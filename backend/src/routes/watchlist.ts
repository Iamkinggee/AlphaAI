/**
 * AlphaAI Backend — /watchlist routes
 * GET    /watchlist       — User's watched pairs
 * POST   /watchlist       — Add a pair to watchlist
 * DELETE /watchlist/:id   — Remove a pair from watchlist
 * PATCH  /watchlist/:id   — Set price alert for a pair
 */
import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../services/supabaseClient';

const router = Router();

function getUserId(req: Request): string | null {
  return req.headers['x-user-id'] as string ?? null;
}

/**
 * GET /watchlist
 */
router.get('/', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ success: false, error: 'Unauthorised' }); return; }

  const db = getSupabaseClient();
  const { data, error } = await db
    .from('watchlist')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, data: data ?? [] });
});

/**
 * POST /watchlist
 */
router.post('/', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ success: false, error: 'Unauthorised' }); return; }

  const { pair, baseAsset, quoteAsset } = req.body;
  if (!pair) { res.status(400).json({ success: false, error: 'pair is required' }); return; }

  const db = getSupabaseClient();
  const { data, error } = await db
    .from('watchlist')
    .insert({ user_id: userId, pair, base_asset: baseAsset, quote_asset: quoteAsset })
    .select()
    .single();

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.status(201).json({ success: true, data });
});

/**
 * PATCH /watchlist/:id — Set price alerts
 */
router.patch('/:id', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ success: false, error: 'Unauthorised' }); return; }

  const { id } = req.params;
  const { alertAbove, alertBelow } = req.body;
  const db = getSupabaseClient();

  const { data, error } = await db
    .from('watchlist')
    .update({ alert_above: alertAbove, alert_below: alertBelow })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error || !data) { res.status(404).json({ success: false, error: 'Item not found' }); return; }
  res.json({ success: true, data });
});

/**
 * DELETE /watchlist/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ success: false, error: 'Unauthorised' }); return; }

  const { id } = req.params;
  const db = getSupabaseClient();

  const { error } = await db
    .from('watchlist')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, message: 'Pair removed from watchlist' });
});

export default router;
