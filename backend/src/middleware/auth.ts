import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import { getSupabaseClient } from '../services/supabaseClient';

export type AuthedUser = {
  id: string;
  email?: string | null;
};

export type AuthedRequest = Request & { user: AuthedUser };

function bearerToken(req: Request): string | null {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return null;
  return h.slice(7).trim();
}

/**
 * Require a valid Supabase JWT (Authorization: Bearer <access_token>).
 * Never trusts x-user-id headers (prevents spoofing).
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ success: false, error: 'Missing auth token' });
    return;
  }

  // Disallow dev tokens in production.
  if (config.NODE_ENV === 'production' && token.startsWith('dev_')) {
    res.status(401).json({ success: false, error: 'Invalid auth token' });
    return;
  }

  try {
    const db = getSupabaseClient();
    const { data, error } = await db.auth.getUser(token);
    if (error || !data?.user?.id) {
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
      return;
    }

    (req as AuthedRequest).user = {
      id: data.user.id,
      email: data.user.email,
    };

    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

/**
 * Admin-only guard for destructive/runtime-global operations.
 * Uses `x-admin-key` header matching `ADMIN_API_KEY`.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const expected = config.ADMIN_API_KEY;
  if (!expected) {
    res.status(503).json({ success: false, error: 'Admin API is not configured' });
    return;
  }

  const provided = (req.headers['x-admin-key'] as string | undefined)?.trim();
  if (!provided || provided !== expected) {
    res.status(403).json({ success: false, error: 'Forbidden' });
    return;
  }

  next();
}

