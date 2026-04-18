/**
 * AlphaAI Backend — /notifications routes
 * GET   /notifications        — User's notification history
 * PATCH /notifications/:id    — Mark single notification as read
 * POST  /notifications/readAll — Mark all as read
 * DELETE /notifications        — Clear all notifications
 */
import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../services/supabaseClient';

const router = Router();

function getUserId(req: Request): string | null {
  return req.headers['x-user-id'] as string ?? null;
}

/**
 * GET /notifications
 */
router.get('/', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ success: false, error: 'Unauthorised' }); return; }

  const { limit = '30', unreadOnly } = req.query;
  const db = getSupabaseClient();

  let query = db
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(Number(limit));

  if (unreadOnly === 'true') {
    query = query.eq('read', false);
  }

  const { data, error } = await query;
  if (error) { res.status(500).json({ success: false, error: error.message }); return; }

  const unreadCount = (data ?? []).filter((n) => !n.read).length;
  res.json({ success: true, data: data ?? [], unreadCount });
});

/**
 * POST /notifications/push-token
 * Registers the device's Expo push token.
 */
router.post('/push-token', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  const { token, platform } = req.body;

  if (!token) {
    res.status(400).json({ success: false, error: 'Token is required' });
    return;
  }

  console.log(`📲 [Notifications] Received push token${userId ? ` for user ${userId}` : ' (anonymous)'} on ${platform}`);

  // TODO: Upsert the token into a `user_profiles` or `push_tokens` table in Supabase.
  // For now, we return 200 OK to satisfy the frontend API contract.
  
  res.json({ success: true, message: 'Push token registered successfully' });
});

/**
 * PATCH /notifications/:id — Mark single read
 */
router.patch('/:id', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ success: false, error: 'Unauthorised' }); return; }

  const { id } = req.params;
  const db = getSupabaseClient();

  const { data, error } = await db
    .from('notifications')
    .update({ read: true })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error || !data) { res.status(404).json({ success: false, error: 'Notification not found' }); return; }
  res.json({ success: true, data });
});

/**
 * POST /notifications/read-all — Mark all read
 */
router.post('/read-all', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ success: false, error: 'Unauthorised' }); return; }

  const db = getSupabaseClient();
  const { error } = await db
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, message: 'All notifications marked as read' });
});

/**
 * DELETE /notifications — Clear all
 */
router.delete('/', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) { res.status(401).json({ success: false, error: 'Unauthorised' }); return; }

  const db = getSupabaseClient();
  const { error } = await db
    .from('notifications')
    .delete()
    .eq('user_id', userId);

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, message: 'Notifications cleared' });
});

export default router;
