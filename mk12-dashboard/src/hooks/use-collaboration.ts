"use client";

/**
 * Collaboration hooks for real-time presence, annotations,
 * cursor sync, and segment locking.
 *
 * Connects to ws://host/ws/collab/:projectId
 */

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { getAuthToken } from "@/lib/api-client";

// ─── Types ──────────────────────────────────────────────────────────

export interface CollabUser {
  userId: string;
  clientId: string;
  name: string;
  role: string;
  color: string;
  cursor: {
    segmentId: string | null;
    timestamp: number | null;
  };
  lastSeen: number;
}

export interface SegmentLock {
  segmentId: string;
  userId: string;
  clientId: string;
  lockedAt: number;
  version: number;
}

export interface Annotation {
  id: string;
  text: string;
  timestamp: number;
  segment_id: string;
  project_id: string;
  author_id: string;
  author_name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

interface CollabMessage {
  type: string;
  payload?: unknown;
  timestamp?: number;
}

// ─── Internal WebSocket management ──────────────────────────────────

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const HEARTBEAT_INTERVAL = 10_000;
const RECONNECT_DELAY_BASE = 1000;
const RECONNECT_MAX_DELAY = 30_000;
const MAX_RECONNECT_ATTEMPTS = 10;

type MessageHandler = (message: CollabMessage) => void;

class CollabWebSocket {
  private ws: WebSocket | null = null;
  private projectId: string;
  private handlers = new Set<MessageHandler>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private intentionalClose = false;
  private _isConnected = false;
  private _clientId: string | null = null;
  private connectionListeners = new Set<(connected: boolean) => void>();

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  get clientId(): string | null {
    return this._clientId;
  }

  connect(): void {
    this.intentionalClose = false;
    this.reconnectAttempts = 0;
    this.createConnection();
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
    this._isConnected = false;
    this.notifyConnection(false);
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => { this.handlers.delete(handler); };
  }

  onConnectionChange(listener: (connected: boolean) => void): () => void {
    this.connectionListeners.add(listener);
    return () => { this.connectionListeners.delete(listener); };
  }

  send(type: string, payload?: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type, payload, timestamp: Date.now() }));
  }

  private createConnection(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    const token = getAuthToken();
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
    const url = `${WS_URL}/ws/collab/${this.projectId}${tokenParam}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this._isConnected = true;
      this.notifyConnection(true);
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const message: CollabMessage = JSON.parse(event.data);

        // Capture clientId from presence:state
        if (message.type === "presence:state") {
          const p = message.payload as { clientId?: string };
          if (p?.clientId) this._clientId = p.clientId;
        }

        for (const handler of this.handlers) {
          try { handler(message); } catch { /* swallow handler errors */ }
        }
      } catch {
        // Unparseable message
      }
    };

    this.ws.onclose = (event) => {
      this._isConnected = false;
      this.stopHeartbeat();
      this.notifyConnection(false);
      if (!this.intentionalClose && event.code !== 1000) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose follows
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
    const delay = Math.min(
      RECONNECT_DELAY_BASE * Math.pow(2, this.reconnectAttempts),
      RECONNECT_MAX_DELAY,
    );
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.createConnection(), delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send("heartbeat");
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private notifyConnection(connected: boolean): void {
    for (const listener of this.connectionListeners) {
      listener(connected);
    }
  }
}

// Singleton per project
const collabInstances = new Map<string, { ws: CollabWebSocket; refCount: number }>();

function acquireCollabSocket(projectId: string): CollabWebSocket {
  let entry = collabInstances.get(projectId);
  if (!entry) {
    const ws = new CollabWebSocket(projectId);
    ws.connect();
    entry = { ws, refCount: 0 };
    collabInstances.set(projectId, entry);
  }
  entry.refCount++;
  return entry.ws;
}

function releaseCollabSocket(projectId: string): void {
  const entry = collabInstances.get(projectId);
  if (!entry) return;
  entry.refCount--;
  if (entry.refCount <= 0) {
    entry.ws.disconnect();
    collabInstances.delete(projectId);
  }
}

// ─── usePresence ────────────────────────────────────────────────────

export function usePresence(projectId: string | undefined) {
  const [users, setUsers] = useState<CollabUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [myClientId, setMyClientId] = useState<string | null>(null);
  const wsRef = useRef<CollabWebSocket | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const ws = acquireCollabSocket(projectId);
    wsRef.current = ws;

    const unsubConn = ws.onConnectionChange(setIsConnected);

    const unsubMsg = ws.onMessage((msg) => {
      switch (msg.type) {
        case "presence:state": {
          const p = msg.payload as {
            clientId: string;
            users: CollabUser[];
          };
          setMyClientId(p.clientId);
          setUsers(p.users);
          break;
        }
        case "user:joined": {
          const p = msg.payload as CollabUser;
          setUsers((prev) => {
            // Don't duplicate
            if (prev.some((u) => u.clientId === p.clientId)) return prev;
            return [...prev, {
              userId: p.userId,
              clientId: p.clientId,
              name: p.name,
              role: p.role ?? "viewer",
              color: p.color,
              cursor: { segmentId: null, timestamp: null },
              lastSeen: Date.now(),
            }];
          });
          break;
        }
        case "user:left": {
          const p = msg.payload as { clientId: string };
          setUsers((prev) => prev.filter((u) => u.clientId !== p.clientId));
          break;
        }
        case "cursor:moved": {
          const p = msg.payload as {
            clientId: string;
            segmentId?: string;
            timestamp?: number;
          };
          setUsers((prev) =>
            prev.map((u) =>
              u.clientId === p.clientId
                ? {
                    ...u,
                    cursor: {
                      segmentId: p.segmentId ?? null,
                      timestamp: p.timestamp ?? null,
                    },
                    lastSeen: Date.now(),
                  }
                : u,
            ),
          );
          break;
        }
      }
    });

    return () => {
      unsubConn();
      unsubMsg();
      wsRef.current = null;
      releaseCollabSocket(projectId);
      setUsers([]);
      setIsConnected(false);
    };
  }, [projectId]);

  const identify = useCallback(
    (userId: string, name: string, role: string) => {
      wsRef.current?.send("identify", { userId, name, role });
    },
    [],
  );

  return { users, isConnected, myClientId, identify };
}

// ─── useCursorSync ──────────────────────────────────────────────────

export function useCursorSync(projectId: string | undefined) {
  const [cursors, setCursors] = useState<Map<string, { segmentId: string | null; timestamp: number | null; color: string; name: string }>>(new Map());
  const wsRef = useRef<CollabWebSocket | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const ws = acquireCollabSocket(projectId);
    wsRef.current = ws;

    const unsubMsg = ws.onMessage((msg) => {
      if (msg.type === "cursor:moved") {
        const p = msg.payload as {
          clientId: string;
          segmentId?: string;
          timestamp?: number;
          color?: string;
          name?: string;
        };
        setCursors((prev) => {
          const next = new Map(prev);
          next.set(p.clientId, {
            segmentId: p.segmentId ?? null,
            timestamp: p.timestamp ?? null,
            color: p.color ?? "#888",
            name: p.name ?? "Unknown",
          });
          return next;
        });
      }
    });

    return () => {
      unsubMsg();
      wsRef.current = null;
      releaseCollabSocket(projectId);
      setCursors(new Map());
    };
  }, [projectId]);

  const moveCursor = useCallback(
    (segmentId: string | null, timestamp: number | null) => {
      wsRef.current?.send("cursor:move", { segmentId, timestamp });
    },
    [],
  );

  return { cursors, moveCursor };
}

// ─── useAnnotations ─────────────────────────────────────────────────

export function useAnnotations(projectId: string | undefined) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const wsRef = useRef<CollabWebSocket | null>(null);

  // Fetch initial annotations via REST
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setIsLoading(true);

    const headers: Record<string, string> = {};
    const token = getAuthToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch(`${API_URL}/api/projects/${projectId}/annotations`, { headers })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setAnnotations(data.annotations ?? []);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [projectId]);

  // Listen for real-time updates via collab WebSocket
  useEffect(() => {
    if (!projectId) return;

    const ws = acquireCollabSocket(projectId);
    wsRef.current = ws;

    const unsubMsg = ws.onMessage((msg) => {
      switch (msg.type) {
        case "annotation:created": {
          const a = msg.payload as Annotation;
          setAnnotations((prev) => {
            if (prev.some((x) => x.id === a.id)) return prev;
            return [...prev, a].sort((x, y) => x.timestamp - y.timestamp);
          });
          break;
        }
        case "annotation:updated": {
          const a = msg.payload as Annotation;
          setAnnotations((prev) =>
            prev.map((x) => (x.id === a.id ? a : x)),
          );
          break;
        }
        case "annotation:deleted": {
          const p = msg.payload as { id: string };
          setAnnotations((prev) => prev.filter((x) => x.id !== p.id));
          break;
        }
      }
    });

    return () => {
      unsubMsg();
      wsRef.current = null;
      releaseCollabSocket(projectId);
    };
  }, [projectId]);

  const createAnnotation = useCallback(
    async (input: {
      text: string;
      timestamp: number;
      segment_id: string;
      author_id: string;
      author_name: string;
      color?: string;
    }) => {
      if (!projectId) return null;
      const clientId = wsRef.current?.clientId;
      const authToken = getAuthToken();
      const res = await fetch(`${API_URL}/api/projects/${projectId}/annotations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {}),
          ...(clientId ? { "X-Collab-Client-Id": clientId } : {}),
        },
        body: JSON.stringify(input),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const annotation = data.annotation as Annotation;

      // Optimistic update
      setAnnotations((prev) => {
        if (prev.some((x) => x.id === annotation.id)) return prev;
        return [...prev, annotation].sort((x, y) => x.timestamp - y.timestamp);
      });

      return annotation;
    },
    [projectId],
  );

  const updateAnnotation = useCallback(
    async (annotationId: string, input: { text?: string; timestamp?: number }) => {
      if (!projectId) return null;
      const clientId = wsRef.current?.clientId;
      const authToken = getAuthToken();
      const res = await fetch(
        `${API_URL}/api/projects/${projectId}/annotations/${annotationId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {}),
            ...(clientId ? { "X-Collab-Client-Id": clientId } : {}),
          },
          body: JSON.stringify(input),
        },
      );
      if (!res.ok) return null;
      const data = await res.json();
      const annotation = data.annotation as Annotation;

      setAnnotations((prev) =>
        prev.map((x) => (x.id === annotation.id ? annotation : x)),
      );
      return annotation;
    },
    [projectId],
  );

  const deleteAnnotation = useCallback(
    async (annotationId: string) => {
      if (!projectId) return false;
      const clientId = wsRef.current?.clientId;
      const authToken = getAuthToken();
      const res = await fetch(
        `${API_URL}/api/projects/${projectId}/annotations/${annotationId}`,
        {
          method: "DELETE",
          headers: {
            ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {}),
            ...(clientId ? { "X-Collab-Client-Id": clientId } : {}),
          },
        },
      );
      if (!res.ok) return false;

      setAnnotations((prev) => prev.filter((x) => x.id !== annotationId));
      return true;
    },
    [projectId],
  );

  return {
    annotations,
    isLoading,
    createAnnotation,
    updateAnnotation,
    deleteAnnotation,
  };
}

// ─── useSegmentLock ─────────────────────────────────────────────────

export function useSegmentLock(projectId: string | undefined) {
  const [locks, setLocks] = useState<Map<string, SegmentLock>>(new Map());
  const wsRef = useRef<CollabWebSocket | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const ws = acquireCollabSocket(projectId);
    wsRef.current = ws;

    const unsubMsg = ws.onMessage((msg) => {
      switch (msg.type) {
        case "presence:state": {
          const p = msg.payload as { locks?: SegmentLock[] };
          if (p.locks) {
            const lockMap = new Map<string, SegmentLock>();
            for (const lock of p.locks) {
              lockMap.set(lock.segmentId, lock);
            }
            setLocks(lockMap);
          }
          break;
        }
        case "segment:locked": {
          const lock = msg.payload as SegmentLock;
          setLocks((prev) => {
            const next = new Map(prev);
            next.set(lock.segmentId, lock);
            return next;
          });
          break;
        }
        case "segment:unlocked": {
          const p = msg.payload as { segmentId: string };
          setLocks((prev) => {
            const next = new Map(prev);
            next.delete(p.segmentId);
            return next;
          });
          break;
        }
      }
    });

    return () => {
      unsubMsg();
      wsRef.current = null;
      releaseCollabSocket(projectId);
      setLocks(new Map());
    };
  }, [projectId]);

  const lockSegment = useCallback(
    (segmentId: string) => {
      wsRef.current?.send("segment:lock", { segmentId });
    },
    [],
  );

  const unlockSegment = useCallback(
    (segmentId: string) => {
      wsRef.current?.send("segment:unlock", { segmentId });
    },
    [],
  );

  const isLockedByOther = useCallback(
    (segmentId: string): boolean => {
      const lock = locks.get(segmentId);
      if (!lock) return false;
      return lock.clientId !== wsRef.current?.clientId;
    },
    [locks],
  );

  const getLock = useCallback(
    (segmentId: string): SegmentLock | undefined => {
      return locks.get(segmentId);
    },
    [locks],
  );

  return { locks, lockSegment, unlockSegment, isLockedByOther, getLock };
}
