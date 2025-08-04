// Type definitions for database schema enums and types

// User types
export type UserType = 'patient' | 'doctor' | 'admin' | 'super_admin';
export type AccountStatus = 'active' | 'inactive' | 'suspended' | 'pending_verification';
export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type AddressType = 'home' | 'work' | 'billing' | 'emergency';
export type MfaMethodType = 'sms' | 'email' | 'totp' | 'backup_codes';

// Patient types
export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
export type ConditionType = 'allergy' | 'chronic_condition' | 'past_surgery' | 'family_history' | 'medication';
export type Severity = 'mild' | 'moderate' | 'severe' | 'critical';
export type AllergenType = 'drug' | 'food' | 'environmental' | 'other';
export type MedicationRoute = 'oral' | 'injection' | 'topical' | 'inhalation' | 'other';
export type CommunicationMethod = 'email' | 'sms' | 'phone' | 'app_notification';
export type Relationship = 'parent' | 'child' | 'spouse' | 'sibling' | 'guardian' | 'other';
export type AccessLevel = 'full' | 'emergency_only' | 'limited';

// Doctor types
export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'suspended';
export type ConsultationFeeTier = 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';
export type FacilityType = 'hospital' | 'clinic' | 'private_practice' | 'health_center';
export type CredentialType = 'medical_degree' | 'residency' | 'fellowship' | 'board_certification' | 'continuing_education';

// Appointment types (to be defined in appointments schema)
export type AppointmentType = 'consultation' | 'follow_up' | 'emergency' | 'telemedicine' | 'routine_checkup';
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'rescheduled';

// Consultation types (to be defined in consultations schema)
export type ConsultationType = 'initial' | 'follow_up' | 'emergency' | 'second_opinion' | 'telemedicine';
export type DiagnosisType = 'primary' | 'secondary' | 'differential' | 'rule_out';
export type CertaintyLevel = 'confirmed' | 'probable' | 'possible' | 'ruled_out';
export type ConsultationStatus = 'in_progress' | 'completed' | 'cancelled';

// Payment types (to be defined in payments schema)
export type PaymentMethod = 'mtn_momo' | 'airtel_money' | 'bank_transfer' | 'cash' | 'card';
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'partially_paid';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'refunded' | 'disputed';
export type PaymentTransactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded';

// Communication types (to be defined in communications schema)
export type ConversationType = 'patient_doctor' | 'patient_admin' | 'doctor_admin' | 'group';
export type MessageType = 'text' | 'image' | 'document' | 'system_notification';
export type MessageStatus = 'sent' | 'delivered' | 'read' | 'deleted';
export type NotificationType = 'appointment_reminder' | 'payment_due' | 'test_results' | 'system_alert' | 'marketing';
export type DeliveryMethod = 'in_app' | 'email' | 'sms' | 'push_notification';
export type PriorityLevel = 'low' | 'medium' | 'high' | 'urgent';

// Document types (to be defined in documents schema)
export type DocumentType = 'medical_record' | 'prescription' | 'lab_result' | 'imaging' | 'insurance' | 'identification' | 'other';
export type PermissionLevel = 'view_only' | 'download' | 'edit' | 'admin';

// System types
export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical';

// Database table types (inferred from schema)
export type User = {
  userId: string;
  email: string;
  phoneNumber?: string;
  passwordHash: string;
  userType: UserType;
  accountStatus: AccountStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  loginAttempts: number;
  accountLockedUntil?: Date;
};

export type UserProfile = {
  profileId: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  dateOfBirth?: Date;
  gender?: Gender;
  nationality?: string;
  nationalId?: string;
  passportNumber?: string;
  profilePictureUrl?: string;
  preferredLanguage: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
};

export type Patient = {
  patientId: string;
  userId: string;
  medicalRecordNumber: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  bloodType?: BloodType;
  height?: number;
  weight?: number;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  insuranceGroupNumber?: string;
  primaryPhysicianId?: string;
  preferredPharmacy?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type Doctor = {
  doctorId: string;
  userId: string;
  medicalLicenseNumber: string;
  licenseIssuingAuthority?: string;
  licenseExpiryDate?: Date;
  nidNumber?: string;
  taxIdentificationNumber?: string;
  yearsOfExperience?: number;
  consultationFeeTier: ConsultationFeeTier;
  baseConsultationFee?: number;
  emergencyConsultationFee?: number;
  followUpConsultationFee?: number;
  averageConsultationDuration: number;
  maxDailyAppointments: number;
  isAcceptingNewPatients: boolean;
  verificationStatus: VerificationStatus;
  verificationDate?: Date;
  verifiedBy?: string;
  createdAt: Date;
  updatedAt: Date;
};
