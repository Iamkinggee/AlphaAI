import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  
  // Supabase
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  
  // Redis
  REDIS_URL: z.string().url().optional(),
  
  // Binance
  BINANCE_API_KEY: z.string().optional(),
  BINANCE_API_SECRET: z.string().optional(),
  
  // Groq (LLM — free tier available at console.groq.com)
  GROQ_API_KEY: z.string().optional(),
  
  // Security
  JWT_SECRET: z.string().min(32, 'JWT_SECRET should be at least 32 characters').optional(),

  // API hardening
  // Comma-separated list of allowed origins for CORS in production. Example:
  // https://alphaai.app,https://staging.alphaai.app
  CORS_ORIGINS: z.string().optional(),

  // Admin-only maintenance endpoints (server-side / internal tooling).
  // Required for production for endpoints guarded by requireAdmin().
  ADMIN_API_KEY: z.string().min(16).optional(),
}).superRefine((val, ctx) => {
  if (val.NODE_ENV === 'production') {
    if (!val.JWT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET is required in production (min 32 chars)',
      });
    }
    if (!val.CORS_ORIGINS || val.CORS_ORIGINS.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGINS'],
        message: 'CORS_ORIGINS is required in production (comma-separated allowlist)',
      });
    }
  }
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const config = _env.data;
