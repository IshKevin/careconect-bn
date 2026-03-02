import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import compression from 'compression';
import { config } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { requestId } from './middleware/requestId';
import 'express-async-errors';
import { apiRouter } from './routes';
import { healthCheck } from './config/database';

// Create Express application
const app = express();

// Trust proxy for accurate IP addresses (Neon or other cloud proxies)
app.set('trust proxy', 1);



// Apply CORS middleware
app.use(cors());

// Request ID middleware (must be early in the chain)
app.use(requestId);

// HTTP request logging
if (config.env !== 'test') {
  app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
}

// Compression middleware
app.use(compression());

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
}));

// Body parsing middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Health check endpoint
app.get('/health', async (_req, res) => {
  const dbHealth = await healthCheck();
  const isHealthy = dbHealth.status === 'healthy';
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: config.apiVersion,
    environment: config.env,
    services: {
      database: dbHealth,
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100),
    },
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'CareConnect Rwanda Healthcare Management System API',
    version: config.apiVersion,
    environment: config.env,
    health: `${req.protocol}://${req.get('host')}/health`,
    timestamp: new Date().toISOString(),
  });
});

app.use(apiRouter);

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

export { app };