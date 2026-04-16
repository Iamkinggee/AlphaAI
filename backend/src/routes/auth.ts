/**
 * AlphaAI Backend — /auth routes
 * POST /auth/sign-up   — Create new user account
 * POST /auth/sign-in   — Sign in with email/password
 * POST /auth/sign-out  — Invalidate session
 * POST /auth/refresh   — Refresh access token
 * GET  /auth/me        — Get current user profile
 */
import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../services/supabaseClient';

const router = Router();

/**
 * POST /auth/sign-up
 */
router.post('/sign-up', async (req: Request, res: Response) => {
  const { email, password, displayName } = req.body;

  if (!email || !password) {
    res.status(400).json({ success: false, error: 'Email and password are required' });
    return;
  }

  try {
    const db = getSupabaseClient();

    // Create auth user via Supabase
    const { data: authData, error: authError } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { displayName },
    });

    if (authError || !authData?.user) {
      res.status(400).json({ success: false, error: authError?.message ?? 'Sign up failed' });
      return;
    }

    // Create profile row
    await db.from('profiles').insert({
      id: authData.user.id,
      email,
      username: displayName ?? email.split('@')[0],
    });

    res.status(201).json({
      success: true,
      data: { userId: authData.user.id, email },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /auth/sign-in
 */
router.post('/sign-in', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ success: false, error: 'Email and password are required' });
    return;
  }

  try {
    const db = getSupabaseClient();

    const { data, error } = await db.auth.signInWithPassword({ email, password });

    if (error || !data?.session) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    res.json({
      success: true,
      data: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
        user: {
          id: data.user?.id,
          email: data.user?.email,
          displayName: data.user?.user_metadata?.displayName,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /auth/me
 * Validate token and return user profile.
 * Expects Authorization: Bearer <accessToken>
 */
router.get('/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing or invalid auth token' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const db = getSupabaseClient();
    const { data, error } = await db.auth.getUser(token);

    if (error || !data?.user) {
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
      return;
    }

    const { data: profile } = await db
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    res.json({
      success: true,
      data: {
        id: data.user.id,
        email: data.user.email,
        displayName: profile?.username ?? data.user.user_metadata?.displayName,
        tier: profile?.tier ?? 'free',
        createdAt: data.user.created_at,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
