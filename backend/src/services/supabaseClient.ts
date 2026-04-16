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
    return createMockSupabase();
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
  const mockQuery = {
    select: () => mockQuery,
    insert: () => mockQuery,
    update: () => mockQuery,
    delete: () => mockQuery,
    eq: () => mockQuery,
    order: () => mockQuery,
    limit: () => mockQuery,
    single: async () => ({ data: null, error: new Error('Mock Supabase — no credentials') }),
    then: async () => ({ data: [], error: null }),
  };

  return {
    from: () => mockQuery,
    auth: {
      signInWithPassword: async () => ({ data: null, error: new Error('Mock Supabase') }),
      signUp: async () => ({ data: null, error: new Error('Mock Supabase') }),
      admin: { getUserById: async () => ({ data: null, error: null }) },
    },
  } as unknown as SupabaseClient;
}
