import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from './env';
import * as schema from '@/db/schemas';

const connectionString = config.database.url;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

// Create postgres client with Neon-optimized settings
const client = postgres(connectionString, {
  max: 20, // Maximum number of connections
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Connection timeout in seconds
  ssl: 'require', // Neon requires SSL
  prepare: false, // Disable prepared statements for better compatibility with Neon
});

// Create drizzle instance
export const db = drizzle(client, {
  schema,
  logger: config.env === 'development'
});

// Test connection function
export const testConnection = async (): Promise<boolean> => {
  try {
    await client`SELECT 1`;
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
};

// Close connection function
export const closeConnection = async (): Promise<void> => {
  try {
    await client.end();
    console.log('🔌 Database connection closed');
  } catch (error) {
    console.error('Error closing database connection:', error);
  }
};

// Health check function
export const healthCheck = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  latency?: number;
  error?: string;
}> => {
  try {
    const start = Date.now();
    await client`SELECT 1`;
    const latency = Date.now() - start;
    
    return {
      status: 'healthy',
      latency
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};