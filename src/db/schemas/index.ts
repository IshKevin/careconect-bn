// Export all tables
export {
  patients,
  patientMedicalHistory,
  patientAllergies,
  patientMedications,
  patientPreferences,
  patientFamilyLinks,
  patientsRelations,
  patientMedicalHistoryRelations,
  patientAllergiesRelations,
  patientMedicationsRelations,
  patientPreferencesRelations,
  patientFamilyLinksRelations,
  bloodTypeEnum,
  conditionTypeEnum,
  severityEnum,
  allergenTypeEnum,
  medicationRouteEnum,
  communicationMethodEnum,
  relationshipEnum,
  accessLevelEnum,
} from './patients';

export {
  users,
  userTypeEnum,
  accountStatusEnum,
  insertUserSchema,
  selectUserSchema,
  updateUserSchema,
} from './users';

export {
  userProfiles,
  userProfilesRelations,
  insertUserProfileSchema,
  selectUserProfileSchema,
  updateUserProfileSchema,
} from './user-profiles';

export {
  doctors,
  doctorsRelations,
  insertDoctorSchema,
  selectDoctorSchema,
  updateDoctorSchema,
  doctorWithUserSchema,
} from './doctors';

export {
  doctorAvailability,
  doctorAvailabilityRelations,
  daysOfWeek,
  insertDoctorAvailabilitySchema,
  selectDoctorAvailabilitySchema,
  updateDoctorAvailabilitySchema,
  availabilityWithDoctorSchema,
  timeSlotSchema,
} from './doctor-availability';

export {
  appointments,
  appointmentTypeEnum,
  appointmentStatusEnum,
  appointmentsRelations,
  insertAppointmentSchema,
  selectAppointmentSchema,
  updateAppointmentSchema,
  appointmentWithDetailsSchema,
  bookAppointmentSchema,
  appointmentFiltersSchema,
} from './appointments';

export {
  consultations,
  consultationsRelations,
  insertConsultationSchema,
  selectConsultationSchema,
  updateConsultationSchema,
  consultationWithDetailsSchema,
  createConsultationSchema,
  consultationFiltersSchema,
  consultationSummarySchema,
} from './consultations';

export {
  invoices,
  invoiceStatusEnum,
  invoicesRelations,
  insertInvoiceSchema,
  selectInvoiceSchema,
  updateInvoiceSchema,
  invoiceWithDetailsSchema,
  createInvoiceSchema,
  updateInvoiceStatusSchema,
  invoiceFiltersSchema,
  invoiceSummarySchema,
  paymentRecordSchema,
} from './invoices';

// Export all types
export type {
  User,
  NewUser,
  UpdateUser,
  UserType,
  AccountStatus,
} from './users';

export type {
  UserProfile,
  NewUserProfile,
  UpdateUserProfile,
} from './user-profiles';

export type {
  Doctor,
  NewDoctor,
  UpdateDoctor,
  DoctorWithUser,
  Specialty,
} from './doctors';

export type {
  DoctorAvailability,
  NewDoctorAvailability,
  UpdateDoctorAvailability,
  AvailabilityWithDoctor,
  TimeSlot,
  DayOfWeek,
} from './doctor-availability';

export type {
  Appointment,
  NewAppointment,
  UpdateAppointment,
  AppointmentWithDetails,
  BookAppointmentRequest,
  AppointmentFilters,
  AppointmentType,
  AppointmentStatus,
} from './appointments';

export type {
  Consultation,
  NewConsultation,
  UpdateConsultation,
  ConsultationWithDetails,
  CreateConsultationRequest,
  ConsultationFilters,
  ConsultationSummary,
} from './consultations';

export type {
  Invoice,
  NewInvoice,
  UpdateInvoice,
  InvoiceWithDetails,
  CreateInvoiceRequest,
  UpdateInvoiceStatusRequest,
  InvoiceFilters,
  InvoiceSummary,
  PaymentRecord,
  InvoiceStatus,
} from './invoices';

// Common utility schemas
export const paginationSchema = {
  page: { type: 'number', minimum: 1, default: 1 },
  limit: { type: 'number', minimum: 1, maximum: 100, default: 10 },
} as const;

export const timestampSchema = {
  createdAt: { type: 'string', format: 'date-time' },
  updatedAt: { type: 'string', format: 'date-time' },
} as const;