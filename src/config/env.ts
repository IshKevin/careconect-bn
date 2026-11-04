import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

dotenvConfig();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  API_VERSION: z.string().default('v1'),
  FRONTEND_URL: z.string().url().default('http://localhost:3001'),
  CORS_ORIGIN: z.string().default('http://localhost:3001'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DB_MAX_CONNECTIONS: z.string().transform(Number).default('20'),
  DB_IDLE_TIMEOUT: z.string().transform(Number).default('20'),
  DB_CONNECT_TIMEOUT: z.string().transform(Number).default('10'),
  // 'require' for Neon or any hosted Postgres; 'disable' for the local Docker Postgres container.
  DATABASE_SSL: z.enum(['require', 'prefer', 'disable']).default('require'),

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

  // Pesapal (https://developer.pesapal.com). Sandbox and production use different hosts.
  PESAPAL_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
  PESAPAL_CONSUMER_KEY: z.string().optional(),
  PESAPAL_CONSUMER_SECRET: z.string().optional(),
  PESAPAL_IPN_ID: z.string().optional(),
  PESAPAL_IPN_URL: z.string().url().optional(),
  PESAPAL_CALLBACK_URL: z.string().url().optional(),
  PESAPAL_REFUNDS_ENABLED: z.enum(['true', 'false']).default('false'),
  RECONCILIATION_INTERVAL_HOURS: z.coerce.number().min(0).default(24),

  // Resend (https://resend.com)
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_ADDRESS: z.string().default('IsanoMed <no-reply@careconnect.rw>'),
  RESEND_REPLY_TO: z.string().optional(),
  RESEND_WEBHOOK_SECRET: z.string().optional(),

  // Internal video calls: WebRTC media between browsers, signalling on this server,
  // and a self-hosted TURN relay (coturn) for networks that block direct connections.
  VIDEO_STUN_URLS: z.string().default('stun:coturn:3478'),
  VIDEO_TURN_URLS: z.string().default('turn:coturn:3478?transport=udp'),
  VIDEO_TURN_SECRET: z.string().min(32, 'VIDEO_TURN_SECRET must be at least 32 characters').optional(),
  VIDEO_JOIN_WINDOW_BEFORE_MIN: z.string().transform(Number).default('15'),
  VIDEO_JOIN_WINDOW_AFTER_MIN: z.string().transform(Number).default('30'),
});

const parsed = envSchema.parse(process.env);

// Production must not start with missing provider secrets (OPS-01).
const requiredInProduction: Array<keyof typeof parsed> = [
  'PESAPAL_CONSUMER_KEY',
  'PESAPAL_CONSUMER_SECRET',
  'PESAPAL_IPN_ID',
  'PESAPAL_IPN_URL',
  'PESAPAL_CALLBACK_URL',
  'RESEND_API_KEY',
  'VIDEO_TURN_SECRET',
];

if (parsed.NODE_ENV === 'production') {
  const missing = requiredInProduction.filter((key) => !parsed[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }
}

const envVars = parsed;

export const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  apiVersion: envVars.API_VERSION,
  frontendUrl: envVars.FRONTEND_URL,
  corsOrigin: envVars.CORS_ORIGIN,

  database: {
    url: envVars.DATABASE_URL,
    // postgres-js takes `false` (not "disable") to turn SSL off.
    ssl: envVars.DATABASE_SSL === 'disable' ? false : envVars.DATABASE_SSL,
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
    languages: ['en', 'rw', 'fr'],
  },

  reconciliation: {
    intervalHours: envVars.RECONCILIATION_INTERVAL_HOURS,
  },
  pesapal: {
    environment: envVars.PESAPAL_ENVIRONMENT,
    consumerKey: envVars.PESAPAL_CONSUMER_KEY,
    consumerSecret: envVars.PESAPAL_CONSUMER_SECRET,
    ipnId: envVars.PESAPAL_IPN_ID,
    ipnUrl: envVars.PESAPAL_IPN_URL,
    callbackUrl: envVars.PESAPAL_CALLBACK_URL,
    refundsEnabled: envVars.PESAPAL_REFUNDS_ENABLED === 'true',
    currency: envVars.DEFAULT_CURRENCY,
  },

  email: {
    resendApiKey: envVars.RESEND_API_KEY,
    fromAddress: envVars.RESEND_FROM_ADDRESS,
    replyTo: envVars.RESEND_REPLY_TO,
    webhookSecret: envVars.RESEND_WEBHOOK_SECRET,
  },

  video: {
    stunUrls: envVars.VIDEO_STUN_URLS.split(',').map((url) => url.trim()).filter(Boolean),
    turnUrls: envVars.VIDEO_TURN_URLS.split(',').map((url) => url.trim()).filter(Boolean),
    turnSecret: envVars.VIDEO_TURN_SECRET,
    joinWindowBeforeMin: envVars.VIDEO_JOIN_WINDOW_BEFORE_MIN,
    joinWindowAfterMin: envVars.VIDEO_JOIN_WINDOW_AFTER_MIN,
  },
} as const;
