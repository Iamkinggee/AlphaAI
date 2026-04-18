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
  | 'setup_detected'
  | 'scan_complete'
  | 'universe_update'
  | 'system';

export interface WsEvent<T = unknown> {
  type: WsEventType;
  timestamp: number;
  data: T;
}

type Client = { 
  ws: WebSocket; 
  userId?: string; 
  subscribedPairs: Set<string>;
  isAlive: boolean;
};

let wss: WebSocketServer | null = null;
const clients: Set<Client> = new Set();
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Attach the WebSocket server to the existing HTTP server.
 * Call once after Express app.listen().
 */
export function attachWsServer(server: Server): void {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const client: Client = { ws, subscribedPairs: new Set(), isAlive: true };
    clients.add(client);
    console.log(`🔌 [WS] Client connected — total: ${clients.size}`);

    // Heartbeat: Setup pong listener
    ws.on('pong', () => {
      client.isAlive = true;
    });

    // Send a welcome frame
    sendToClient(client, { type: 'system', timestamp: Date.now(), data: { message: 'AlphaAI WS connected' } });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { action: string; pairs?: string[]; userId?: string };
        
        // Handle explicit ping action from frontend if needed (as fallback to frame-level pong)
        if (msg.action === 'ping') {
          client.isAlive = true;
          return;
        }

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

  // Start heartbeat interval
  heartbeatInterval = setInterval(() => {
    for (const client of clients) {
      if (client.isAlive === false) {
        console.log('🔌 [WS] Terminating zombie connection');
        client.ws.terminate();
        clients.delete(client);
        continue;
      }
      client.isAlive = false;
      client.ws.ping();
    }
  }, 30_000);

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
    data: { ...signal, created_at: new Date().toISOString() },
  });
}

/** Broadcast an activated signal. */
export function broadcastActivated(signal: Record<string, unknown>): void {
  broadcastAll({
    type: 'signal_active',
    timestamp: Date.now(),
    data: { ...signal, created_at: new Date().toISOString() },
  });
}

/** Broadcast a newly created high-probability structural setup. */
export function broadcastSetupDetected(data: Record<string, unknown>): void {
  broadcastAll({
    type: 'setup_detected',
    timestamp: Date.now(),
    data: { ...data, created_at: new Date().toISOString() },
  });
}

function sendToClient(client: Client, event: WsEvent): void {
  try {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(event));
    } else if (client.ws.readyState === WebSocket.CLOSED || client.ws.readyState === WebSocket.CLOSING) {
      clients.delete(client);
    }
  } catch (err) {
    console.error('[WS] Send failed, removing client:', (err as Error).message);
    clients.delete(client);
  }
}

export function getConnectedCount(): number {
  return clients.size;
}
