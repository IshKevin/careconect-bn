import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

dotenvConfig();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  API_VERSION: z.string().default('v1'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DB_MAX_CONNECTIONS: z.string().transform(Number).default('20'),
  DB_IDLE_TIMEOUT: z.string().transform(Number).default('20'),
  DB_CONNECT_TIMEOUT: z.string().transform(Number).default('10'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_RESET_SECRET: z.string().min(32, 'JWT_RESET_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  JWT_ISSUER: z.string().default('careconnect-bn'),
  JWT_AUDIENCE: z.string().default('careconnect-api'),

  ENCRYPTION_KEY: z.string().length(32, 'ENCRYPTION_KEY must be exactly 32 characters'),
  HASH_SALT_ROUNDS: z.string().transform(Number).default('12'),

  RWANDA_TIMEZONE: z.string().default('Africa/Kigali'),
  DEFAULT_CURRENCY: z.string().default('RWF'),
});

const envVars = envSchema.parse(process.env);

export const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  apiVersion: envVars.API_VERSION,

  database: {
    url: envVars.DATABASE_URL,
    maxConnections: envVars.DB_MAX_CONNECTIONS,
    idleTimeout: envVars.DB_IDLE_TIMEOUT,
    connectTimeout: envVars.DB_CONNECT_TIMEOUT,
  },

  jwt: {
    secret: envVars.JWT_SECRET,
    refreshSecret: envVars.JWT_REFRESH_SECRET,
    resetSecret: envVars.JWT_RESET_SECRET,
    expiresIn: envVars.JWT_EXPIRES_IN,
    refreshExpiresIn: envVars.JWT_REFRESH_EXPIRES_IN,
    issuer: envVars.JWT_ISSUER,
    audience: envVars.JWT_AUDIENCE,
  },

  encryption: {
    key: envVars.ENCRYPTION_KEY,
    saltRounds: envVars.HASH_SALT_ROUNDS,
  },

  rwanda: {
    timezone: envVars.RWANDA_TIMEZONE,
    currency: envVars.DEFAULT_CURRENCY,
  },
} as const;