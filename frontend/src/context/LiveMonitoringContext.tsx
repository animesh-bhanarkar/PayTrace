import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { getLiveEventsUrl, fetchRecentLiveEvents, type LiveEventItem } from "../api/client";

export type ConnectionStatus = "LIVE" | "RECONNECTING" | "OFFLINE";

interface LiveMonitoringContextType {
  connectionStatus: ConnectionStatus;
  lastEvent: LiveEventItem | null;
  recentEvents: LiveEventItem[];
  unreadCount: number;
  resetUnreadCount: () => void;
  reconnect: () => void;
  subscribeToEvents: (callback: (event: LiveEventItem) => void) => () => void;
}

const LiveMonitoringContext = createContext<LiveMonitoringContextType | undefined>(undefined);

export const LiveMonitoringProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("OFFLINE");
  const [lastEvent, setLastEvent] = useState<LiveEventItem | null>(null);
  const [recentEvents, setRecentEvents] = useState<LiveEventItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const cursorRef = useRef<number>(0);
  const backoffRef = useRef<number>(1000);
  const subscribersRef = useRef<Set<(event: LiveEventItem) => void>>(new Set());

  const resetUnreadCount = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const subscribeToEvents = useCallback((callback: (event: LiveEventItem) => void) => {
    subscribersRef.current.add(callback);
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  const handleIncomingEvent = useCallback((item: LiveEventItem, isInitial = false) => {
    if (item.id && item.id > cursorRef.current) {
      cursorRef.current = item.id;
    }
    setLastEvent(item);
    setRecentEvents((prev) => {
      // Deduplicate by ID
      if (prev.some((e) => e.id === item.id)) return prev;
      return [item, ...prev.slice(0, 49)];
    });
    if (!isInitial) {
      setUnreadCount((c) => c + 1);
    }

    // Notify registered subscribers
    subscribersRef.current.forEach((cb) => {
      try {
        cb(item);
      } catch (err) {
        console.error("Live event subscriber error:", err);
      }
    });
  }, []);

  // Fetch initial batch of recent events on mount
  useEffect(() => {
    let isMounted = true;
    fetchRecentLiveEvents(0, 20)
      .then((res) => {
        if (isMounted && res.events && res.events.length > 0) {
          const events = res.events;
          setRecentEvents(events);
          if (events[0]?.id) {
            cursorRef.current = Math.max(cursorRef.current, events[0].id);
          }
          // Set unread count to recent items count up to 3
          setUnreadCount(Math.min(events.length, 3));
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setConnectionStatus("RECONNECTING");

    try {
      const url = getLiveEventsUrl(cursorRef.current > 0 ? cursorRef.current : undefined);
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        setConnectionStatus("LIVE");
        backoffRef.current = 1000; // reset exponential backoff
      };

      const eventTypes = [
        "webhook.received",
        "webhook.untrusted",
        "incident.created",
        "incident.updated",
        "investigation.completed",
      ];

      eventTypes.forEach((eventType) => {
        es.addEventListener(eventType, (e: MessageEvent) => {
          try {
            const parsed = JSON.parse(e.data);
            handleIncomingEvent(parsed);
          } catch (err) {
            console.warn("Failed to parse live event data:", err);
          }
        });
      });

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
        setConnectionStatus("RECONNECTING");

        // Polling fallback while disconnected
        fetchRecentLiveEvents(cursorRef.current, 10)
          .then((res) => {
            if (res.events && res.events.length > 0) {
              res.events.forEach((ev) => handleIncomingEvent(ev));
            }
          })
          .catch(() => {});

        // Exponential backoff reconnect
        const delay = Math.min(backoffRef.current, 30000);
        backoffRef.current = Math.min(backoffRef.current * 1.5, 30000);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };
    } catch (err) {
      console.warn("EventSource setup failed, falling back to offline/polling:", err);
      setConnectionStatus("OFFLINE");
    }
  }, [handleIncomingEvent]);

  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    backoffRef.current = 1000;
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return (
    <LiveMonitoringContext.Provider
      value={{
        connectionStatus,
        lastEvent,
        recentEvents,
        unreadCount,
        resetUnreadCount,
        reconnect,
        subscribeToEvents,
      }}
    >
      {children}
    </LiveMonitoringContext.Provider>
  );
};

export const useLiveMonitoring = () => {
  const context = useContext(LiveMonitoringContext);
  if (!context) {
    throw new Error("useLiveMonitoring must be used within a LiveMonitoringProvider");
  }
  return context;
};
