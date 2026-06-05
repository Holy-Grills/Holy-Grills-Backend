import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),
  API_BASE_URL: z.string().url().default("http://localhost:4000"),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003"),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  STORE_TIMEZONE: z.string().default("Africa/Lagos"),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
  ADMIN_BOOTSTRAP_TOKEN: z.string().optional().default(""),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_OAUTH_REDIRECT_URL: z.string().url().optional().default("http://localhost:4000/api/v1/auth/google/callback"),
  PAYSTACK_SECRET_KEY: z.string().optional().default(""),
  PAYSTACK_CALLBACK_URL: z.string().url().optional().default("http://localhost:3000/payment/callback"),
  EMAIL_PROVIDER_API_KEY: z.string().optional().default(""),
  WEB_PUSH_PUBLIC_KEY: z.string().optional().default(""),
  WEB_PUSH_PRIVATE_KEY: z.string().optional().default(""),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  ADMIN_BASE_URL: z.string().url().default("http://localhost:3001"),
  KITCHEN_BASE_URL: z.string().url().default("http://localhost:3002"),
  RIDER_BASE_URL: z.string().url().default("http://localhost:3003")
});

export const env = envSchema.parse(process.env);

export const corsOrigins = env.CORS_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
