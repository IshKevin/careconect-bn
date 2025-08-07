import { Response} from 'express';
import { StatusCodes } from 'http-status-codes';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env';


// Interface for API response
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown[];
    documentation?: string;
    supportContact?: string;
  };
  metadata: {
    requestId: string;
    timestamp: string;
    version: string;
    region: string;
    processingTime?: string;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  links?: {
    self: string;
    next?: string;
    prev?: string;
    first?: string;
    last?: string;
  };
}

// Pagination parameters
export interface PaginationParams {
  page?: number;
  limit?: number;
}

// Generate request ID
export const generateRequestId = (): string => {
  return uuidv4();
};

// Create standardized API response
export const createApiResponse = <T>(
  data?: T,
  requestId?: string,
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  },
  links?: {
    self: string;
    next?: string;
    prev?: string;
    first?: string;
    last?: string;
  }
): ApiResponse<T> => {
  const response: ApiResponse<T> = {
    success: true,
    metadata: {
      requestId: requestId || generateRequestId(),
      timestamp: new Date().toISOString(),
      version: config.apiVersion,
      region: 'rw-central',
    },
  };

  if (data !== undefined) {
    response.data = data;
  }

  if (pagination) {
    response.pagination = pagination;
  }

  if (links) {
    response.links = links;
  }

  return response;
};

// Create error response
export const createErrorResponse = (
  code: string,
  message: string,
  details?: unknown[],
  requestId?: string,
  documentation?: string,
  supportContact?: string
): ApiResponse => {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      documentation: documentation || `https://docs.api.healthsystem.rw/errors/${code.toLowerCase()}`,
      supportContact: supportContact || 'api-support@healthsystem.rw',
    },
    metadata: {
      requestId: requestId || generateRequestId(),
      timestamp: new Date().toISOString(),
      version: config.apiVersion,
      region: 'rw-central',
    },
  };

  if (details !== undefined) {
    response.error!.details = details;
  }

  return response;
};

// Response helpers
export const responseHelpers = {
  success: <T>(res: Response, data: T, statusCode: number = StatusCodes.OK, requestId?: string): Response => {
    const response = createApiResponse(data, requestId);
    return res.status(statusCode).json(response);
  },

  created: <T>(res: Response, data: T, requestId?: string): Response => {
    const response = createApiResponse(data, requestId);
    return res.status(StatusCodes.CREATED).json(response);
  },

  noContent: (res: Response, requestId?: string): Response => {
    const response = createApiResponse(undefined, requestId);
    return res.status(StatusCodes.NO_CONTENT).json(response);
  },

  paginated: <T>(
    res: Response,
    data: T[],
    pagination: PaginationParams & { total: number },
    baseUrl: string,
    requestId?: string
  ): Response => {
    const { page = 1, limit = 20, total } = pagination;
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    const paginationInfo = {
      page,
      limit,
      total,
      totalPages,
      hasNext,
      hasPrev,
    };

    const links = {
      self: `${baseUrl}?page=${page}&limit=${limit}`,
      ...(hasNext && { next: `${baseUrl}?page=${page + 1}&limit=${limit}` }),
      ...(hasPrev && { prev: `${baseUrl}?page=${page - 1}&limit=${limit}` }),
      first: `${baseUrl}?page=1&limit=${limit}`,
      last: `${baseUrl}?page=${totalPages}&limit=${limit}`,
    };

    const response = createApiResponse(data, requestId, paginationInfo, links);
    return res.status(StatusCodes.OK).json(response);
  },

  badRequest: (res: Response, message: string, details?: unknown[], requestId?: string): Response => {
    const response = createErrorResponse('BAD_REQUEST', message, details, requestId);
    return res.status(StatusCodes.BAD_REQUEST).json(response);
  },

  unauthorized: (res: Response, message: string = 'Authentication required', requestId?: string): Response => {
    const response = createErrorResponse('UNAUTHORIZED', message, undefined, requestId);
    return res.status(StatusCodes.UNAUTHORIZED).json(response);
  },

  forbidden: (res: Response, message: string = 'Access denied', requestId?: string): Response => {
    const response = createErrorResponse('FORBIDDEN', message, undefined, requestId);
    return res.status(StatusCodes.FORBIDDEN).json(response);
  },

  notFound: (res: Response, message: string = 'Resource not found', requestId?: string): Response => {
    const response = createErrorResponse('NOT_FOUND', message, undefined, requestId);
    return res.status(StatusCodes.NOT_FOUND).json(response);
  },

  conflict: (res: Response, message: string, requestId?: string): Response => {
    const response = createErrorResponse('CONFLICT', message, undefined, requestId);
    return res.status(StatusCodes.CONFLICT).json(response);
  },

  unprocessableEntity: (res: Response, message: string, details?: unknown[], requestId?: string): Response => {
    const response = createErrorResponse('UNPROCESSABLE_ENTITY', message, details, requestId);
    return res.status(StatusCodes.UNPROCESSABLE_ENTITY).json(response);
  },

  tooManyRequests: (res: Response, message: string = 'Rate limit exceeded', requestId?: string): Response => {
    const response = createErrorResponse('TOO_MANY_REQUESTS', message, undefined, requestId);
    return res.status(StatusCodes.TOO_MANY_REQUESTS).json(response);
  },

  internalServerError: (res: Response, message: string = 'Internal server error', requestId?: string): Response => {
    const response = createErrorResponse('INTERNAL_SERVER_ERROR', message, undefined, requestId);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(response);
  },

  serviceUnavailable: (res: Response, message: string = 'Service temporarily unavailable', requestId?: string): Response => {
    const response = createErrorResponse('SERVICE_UNAVAILABLE', message, undefined, requestId);
    return res.status(StatusCodes.SERVICE_UNAVAILABLE).json(response);
  },

  validationError: (
    res: Response,
    errors: Array<{ field: string; message: string; code: string }>,
    requestId?: string
  ): Response => {
    const response = createErrorResponse('VALIDATION_ERROR', 'Invalid input parameters', errors, requestId);
    return res.status(StatusCodes.BAD_REQUEST).json(response);
  },

  customError: (
    res: Response,
    statusCode: number,
    code: string,
    message: string,
    details?: unknown[],
    requestId?: string
  ): Response => {
    const response = createErrorResponse(code, message, details, requestId);
    return res.status(statusCode).json(response);
  },
};

// Pagination utilities
export const paginationUtils = {
  calculatePagination: (page: number = 1, limit: number = 20, total: number) => {
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;
    const offset = (page - 1) * limit;

    return {
      page,
      limit,
      total,
      totalPages,
      hasNext,
      hasPrev,
      offset,
    };
  },

  validatePagination: (page?: number, limit?: number) => {
    const validatedPage = Math.max(1, page || 1);
    const validatedLimit = Math.min(100, Math.max(1, limit || 20));

    return {
      page: validatedPage,
      limit: validatedLimit,
    };
  },

  generateLinks: (baseUrl: string, page: number, limit: number, totalPages: number) => {
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
      self: `${baseUrl}?page=${page}&limit=${limit}`,
      ...(hasNext && { next: `${baseUrl}?page=${page + 1}&limit=${limit}` }),
      ...(hasPrev && { prev: `${baseUrl}?page=${page - 1}&limit=${limit}` }),
      first: `${baseUrl}?page=1&limit=${limit}`,
      last: `${baseUrl}?page=${totalPages}&limit=${limit}`,
    };
  },
};

// Response timing utilities
export const timingUtils = {
  startTiming: (): [number, number] => {
    return process.hrtime();
  },

  endTiming: (startTime: [number, number]): string => {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const milliseconds = seconds * 1000 + nanoseconds / 1000000;
    return `${milliseconds.toFixed(2)}ms`;
  },

  addTiming: <T>(response: ApiResponse<T>, startTime: [number, number]): ApiResponse<T> => {
    const processingTime = timingUtils.endTiming(startTime);
    return {
      ...response,
      metadata: {
        ...response.metadata,
        processingTime,
      },
    };
  },
};