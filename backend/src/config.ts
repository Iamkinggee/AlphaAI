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
  JWT_SECRET: z.string().min(32, "JWT_SECRET should be at least 32 characters").default('super-secret-development-key-alpha-ai'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const config = _env.data;
