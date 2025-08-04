import { Request } from 'express';

// User types
export type UserType = 'patient' | 'doctor' | 'admin' | 'super_admin';

export type AccountStatus = 'active' | 'inactive' | 'suspended' | 'pending_verification';

export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export type AddressType = 'home' | 'work' | 'billing' | 'emergency';

// Authentication types
export type MfaMethodType = 'sms' | 'email' | 'totp' | 'backup_codes';

export interface JwtPayload {
  userId: string;
  email: string;
  userType: UserType;
  sessionId: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    userType: UserType;
    sessionId: string;
  };
}

// Medical types
export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export type ConditionType = 'allergy' | 'chronic_condition' | 'past_surgery' | 'family_history' | 'medication';

export type Severity = 'mild' | 'moderate' | 'severe' | 'critical';

export type AllergenType = 'drug' | 'food' | 'environmental' | 'other';

export type MedicationRoute = 'oral' | 'injection' | 'topical' | 'inhalation' | 'other';

// Appointment types
export type AppointmentType = 'consultation' | 'follow_up' | 'emergency' | 'telemedicine' | 'routine_checkup';

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled';

export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'partially_paid';

// Doctor types
export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'suspended';

export type ConsultationFeeTier = 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';

export type FacilityType = 'hospital' | 'clinic' | 'private_practice' | 'health_center';

// Consultation types
export type ConsultationType = 'initial' | 'follow_up' | 'emergency' | 'second_opinion' | 'telemedicine';

export type DiagnosisType = 'primary' | 'secondary' | 'differential' | 'rule_out';

export type CertaintyLevel = 'confirmed' | 'probable' | 'possible' | 'ruled_out';

export type ConsultationStatus = 'in_progress' | 'completed' | 'cancelled';

// Payment types
export type PaymentMethod = 'mtn_momo' | 'airtel_money' | 'bank_transfer' | 'cash' | 'card';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'refunded' | 'disputed';

export type PaymentTransactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded';

// Communication types
export type ConversationType = 'patient_doctor' | 'patient_admin' | 'doctor_admin' | 'group';

export type MessageType = 'text' | 'image' | 'document' | 'system_notification';

export type MessageStatus = 'sent' | 'delivered' | 'read' | 'deleted';

export type NotificationType = 'appointment_reminder' | 'payment_due' | 'test_results' | 'system_alert' | 'marketing';

export type DeliveryMethod = 'in_app' | 'email' | 'sms' | 'push_notification';

export type PriorityLevel = 'low' | 'medium' | 'high' | 'urgent';

// Document types
export type DocumentType = 'medical_record' | 'prescription' | 'lab_result' | 'imaging' | 'insurance' | 'identification' | 'other';

export type PermissionLevel = 'view_only' | 'download' | 'edit' | 'admin';

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
  };
  metadata: {
    requestId: string;
    timestamp: string;
    version: string;
    processingTime?: string;
    region: string;
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
}

export interface FilterParams {
  search?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  type?: string;
}

// Error types
export interface AppError extends Error {
  statusCode: number;
  code: string;
  isOperational: boolean;
  details?: unknown;
}

// Validation types
export interface ValidationError {
  field: string;
  code: string;
  message: string;
  value?: unknown;
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
}

// Health check types
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: 'healthy' | 'unhealthy';
    redis: 'healthy' | 'unhealthy';
    external_apis: 'healthy' | 'unhealthy';
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
}

// File upload types
export interface FileUploadResult {
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  path: string;
  url: string;
}

// Search types
export interface SearchParams {
  query: string;
  filters?: Record<string, unknown>;
  pagination?: PaginationParams;
  highlight?: boolean;
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  facets?: Record<string, Record<string, number>>;
  suggestions?: string[];
}
