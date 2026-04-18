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
 * Wait for Redis to be fully connected and ready.
 * Resolves immediately if already connected.
 */
export async function waitForRedis(): Promise<void> {
  const redis = getRedisClient();
  // Mock client doesn't have status, so it's always "ready"
  if (!redis.status || redis.status === 'ready') return;

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.warn('⚠️  Redis connection timed out — proceeding with detection engine using local state...');
      resolve();
    }, 3000);

    redis.once('ready', () => {
      clearTimeout(timeout);
      resolve();
    });

    redis.once('error', (err) => {
      console.warn('⚠️  Redis connection error during startup — proceeding anyway:', err.message);
      clearTimeout(timeout);
      resolve();
    });
  });
}

/**
 * Structural Map Helpers
 * Keys: `structure:BTC/USDT:1H`, `structure:BTC/USDT:4H`, etc.
 */
export const structuralMap = {
  async get(pair: string, timeframe?: string): Promise<Record<string, unknown> | null> {
    const redis = getRedisClient();
    const key = timeframe ? `structure:${pair}:${timeframe}` : `structure:${pair}`;
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  },

  async set(pair: string, data: Record<string, unknown>, ttlSeconds = 3600, timeframe?: string): Promise<void> {
    const redis = getRedisClient();
    // Use timeframe-specific key from data if not provided
    const tf = timeframe ?? (data.timeframe as string) ?? 'unknown';
    const key = `structure:${pair}:${tf}`;
    await redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
  },

  async getAllForPair(pair: string): Promise<Record<string, unknown>[]> {
    const redis = getRedisClient();
    const keys = await redis.keys(`structure:${pair}:*`);
    const results: Record<string, unknown>[] = [];
    for (const key of keys) {
      const raw = await redis.get(key);
      if (raw) {
        try { results.push(JSON.parse(raw)); } catch { /* skip malformed */ }
      }
    }
    return results;
  },

  async delete(pair: string, timeframe?: string): Promise<void> {
    const redis = getRedisClient();
    if (timeframe) {
      await redis.del(`structure:${pair}:${timeframe}`);
    } else {
      const keys = await redis.keys(`structure:${pair}:*`);
      if (keys.length > 0) await redis.del(...keys);
    }
  },

  async getAllPairs(): Promise<string[]> {
    const redis = getRedisClient();
    const keys = await redis.keys('structure:*');
    // Extract unique pair names from `structure:PAIR:TF` format
    const pairs = new Set<string>();
    keys.forEach(k => {
      const parts = k.replace('structure:', '').split(':');
      if (parts.length >= 2) pairs.add(parts.slice(0, -1).join(':'));
      else pairs.add(parts[0]);
    });
    return Array.from(pairs);
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
