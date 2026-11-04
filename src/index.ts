import { createServer } from 'http';
import { app } from './app';
import { config } from './config/env';
import { testConnection, closeConnection } from './config/database';
import { logger } from './config/logger';
import { attachVideoSignaling } from './realtime/video-signaling';
import { runReconciliation } from './services/reconciliation.service';

// Server startup function
const startServer = async (): Promise<void> => {
  try {
    // Test database connection
    logger.info('Testing database connection...');
    const isConnected = await testConnection();
    
    if (!isConnected) {
      throw new Error('Database connection failed');
    }

    // Start the server
    const server = createServer(app);
    attachVideoSignaling(server, config.corsOrigin.split(',').map((origin) => origin.trim()));

    server.listen(config.port, () => {
      logger.info('Server started successfully', {
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
      logger.info('Server endpoints available:', {
        health: `${baseUrl}/health`,
        api: `${baseUrl}/api/${config.apiVersion}`,
      });
    });

    // PAY-07: scheduled reconciliation (off when RECONCILIATION_INTERVAL_HOURS=0).
    if (config.reconciliation.intervalHours > 0) {
      const everyMs = config.reconciliation.intervalHours * 60 * 60 * 1000;
      setInterval(() => {
        runReconciliation('schedule').catch((error) => logger.error('Scheduled reconciliation failed', error));
      }, everyMs).unref();
    }

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received, starting graceful shutdown...`);

      // Stop accepting new connections
      server.close(async (error) => {
        if (error) {
          logger.error('Error during server shutdown:', error);
          process.exit(1);
        }

        try {
          // Close database connections
          logger.info('Closing database connections...');
          await closeConnection();
          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (shutdownError) {
          logger.error('Error during graceful shutdown:', shutdownError);
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${config.port} is already in use`);
      } else if (error.code === 'EACCES') {
        logger.error(`Permission denied to bind to port ${config.port}`);
      } else {
        logger.error('Server error:', error);
      }
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer().catch((error) => {
  logger.error('Unhandled error during server startup:', error);
  process.exit(1);
});