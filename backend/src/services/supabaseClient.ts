/**
 * AlphaAI Backend — Supabase Client
 * Singleton Supabase client for PostgreSQL operations.
 * Uses service-role key for server-side privileged access (bypasses RLS where needed).
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';

let supabase: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (supabase) return supabase;

  if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️  Supabase env vars not set — running in mock mode (dev only)');
    supabase = createMockSupabase();
    return supabase;
  }

  supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('🟢 Supabase client initialised');
  return supabase;
}

/**
 * Dev-only no-op Supabase mock so the server boots without credentials.
 */
function createMockSupabase(): SupabaseClient {
  type MockResult = { data: unknown; error: Error | null; count?: number };
  const baseResult: MockResult = { data: [], error: null, count: 0 };
  const singleResult: MockResult = { data: null, error: new Error('Mock Supabase — no credentials'), count: 0 };

  const createQuery = () => {
    const query: Record<string, (...args: unknown[]) => unknown> = {};
    const chainMethods = [
      'select', 'insert', 'update', 'delete',
      'eq', 'neq', 'in', 'gte', 'lte', 'gt', 'lt',
      'order', 'limit', 'range', 'or', 'returns'
    ];

    for (const method of chainMethods) {
      query[method] = () => query;
    }

    query.single = async () => singleResult;
    query.maybeSingle = async () => ({ data: null, error: null, count: 0 });
    query.then = (onFulfilled?: (value: MockResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(baseResult).then(onFulfilled, onRejected);
    query.catch = (onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(baseResult).catch(onRejected);
    query.finally = (onFinally?: (() => void) | undefined) =>
      Promise.resolve(baseResult).finally(onFinally);

    return query;
  };

  return {
    from: () => createQuery(),
    auth: {
      signInWithPassword: async () => ({ data: null, error: new Error('Mock Supabase') }),
      signUp: async () => ({ data: null, error: new Error('Mock Supabase') }),
      admin: { getUserById: async () => ({ data: null, error: null }) },
    },
  } as unknown as SupabaseClient;
}
