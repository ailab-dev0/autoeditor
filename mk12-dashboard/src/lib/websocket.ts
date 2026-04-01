import type {
  WebSocketMessage,
  WebSocketMessageType,
  SegmentUpdatePayload,
  ApprovalSyncPayload,
  PipelineStatus,
} from "./types";
import { getAuthToken } from "./api-client";

type MessageHandler<T = unknown> = (payload: T, message: WebSocketMessage<T>) => void;

export type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

interface WebSocketClientOptions {
  url?: string;
  maxReconnectAttempts?: number;
  initialReconnectDelay?: number;
  maxReconnectDelay?: number;
}

const DEFAULT_OPTIONS: Required<WebSocketClientOptions> = {
  url: process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000",
  maxReconnectAttempts: 10,
  initialReconnectDelay: 1000,
  maxReconnectDelay: 30000,
};

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private projectId: string | null = null;
  private options: Required<WebSocketClientOptions>;
  private handlers = new Map<WebSocketMessageType, Set<MessageHandler<unknown>>>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private connectionStateListeners = new Set<(state: ConnectionState) => void>();
  private _connectionState: ConnectionState = "disconnected";

  constructor(options?: WebSocketClientOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  get connectionState(): ConnectionState {
    return this._connectionState;
  }

  get isConnected(): boolean {
    return this._connectionState === "connected";
  }

  connect(projectId: string): void {
    this.intentionalClose = false;
    this.projectId = projectId;
    this.reconnectAttempts = 0;
    this.createConnection();
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.projectId = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
    this.setConnectionState("disconnected");
  }

  on<T = unknown>(type: WebSocketMessageType, handler: MessageHandler<T>): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    const handlers = this.handlers.get(type)!;
    const wrappedHandler = handler as MessageHandler<unknown>;
    handlers.add(wrappedHandler);

    return () => {
      handlers.delete(wrappedHandler);
      if (handlers.size === 0) {
        this.handlers.delete(type);
      }
    };
  }

  onSegmentUpdate(handler: MessageHandler<SegmentUpdatePayload>): () => void {
    return this.on("segment_update", handler);
  }

  onPipelineStatus(handler: MessageHandler<PipelineStatus>): () => void {
    return this.on("pipeline_status", handler);
  }

  onApprovalSync(handler: MessageHandler<ApprovalSyncPayload>): () => void {
    return this.on("approval_sync", handler);
  }

  onConnectionStateChange(listener: (state: ConnectionState) => void): () => void {
    this.connectionStateListeners.add(listener);
    return () => {
      this.connectionStateListeners.delete(listener);
    };
  }

  send(type: WebSocketMessageType, payload: unknown): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("[WS] Cannot send: not connected");
      return;
    }
    const message: WebSocketMessage = {
      type,
      projectId: this.projectId ?? "",
      payload,
      timestamp: new Date().toISOString(),
    };
    this.ws.send(JSON.stringify(message));
  }

  // ─── Private ─────────────────────────────────────────────────────────

  private setConnectionState(state: ConnectionState): void {
    this._connectionState = state;
    for (const listener of this.connectionStateListeners) {
      listener(state);
    }
  }

  private createConnection(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setConnectionState("connecting");

    const token = getAuthToken();
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : "";
    const url = `${this.options.url}/ws/dashboard/${this.projectId}${tokenParam}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setConnectionState("connected");
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.dispatchMessage(message);
      } catch {
        console.error("[WS] Failed to parse message:", event.data);
      }
    };

    this.ws.onclose = (event) => {
      if (this.intentionalClose || event.code === 1000) {
        this.setConnectionState("disconnected");
      } else {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose will follow, which handles reconnection
    };
  }

  private dispatchMessage(message: WebSocketMessage): void {
    const handlers = this.handlers.get(message.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(message.payload, message);
        } catch (err) {
          console.error(`[WS] Handler error for ${message.type}:`, err);
        }
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error("[WS] Max reconnect attempts reached");
      this.setConnectionState("error");
      return;
    }

    this.setConnectionState("connecting");

    const delay = Math.min(
      this.options.initialReconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.options.maxReconnectDelay,
    );

    this.reconnectAttempts++;
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.createConnection();
    }, delay);
  }
}

// Singleton instance
let clientInstance: WebSocketClient | null = null;

export function getWebSocketClient(options?: WebSocketClientOptions): WebSocketClient {
  if (!clientInstance) {
    clientInstance = new WebSocketClient(options);
  }
  return clientInstance;
}

export default WebSocketClient;
