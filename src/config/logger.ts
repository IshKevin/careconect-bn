import winston from 'winston';
import { config } from './env';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
};

// Add colors to winston
winston.addColors(colors);

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Determine log level based on environment
const getLogLevel = (): string => {
  switch (config.env) {
    case 'production':
      return 'warn';
    case 'test':
      return 'error';
    case 'development':
    default:
      return 'debug';
  }
};

// Create transports array
const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    level: getLogLevel(),
    format: consoleFormat,
  }),
];

// Add file transport if not in test environment
if (config.env !== 'test') {
  transports.push(
    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/app.log',
      level: getLogLevel(),
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Separate file for errors
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: fileFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Create logger instance
export const logger = winston.createLogger({
  levels,
  level: getLogLevel(),
  transports,
  exitOnError: false,
  // Don't log in test environment unless explicitly set
  silent: config.env === 'test' && !process.env['ENABLE_LOGGING'],
});

// Create a stream object for Morgan HTTP logging
export const loggerStream = {
  write: (message: string): void => {
    logger.info(message.trim());
  },
};

// Helper functions for structured logging
export const logHelpers = {
  // Log user action
  logUserAction: (userId: string, action: string, details?: Record<string, unknown>): void => {
    logger.info('User action', {
      userId,
      action,
      ...details,
      timestamp: new Date().toISOString(),
    });
  },

  // Log API request
  logApiRequest: (
    method: string,
    url: string,
    userId?: string,
    statusCode?: number,
    responseTime?: number
  ): void => {
    logger.info('API request', {
      method,
      url,
      userId,
      statusCode,
      responseTime,
      timestamp: new Date().toISOString(),
    });
  },

  // Log database operation
  logDbOperation: (
    operation: string,
    table: string,
    userId?: string,
    details?: Record<string, unknown>
  ): void => {
    logger.info('Database operation', {
      operation,
      table,
      userId,
      ...details,
      timestamp: new Date().toISOString(),
    });
  },

  // Log security event
  logSecurityEvent: (
    event: string,
    userId?: string,
    ipAddress?: string,
    details?: Record<string, unknown>
  ): void => {
    logger.warn('Security event', {
      event,
      userId,
      ipAddress,
      ...details,
      timestamp: new Date().toISOString(),
    });
  },

  // Log payment event
  logPaymentEvent: (
    event: string,
    paymentId: string,
    userId?: string,
    amount?: number,
    details?: Record<string, unknown>
  ): void => {
    logger.info('Payment event', {
      event,
      paymentId,
      userId,
      amount,
      ...details,
      timestamp: new Date().toISOString(),
    });
  },

  // Log error with context
  logError: (
    error: Error,
    context?: string,
    userId?: string,
    details?: Record<string, unknown>
  ): void => {
    logger.error('Application error', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context,
      userId,
      ...details,
      timestamp: new Date().toISOString(),
    });
  },

  // Log performance metric
  logPerformance: (
    operation: string,
    duration: number,
    details?: Record<string, unknown>
  ): void => {
    logger.info('Performance metric', {
      operation,
      duration,
      ...details,
      timestamp: new Date().toISOString(),
    });
  },

  // Log system health
  logSystemHealth: (
    component: string,
    status: 'healthy' | 'unhealthy',
    details?: Record<string, unknown>
  ): void => {
    const level = status === 'healthy' ? 'info' : 'error';
    logger.log(level, 'System health check', {
      component,
      status,
      ...details,
      timestamp: new Date().toISOString(),
    });
  },
};