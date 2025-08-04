import { app } from './app';
import { config } from '@/config/env';
import { Pool } from 'pg';

// Initialize database connection
const pool = new Pool({
  connectionString: config.database.url,
  ssl: { rejectUnauthorized: false }, // Neon requires SSL
});

// Server startup function
const startServer = async (): Promise<void> => {
  try {
    // Test database connection
    console.log('Testing database connection...');
    const result = await pool.query('SELECT NOW()');
    console.log('Database connection successful:', result.rows[0].now);

    // Start the server
    const server = app.listen(config.port, () => {
      console.log('Server started successfully', {
        port: config.port,
        environment: config.env,
        version: config.apiVersion,
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      });

      // Log server URLs
      const baseUrl = `http://localhost:${config.port}`;
      console.log('Server endpoints available:', {
        health: `${baseUrl}/health`,
      });
    });

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string): Promise<void> => {
      console.log(`${signal} received, starting graceful shutdown...`);

      // Stop accepting new connections
      server.close(async (error) => {
        if (error) {
          console.error('Error during server shutdown:', error);
          process.exit(1);
        }

        try {
          // Close database connections
          console.log('Closing database connections...');
          await pool.end();
          console.log('Graceful shutdown completed');
          process.exit(0);
        } catch (shutdownError) {
          console.error('Error during graceful shutdown:', shutdownError);
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${config.port} is already in use`);
      } else if (error.code === 'EACCES') {
        console.error(`Permission denied to bind to port ${config.port}`);
      } else {
        console.error('Server error:', error);
      }
      process.exit(1);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer().catch((error) => {
  console.error('Unhandled error during server startup:', error);
  process.exit(1);
});