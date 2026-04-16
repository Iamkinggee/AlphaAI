/**
 * AlphaAI Backend — Redis Client
 * Singleton ioredis connection for the Structural Map cache.
 * Stores per-pair swing points, order blocks, FVGs, S&D zones per pair.
 */
import Redis from 'ioredis';
import { config } from '../config';

let client: Redis | null = null;

export function getRedisClient(): Redis {
  if (client) return client;

  if (!config.REDIS_URL) {
    console.warn('⚠️  REDIS_URL not set — using in-memory mock (dev only)');
    // Return a no-op stub to prevent crashes during development without Redis
    return createMockRedis();
  }

  client = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  client.on('connect', () => console.log('🔴 Redis connected'));
  client.on('error', (err) => console.error('❌ Redis error:', err.message));
  client.on('close', () => console.log('🔌 Redis disconnected'));

  return client;
}

/**
 * Structural Map Helpers
 * All data is stored as JSON strings in Redis hashes keyed by pair.
 * e.g. `structure:BTC/USDT` → { swings: [...], orderBlocks: [...], ... }
 */
export const structuralMap = {
  async get(pair: string): Promise<Record<string, unknown> | null> {
    const redis = getRedisClient();
    const raw = await redis.get(`structure:${pair}`);
    return raw ? JSON.parse(raw) : null;
  },

  async set(pair: string, data: Record<string, unknown>, ttlSeconds = 3600): Promise<void> {
    const redis = getRedisClient();
    await redis.set(`structure:${pair}`, JSON.stringify(data), 'EX', ttlSeconds);
  },

  async delete(pair: string): Promise<void> {
    const redis = getRedisClient();
    await redis.del(`structure:${pair}`);
  },

  async getAllPairs(): Promise<string[]> {
    const redis = getRedisClient();
    const keys = await redis.keys('structure:*');
    return keys.map((k) => k.replace('structure:', ''));
  },
};

/**
 * Dev-only no-op Redis mock to allow backend to boot without Redis.
 */
function createMockRedis(): Redis {
  const store: Record<string, string> = {};
  return {
    get: async (key: string) => store[key] ?? null,
    set: async (key: string, value: string) => { store[key] = value; return 'OK'; },
    del: async (key: string) => { delete store[key]; return 1; },
    keys: async (pattern: string) => Object.keys(store).filter(k => k.startsWith(pattern.replace('*', ''))),
    on: () => {},
  } as unknown as Redis;
}
