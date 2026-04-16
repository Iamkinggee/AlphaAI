/**
 * AlphaAI Backend — /signals routes
 * GET  /signals           — All signals (with optional filters)
 * GET  /signals/approaching — Approaching-zone signals only
 * GET  /signals/active    — Active trade signals only
 * GET  /signals/:id       — Single signal detail
 */
import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../services/supabaseClient';

const router = Router();

// Status filter whitelist
const VALID_STATUSES = ['approaching', 'active', 'TP1_hit', 'TP2_hit', 'TP3_hit', 'stopped', 'expired', 'pending'];

/**
 * GET /signals
 * Query params: status, direction, timeframe, minScore, limit, offset
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, direction, timeframe, minScore = '0', limit = '50', offset = '0' } = req.query;
    const db = getSupabaseClient();

    let query = db
      .from('signals')
      .select('*')
      .order('detected_at', { ascending: false })
      .limit(Number(limit))
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (status && typeof status === 'string' && VALID_STATUSES.includes(status)) {
      query = query.eq('status', status);
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

    res.json({ success: true, data: data ?? [], count: data?.length ?? 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /signals/approaching
 * Returns only signals currently approaching their entry zone.
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
    res.json({ success: true, data: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /signals/active
 * Returns only signals currently in an active trade.
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
    res.json({ success: true, data: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /signals/:id
 * Returns a single signal by ID.
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

    res.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
