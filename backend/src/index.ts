import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dns from 'dns';
import { config } from './config';

// Fix Node 18+ native fetch hanging for 30s trying IPv6 before falling back to IPv4
dns.setDefaultResultOrder('ipv4first');

// ── Route imports ─────────────────────────────────────────────────────
import authRoutes         from './routes/auth';
import signalRoutes       from './routes/signals';
import marketRoutes       from './routes/market';
import journalRoutes      from './routes/journal';
import watchlistRoutes    from './routes/watchlist';
import notificationRoutes from './routes/notifications';
import chatRoutes         from './routes/chat';
import { attachWsServer } from './services/wsServerManager';
import { startPipeline }  from './services/pipelineOrchestrator';

const app = express();

// ── Middleware ────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan(config.NODE_ENV === 'development' ? 'dev' : 'combined'));

// ── Health check ──────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: config.NODE_ENV,
    version: '1.0.0',
  });
});

// ── API Root ──────────────────────────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'AlphaAI API',
    version: '1.0.0',
    description: 'Institutional-grade crypto signal detection engine',
    routes: {
      health:        'GET  /health',
      auth:          'POST /api/auth/sign-in | sign-up | GET /api/auth/me',
      signals:       'GET  /api/signals | /approaching | /active | /:id',
      market:        'GET  /api/market/pulse | /price/:pair | /pairs | /candles/:pair',
      journal:       'GET|POST /api/journal | GET /api/journal/stats | PATCH|DELETE /api/journal/:id',
      watchlist:     'GET|POST /api/watchlist | PATCH|DELETE /api/watchlist/:id',
      notifications: 'GET /api/notifications | PATCH /api/notifications/:id | POST /api/notifications/read-all',
    },
  });
});

// ── Route mounting ────────────────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/signals',       signalRoutes);
app.use('/api/market',        marketRoutes);
app.use('/api/journal',       journalRoutes);
app.use('/api/watchlist',     watchlistRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat',          chatRoutes);

// ── 404 Handler ───────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ── Global Error Handler ──────────────────────────────────────────────
app.use((err: Error & { status?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
  // body-parser / express.json parse failures should be 400, not 500
  if (err instanceof SyntaxError && err.type === 'entity.parse.failed') {
    res.status(400).json({ success: false, error: 'Malformed JSON request body' });
    return;
  }
  if (typeof err.status === 'number' && err.status >= 400 && err.status < 500) {
    res.status(err.status).json({ success: false, error: err.message || 'Bad request' });
    return;
  }
  console.error('💥 Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ── Startup ───────────────────────────────────────────────────────────
const start = () => {
  const server = app.listen(Number(config.PORT), '0.0.0.0', () => {
    let lanIp = 'localhost';
    try {
      const { networkInterfaces } = require('os');
      const nets = networkInterfaces();
      for (const iface of Object.values(nets) as any[]) {
        for (const addr of iface) {
          if (addr.family === 'IPv4' && !addr.internal) { lanIp = addr.address; break; }
        }
        if (lanIp !== 'localhost') break;
      }
    } catch {}

    console.log(`
╔══════════════════════════════════════╗
║       AlphaAI Backend Server         ║
╠══════════════════════════════════════╣
║  Local:  http://localhost:${config.PORT}
║  LAN:    http://${lanIp}:${config.PORT}
║  WS:     ws://${lanIp}:${config.PORT}/ws
╚══════════════════════════════════════╝
    `);
  });

  // Boot WebSocket hub
  attachWsServer(server);

  console.log('🏁 [Startup] Waiting for Redis...');
  // Wait for Redis before starting pipeline
  import('./cache/redisClient').then(m => {
    console.log('🏁 [Startup] Redis module loaded, calling waitForRedis()...');
    return m.waitForRedis();
  }).then(() => {
    console.log('🏁 [Startup] Redis ready, booting pipeline...');
    // Boot 3-stage detection pipeline (non-blocking)
    startPipeline().catch((err) =>
      console.error('💥 [Pipeline] Failed to start:', err)
    );
  }).catch(err => {
    console.error('💥 [Startup] Initialization error:', err);
  });

  // ── Graceful shutdown (releases port on hot-reload, prevents EADDRINUSE) ──
  const shutdown = () => {
    server.close(() => {
      console.log('🛑 Server closed');
      process.exit(0);
    });
    // Force-exit after 2s if connections linger
    setTimeout(() => process.exit(0), 2000);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT',  shutdown);
};

start();
