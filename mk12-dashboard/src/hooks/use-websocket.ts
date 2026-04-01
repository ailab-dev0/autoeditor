"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  getWebSocketClient,
  type WebSocketClient,
  type ConnectionState,
} from "@/lib/websocket";
import type { WebSocketMessageType } from "@/lib/types";

/**
 * Owns the WebSocket connection lifecycle. Call this ONCE from the
 * project layout — it connects on mount and disconnects on unmount.
 * All other hooks should use `useWebSocketSubscribe()` instead.
 */
export function useWebSocket(projectId: string | undefined) {
  const clientRef = useRef<WebSocketClient | null>(null);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");

  useEffect(() => {
    if (!projectId) return;

    const client = getWebSocketClient();
    clientRef.current = client;

    const unsub = client.onConnectionStateChange(setConnectionState);
    client.connect(projectId);

    return () => {
      unsub();
      client.disconnect();
      clientRef.current = null;
      setConnectionState("disconnected");
    };
  }, [projectId]);

  const send = useCallback(
    (type: WebSocketMessageType, payload: unknown): void => {
      clientRef.current?.send(type, payload);
    },
    [],
  );

  return {
    connectionState,
    isConnected: connectionState === "connected",
    send,
  };
}

/**
 * Subscribe to WebSocket events without owning the connection.
 * Safe to call from any component that renders inside a project layout
 * where `useWebSocket(projectId)` is active.
 */
export function useWebSocketSubscribe() {
  const clientRef = useRef<WebSocketClient | null>(null);

  // Grab the singleton client once (it's already connected by the layout)
  if (!clientRef.current && typeof window !== "undefined") {
    clientRef.current = getWebSocketClient();
  }

  const subscribe = useCallback(
    <T = unknown>(
      type: WebSocketMessageType,
      handler: (payload: T) => void,
    ): (() => void) => {
      const client = clientRef.current;
      if (!client) return () => {};
      return client.on(type, handler as (payload: unknown) => void);
    },
    [],
  );

  return { subscribe };
}
