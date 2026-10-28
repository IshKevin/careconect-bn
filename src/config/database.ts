import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from './env';
import * as schema from '../db/schemas/index';

const connectionString = config.database.url;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

// Postgres client. SSL is set by DATABASE_SSL: 'require' for Neon, 'disable' for the local container.
const client = postgres(connectionString, {
  max: config.database.maxConnections,
  idle_timeout: config.database.idleTimeout,
  connect_timeout: config.database.connectTimeout,
  ssl: config.database.ssl,
  prepare: false, // Disable prepared statements for better compatibility with pooled proxies
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

// Helper function to execute raw SQL queries
export const executeRawQuery = async <T = any>(
  strings: TemplateStringsArray,
  ...values: any[]
): Promise<T[]> => {
  try {
    const result = await client(strings, ...values);
    return result as unknown as T[];
  } catch (error) {
    console.error('Raw query execution failed:', error);
    throw error;
  }
};