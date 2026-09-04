"""
PayTrace Phase 9: Live Monitoring Engine.

Provides lightweight, process-local live event distribution using Server-Sent Events (SSE).

CRITICAL INVARIANTS:
1. LIVE != AUTONOMOUS:
   Live monitoring is strictly an observation/notification layer.
   It may observe, correlate, notify, indicate new evidence, and report updates.
   It must NEVER autonomously capture, refund, transfer, modify payment state,
   or execute arbitrary external actions.

2. SENSITIVE DATA BOUNDARY:
   Never broadcast PAN, CVV, API keys, webhook secrets, authorization tokens,
   passwords, or unmasked sensitive payment payloads.
   All payloads pass through strict sanitization before publishing.

3. PROCESS-LOCAL BOUNDED BUFFER:
   In-memory event buffer is strictly bounded (default 1000 events) with
   monotonic sequence cursors. It is not distributed and does not claim
   distributed durability.
"""

import asyncio
import collections
import datetime
import json
import logging
import re
import threading
from dataclasses import dataclass, asdict
from typing import Any, AsyncGenerator, Dict, List, Optional, Set

logger = logging.getLogger("paytrace.live")

# Supported live event types
SUPPORTED_LIVE_EVENTS = {
    "webhook.received",
    "webhook.untrusted",
    "incident.created",
    "incident.updated",
    "investigation.completed",
}

# Sensitive key patterns to redact
SENSITIVE_KEY_PATTERNS = re.compile(
    r"(secret|password|token|api_?key|auth|signature|pan|cvv|card_?number|raw_payload)",
    re.IGNORECASE,
)

# Card PAN regex (13-19 digits, possibly hyphenated/spaced)
CARD_PAN_PATTERN = re.compile(r"\b(?:\d[ -]*?){13,19}\b")
CVV_PATTERN = re.compile(r"\b\d{3,4}\b")


def sanitize_live_metadata(data: Any) -> Any:
    """
    Recursively sanitize live event metadata to ensure no sensitive credentials,
    PANs, CVVs, or unmasked secrets are broadcast over live channels.
    """
    if isinstance(data, dict):
        sanitized = {}
        for k, v in data.items():
            if SENSITIVE_KEY_PATTERNS.search(str(k)):
                sanitized[k] = "[REDACTED]"
            else:
                sanitized[k] = sanitize_live_metadata(v)
        return sanitized
    elif isinstance(data, list):
        return [sanitize_live_metadata(item) for item in data]
    elif isinstance(data, str):
        # Redact credit card numbers if present in strings
        if len(data) > 12 and CARD_PAN_PATTERN.search(data):
            # Check if digits count is 13-19
            digits_only = re.sub(r"\D", "", data)
            if 13 <= len(digits_only) <= 19:
                return "[REDACTED_PAN]"
        return data
    return data


@dataclass
class LiveEvent:
    id: int
    event_type: str
    data: Dict[str, Any]
    timestamp: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "event_type": self.event_type,
            "data": self.data,
            "timestamp": self.timestamp,
        }

    def to_sse(self) -> str:
        """Format as standard Server-Sent Event frame."""
        payload = json.dumps(self.to_dict())
        return f"id: {self.id}\nevent: {self.event_type}\ndata: {payload}\n\n"


class LiveEventStream:
    """
    Thread-safe, process-local bounded event stream with monotonic cursors
    and SSE subscriber broadcasting.
    """

    def __init__(self, max_buffer_size: int = 1000):
        self.max_buffer_size = max_buffer_size
        self._buffer: collections.deque = collections.deque(maxlen=max_buffer_size)
        self._cursor: int = 0
        self._lock = threading.Lock()
        self._subscribers: Set[asyncio.Queue] = set()
        self._start_time = datetime.datetime.now(datetime.timezone.utc)

    @property
    def current_cursor(self) -> int:
        with self._lock:
            return self._cursor

    def publish_event(self, event_type: str, data: Dict[str, Any]) -> LiveEvent:
        """
        Sanitize and publish a live event.
        Monotonically assigns sequence ID and adds to bounded buffer.
        Dispatches non-blocking copies to active subscriber queues.
        """
        sanitized_data = sanitize_live_metadata(data)
        now_utc = datetime.datetime.now(datetime.timezone.utc).isoformat()

        with self._lock:
            self._cursor += 1
            event = LiveEvent(
                id=self._cursor,
                event_type=event_type,
                data=sanitized_data,
                timestamp=now_utc,
            )
            self._buffer.append(event)

            # Broadcast to active asyncio subscriber queues
            dead_subscribers = set()
            for q in list(self._subscribers):
                try:
                    q.put_nowait(event)
                except asyncio.QueueFull:
                    logger.warning("Subscriber queue full; dropping live event %d", event.id)
                except Exception:
                    dead_subscribers.add(q)
            self._subscribers.difference_update(dead_subscribers)

        return event

    def get_recent(
        self, since_id: Optional[int] = None, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Retrieve buffered events since a given cursor ID for polling fallback
        or reconnection replay.
        """
        with self._lock:
            events = list(self._buffer)

        if since_id is not None:
            filtered = [e for e in events if e.id > since_id]
        else:
            filtered = events

        # Return latest up to limit
        return [e.to_dict() for e in filtered[-limit:]]

    async def subscribe(
        self, last_event_id: Optional[int] = None, ping_interval: float = 15.0
    ) -> AsyncGenerator[str, None]:
        """
        Subscribe to live SSE stream.
        1. If last_event_id is provided, replays missed events from bounded buffer.
        2. Streams new events as published.
        3. Sends keepalive ping comments (: ping\\n\\n) at regular intervals.
        """
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        with self._lock:
            self._subscribers.add(queue)

        try:
            # 1. Replay missed events from buffer if requested
            if last_event_id is not None:
                missed = self.get_recent(since_id=last_event_id, limit=self.max_buffer_size)
                for item in missed:
                    event_id = item["id"]
                    event_type = item["event_type"]
                    payload = json.dumps(item)
                    yield f"id: {event_id}\nevent: {event_type}\ndata: {payload}\n\n"

            # 2. Main event loop with keepalive pings
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=ping_interval)
                    yield event.to_sse()
                except asyncio.TimeoutError:
                    # Send standard SSE keepalive comment
                    yield ": ping\n\n"
        finally:
            with self._lock:
                self._subscribers.discard(queue)

    def get_status(self) -> Dict[str, Any]:
        """Return diagnostic status of the live monitoring stream."""
        with self._lock:
            buf_len = len(self._buffer)
            cur = self._cursor
            sub_count = len(self._subscribers)

        return {
            "service": "paytrace-live-monitoring",
            "status": "active",
            "transport": "Server-Sent Events (SSE) with polling fallback",
            "process_local": True,
            "durable": False,
            "total_events_published": cur,
            "buffer_size": buf_len,
            "buffer_capacity": self.max_buffer_size,
            "current_cursor": cur,
            "active_subscribers": sub_count,
            "started_at": self._start_time.isoformat(),
            "supported_events": sorted(list(SUPPORTED_LIVE_EVENTS)),
            "safety_invariant": "LIVE != AUTONOMOUS (Observation & Notification Only)",
        }

    def clear(self) -> None:
        """Reset buffer and cursor (primarily for test isolation)."""
        with self._lock:
            self._buffer.clear()
            self._cursor = 0
            self._subscribers.clear()


# Global process-local singleton
live_event_stream = LiveEventStream(max_buffer_size=1000)
