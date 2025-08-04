import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

// Security headers middleware
export const securityHeaders = (_req: Request, res: Response, next: NextFunction): void => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Add security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
  });
  
  next();
};

// IP whitelist middleware (for admin endpoints)
export const ipWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIP = req.ip || req.connection.remoteAddress || '';
    
    if (!allowedIPs.includes(clientIP)) {
      logger.warn('IP not whitelisted', {
        ip: clientIP,
        url: req.url,
        method: req.method,
        userAgent: req.get('User-Agent'),
      });
      
      res.status(403).json({
        success: false,
        error: {
          code: 'IP_NOT_ALLOWED',
          message: 'Access denied from this IP address',
        },
        metadata: {
          requestId: (req as any).requestId || '',
          timestamp: new Date().toISOString(),
          version: 'v1',
          region: 'rw-central',
        },
      });
      return;
    }
    
    next();
  };
};

// Request size limiter
export const requestSizeLimiter = (maxSize: number) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.get('Content-Length') || '0', 10);
    
    if (contentLength > maxSize) {
      logger.warn('Request size exceeded', {
        contentLength,
        maxSize,
        ip: req.ip,
        url: req.url,
        method: req.method,
      });
      
      res.status(413).json({
        success: false,
        error: {
          code: 'REQUEST_TOO_LARGE',
          message: `Request size exceeds maximum allowed size of ${maxSize} bytes`,
        },
        metadata: {
          requestId: (req as any).requestId || '',
          timestamp: new Date().toISOString(),
          version: 'v1',
          region: 'rw-central',
        },
      });
      return;
    }
    
    next();
  };
};

// User agent validation
export const validateUserAgent = (req: Request, res: Response, next: NextFunction): void => {
  const userAgent = req.get('User-Agent');
  
  if (!userAgent) {
    logger.warn('Missing User-Agent header', {
      ip: req.ip,
      url: req.url,
      method: req.method,
    });
    
    res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_USER_AGENT',
        message: 'User-Agent header is required',
      },
      metadata: {
        requestId: (req as any).requestId || '',
        timestamp: new Date().toISOString(),
        version: 'v1',
        region: 'rw-central',
      },
    });
    return;
  }
  
  // Check for suspicious user agents
  const suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
  ];
  
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(userAgent));
  
  if (isSuspicious) {
    logger.warn('Suspicious User-Agent detected', {
      userAgent,
      ip: req.ip,
      url: req.url,
      method: req.method,
    });
    
    // Don't block, just log for monitoring
  }
  
  next();
};

// API key validation middleware
export const validateApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.get('X-API-Key');
  
  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_API_KEY',
        message: 'API key is required',
      },
      metadata: {
        requestId: (req as any).requestId || '',
        timestamp: new Date().toISOString(),
        version: 'v1',
        region: 'rw-central',
      },
    });
    return;
  }
  
  // TODO: Validate API key against database
  // For now, just check if it's not empty
  if (apiKey.length < 32) {
    logger.warn('Invalid API key format', {
      apiKey: apiKey.substring(0, 8) + '...',
      ip: req.ip,
      url: req.url,
      method: req.method,
    });
    
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_API_KEY',
        message: 'Invalid API key format',
      },
      metadata: {
        requestId: (req as any).requestId || '',
        timestamp: new Date().toISOString(),
        version: 'v1',
        region: 'rw-central',
      },
    });
    return;
  }
  
  next();
};

// Content type validation
export const validateContentType = (allowedTypes: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentType = req.get('Content-Type');
    
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      if (!contentType) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_CONTENT_TYPE',
            message: 'Content-Type header is required',
          },
          metadata: {
            requestId: (req as any).requestId || '',
            timestamp: new Date().toISOString(),
            version: 'v1',
            region: 'rw-central',
          },
        });
        return;
      }
      
      const isAllowed = allowedTypes.some(type => contentType.includes(type));
      
      if (!isAllowed) {
        res.status(415).json({
          success: false,
          error: {
            code: 'UNSUPPORTED_MEDIA_TYPE',
            message: `Content-Type '${contentType}' is not supported. Allowed types: ${allowedTypes.join(', ')}`,
          },
          metadata: {
            requestId: (req as any).requestId || '',
            timestamp: new Date().toISOString(),
            version: 'v1',
            region: 'rw-central',
          },
        });
        return;
      }
    }
    
    next();
  };
};
