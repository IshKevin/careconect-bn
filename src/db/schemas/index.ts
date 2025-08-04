// Export all schemas and relations
export * from './users';
export * from './patients';
export * from './doctors';

// Re-export commonly used types
export type {
  UserType,
  AccountStatus,
  Gender,
  AddressType,
  MfaMethodType,
  BloodType,
  ConditionType,
  Severity,
  AllergenType,
  MedicationRoute,
  CommunicationMethod,
  Relationship,
  AccessLevel,
  VerificationStatus,
  ConsultationFeeTier,
  FacilityType,
  CredentialType,
} from '../types/schema-types';

// Schema collections for easier imports
import {
  users,
  userProfiles,
  userAddresses,
  userSessions,
  multiFactorAuth,
  userPermissions,
  auditLogs,
} from './users';

import {
  patients,
  patientMedicalHistory,
  patientAllergies,
  patientMedications,
  patientPreferences,
  patientFamilyLinks,
} from './patients';

import {
  doctors,
  doctorSpecializations,
  doctorCredentials,
  doctorPracticeLocations,
  doctorReviews,
  doctorStatistics,
} from './doctors';

// User-related schemas
export const userSchemas = {
  users,
  userProfiles,
  userAddresses,
  userSessions,
  multiFactorAuth,
  userPermissions,
  auditLogs,
};

// Patient-related schemas
export const patientSchemas = {
  patients,
  patientMedicalHistory,
  patientAllergies,
  patientMedications,
  patientPreferences,
  patientFamilyLinks,
};

// Doctor-related schemas
export const doctorSchemas = {
  doctors,
  doctorSpecializations,
  doctorCredentials,
  doctorPracticeLocations,
  doctorReviews,
  doctorStatistics,
};

// All schemas combined
export const allSchemas = {
  ...userSchemas,
  ...patientSchemas,
  ...doctorSchemas,
};
