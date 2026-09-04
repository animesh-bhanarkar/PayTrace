"""
PayTrace Phase 9: Live Monitoring Router.

Endpoints:
  GET /live/events: Server-Sent Events (SSE) live stream
  GET /live/recent: Polling fallback for recent events from bounded buffer
  GET /live/status: Stream diagnostics, status, and safety invariant declaration
"""

import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Header, Query, Request
from fastapi.responses import StreamingResponse

from app.live_monitoring import live_event_stream

logger = logging.getLogger("paytrace.routers.live")

router = APIRouter(prefix="/live", tags=["live-monitoring"])


@router.get("/events")
async def live_events_sse(
    request: Request,
    last_event_id: Optional[str] = Header(None, alias="Last-Event-ID"),
    cursor: Optional[int] = Query(None, description="Optional cursor query param fallback for reconnect"),
):
    """
    Live Event Stream using Server-Sent Events (SSE).
    Replays missed events if Last-Event-ID header or cursor parameter is provided.
    Sends keepalive pings every 15s to keep connections alive through proxies.
    """
    reconnect_cursor: Optional[int] = None
    if last_event_id:
        try:
            reconnect_cursor = int(last_event_id)
        except (ValueError, TypeError):
            pass

    if reconnect_cursor is None and cursor is not None:
        reconnect_cursor = cursor

    async def event_generator():
        try:
            async for sse_chunk in live_event_stream.subscribe(last_event_id=reconnect_cursor):
                if await request.is_disconnected():
                    break
                yield sse_chunk
        except Exception as e:
            logger.info("SSE client disconnected or closed: %s", e)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/recent")
def get_recent_live_events(
    cursor: Optional[int] = Query(None, description="Return events strictly after this cursor ID"),
    limit: int = Query(50, ge=1, le=200, description="Max number of events to return"),
) -> Dict[str, Any]:
    """
    Polling fallback: Retrieve recent events from the process-local bounded buffer.
    """
    events = live_event_stream.get_recent(since_id=cursor, limit=limit)
    return {
        "count": len(events),
        "current_cursor": live_event_stream.current_cursor,
        "events": events,
    }


@router.get("/status")
def get_live_status() -> Dict[str, Any]:
    """
    Retrieve live monitoring stream diagnostic status.
    Declares process-local memory bounds and LIVE != AUTONOMOUS invariant.
    """
    return live_event_stream.get_status()
