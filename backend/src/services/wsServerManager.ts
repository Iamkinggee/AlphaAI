/**
 * AlphaAI Backend — WebSocket Manager
 * Server-side WebSocket hub for pushing real-time updates to connected clients.
 * Events: price_tick, signal_approaching, signal_active, signal_tp_hit, scan_complete
 */
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

export type WsEventType =
  | 'price_tick'
  | 'signal_approaching'
  | 'signal_active'
  | 'signal_tp_hit'
  | 'signal_stopped'
  | 'scan_complete'
  | 'system';

export interface WsEvent<T = unknown> {
  type: WsEventType;
  timestamp: number;
  data: T;
}

type Client = { ws: WebSocket; userId?: string; subscribedPairs: Set<string> };

let wss: WebSocketServer | null = null;
const clients: Set<Client> = new Set();

/**
 * Attach the WebSocket server to the existing HTTP server.
 * Call once after Express app.listen().
 */
export function attachWsServer(server: Server): void {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const client: Client = { ws, subscribedPairs: new Set() };
    clients.add(client);
    console.log(`🔌 [WS] Client connected — total: ${clients.size}`);

    // Send a welcome frame
    sendToClient(client, { type: 'system', timestamp: Date.now(), data: { message: 'AlphaAI WS connected' } });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { action: string; pairs?: string[]; userId?: string };
        if (msg.action === 'subscribe' && Array.isArray(msg.pairs)) {
          msg.pairs.forEach((p) => client.subscribedPairs.add(p));
          console.log(`[WS] Client subscribed to: ${msg.pairs.join(', ')}`);
        }
        if (msg.action === 'unsubscribe' && Array.isArray(msg.pairs)) {
          msg.pairs.forEach((p) => client.subscribedPairs.delete(p));
        }
        if (msg.userId) {
          client.userId = msg.userId;
        }
      } catch { /* ignore malformed frames */ }
    });

    ws.on('close', () => {
      clients.delete(client);
      console.log(`🔌 [WS] Client disconnected — total: ${clients.size}`);
    });

    ws.on('error', (err) => console.error('[WS] Client error:', err.message));
  });

  console.log('🔌 [WS] WebSocket server ready at /ws');
}

// ── Broadcast helpers ─────────────────────────────────────────────────

/** Broadcast to all connected clients subscribed to a specific pair. */
export function broadcastToPair(pair: string, event: WsEvent): void {
  for (const client of clients) {
    if (client.subscribedPairs.has(pair) || client.subscribedPairs.has('*')) {
      sendToClient(client, event);
    }
  }
}

/** Broadcast to all connected clients. */
export function broadcastAll(event: WsEvent): void {
  for (const client of clients) {
    sendToClient(client, event);
  }
}

/** Broadcast a price tick to subscribers. */
export function broadcastPriceTick(pair: string, price: number, change24h: number): void {
  broadcastToPair(pair, {
    type: 'price_tick',
    timestamp: Date.now(),
    data: { pair, price, change24h },
  });
}

/** Broadcast a new approaching signal. */
export function broadcastApproaching(signal: Record<string, unknown>): void {
  broadcastAll({
    type: 'signal_approaching',
    timestamp: Date.now(),
    data: signal,
  });
}

/** Broadcast an activated signal. */
export function broadcastActivated(signal: Record<string, unknown>): void {
  broadcastAll({
    type: 'signal_active',
    timestamp: Date.now(),
    data: signal,
  });
}

function sendToClient(client: Client, event: WsEvent): void {
  if (client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(event));
  }
}

export function getConnectedCount(): number {
  return clients.size;
}
