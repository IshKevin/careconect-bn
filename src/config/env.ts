import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';


dotenvConfig();


const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  API_VERSION: z.string().default('v1'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('24h'),

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
  },

  jwt: {
    secret: envVars.JWT_SECRET,
    expiresIn: envVars.JWT_EXPIRES_IN,
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