/**
 * AlphaAI Frontend — WebSocket Manager
 * Client-side WebSocket connection to the AlphaAI backend.
 * Receives real-time price ticks, signal alerts, and scan updates.
 * Feeds live data directly into Zustand stores.
 */

type WsEventType =
  | 'price_tick'
  | 'signal_approaching'
  | 'signal_active'
  | 'signal_tp_hit'
  | 'signal_stopped'
  | 'scan_complete'
  | 'system';

interface WsEvent<T = unknown> {
  type: WsEventType;
  timestamp: number;
  data: T;
}

type EventHandler<T = unknown> = (data: T) => void;

class AlphaAIWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectDelay = 3000;
  private maxRetries = 10;
  private retries = 0;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private handlers: Map<WsEventType, EventHandler[]> = new Map();
  private subscribedPairs: string[] = [];
  private userId: string | null = null;
  private isConnected = false;

  constructor(url: string) {
    this.url = url;
  }

  /** Connect to the backend WebSocket server. */
  connect(userId?: string): void {
    if (this.isConnected) return;
    this.userId = userId ?? null;
    this._open();
  }

  private _open(): void {
    try {
      this.ws = new WebSocket(this.url + '/ws');

      this.ws.onopen = () => {
        console.log('🔌 [WS Client] Connected');
        this.isConnected = true;
        this.retries = 0;

        // Authenticate and re-subscribe
        if (this.userId) {
          this._send({ action: 'auth', userId: this.userId });
        }
        if (this.subscribedPairs.length > 0) {
          this._send({ action: 'subscribe', pairs: this.subscribedPairs });
        }

        // Start ping to keep connection alive
        this.pingInterval = setInterval(() => {
          this._send({ action: 'ping' });
        }, 15_000);
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string) as WsEvent;
          const handlers = this.handlers.get(msg.type) ?? [];
          handlers.forEach((h) => h(msg.data));
        } catch { /* ignore malformed events */ }
      };

      this.ws.onclose = () => {
        console.log('🔌 [WS Client] Disconnected');
        this.isConnected = false;
        this._clearPing();
        this._scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('[WS Client] Error:', err);
      };
    } catch (err) {
      console.warn('[WS Client] Failed to open:', err);
      this._scheduleReconnect();
    }
  }

  private _scheduleReconnect(): void {
    if (this.retries >= this.maxRetries) {
      console.warn('[WS Client] Max reconnect attempts reached');
      return;
    }
    this.retries++;
    const delay = this.reconnectDelay * Math.min(this.retries, 4); // exponential cap
    console.log(`[WS Client] Reconnecting in ${delay}ms (attempt ${this.retries})`);
    setTimeout(() => this._open(), delay);
  }

  private _clearPing(): void {
    if (this.pingInterval) { clearInterval(this.pingInterval); this.pingInterval = null; }
  }

  private _send(payload: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  /** Subscribe to real-time updates for specific pairs. */
  subscribe(pairs: string[]): void {
    this.subscribedPairs = [...new Set([...this.subscribedPairs, ...pairs])];
    this._send({ action: 'subscribe', pairs });
  }

  /** Unsubscribe from a pair's feed. */
  unsubscribe(pairs: string[]): void {
    this.subscribedPairs = this.subscribedPairs.filter((p) => !pairs.includes(p));
    this._send({ action: 'unsubscribe', pairs });
  }

  /** Register a handler for a specific event type. */
  on<T>(event: WsEventType, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event)!.push(handler as EventHandler);
    // Return unsubscribe function
    return () => {
      const list = this.handlers.get(event) ?? [];
      const idx = list.indexOf(handler as EventHandler);
      if (idx !== -1) list.splice(idx, 1);
    };
  }

  /** Disconnect cleanly. */
  disconnect(): void {
    this._clearPing();
    this.ws?.close();
    this.isConnected = false;
    this.retries = this.maxRetries; // prevent reconnect
  }

  get connected(): boolean { return this.isConnected; }
}

// Singleton instance
import { WS } from '@/src/constants/api';
export const wsManager = new AlphaAIWebSocket(WS.URL);
