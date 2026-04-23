/**
 * AlphaAI Backend — /auth routes
 * POST /auth/sign-up         — Create new user account
 * POST /auth/sign-in         — Sign in with email/password
 * POST /auth/sign-out        — Invalidate session
 * POST /auth/refresh         — Refresh access token
 * POST /auth/forgot-password — Send password reset email
 * GET  /auth/me              — Get current user profile
 * GET  /auth/google/url      — Get Google OAuth URL (Supabase OAuth)
 */
import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../services/supabaseClient';
import { config } from '../config';

const router = Router();

/**
 * POST /auth/sign-up
 *
 * Strategy: use auth.admin.createUser (email_confirm: true) to skip
 * email confirmation. The `handle_new_user` DB trigger auto-creates the
 * profile row (with email + username columns), so we do NOT insert into
 * profiles manually — that would race/conflict with the trigger.
 *
 * After creating the user, we immediately sign them in and return tokens
 * so the frontend can go straight to the dashboard.
 */
router.post('/sign-up', async (req: Request, res: Response) => {
  const { email, password, displayName } = req.body;

  if (!email || !password) {
    res.status(400).json({ success: false, error: 'Email and password are required' });
    return;
  }

  try {
    const db = getSupabaseClient();

    // ── Step 1: Create the Supabase auth user (bypasses email confirmation) ──
    const { data: authData, error: authError } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,        // skip email verification for dev/prod convenience
      user_metadata: {
        displayName,
        full_name: displayName,   // used by handle_new_user trigger → username
      },
    });

    if (authError) {
      console.warn('[Auth] /sign-up failed:', authError.message);
      // Surface a user-friendly version of common Supabase errors
      const msg = authError.message.includes('already registered')
        ? 'An account with this email already exists. Please sign in.'
        : authError.message;
      res.status(400).json({ success: false, error: msg });
      return;
    }

    if (!authData?.user) {
      res.status(400).json({ success: false, error: 'Sign up failed. Please try again.' });
      return;
    }

    console.log('[Auth] /sign-up user created:', authData.user.id);

    // ── Step 2: Upsert profile (covers cases where trigger hasn't run yet) ──
    // Live schema: profiles(id, email, username, avatar_url, tier, created_at, updated_at)
    try {
      await db.from('profiles').upsert(
        {
          id: authData.user.id,
          email,
          username: displayName || email.split('@')[0],
        },
        { onConflict: 'id', ignoreDuplicates: true }
      );
    } catch (profileErr) {
      // Non-fatal — the trigger may have already created the profile
      console.warn('[Auth] Profile upsert failed (non-fatal):', profileErr instanceof Error ? profileErr.message : profileErr);
    }

    // ── Step 3: Sign in to get session tokens ────────────────────────────────
    const { data: signInData, error: signInError } = await db.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData?.session) {
      // User created but couldn't get tokens — still a partial success.
      // Frontend will redirect to sign-in.
      console.warn('[Auth] /sign-up auto-sign-in failed:', signInError?.message);
      res.status(201).json({
        success: true,
        data: { userId: authData.user.id, email, requiresSignIn: true },
      });
      return;
    }

    // ── Return full session so frontend goes straight to dashboard ───────────
    res.status(201).json({
      success: true,
      data: {
        userId: authData.user.id,
        email,
        accessToken: signInData.session.access_token,
        refreshToken: signInData.session.refresh_token,
        expiresAt: signInData.session.expires_at,
        user: {
          id: signInData.user?.id,
          email: signInData.user?.email,
          displayName: signInData.user?.user_metadata?.displayName ?? displayName,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Auth] /sign-up exception:', message);
    res.status(500).json({ success: false, error: 'Sign up failed. Please try again.' });
  }
});

/**
 * POST /auth/sign-in
 */
router.post('/sign-in', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  console.log('[Auth] /sign-in attempt for:', typeof email === 'string' ? email.split('@')[1] : 'unknown');

  if (!email || !password) {
    res.status(400).json({ success: false, error: 'Email and password are required' });
    return;
  }

  try {
    const db = getSupabaseClient();

    const { data, error } = await db.auth.signInWithPassword({ email, password });

    if (error || !data?.session) {
      console.warn('[Auth] /sign-in rejected:', error?.message ?? 'no session');
      // Provide a clearer error message for the common case
      const msg = error?.message?.includes('Invalid login credentials')
        ? 'Incorrect email or password.'
        : 'Sign in failed. Please try again.';
      res.status(401).json({ success: false, error: msg });
      return;
    }

    console.log('[Auth] /sign-in success for user:', data.user?.id ?? 'unknown');
    res.json({
      success: true,
      data: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
        user: {
          id: data.user?.id,
          email: data.user?.email,
          displayName: data.user?.user_metadata?.displayName ?? data.user?.user_metadata?.full_name,
        },
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Auth] /sign-in exception:', message);
    res.status(500).json({ success: false, error: 'Sign in failed. Please try again.' });
  }
});

/**
 * POST /auth/sign-out
 * Invalidate the current session.
 */
router.post('/sign-out', async (req: Request, res: Response) => {
  try {
    const db = getSupabaseClient();
    await db.auth.signOut();
    console.log('[Auth] /sign-out success');
    res.json({ success: true });
  } catch (err) {
    console.warn('[Auth] /sign-out error:', err instanceof Error ? err.message : err);
    // Even if signOut fails server-side, tell client it's fine (token is deleted client-side)
    res.json({ success: true });
  }
});

/**
 * POST /auth/refresh
 * Refresh the access token using a refresh token.
 */
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    res.status(400).json({ success: false, error: 'Refresh token is required' });
    return;
  }

  try {
    const db = getSupabaseClient();
    const { data, error } = await db.auth.refreshSession({ refresh_token: refreshToken });

    if (error || !data?.session) {
      console.warn('[Auth] /refresh failed:', error?.message ?? 'no session');
      res.status(401).json({ success: false, error: 'Session expired. Please sign in again.' });
      return;
    }

    res.json({
      success: true,
      data: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
      },
    });
  } catch (err) {
    console.error('[Auth] /refresh exception:', err instanceof Error ? err.message : err);
    res.status(500).json({ success: false, error: 'Token refresh failed.' });
  }
});

/**
 * POST /auth/forgot-password
 * Send a password reset email via Supabase.
 */
router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ success: false, error: 'Email is required' });
    return;
  }

  try {
    const db = getSupabaseClient();
    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: 'alphaai://auth/reset-password',
    });

    if (error) {
      console.warn('[Auth] /forgot-password failed:', error.message);
      // Don't reveal whether account exists — always return success
    }

    console.log('[Auth] /forgot-password sent for:', email.split('@')[1]);
    // Always return success to prevent email enumeration
    res.json({ success: true, message: 'If an account exists with this email, a reset link has been sent.' });
  } catch (err) {
    console.error('[Auth] /forgot-password exception:', err instanceof Error ? err.message : err);
    // Still return success to prevent enumeration
    res.json({ success: true, message: 'If an account exists with this email, a reset link has been sent.' });
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

    // Try to load profile — live schema has email + username columns
    const { data: profile } = await db
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    // Build displayName from available sources (live schema: username, not display_name)
    const displayName =
      profile?.username ??
      data.user.user_metadata?.displayName ??
      data.user.user_metadata?.full_name ??
      data.user.email;

    res.json({
      success: true,
      data: {
        id: data.user.id,
        email: data.user.email,
        displayName,
        tier: profile?.tier ?? 'free',
        createdAt: data.user.created_at,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /auth/google/url
 * Returns the Supabase Google OAuth URL for the frontend to open in a browser.
 * Query param: redirectUri — the deep link URI the app listens on after auth.
 *
 * For this to work, you must:
 *  1. Enable Google provider in Supabase Dashboard → Authentication → Providers
 *  2. Add your Google OAuth client ID & secret from Google Cloud Console
 *  3. Add your app's redirect URI to the Supabase "Redirect URLs" allow-list
 *     e.g. alphaai://auth/callback
 */
router.get('/google/url', (req: Request, res: Response) => {
  const supabaseUrl = config.SUPABASE_URL;

  if (!supabaseUrl) {
    res.status(503).json({
      success: false,
      error: 'Google Sign-In is not configured on this server.',
    });
    return;
  }

  const redirectUri = (req.query.redirectUri as string) || 'alphaai://auth/callback';

  // Supabase OAuth URL — opens Google login in browser and redirects back to app
  const url =
    `${supabaseUrl}/auth/v1/authorize` +
    `?provider=google` +
    `&redirect_to=${encodeURIComponent(redirectUri)}`;

  console.log('[Auth] /google/url generated for redirect:', redirectUri);
  res.json({ success: true, data: { url } });
});

export default router;
