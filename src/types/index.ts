import { Request } from 'express';
import { User } from '../db/schemas/users';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}



declare module 'express' {
  interface Request {
    requestId?: string;
    user?: { userId: string; userType: string };
  }
}

// User types
export type UserType = 'patient' | 'doctor' | 'admin' | 'super_admin' | 'sponsor';

export type AccountStatus = 'active' | 'inactive' | 'suspended' | 'pending_verification' | 'deactivated';

export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export type AddressType = 'home' | 'work' | 'billing' | 'emergency' | 'mailing';

// Authentication types
export type MfaMethodType = 'sms' | 'email' | 'totp' | 'backup_codes' | 'biometric';

export interface JwtPayload {
  userId: string;
  email: string;
  userType: UserType;
  sessionId: string;
  permissions?: string[];
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    userType: UserType;
    sessionId: string;
    permissions?: string[];
  };
}

// Medical types
export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown';

export type ConditionType = 'allergy' | 'chronic_condition' | 'past_surgery' | 'family_history' | 'medication' | 'mental_health' | 'vaccination';

export type Severity = 'mild' | 'moderate' | 'severe' | 'critical' | 'life_threatening';

export type AllergenType = 'drug' | 'food' | 'environmental' | 'latex' | 'other';

export type MedicationRoute = 'oral' | 'injection' | 'topical' | 'inhalation' | 'sublingual' | 'rectal' | 'other';

export type VitalType = 'blood_pressure' | 'heart_rate' | 'temperature' | 'respiratory_rate' | 'oxygen_saturation' | 'weight' | 'height' | 'bmi';

// Appointment types
export type AppointmentType = 'consultation' | 'follow_up' | 'emergency' | 'telemedicine' | 'routine_checkup' | 'specialist_referral' | 'vaccination';

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled' | 'waiting';

export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'partially_paid' | 'failed' | 'disputed';

// Doctor types
export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'suspended' | 'expired' | 'under_review';

export type ConsultationFeeTier = 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4' | 'premium' | 'emergency';

export type FacilityType = 'hospital' | 'clinic' | 'private_practice' | 'health_center' | 'telemedicine_only' | 'mobile_clinic';

export type DoctorAvailabilityStatus = 'available' | 'busy' | 'offline' | 'in_consultation' | 'break';

export type SpecializationType =
  | 'general_medicine'
  | 'cardiology'
  | 'dermatology'
  | 'endocrinology'
  | 'gastroenterology'
  | 'neurology'
  | 'oncology'
  | 'orthopedics'
  | 'pediatrics'
  | 'psychiatry'
  | 'radiology'
  | 'surgery'
  | 'gynecology'
  | 'ophthalmology'
  | 'ent'
  | 'urology'
  | 'emergency_medicine'
  | 'family_medicine'
  | 'internal_medicine'
  | 'other';

// Consultation types
export type ConsultationType = 'initial' | 'follow_up' | 'emergency' | 'second_opinion' | 'telemedicine' | 'group_consultation';

export type DiagnosisType = 'primary' | 'secondary' | 'differential' | 'rule_out' | 'provisional';

export type CertaintyLevel = 'confirmed' | 'probable' | 'possible' | 'ruled_out' | 'under_investigation';

export type ConsultationStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

// Payment types
export type PaymentMethod = 'mtn_momo' | 'airtel_money' | 'bank_transfer' | 'cash' | 'card' | 'insurance' | 'voucher';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'refunded' | 'disputed' | 'partially_paid';

export type PaymentTransactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded' | 'expired';

export type CurrencyCode = 'RWF' | 'USD' | 'EUR';

// Communication types
export type ConversationType = 'patient_doctor' | 'patient_admin' | 'doctor_admin' | 'group' | 'emergency' | 'support';

export type MessageType = 'text' | 'image' | 'document' | 'voice' | 'video' | 'system_notification' | 'appointment_update';

export type MessageStatus = 'sent' | 'delivered' | 'read' | 'deleted' | 'failed';

export type NotificationType =
  | 'appointment_reminder'
  | 'payment_due'
  | 'test_results'
  | 'system_alert'
  | 'marketing'
  | 'medication_reminder'
  | 'follow_up_reminder'
  | 'emergency_alert'
  | 'welcome'
  | 'verification'
  | 'security_alert';

export type DeliveryMethod = 'in_app' | 'email' | 'sms' | 'push_notification' | 'whatsapp';

export type PriorityLevel = 'low' | 'medium' | 'high' | 'urgent' | 'critical';

// Document types
export type DocumentType =
  | 'medical_record'
  | 'prescription'
  | 'lab_result'
  | 'imaging'
  | 'insurance'
  | 'identification'
  | 'vaccination_card'
  | 'discharge_summary'
  | 'referral_letter'
  | 'consent_form'
  | 'other';

export type PermissionLevel = 'view_only' | 'download' | 'edit' | 'admin' | 'full_access';

export type DocumentStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'archived' | 'expired';

// Location types (Rwanda-specific)
export type Province = 'Kigali' | 'Eastern' | 'Northern' | 'Southern' | 'Western';

export type DistrictKigali = 'Gasabo' | 'Kicukiro' | 'Nyarugenge';

export type LanguageCode = 'en' | 'rw' | 'fr';

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown[];
    documentation?: string;
    supportContact?: string;
    timestamp?: string;
  };
  metadata: {
    requestId: string;
    timestamp: string;
    version: string;
    processingTime?: string;
    region: string;
    environment?: string;
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

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  cursor?: string;
}

export interface FilterParams {
  search?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  type?: string;
  category?: string;
  tags?: string[];
}

// Error types
export interface AppError extends Error {
  statusCode: number;
  code: string;
  isOperational: boolean;
  details?: unknown;
  context?: Record<string, unknown>;
  timestamp?: string;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown[];
    timestamp: string;
    requestId: string;
    supportReference?: string;
  };
}

// Validation types
export interface ValidationError {
  field: string;
  code: string;
  message: string;
  value?: unknown;
  constraint?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// Audit types
export interface AuditLogData {
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  outcome: 'success' | 'failure' | 'partial';
  metadata?: Record<string, unknown>;
}

// Health check types
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: ServiceHealth;
    redis?: ServiceHealth;
    external_apis: ServiceHealth;
    storage?: ServiceHealth;
    queue?: ServiceHealth;
  };
  metrics: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
    connections: {
      active: number;
      total: number;
    };
  };
}

export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  latency?: number;
  lastCheck: string;
  error?: string;
}

// File upload types
export interface FileUploadResult {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  path: string;
  url: string;
  checksum?: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface FileUploadOptions {
  maxSize?: number;
  allowedTypes?: string[];
  compress?: boolean;
  generateThumbnail?: boolean;
}

// Search types
export interface SearchParams {
  query: string;
  filters?: Record<string, unknown>;
  pagination?: PaginationParams;
  highlight?: boolean;
  fuzzy?: boolean;
  boost?: Record<string, number>;
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  facets?: Record<string, Record<string, number>>;
  suggestions?: string[];
  queryTime: number;
  aggregations?: Record<string, unknown>;
}

// Analytics types
export interface AnalyticsEvent {
  eventType: string;
  userId?: string;
  sessionId?: string;
  timestamp: string;
  properties: Record<string, unknown>;
  context: {
    userAgent: string;
    ipAddress: string;
    location?: {
      country: string;
      city?: string;
    };
  };
}

// Rate limiting types
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: string;
  retryAfter?: number;
}

// Cache types
export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  namespace?: string;
}

export interface CacheEntry<T> {
  data: T;
  createdAt: string;
  expiresAt: string;
  tags?: string[];
}

// Webhook types
export interface WebhookPayload {
  id: string;
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
  signature: string;
}

export interface WebhookConfig {
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  retryPolicy?: {
    maxRetries: number;
    backoffFactor: number;
  };
}

// Schedule types
export interface Schedule {
  id: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  timezone: string;
  isActive: boolean;
  breaks?: {
    startTime: string;
    endTime: string;
  }[];
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  appointmentId?: string;
}