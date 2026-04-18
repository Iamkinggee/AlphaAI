/**
 * AlphaAI Backend — /signals routes
 * Reads live signals from Supabase, normalizes to frontend Signal shape.
 *
 * GET  /signals              — All signals (filters: status, direction, timeframe, minScore)
 * GET  /signals/approaching  — Approaching signals only
 * GET  /signals/active       — Active signals only
 * POST /signals/analyse      — AI analysis of a pair using live chart levels (Groq)
 * GET  /signals/:id          — Single signal by ID
 */
import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../services/supabaseClient';
import { generateAIResponse, GroqNotConfiguredError } from '../services/openaiService';

const router = Router();

// Status filter whitelist
const VALID_STATUSES = ['approaching', 'active', 'TP1_hit', 'TP2_hit', 'TP3_hit', 'stopped', 'expired', 'pending'];

// ── Signal normalizer ─────────────────────────────────────────────────
// Transforms a raw Supabase row into the Signal shape the frontend expects.
// This is the single source of truth for the data contract.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeSignal(row: Record<string, any>) {
  const isLong = row.direction === 'LONG';

  // Support all column name variants seen in DB
  const entryLow  = Number(row.entry_zone_low  ?? row.entry_low)                      || 0;
  const entryHigh = Number(row.entry_zone_high ?? row.entry_high)                     || 0;
  const sl        = Number(row.stop_loss)                                              || 0;
  const tp1       = Number(row.take_profit1    ?? row.take_profit_1 ?? row.tp1)       || 0;
  const tp2       = Number(row.take_profit2    ?? row.take_profit_2 ?? row.tp2)       || 0;
  const tp3       = Number(row.take_profit3    ?? row.take_profit_3 ?? row.tp3)       || 0;
  const distance  = Number(row.distance_pct)                                           || 0;

  // R:R calculation from entry midpoint
  const entryMid  = (entryLow + entryHigh) / 2;
  const risk      = Math.abs(entryMid - sl);
  const rr = (tp: number) =>
    risk > 0 ? `1:${(Math.abs(tp - entryMid) / risk).toFixed(1)}` : '—';

  // Time helpers
  const detectedAt  = row.detected_at  ? new Date(row.detected_at)  : new Date();
  const expiresAt   = row.expires_at   ? new Date(row.expires_at)   : new Date(Date.now() + 48 * 3600_000);
  const activatedAt = row.activated_at ? new Date(row.activated_at) : null;

  const timeElapsed  = formatTimeAgo(detectedAt);
  const expiresIn    = formatTimeUntil(expiresAt);

  // Confluence factors: try to parse JSON column, fall back to sensible defaults
  let confluence = [];
  try {
    confluence = row.confluence ? JSON.parse(row.confluence) : buildDefaultConfluence(row);
  } catch {
    confluence = buildDefaultConfluence(row);
  }

  return {
    id:          row.id,
    pair:        row.pair,
    baseAsset:   row.pair?.split('/')[0] ?? '',
    quoteAsset:  row.pair?.split('/')[1] ?? 'USDT',
    direction:   row.direction,
    timeframe:   row.timeframe,
    status:      row.status,
    score:       Number(row.score) || 0,
    setupType:   row.setup_type ?? `${row.timeframe} SMC Setup`,

    entryZone: {
      low:          entryLow,
      high:         entryHigh,
      lowFormatted: formatPrice(entryLow),
      highFormatted:formatPrice(entryHigh),
    },

    stopLoss:          sl,
    stopLossFormatted: formatPrice(sl),

    takeProfit1: { price: tp1, priceFormatted: formatPrice(tp1), rr: rr(tp1), hit: row.status === 'TP1_hit' || row.status === 'TP2_hit' || row.status === 'TP3_hit' },
    takeProfit2: { price: tp2, priceFormatted: formatPrice(tp2), rr: rr(tp2), hit: row.status === 'TP2_hit' || row.status === 'TP3_hit' },
    takeProfit3: { price: tp3, priceFormatted: formatPrice(tp3), rr: rr(tp3), hit: row.status === 'TP3_hit' },

    confluence,

    distance:         distance,
    distanceFormatted: distance > 0 ? `${distance.toFixed(1)}%` : '—',

    createdAt:   detectedAt.toISOString(),
    expiresAt:   expiresAt.toISOString(),
    activatedAt: activatedAt?.toISOString() ?? null,
    timeElapsed,
    expiresIn,

    // P&L only if active / TP hit
    currentPnl:          row.current_pnl   ? Number(row.current_pnl)   : undefined,
    currentPnlFormatted: row.current_pnl   ? `${Number(row.current_pnl) >= 0 ? '+' : ''}${Number(row.current_pnl).toFixed(2)}%` : undefined,
  };
}

// ── Price formatter consistent with frontend ──────────────────────────
function formatPrice(price: number): string {
  if (!price) return '—';
  if (price >= 10000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (price >= 1000)  return `$${price.toFixed(1)}`;
  if (price >= 1)     return `$${price.toFixed(3)}`;
  return `$${price.toFixed(5)}`;
}

function formatTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)   return 'Just now';
  if (m < 60)  return `${m} minute${m > 1 ? 's' : ''} ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h} hour${h > 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? 's' : ''} ago`;
}

function formatTimeUntil(date: Date): string {
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${rem}m`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildDefaultConfluence(row: Record<string, any>) {
  const score = Number(row.score) || 0;
  return [
    { factor: `${row.timeframe} Order Block`, points: 20, active: score >= 65 },
    { factor: 'Fair Value Gap (FVG)',          points: 15, active: score >= 75 },
    { factor: 'Liquidity sweep before entry',  points: 20, active: score >= 80 },
    { factor: 'Price in discount/premium',     points: 10, active: score >= 70 },
    { factor: 'HTF trend aligned',             points: 10, active: score >= 72 },
    { factor: '5M BOS confirmation',           points: 15, active: score >= 85 },
    { factor: 'S&D zone coincides with OB',    points: 10, active: score >= 78 },
  ];
}

// Resolved / terminal statuses — these signals are "done" and belong in history
const RESOLVED_STATUSES = ['TP3_hit', 'stopped', 'expired'];

// Active / in-play statuses — these are the signals shown in the main list
const ACTIVE_STATUSES = ['approaching', 'active', 'TP1_hit', 'TP2_hit', 'pending'];

// ── In-memory cache ──────────────────────────────────────────────────
let signalsCache: { data: any[]; expiresAt: number } | null = null;
let historyCache: { data: any[]; expiresAt: number } | null = null;

const CACHE_TTL = 30 * 1000; // 30 seconds

// ── Routes ────────────────────────────────────────────────────────────

/**
 * GET /signals
 * Returns only active/in-play signals by default.
 * Query params: status, direction, timeframe, minScore, limit, offset
 *
 * To get resolved/historical signals, use GET /signals/history instead.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, direction, timeframe, minScore = '0', limit = '50', offset = '0' } = req.query;

    // Use cache if no specific filters/offset applied (most common case: initial load)
    const isBasicQuery = !status && !direction && !timeframe && minScore === '0' && limit === '50' && offset === '0';
    if (isBasicQuery && signalsCache && signalsCache.expiresAt > Date.now()) {
      res.json({ success: true, data: signalsCache.data, cached: true });
      return;
    }

    const db = getSupabaseClient();

    let query = db
      .from('signals')
      .select('*')
      .order('detected_at', { ascending: false })
      .limit(Number(limit))
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (status && typeof status === 'string' && VALID_STATUSES.includes(status)) {
      // If caller explicitly asks for a resolved status, honour it
      query = query.eq('status', status);
    } else {
      // Default: only show active/in-play signals (not resolved ones)
      query = query.in('status', ACTIVE_STATUSES);
    }
    if (direction && (direction === 'LONG' || direction === 'SHORT')) {
      query = query.eq('direction', direction);
    }
    if (timeframe && typeof timeframe === 'string') {
      query = query.eq('timeframe', timeframe);
    }
    if (Number(minScore) > 0) {
      query = query.gte('score', Number(minScore));
    }

    const { data, error } = await query;
    if (error) throw error;

    const signals = (data ?? []).map(normalizeSignal);

    // Populate cache for basic queries
    if (isBasicQuery) {
      signalsCache = { data: signals, expiresAt: Date.now() + CACHE_TTL };
    }

    res.json({ success: true, data: signals, count: signals.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[SignalsRoute] GET / error:', message);
    
    // Serve stale cache on error
    if (signalsCache) {
      res.json({ success: true, data: signalsCache.data, count: signalsCache.data.length, stale: true });
      return;
    }
    
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /signals/history
 * Returns resolved/completed signals: TP3_hit, stopped, expired.
 * These are signals that have run their course — shown in a separate history view.
 * Query params: direction, timeframe, limit, offset
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { direction, timeframe, limit = '50', offset = '0' } = req.query;

    // Use cache if no filters applied
    const isBasicQuery = !direction && !timeframe && limit === '50' && offset === '0';
    if (isBasicQuery && historyCache && historyCache.expiresAt > Date.now()) {
      res.json({ success: true, data: historyCache.data, count: historyCache.data.length, cached: true });
      return;
    }

    const db = getSupabaseClient();

    let query = db
      .from('signals')
      .select('*')
      .in('status', RESOLVED_STATUSES)
      .order('updated_at', { ascending: false })
      .limit(Number(limit))
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (direction && (direction === 'LONG' || direction === 'SHORT')) {
      query = query.eq('direction', direction);
    }
    if (timeframe && typeof timeframe === 'string') {
      query = query.eq('timeframe', timeframe);
    }

    const { data, error } = await query;
    if (error) throw error;

    const signals = (data ?? []).map(normalizeSignal);

    if (isBasicQuery) {
      historyCache = { data: signals, expiresAt: Date.now() + CACHE_TTL };
    }

    res.json({ success: true, data: signals, count: signals.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[SignalsRoute] GET /history error:', message);

    if (historyCache) {
      res.json({ success: true, data: historyCache.data, count: historyCache.data.length, stale: true });
      return;
    }

    res.status(500).json({ success: false, error: message });
  }
});

/**
 * DELETE /signals/history
 * Removes all resolved/completed signals from the database.
 */
router.delete('/history', async (_req: Request, res: Response) => {
  try {
    const db = getSupabaseClient();
    const { error } = await db
      .from('signals')
      .delete()
      .in('status', RESOLVED_STATUSES);

    if (error) throw error;
    res.json({ success: true, message: 'History cleared' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /signals/approaching
 */
router.get('/approaching', async (_req: Request, res: Response) => {
  try {
    const db = getSupabaseClient();
    const { data, error } = await db
      .from('signals')
      .select('*')
      .eq('status', 'approaching')
      .order('score', { ascending: false })
      .limit(10);

    if (error) throw error;
    res.json({ success: true, data: (data ?? []).map(normalizeSignal) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /signals/active
 */
router.get('/active', async (_req: Request, res: Response) => {
  try {
    const db = getSupabaseClient();
    const { data, error } = await db
      .from('signals')
      .select('*')
      .eq('status', 'active')
      .order('activated_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data: (data ?? []).map(normalizeSignal) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /signals/analyse
 * Accepts live chart levels and returns AI analysis from Groq.
 * Body: { pair, timeframe, direction, entry, sl, tp1, tp2, tp3, currentPrice, atr, score? }
 */
router.post('/analyse', async (req: Request, res: Response) => {
  try {
    const { pair, timeframe, direction, entry, sl, tp1, tp2, tp3, currentPrice, atr, score } = req.body;

    if (!pair || !timeframe || !entry || !sl) {
      res.status(400).json({ success: false, error: 'pair, timeframe, entry, sl are required' });
      return;
    }

    const fmt = (n: number) => {
      const p = Number(n);
      if (!p) return '—';
      if (p >= 10000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
      if (p >= 1)     return p.toFixed(3);
      return p.toFixed(5);
    };

    const risk = Math.abs(Number(entry) - Number(sl));
    const rr   = (tp: number) => risk > 0 ? (Math.abs(tp - Number(entry)) / risk).toFixed(1) : '—';

    const prompt = `Analyse this ${pair} setup on the ${timeframe} timeframe using Smart Money Concepts:

**Current Price:** $${fmt(currentPrice)}
**Direction:** ${direction}
**ATR(14):** ${atr ? fmt(atr) : 'N/A'}
**Entry Zone:** $${fmt(entry)}
**Stop Loss:** $${fmt(sl)} (${risk > 0 ? ((risk / Number(entry)) * 100).toFixed(2) : '?'}% risk)
**TP1:** $${fmt(tp1)} — R:R 1:${rr(Number(tp1))}
**TP2:** $${fmt(tp2)} — R:R 1:${rr(Number(tp2))}
**TP3:** $${fmt(tp3)} — R:R 1:${rr(Number(tp3))}
${score ? `**Auto Confluence Score:** ${score}/100` : ''}

Based on these ATR-derived levels and current price action on ${pair}:
1. Identify the likely HTF structure (bullish or bearish) 
2. Evaluate the quality of this entry zone
3. Assess whether the R:R is viable
4. State key confirmation signals to watch for
5. Provide your overall bias and key invalidation level

Be concise and actionable. Max 200 words.`;

    const { content } = await generateAIResponse([{ role: 'user', content: prompt }]);

    // Also try to find a matching signal in Supabase for richer context
    const db = getSupabaseClient();
    const { data: matchingSignal } = await db
      .from('signals')
      .select('*')
      .eq('pair', pair)
      .eq('timeframe', timeframe)
      .in('status', ['approaching', 'active'])
      .order('score', { ascending: false })
      .limit(1)
      .single();

    res.json({
      success: true,
      data: {
        text:      content,
        pair,
        timeframe,
        direction,
        entry:     Number(entry),
        sl:        Number(sl),
        tp1:       Number(tp1),
        tp2:       Number(tp2),
        tp3:       Number(tp3),
        score:     matchingSignal?.score ?? (score ?? 72),
        setupType: matchingSignal?.setup_type ?? `${timeframe} ATR-Based Setup`,
        zoneLow:   matchingSignal?.entry_zone_low  ?? Number(entry) * 0.998,
        zoneHigh:  matchingSignal?.entry_zone_high ?? Number(entry) * 1.002,
        hasFvg:    !!matchingSignal,
        hasOb:     !!matchingSignal,
        hasSweep:  (matchingSignal?.score ?? 0) >= 80,
        fvgLow:    Number(entry) * (direction === 'LONG' ? 1.002 : 0.996),
        fvgHigh:   Number(entry) * (direction === 'LONG' ? 1.008 : 0.998),
      },
    });
  } catch (err) {
    if (err instanceof GroqNotConfiguredError) {
      res.status(503).json({ success: false, error: err.message });
      return;
    }
    const message = err instanceof Error ? err.message : 'Analysis failed';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /signals/:id
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getSupabaseClient();

    const { data, error } = await db
      .from('signals')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      res.status(404).json({ success: false, error: 'Signal not found' });
      return;
    }

    res.json({ success: true, data: normalizeSignal(data) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
