/**
 * AlphaAI Backend — /journal routes
 * GET    /journal         — All trade journal entries for user
 * POST   /journal         — Create a new manual trade entry
 * PATCH  /journal/:id     — Update a trade entry
 * DELETE /journal/:id     — Remove a trade entry
 * GET    /journal/stats   — Aggregated performance stats
 */
import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../services/supabaseClient';

const router = Router();

/** Extract user ID from Authorization header (placeholder — full JWT middleware Phase 5) */
function getUserId(req: Request): string | null {
  // TODO: Replace with proper JWT middleware
  return req.headers['x-user-id'] as string ?? null;
}

/**
 * GET /journal
 */
router.get('/', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ success: false, error: 'Unauthorised' }); return; }

  const { result, limit = '50', offset = '0' } = req.query;
  const db = getSupabaseClient();

  let query = db
    .from('journal')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false })
    .limit(Number(limit));

  if (result && typeof result === 'string') {
    query = query.eq('result', result);
  }

  const { data, error } = await query;
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }

  res.json({ success: true, data: data ?? [] });
});

/**
 * GET /journal/stats
 */
router.get('/stats', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ success: false, error: 'Unauthorised' }); return; }

  const db = getSupabaseClient();
  const { data, error } = await db
    .from('journal')
    .select('result, pnl_percent, rr_achieved')
    .eq('user_id', userId)
    .not('result', 'eq', 'pending');

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }

  const trades = data ?? [];
  const wins = trades.filter((t) => t.result === 'win').length;
  const losses = trades.filter((t) => t.result === 'loss').length;
  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl_percent ?? 0), 0);
  const avgRR = trades.length > 0
    ? trades.reduce((sum, t) => sum + (t.rr_achieved ?? 0), 0) / trades.length
    : 0;

  res.json({
    success: true,
    data: {
      totalTrades: trades.length,
      wins,
      losses,
      winRate: trades.length > 0 ? Math.round((wins / trades.length) * 100) : 0,
      totalPnlPercent: Math.round(totalPnl * 100) / 100,
      avgRR: Math.round(avgRR * 100) / 100,
    },
  });
});

/**
 * POST /journal
 */
router.post('/', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ success: false, error: 'Unauthorised' }); return; }

  const { pair, direction, timeframe, entryPrice, exitPrice, result, pnlPercent, rrAchieved, setupNotes } = req.body;

  if (!pair || !direction || !entryPrice) {
    res.status(400).json({ success: false, error: 'pair, direction, entryPrice are required' });
    return;
  }

  const db = getSupabaseClient();
  const { data, error } = await db
    .from('journal')
    .insert({
      user_id: userId,
      pair, direction, timeframe,
      entry_price: entryPrice,
      exit_price: exitPrice,
      result: result ?? 'pending',
      pnl_percent: pnlPercent,
      rr_achieved: rrAchieved,
      setup_notes: setupNotes,
    })
    .select()
    .single();

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }

  res.status(201).json({ success: true, data });
});

/**
 * PATCH /journal/:id
 */
router.patch('/:id', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ success: false, error: 'Unauthorised' }); return; }

  const { id } = req.params;
  const db = getSupabaseClient();

  const { data, error } = await db
    .from('journal')
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error || !data) { res.status(404).json({ success: false, error: 'Trade not found' }); return; }

  res.json({ success: true, data });
});

/**
 * DELETE /journal/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ success: false, error: 'Unauthorised' }); return; }

  const { id } = req.params;
  const db = getSupabaseClient();

  const { error } = await db
    .from('journal')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }

  res.json({ success: true, message: 'Trade deleted' });
});

export default router;
