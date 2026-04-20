/**
 * AlphaAI Backend — /notifications routes
 * GET   /notifications        — User's notification history
 * PATCH /notifications/:id    — Mark single notification as read
 * POST  /notifications/readAll — Mark all as read
 * DELETE /notifications        — Clear all notifications
 */
import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../services/supabaseClient';
import { requireAuth, type AuthedRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /notifications
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).user.id;

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
router.post('/push-token', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).user.id;
  const { token, platform } = req.body;

  if (!token || typeof token !== 'string') {
    res.status(400).json({ success: false, error: 'Token is required' });
    return;
  }

  const safePlatform = typeof platform === 'string' && ['ios', 'android', 'web'].includes(platform)
    ? platform
    : 'unknown';

  const db = getSupabaseClient();
  const { error } = await db
    .from('push_tokens')
    .upsert(
      {
        token,
        user_id: userId,
        platform: safePlatform,
        is_active: true,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' },
    );

  if (error) {
    res.status(500).json({ success: false, error: error.message });
    return;
  }

  console.log(`📲 [Notifications] Registered push token${userId ? ` for user ${userId}` : ''} (${safePlatform})`);
  res.json({ success: true, message: 'Push token registered successfully' });
});

/**
 * PATCH /notifications/:id — Mark single read
 */
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).user.id;

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
router.post('/read-all', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).user.id;

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
router.delete('/', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthedRequest).user.id;

  const db = getSupabaseClient();
  const { error } = await db
    .from('notifications')
    .delete()
    .eq('user_id', userId);

  if (error) { res.status(500).json({ success: false, error: error.message }); return; }
  res.json({ success: true, message: 'Notifications cleared' });
});

export default router;
