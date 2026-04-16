import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';

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
app.use((err: Error, _req: Request, res: Response) => {
  console.error('💥 Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ── Startup ───────────────────────────────────────────────────────────
const start = () => {
  const server = app.listen(config.PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
║       AlphaAI Backend Server         ║
╠══════════════════════════════════════╣
║  Port:  ${config.PORT}                              
║  Env:   ${config.NODE_ENV}                       
║  Routes: /api/auth | signals | market
║          journal | watchlist | notifs
║  WS:    /ws (real-time feed)
╚══════════════════════════════════════╝
    `);
  });

  // Boot WebSocket hub
  attachWsServer(server);

  // Boot 3-stage detection pipeline (non-blocking)
  startPipeline().catch((err) =>
    console.error('💥 [Pipeline] Failed to start:', err)
  );
};

start();
