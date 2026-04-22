/**
 * AlphaAI Backend — /auth routes
 * POST /auth/sign-up         — Create new user account
 * POST /auth/sign-in         — Sign in with email/password
 * POST /auth/sign-out        — Invalidate session
 * POST /auth/refresh         — Refresh access token
 * GET  /auth/me              — Get current user profile
 * GET  /auth/google/url      — Get Google OAuth URL (Supabase OAuth)
 */
import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../services/supabaseClient';
import { config } from '../config';

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
  console.log('[DBG-AuthRoute] /sign-in request', {
    hasEmail: !!email,
    emailDomain: typeof email === 'string' ? email.split('@')[1] ?? null : null,
    hasPassword: !!password,
  });
  // #region agent log
  fetch('http://127.0.0.1:7492/ingest/ab6bd97f-a660-4e32-856c-28f4fb4f56e2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'01c768'},body:JSON.stringify({sessionId:'01c768',runId:'auth-debug-1',hypothesisId:'H2',location:'backend/src/routes/auth.ts:/sign-in',message:'backend sign-in request',data:{hasEmail:!!email,emailDomain:typeof email === 'string' ? email.split('@')[1] ?? null : null,hasPassword:!!password},timestamp:Date.now()})}).catch(()=>{});
  // #endregion agent log

  if (!email || !password) {
    res.status(400).json({ success: false, error: 'Email and password are required' });
    return;
  }

  try {
    const db = getSupabaseClient();

    const { data, error } = await db.auth.signInWithPassword({ email, password });

    if (error || !data?.session) {
      console.log('[DBG-AuthRoute] /sign-in rejected', {
        errorMessage: error?.message ?? null,
        hasSession: !!data?.session,
      });
      // #region agent log
      fetch('http://127.0.0.1:7492/ingest/ab6bd97f-a660-4e32-856c-28f4fb4f56e2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'01c768'},body:JSON.stringify({sessionId:'01c768',runId:'auth-debug-1',hypothesisId:'H2',location:'backend/src/routes/auth.ts:/sign-in',message:'backend sign-in rejected',data:{errorMessage:error?.message ?? null,hasSession:!!data?.session},timestamp:Date.now()})}).catch(()=>{});
      // #endregion agent log
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
    // #region agent log
    fetch('http://127.0.0.1:7492/ingest/ab6bd97f-a660-4e32-856c-28f4fb4f56e2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'01c768'},body:JSON.stringify({sessionId:'01c768',runId:'auth-debug-1',hypothesisId:'H2',location:'backend/src/routes/auth.ts:/sign-in',message:'backend sign-in success',data:{userId:data.user?.id ?? null,hasRefresh:!!data.session.refresh_token},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log
    console.log('[DBG-AuthRoute] /sign-in success', {
      userId: data.user?.id ?? null,
      hasRefresh: !!data.session.refresh_token,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.log('[DBG-AuthRoute] /sign-in exception', { errorMessage: message });
    // #region agent log
    fetch('http://127.0.0.1:7492/ingest/ab6bd97f-a660-4e32-856c-28f4fb4f56e2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'01c768'},body:JSON.stringify({sessionId:'01c768',runId:'auth-debug-1',hypothesisId:'H2',location:'backend/src/routes/auth.ts:/sign-in',message:'backend sign-in exception',data:{errorMessage:message},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log
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
  // #region agent log
  fetch('http://127.0.0.1:7492/ingest/ab6bd97f-a660-4e32-856c-28f4fb4f56e2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'01c768'},body:JSON.stringify({sessionId:'01c768',runId:'auth-debug-1',hypothesisId:'H4',location:'backend/src/routes/auth.ts:/google/url',message:'google oauth url generated',data:{redirectUri,hasSupabaseUrl:!!supabaseUrl},timestamp:Date.now()})}).catch(()=>{});
  // #endregion agent log
  console.log('[DBG-AuthRoute] /google/url generated', {
    redirectUri,
    hasSupabaseUrl: !!supabaseUrl,
  });

  res.json({ success: true, data: { url } });
});

export default router;
