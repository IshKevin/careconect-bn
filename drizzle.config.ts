import type { Config } from 'drizzle-kit';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig();


export default {
  schema: './src/db/schemas/*',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
   url: process.env.DATABASE_URL as string,
  },
} satisfies Config;