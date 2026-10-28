import path from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { config } from '../config/env';

// Applies pending SQL migrations, then exits. Run before the API starts (see docker-compose.yml).
const run = async (): Promise<void> => {
  const client = postgres(config.database.url, { max: 1, ssl: config.database.ssl });
  try {
    // Works from both src (ts-node/tsx) and dist (compiled): migrations live in src/db/migrations.
    const migrationsFolder = path.resolve(__dirname, '..', '..', 'src', 'db', 'migrations');
    await migrate(drizzle(client), { migrationsFolder });
    console.log('Migrations applied');
  } finally {
    await client.end();
  }
};

run().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
