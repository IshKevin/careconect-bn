# Professional Healthcare Management System - Database Schema Design

## Database Architecture Overview

**Database Type**: PostgreSQL 15+ (Primary) with Redis (Caching/Sessions)
**Architecture**: Microservices with Distributed Database
**Compliance**: HIPAA, GDPR, Rwanda Health Ministry Standards
**Backup Strategy**: Real-time replication with point-in-time recovery
**Security**: Row-level security, column-level encryption, audit logging

---

## 1. USER MANAGEMENT & AUTHENTICATION SCHEMA

### 1.1 Core User Tables

**users** (Primary user table)
- user_id (UUID, Primary Key)
- email (VARCHAR, Unique, Encrypted)
- phone_number (VARCHAR, Unique, Encrypted)
- password_hash (VARCHAR, BCrypt)
- user_type (ENUM: patient, doctor, admin, super_admin)
- account_status (ENUM: active, inactive, suspended, pending_verification)
- email_verified (BOOLEAN)
- phone_verified (BOOLEAN)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- last_login (TIMESTAMP)
- login_attempts (INTEGER)
- account_locked_until (TIMESTAMP)

**user_profiles** (Extended profile information)
- profile_id (UUID, Primary Key)
- user_id (UUID, Foreign Key to users)
- first_name (VARCHAR, Encrypted)
- last_name (VARCHAR, Encrypted)
- middle_name (VARCHAR, Encrypted)
- date_of_birth (DATE, Encrypted)
- gender (ENUM: male, female, other, prefer_not_to_say)
- nationality (VARCHAR)
- national_id (VARCHAR, Unique, Encrypted)
- passport_number (VARCHAR, Encrypted)
- profile_picture_url (VARCHAR)
- preferred_language (VARCHAR)
- timezone (VARCHAR)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

**user_addresses** (Multiple addresses per user)
- address_id (UUID, Primary Key)
- user_id (UUID, Foreign Key to users)
- address_type (ENUM: home, work, billing, emergency)
- street_address (VARCHAR, Encrypted)
- city (VARCHAR)
- district (VARCHAR)
- province (VARCHAR)
- postal_code (VARCHAR)
- country (VARCHAR, Default: 'Rwanda')
- is_primary (BOOLEAN)
- created_at (TIMESTAMP)

### 1.2 Security & Authentication

**user_sessions** (Active user sessions)
- session_id (UUID, Primary Key)
- user_id (UUID, Foreign Key to users)
- device_fingerprint (VARCHAR)
- ip_address (INET)
- user_agent (TEXT)
- session_token (VARCHAR, Unique)
- refresh_token (VARCHAR, Unique)
- expires_at (TIMESTAMP)
- is_active (BOOLEAN)
- created_at (TIMESTAMP)

**multi_factor_auth** (MFA settings)
- mfa_id (UUID, Primary Key)
- user_id (UUID, Foreign Key to users)
- method_type (ENUM: sms, email, totp, backup_codes)
- secret_key (VARCHAR, Encrypted)
- is_enabled (BOOLEAN)
- backup_codes (JSONB, Encrypted)
- last_used (TIMESTAMP)
- created_at (TIMESTAMP)

**user_permissions** (Role-based access control)
- permission_id (UUID, Primary Key)
- user_id (UUID, Foreign Key to users)
- resource (VARCHAR)
- action (VARCHAR)
- granted_by (UUID, Foreign Key to users)
- granted_at (TIMESTAMP)
- expires_at (TIMESTAMP)
- is_active (BOOLEAN)

**audit_logs** (Comprehensive audit trail)
- log_id (UUID, Primary Key)
- user_id (UUID, Foreign Key to users)
- action (VARCHAR)
- resource_type (VARCHAR)
- resource_id (VARCHAR)
- old_values (JSONB)
- new_values (JSONB)
- ip_address (INET)
- user_agent (TEXT)
- timestamp (TIMESTAMP)
- severity (ENUM: low, medium, high, critical)

---

## 2. PATIENT MANAGEMENT SCHEMA

### 2.1 Patient Core Information

**patients** (Patient-specific data)
- patient_id (UUID, Primary Key)
- user_id (UUID, Foreign Key to users)
- medical_record_number (VARCHAR, Unique, Auto-generated)
- emergency_contact_name (VARCHAR, Encrypted)
- emergency_contact_phone (VARCHAR, Encrypted)
- emergency_contact_relationship (VARCHAR)
- blood_type (ENUM: A+, A-, B+, B-, AB+, AB-, O+, O-)
- height (DECIMAL)
- weight (DECIMAL)
- insurance_provider (VARCHAR)
- insurance_policy_number (VARCHAR, Encrypted)
- insurance_group_number (VARCHAR, Encrypted)
- primary_physician_id (UUID, Foreign Key to doctors)
- preferred_pharmacy (VARCHAR)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

**patient_medical_history** (Comprehensive medical history)
- history_id (UUID, Primary Key)
- patient_id (UUID, Foreign Key to patients)
- condition_type (ENUM: allergy, chronic_condition, past_surgery, family_history, medication)
- condition_name (VARCHAR)
- condition_code (VARCHAR) -- ICD-11 codes
- severity (ENUM: mild, moderate, severe, critical)
- onset_date (DATE)
- resolved_date (DATE)
- notes (TEXT, Encrypted)
- documented_by (UUID, Foreign Key to users)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

**patient_allergies** (Detailed allergy information)
- allergy_id (UUID, Primary Key)
- patient_id (UUID, Foreign Key to patients)
- allergen_type (ENUM: drug, food, environmental, other)
- allergen_name (VARCHAR)
- reaction_severity (ENUM: mild, moderate, severe, anaphylaxis)
- symptoms (JSONB)
- first_occurrence (DATE)
- last_occurrence (DATE)
- treatment_notes (TEXT)
- verified_by_doctor (BOOLEAN)
- created_at (TIMESTAMP)

**patient_medications** (Current and past medications)
- medication_id (UUID, Primary Key)
- patient_id (UUID, Foreign Key to patients)
- medication_name (VARCHAR)
- generic_name (VARCHAR)
- dosage (VARCHAR)
- frequency (VARCHAR)
- route (ENUM: oral, injection, topical, inhalation, other)
- start_date (DATE)
- end_date (DATE)
- prescribed_by (UUID, Foreign Key to doctors)
- pharmacy_filled (VARCHAR)
- adherence_score (DECIMAL)
- side_effects (JSONB)
- is_active (BOOLEAN)
- created_at (TIMESTAMP)

### 2.2 Patient Preferences & Settings

**patient_preferences** (Patient care preferences)
- preference_id (UUID, Primary Key)
- patient_id (UUID, Foreign Key to patients)
- preferred_communication_method (ENUM: email, sms, phone, app_notification)
- appointment_reminder_timing (INTEGER) -- hours before
- data_sharing_consent (JSONB)
- marketing_consent (BOOLEAN)
- research_participation_consent (BOOLEAN)
- family_access_permissions (JSONB)
- privacy_settings (JSONB)
- updated_at (TIMESTAMP)

**patient_family_links** (Family member connections)
- link_id (UUID, Primary Key)
- primary_patient_id (UUID, Foreign Key to patients)
- linked_patient_id (UUID, Foreign Key to patients)
- relationship (ENUM: parent, child, spouse, sibling, guardian, other)
- access_level (ENUM: full, emergency_only, limited)
- approved_by_patient (BOOLEAN)
- created_at (TIMESTAMP)

---

## 3. DOCTOR MANAGEMENT SCHEMA

### 3.1 Doctor Professional Information

**doctors** (Doctor-specific data)
- doctor_id (UUID, Primary Key)
- user_id (UUID, Foreign Key to users)
- medical_license_number (VARCHAR, Unique, Encrypted)
- license_issuing_authority (VARCHAR)
- license_expiry_date (DATE)
- nid_number (VARCHAR, Unique, Encrypted) -- National ID for Rwanda
- tax_identification_number (VARCHAR, Encrypted)
- years_of_experience (INTEGER)
- consultation_fee_tier (ENUM: tier_1, tier_2, tier_3, tier_4)
- base_consultation_fee (DECIMAL)
- emergency_consultation_fee (DECIMAL)
- follow_up_consultation_fee (DECIMAL)
- average_consultation_duration (INTEGER) -- minutes
- max_daily_appointments (INTEGER)
- is_accepting_new_patients (BOOLEAN)
- verification_status (ENUM: pending, verified, rejected, suspended)
- verification_date (TIMESTAMP)
- verified_by (UUID, Foreign Key to users)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

**doctor_specializations** (Doctor specialties and sub-specialties)
- specialization_id (UUID, Primary Key)
- doctor_id (UUID, Foreign Key to doctors)
- specialty_name (VARCHAR)
- subspecialty_name (VARCHAR)
- board_certification (VARCHAR)
- certification_date (DATE)
- certification_expiry (DATE)
- certifying_body (VARCHAR)
- is_primary_specialty (BOOLEAN)
- created_at (TIMESTAMP)

**doctor_credentials** (Educational and professional credentials)
- credential_id (UUID, Primary Key)
- doctor_id (UUID, Foreign Key to doctors)
- credential_type (ENUM: medical_degree, residency, fellowship, board_certification, continuing_education)
- institution_name (VARCHAR)
- degree_title (VARCHAR)
- completion_date (DATE)
- verification_status (ENUM: pending, verified, rejected)
- document_url (VARCHAR, Encrypted)
- expiry_date (DATE)
- created_at (TIMESTAMP)

**doctor_practice_locations** (Multiple practice locations)
- location_id (UUID, Primary Key)
- doctor_id (UUID, Foreign Key to doctors)
- clinic_hospital_name (VARCHAR)
- address_line_1 (VARCHAR)
- address_line_2 (VARCHAR)
- city (VARCHAR)
- district (VARCHAR)
- province (VARCHAR)
- phone_number (VARCHAR)
- facility_type (ENUM: hospital, clinic, private_practice, health_center)
- is_primary_location (BOOLEAN)
- accepts_telemedicine (BOOLEAN)
- created_at (TIMESTAMP)

### 3.2 Doctor Performance & Analytics

**doctor_reviews** (Patient reviews and ratings)
- review_id (UUID, Primary Key)
- doctor_id (UUID, Foreign Key to doctors)
- patient_id (UUID, Foreign Key to patients)
- appointment_id (UUID, Foreign Key to appointments)
- overall_rating (INTEGER) -- 1-5 scale
- communication_rating (INTEGER)
- punctuality_rating (INTEGER)
- expertise_rating (INTEGER)
- facility_rating (INTEGER)
- written_review (TEXT)
- is_anonymous (BOOLEAN)
- is_verified (BOOLEAN)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

**doctor_statistics** (Performance metrics)
- stat_id (UUID, Primary Key)
- doctor_id (UUID, Foreign Key to doctors)
- period_start (DATE)
- period_end (DATE)
- total_consultations (INTEGER)
- total_patients_treated (INTEGER)
- average_rating (DECIMAL)
- total_revenue (DECIMAL)
- no_show_rate (DECIMAL)
- patient_satisfaction_score (DECIMAL)
- average_consultation_time (INTEGER)
- follow_up_compliance_rate (DECIMAL)
- created_at (TIMESTAMP)

---

## 4. APPOINTMENT & SCHEDULING SCHEMA

### 4.1 Appointment Management

**appointments** (Core appointment data)
- appointment_id (UUID, Primary Key)
- patient_id (UUID, Foreign Key to patients)
- doctor_id (UUID, Foreign Key to doctors)
- appointment_type (ENUM: consultation, follow_up, emergency, telemedicine, routine_checkup)
- appointment_status (ENUM: scheduled, confirmed, in_progress, completed, cancelled, no_show, rescheduled)
- scheduled_date (DATE)
- scheduled_time (TIME)
- estimated_duration (INTEGER) -- minutes
- actual_start_time (TIMESTAMP)
- actual_end_time (TIMESTAMP)
- consultation_fee (DECIMAL)
- additional_fees (DECIMAL)
- total_amount (DECIMAL)
- payment_status (ENUM: pending, paid, refunded, partially_paid)
- cancellation_reason (VARCHAR)
- cancelled_by (ENUM: patient, doctor, system, admin)
- is_recurring (BOOLEAN)
- recurring_pattern (JSONB)
- telemedicine_link (VARCHAR, Encrypted)
- special_instructions (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

**appointment_history** (Appointment changes tracking)
- history_id (UUID, Primary Key)
- appointment_id (UUID, Foreign Key to appointments)
- changed_by (UUID, Foreign Key to users)
- change_type (ENUM: created, rescheduled, cancelled, status_updated, fee_updated)
- old_values (JSONB)
- new_values (JSONB)
- reason (TEXT)
- timestamp (TIMESTAMP)

**doctor_availability** (Doctor schedule management)
- availability_id (UUID, Primary Key)
- doctor_id (UUID, Foreign Key to doctors)
- day_of_week (INTEGER) -- 0=Sunday, 6=Saturday
- start_time (TIME)
- end_time (TIME)
- slot_duration (INTEGER) -- minutes
- buffer_time (INTEGER) -- minutes between appointments
- max_appointments_per_slot (INTEGER)
- location_id (UUID, Foreign Key to doctor_practice_locations)
- is_telemedicine_available (BOOLEAN)
- effective_from (DATE)
- effective_until (DATE)
- is_active (BOOLEAN)
- created_at (TIMESTAMP)

**doctor_time_blocks** (Blocked time periods)
- block_id (UUID, Primary Key)
- doctor_id (UUID, Foreign Key to doctors)
- block_type (ENUM: vacation, sick_leave, training, personal, maintenance)
- start_datetime (TIMESTAMP)
- end_datetime (TIMESTAMP)
- reason (TEXT)
- created_by (UUID, Foreign Key to users)
- is_recurring (BOOLEAN)
- recurrence_pattern (JSONB)
- created_at (TIMESTAMP)

### 4.2 Waitlist & Queue Management

**appointment_waitlist** (Patient waitlist for appointments)
- waitlist_id (UUID, Primary Key)
- patient_id (UUID, Foreign Key to patients)
- doctor_id (UUID, Foreign Key to doctors)
- preferred_date_start (DATE)
- preferred_date_end (DATE)
- preferred_time_start (TIME)
- preferred_time_end (TIME)
- appointment_type (ENUM: consultation, follow_up, emergency)
- priority_level (INTEGER) -- 1=highest, 10=lowest
- notification_preferences (JSONB)
- status (ENUM: active, fulfilled, cancelled, expired)
- created_at (TIMESTAMP)
- fulfilled_at (TIMESTAMP)

---

## 5. CONSULTATION & MEDICAL RECORDS SCHEMA

### 5.1 Consultation Management

**consultations** (Consultation sessions)
- consultation_id (UUID, Primary Key)
- appointment_id (UUID, Foreign Key to appointments)
- patient_id (UUID, Foreign Key to patients)
- doctor_id (UUID, Foreign Key to doctors)
- consultation_type (ENUM: initial, follow_up, emergency, second_opinion, telemedicine)
- chief_complaint (TEXT, Encrypted)
- history_of_present_illness (TEXT, Encrypted)
- physical_examination (TEXT, Encrypted)
- vital_signs (JSONB, Encrypted)
- assessment_and_plan (TEXT, Encrypted)
- differential_diagnosis (JSONB)
- consultation_notes (TEXT, Encrypted)
- follow_up_instructions (TEXT, Encrypted)
- next_appointment_recommended (BOOLEAN)
- consultation_summary (TEXT, Encrypted)
- doctor_signature (VARCHAR)
- consultation_status (ENUM: in_progress, completed, cancelled)
- started_at (TIMESTAMP)
- completed_at (TIMESTAMP)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

**diagnoses** (Diagnosis information)
- diagnosis_id (UUID, Primary Key)
- consultation_id (UUID, Foreign Key to consultations)
- diagnosis_code (VARCHAR) -- ICD-11 code
- diagnosis_description (VARCHAR)
- diagnosis_type (ENUM: primary, secondary, differential, rule_out)
- certainty_level (ENUM: confirmed, probable, possible, ruled_out)
- onset_date (DATE)
- severity (ENUM: mild, moderate, severe, critical)
- diagnosis_notes (TEXT, Encrypted)
- created_at (TIMESTAMP)

**vital_signs** (Detailed vital signs tracking)
- vital_id (UUID, Primary Key)
- consultation_id (UUID, Foreign Key to consultations)
- patient_id (UUID, Foreign Key to patients)
- measurement_datetime (TIMESTAMP)
- systolic_bp (INTEGER)
- diastolic_bp (INTEGER)
- heart_rate (INTEGER)
- respiratory_rate (INTEGER)
- temperature (DECIMAL)
- temperature_unit (ENUM: celsius, fahrenheit)
- oxygen_saturation (DECIMAL)
- weight (DECIMAL)
- height (DECIMAL)
- bmi (DECIMAL)
- pain_scale (INTEGER) -- 0-10
- recorded_by (UUID, Foreign Key to users)
- notes (TEXT)
- created_at (TIMESTAMP)

### 5.2 Prescription Management

**prescriptions** (Electronic prescriptions)
- prescription_id (UUID, Primary Key)
- consultation_id (UUID, Foreign Key to consultations)
- patient_id (UUID, Foreign Key to patients)
- doctor_id (UUID, Foreign Key to doctors)
- prescription_number (VARCHAR, Unique)
- prescription_date (DATE)
- prescription_status (ENUM: active, dispensed, cancelled, expired, modified)
- total_medications (INTEGER)
- special_instructions (TEXT, Encrypted)
- pharmacy_notes (TEXT)
- dispensed_by_pharmacy (VARCHAR)
- dispensed_date (DATE)
- expiry_date (DATE)
- electronic_signature (VARCHAR)
- digital_signature_hash (VARCHAR)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

**prescription_medications** (Individual medications in prescription)
- prescription_med_id (UUID, Primary Key)
- prescription_id (UUID, Foreign Key to prescriptions)
- medication_name (VARCHAR)
- generic_name (VARCHAR)
- strength (VARCHAR)
- dosage_form (ENUM: tablet, capsule, liquid, injection, cream, inhaler, drops)
- quantity_prescribed (INTEGER)
- dosage_instructions (TEXT, Encrypted)
- frequency (VARCHAR)
- duration_days (INTEGER)
- refills_allowed (INTEGER)
- refills_remaining (INTEGER)
- substitution_allowed (BOOLEAN)
- medication_notes (TEXT)
- drug_code (VARCHAR) -- National drug code
- created_at (TIMESTAMP)

### 5.3 Laboratory & Imaging

**lab_orders** (Laboratory test orders)
- lab_order_id (UUID, Primary Key)
- consultation_id (UUID, Foreign Key to consultations)
- patient_id (UUID, Foreign Key to patients)
- doctor_id (UUID, Foreign Key to doctors)
- lab_facility (VARCHAR)
- order_date (DATE)
- order_priority (ENUM: routine, urgent, stat, asap)
- clinical_information (TEXT, Encrypted)
- order_status (ENUM: ordered, collected, processing, completed, cancelled)
- total_tests (INTEGER)
- estimated_completion (TIMESTAMP)
- actual_completion (TIMESTAMP)
- created_at (TIMESTAMP)

**lab_tests** (Individual lab tests)
- lab_test_id (UUID, Primary Key)
- lab_order_id (UUID, Foreign Key to lab_orders)
- test_code (VARCHAR)
- test_name (VARCHAR)
- test_category (VARCHAR)
- specimen_type (ENUM: blood, urine, stool, saliva, tissue, other)
- collection_instructions (TEXT)
- reference_range (VARCHAR)
- test_result (VARCHAR, Encrypted)
- result_unit (VARCHAR)
- abnormal_flag (ENUM: normal, high, low, critical_high, critical_low)
- result_notes (TEXT, Encrypted)
- performed_date (TIMESTAMP)
- reported_date (TIMESTAMP)
- created_at (TIMESTAMP)

**imaging_orders** (Medical imaging orders)
- imaging_order_id (UUID, Primary Key)
- consultation_id (UUID, Foreign Key to consultations)
- patient_id (UUID, Foreign Key to patients)
- doctor_id (UUID, Foreign Key to doctors)
- imaging_type (ENUM: xray, ct, mri, ultrasound, mammography, dexa)
- body_part (VARCHAR)
- clinical_indication (TEXT, Encrypted)
- contrast_required (BOOLEAN)
- special_instructions (TEXT)
- imaging_facility (VARCHAR)
- order_priority (ENUM: routine, urgent, stat)
- order_status (ENUM: ordered, scheduled, in_progress, completed, cancelled)
- scheduled_datetime (TIMESTAMP)
- performed_datetime (TIMESTAMP)
- report_available (BOOLEAN)
- created_at (TIMESTAMP)

---

## 6. PAYMENT & BILLING SCHEMA

### 6.1 Financial Transactions

**invoices** (System-generated invoices)
- invoice_id (UUID, Primary Key)
- invoice_number (VARCHAR, Unique, Auto-generated)
- patient_id (UUID, Foreign Key to patients)
- doctor_id (UUID, Foreign Key to doctors)
- appointment_id (UUID, Foreign Key to appointments)
- consultation_id (UUID, Foreign Key to consultations)
- invoice_date (DATE)
- due_date (DATE)
- invoice_status (ENUM: draft, sent, paid, overdue, cancelled, refunded, disputed)
- subtotal (DECIMAL)
- tax_amount (DECIMAL)
- discount_amount (DECIMAL)
- total_amount (DECIMAL)
- currency (VARCHAR, Default: 'RWF')
- payment_terms (VARCHAR)
- notes (TEXT)
- generated_by (UUID, Foreign Key to users)
- sent_at (TIMESTAMP)
- paid_at (TIMESTAMP)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

**invoice_line_items** (Detailed invoice breakdown)
- line_item_id (UUID, Primary Key)
- invoice_id (UUID, Foreign Key to invoices)
- item_type (ENUM: consultation_fee, additional_service, medication, lab_test, imaging, equipment_use)
- item_description (VARCHAR)
- quantity (INTEGER)
- unit_price (DECIMAL)
- total_price (DECIMAL)
- tax_rate (DECIMAL)
- discount_rate (DECIMAL)
- service_date (DATE)
- created_at (TIMESTAMP)

**payments** (Payment transactions)
- payment_id (UUID, Primary Key)
- invoice_id (UUID, Foreign Key to invoices)
- patient_id (UUID, Foreign Key to patients)
- payment_method (ENUM: mtn_momo, airtel_money, bank_transfer, cash, card)
- payment_provider (VARCHAR) -- PayPack, etc.
- external_transaction_id (VARCHAR)
- payment_amount (DECIMAL)
- currency (VARCHAR)
- payment_status (ENUM: pending, processing, completed, failed, cancelled, refunded)
- payment_date (TIMESTAMP)
- confirmation_code (VARCHAR)
- payment_reference (VARCHAR)
- processing_fee (DECIMAL)
- net_amount (DECIMAL)
- failure_reason (TEXT)
- refund_amount (DECIMAL)
- refund_date (TIMESTAMP)
- refund_reason (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### 6.2 PayPack Integration

**paypack_transactions** (PayPack-specific transaction data)
- paypack_transaction_id (UUID, Primary Key)
- payment_id (UUID, Foreign Key to payments)
- paypack_reference (VARCHAR, Unique)
- merchant_transaction_id (VARCHAR)
- payment_method_type (ENUM: mtn_momo, airtel_money)
- phone_number (VARCHAR, Encrypted)
- amount (DECIMAL)
- currency (VARCHAR)
- transaction_status (ENUM: pending, success, failed, cancelled, expired)
- paypack_status_code (VARCHAR)
- paypack_message (TEXT)
- callback_received (BOOLEAN)
- webhook_data (JSONB)
- initiated_at (TIMESTAMP)
- completed_at (TIMESTAMP)
- created_at (TIMESTAMP)

**financial_reconciliation** (Payment reconciliation records)
- reconciliation_id (UUID, Primary Key)
- reconciliation_date (DATE)
- payment_provider (VARCHAR)
- total_transactions (INTEGER)
- total_amount (DECIMAL)
- platform_fees (DECIMAL)
- net_settlement (DECIMAL)
- settlement_date (DATE)
- settlement_reference (VARCHAR)
- discrepancies (JSONB)
- reconciliation_status (ENUM: pending, completed, discrepancy_found, resolved)
- processed_by (UUID, Foreign Key to users)
- created_at (TIMESTAMP)

### 6.3 Doctor Payouts

**doctor_earnings** (Doctor earnings tracking)
- earning_id (UUID, Primary Key)
- doctor_id (UUID, Foreign Key to doctors)
- consultation_id (UUID, Foreign Key to consultations)
- payment_id (UUID, Foreign Key to payments)
- gross_amount (DECIMAL)
- platform_commission_rate (DECIMAL)
- platform_commission_amount (DECIMAL)
- tax_deduction (DECIMAL)
- net_earning (DECIMAL)
- earning_status (ENUM: pending, approved, paid, disputed)
- payout_batch_id (UUID)
- earned_date (DATE)
- approved_date (DATE)
- paid_date (DATE)
- created_at (TIMESTAMP)

**doctor_payouts** (Batch payouts to doctors)
- payout_id (UUID, Primary Key)
- doctor_id (UUID, Foreign Key to doctors)
- payout_period_start (DATE)
- payout_period_end (DATE)
- total_earnings (DECIMAL)
- total_deductions (DECIMAL)
- net_payout_amount (DECIMAL)
- payout_method (ENUM: bank_transfer, mobile_money, check)
- payout_reference (VARCHAR)
- payout_status (ENUM: pending, processing, completed, failed)
- payout_date (DATE)
- processed_by (UUID, Foreign Key to users)
- bank_account_details (JSONB, Encrypted)
- created_at (TIMESTAMP)

---

## 7. COMMUNICATION & NOTIFICATION SCHEMA

### 7.1 Messaging System

**conversations** (Message conversations)
- conversation_id (UUID, Primary Key)
- conversation_type (ENUM: patient_doctor, patient_admin, doctor_admin, group)
- subject (VARCHAR)
- participants (JSONB) -- Array of user IDs
- is_active (BOOLEAN)
- last_message_at (TIMESTAMP)
- created_by (UUID, Foreign Key to users)
- created_at (TIMESTAMP)

**messages** (Individual messages)
- message_id (UUID, Primary Key)
- conversation_id (UUID, Foreign Key to conversations)
- sender_id (UUID, Foreign Key to users)
- message_type (ENUM: text, image, document, system_notification)
- message_content (TEXT, Encrypted)
- attachment_urls (JSONB)
- is_encrypted (BOOLEAN)
- read_receipts (JSONB)
- message_status (ENUM: sent, delivered, read, deleted)
- reply_to_message_id (UUID, Foreign Key to messages)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

### 7.2 Notification Management

**notifications** (System notifications)
- notification_id (UUID, Primary Key)
- user_id (UUID, Foreign Key to users)
- notification_type (ENUM: appointment_reminder, payment_due, test_results, system_alert, marketing)
- title (VARCHAR)
- message (TEXT)
- priority_level (ENUM: low, medium, high, urgent)
- delivery_method (ENUM: in_app, email, sms, push_notification)
- is_read (BOOLEAN)
- action_required (BOOLEAN)
- action_url (VARCHAR)
- expires_at (TIMESTAMP)
- sent_at (TIMESTAMP)
- read_at (TIMESTAMP)
- created_at (TIMESTAMP)

**notification_templates** (Reusable notification templates)
- template_id (UUID, Primary Key)
- template_name (VARCHAR)
- template_category (VARCHAR)
- subject_template (VARCHAR)
- message_template (TEXT)
- supported_channels (JSONB)
- variables (JSONB)
- is_active (BOOLEAN)
- created_by (UUID, Foreign Key to users)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

---

## 8. DOCUMENT & FILE MANAGEMENT SCHEMA

### 8.1 File Storage

**documents** (File and document management)
- document_id (UUID, Primary Key)
- uploaded_by (UUID, Foreign Key to users)
- owner_id (UUID, Foreign Key to users)
- document_type (ENUM: medical_record, prescription, lab_result, imaging, insurance, identification, other)
- file_name (VARCHAR)
- original_file_name (VARCHAR)
- file_size (BIGINT)
- file_mime_type (VARCHAR)
- file_extension (VARCHAR)
- storage_path (VARCHAR, Encrypted)
- file_hash (VARCHAR)
- is_encrypted (BOOLEAN)
- encryption_key_id (VARCHAR)
- access_permissions (JSONB)
- document_category (VARCHAR)
- tags (JSONB)
- description (TEXT)
- expiry_date (DATE)
- is_active (BOOLEAN)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

**document_sharing** (Document sharing permissions)
- sharing_id (UUID, Primary Key)
- document_id (UUID, Foreign Key to documents)
- shared_by (UUID, Foreign Key to users)
- shared_with (UUID, Foreign Key to users)
- permission_level (ENUM: view_only, download, edit, admin)
- expiry_date (TIMESTAMP)
- is_active (BOOLEAN)
- access_count (INTEGER)
- last_accessed (TIMESTAMP)
- created_at (TIMESTAMP)

---

## 9. SYSTEM CONFIGURATION SCHEMA

### 9.1 System Settings

**system_settings** (Global system configuration)
- setting_id (UUID, Primary Key)
- setting_category (VARCHAR)
- setting_key (VARCHAR, Unique)
- setting_value (TEXT)
- data_type (ENUM: string, integer, decimal, boolean, json)
- description (TEXT)
- is_encrypted (BOOLEAN)
- is_user_configurable (BOOLEAN)
- updated_by (UUID, Foreign Key to users)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

**specialties** (Medical specialties reference)
- specialty_id (UUID, Primary Key)
- specialty_name (VARCHAR, Unique)
- specialty_code (VARCHAR)
- description (TEXT)
- parent_specialty_id (UUID, Foreign Key to specialties)
- is_active (BOOLEAN)
- created_at (TIMESTAMP)

**medical_conditions** (Medical conditions reference)
- condition_id (UUID, Primary Key)
- condition_name (VARCHAR)
- icd_11_code (VARCHAR)
- category (VARCHAR)
- severity_levels (JSONB)
- common_symptoms (JSONB)
- is_chronic (BOOLEAN)
- is_active (BOOLEAN)
- created_at (TIMESTAMP)

### 9.2 Pricing & Configuration

**pricing_tiers** (Doctor pricing tiers)
- tier_id (UUID, Primary Key)
- tier_name (VARCHAR)
- tier_description (TEXT)
- base_rate_multiplier (DECIMAL)
- minimum_experience_years (INTEGER)
- required_certifications (JSONB)
- benefits (JSONB)
- is_active (BOOLEAN)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

**service_pricing** (Service pricing matrix)
- pricing_id (UUID, Primary Key)
- service_type (ENUM## 9. SYSTEM CONFIGURATION SCHEMA (Continued)

### 9.2 Pricing & Configuration (Continued)

**service_pricing** (Service pricing matrix)
- pricing_id (UUID, Primary Key)
- service_type (ENUM: consultation, follow_up, emergency, telemedicine, specialist_referral)
- specialty_id (UUID, Foreign Key to specialties)
- tier_id (UUID, Foreign Key to pricing_tiers)
- base_price (DECIMAL)
- emergency_multiplier (DECIMAL)
- weekend_multiplier (DECIMAL)
- holiday_multiplier (DECIMAL)
- duration_based_pricing (JSONB)
- effective_from (DATE)
- effective_until (DATE)
- is_active (BOOLEAN)
- created_by (UUID, Foreign Key to users)
- created_at (TIMESTAMP)

**platform_commission** (Commission structure)
- commission_id (UUID, Primary Key)
- commission_type (ENUM: percentage, fixed_amount, tiered)
- service_category (VARCHAR)
- doctor_tier_id (UUID, Foreign Key to pricing_tiers)
- commission_rate (DECIMAL)
- minimum_amount (DECIMAL)
- maximum_amount (DECIMAL)
- effective_from (DATE)
- effective_until (DATE)
- is_active (BOOLEAN)
- created_at (TIMESTAMP)

---

## 10. ANALYTICS & REPORTING SCHEMA

### 10.1 Business Intelligence

**analytics_events** (Event tracking for analytics)
- event_id (UUID, Primary Key)
- user_id (UUID, Foreign Key to users)
- event_type (VARCHAR)
- event_category (VARCHAR)
- event_action (VARCHAR)
- event_label (VARCHAR)
- event_value (DECIMAL)
- page_url (VARCHAR)
- referrer_url (VARCHAR)
- user_agent (TEXT)
- ip_address (INET)
- session_id (VARCHAR)
- device_type (ENUM: desktop, mobile, tablet)
- browser (VARCHAR)
- operating_system (VARCHAR)
- custom_properties (JSONB)
- timestamp (TIMESTAMP)

**system_metrics** (System performance metrics)
- metric_id (UUID, Primary Key)
- metric_name (VARCHAR)
- metric_category (VARCHAR)
- metric_value (DECIMAL)
- metric_unit (VARCHAR)
- measurement_timestamp (TIMESTAMP)
- aggregation_period (ENUM: minute, hour, day, week, month)
- tags (JSONB)
- created_at (TIMESTAMP)

**report_schedules** (Automated report generation)
- schedule_id (UUID, Primary Key)
- report_name (VARCHAR)
- report_type (ENUM: financial, operational, clinical, compliance)
- recipient_users (JSONB)
- recipient_emails (JSONB)
- schedule_frequency (ENUM: daily, weekly, monthly, quarterly, annually)
- schedule_day (INTEGER)
- schedule_time (TIME)
- parameters (JSONB)
- last_run (TIMESTAMP)
- next_run (TIMESTAMP)
- is_active (BOOLEAN)
- created_by (UUID, Foreign Key to users)
- created_at (TIMESTAMP)

### 10.2 Quality Metrics

**quality_indicators** (Healthcare quality metrics)
- indicator_id (UUID, Primary Key)
- indicator_name (VARCHAR)
- indicator_category (ENUM: patient_safety, clinical_effectiveness, patient_experience, efficiency)
- measurement_period (DATERANGE)
- target_value (DECIMAL)
- actual_value (DECIMAL)
- performance_percentage (DECIMAL)
- benchmark_comparison (JSONB)
- trend_direction (ENUM: improving, declining, stable)
- calculated_at (TIMESTAMP)
- created_at (TIMESTAMP)

**patient_satisfaction_surveys** (Patient feedback surveys)
- survey_id (UUID, Primary Key)
- patient_id (UUID, Foreign Key to patients)
- doctor_id (UUID, Foreign Key to doctors)
- appointment_id (UUID, Foreign Key to appointments)
- survey_type (ENUM: post_consultation, annual, complaint_follow_up)
- overall_satisfaction (INTEGER) -- 1-10 scale
- communication_score (INTEGER)
- wait_time_satisfaction (INTEGER)
- facility_cleanliness (INTEGER)
- staff_courtesy (INTEGER)
- likelihood_to_recommend (INTEGER)
- written_feedback (TEXT)
- improvement_suggestions (TEXT)
- response_date (TIMESTAMP)
- created_at (TIMESTAMP)

---

## 11. COMPLIANCE & AUDIT SCHEMA

### 11.1 Regulatory Compliance

**compliance_audits** (Compliance audit trails)
- audit_id (UUID, Primary Key)
- audit_type (ENUM: hipaa, data_protection, financial, clinical_quality, licensing)
- audit_scope (VARCHAR)
- auditor_name (VARCHAR)
- audit_start_date (DATE)
- audit_end_date (DATE)
- audit_status (ENUM: planned, in_progress, completed, failed, remediation_required)
- findings (JSONB)
- recommendations (JSONB)
- remediation_plan (TEXT)
- remediation_deadline (DATE)
- compliance_score (DECIMAL)
- created_by (UUID, Foreign Key to users)
- created_at (TIMESTAMP)

**data_privacy_consents** (Patient privacy consents)
- consent_id (UUID, Primary Key)
- patient_id (UUID, Foreign Key to patients)
- consent_type (ENUM: data_processing, marketing, research, family_access, telemedicine)
- consent_status (BOOLEAN)
- consent_version (VARCHAR)
- consent_text (TEXT)
- consent_date (TIMESTAMP)
- withdrawal_date (TIMESTAMP)
- ip_address (INET)
- user_agent (TEXT)
- legal_basis (VARCHAR)
- retention_period (INTEGER) -- days
- created_at (TIMESTAMP)

**data_breach_incidents** (Security incident tracking)
- incident_id (UUID, Primary Key)
- incident_type (ENUM: unauthorized_access, data_loss, system_compromise, human_error)
- severity_level (ENUM: low, medium, high, critical)
- affected_users_count (INTEGER)
- affected_data_types (JSONB)
- discovery_date (TIMESTAMP)
- containment_date (TIMESTAMP)
- resolution_date (TIMESTAMP)
- incident_description (TEXT)
- impact_assessment (TEXT)
- remediation_actions (TEXT)
- notification_required (BOOLEAN)
- authorities_notified (BOOLEAN)
- patients_notified (BOOLEAN)
- reported_by (UUID, Foreign Key to users)
- created_at (TIMESTAMP)

### 11.2 Clinical Governance

**clinical_protocols** (Standardized clinical protocols)
- protocol_id (UUID, Primary Key)
- protocol_name (VARCHAR)
- protocol_version (VARCHAR)
- specialty_id (UUID, Foreign Key to specialties)
- condition_codes (JSONB) -- ICD-11 codes
- protocol_steps (JSONB)
- evidence_level (ENUM: A, B, C, D)
- approval_date (DATE)
- review_date (DATE)
- expiry_date (DATE)
- approved_by (UUID, Foreign Key to users)
- is_active (BOOLEAN)
- created_at (TIMESTAMP)

**medication_database** (Comprehensive medication reference)
- medication_id (UUID, Primary Key)
- generic_name (VARCHAR)
- brand_names (JSONB)
- drug_class (VARCHAR)
- therapeutic_category (VARCHAR)
- dosage_forms (JSONB)
- strengths (JSONB)
- contraindications (JSONB)
- drug_interactions (JSONB)
- side_effects (JSONB)
- pregnancy_category (VARCHAR)
- pediatric_dosing (JSONB)
- geriatric_considerations (TEXT)
- monitoring_requirements (JSONB)
- is_controlled_substance (BOOLEAN)
- is_active (BOOLEAN)
- last_updated (TIMESTAMP)

---

## 12. INTEGRATION & EXTERNAL SYSTEMS SCHEMA

### 12.1 Third-Party Integrations

**external_systems** (External system configurations)
- system_id (UUID, Primary Key)
- system_name (VARCHAR)
- system_type (ENUM: laboratory, pharmacy, hospital_ims, insurance, government)
- api_endpoint (VARCHAR, Encrypted)
- authentication_method (ENUM: api_key, oauth, certificate, basic_auth)
- credentials (JSONB, Encrypted)
- connection_status (ENUM: active, inactive, error, maintenance)
- last_sync (TIMESTAMP)
- sync_frequency (INTEGER) -- minutes
- error_count (INTEGER)
- last_error (TEXT)
- configuration (JSONB)
- is_active (BOOLEAN)
- created_at (TIMESTAMP)

**integration_logs** (Integration activity logs)
- log_id (UUID, Primary Key)
- system_id (UUID, Foreign Key to external_systems)
- operation_type (ENUM: sync, send, receive, authenticate)
- operation_status (ENUM: success, failure, timeout, retry)
- request_data (JSONB)
- response_data (JSONB)
- error_message (TEXT)
- processing_time (INTEGER) -- milliseconds
- retry_count (INTEGER)
- timestamp (TIMESTAMP)

### 12.2 API Management

**api_clients** (Registered API clients)
- client_id (UUID, Primary Key)
- client_name (VARCHAR)
- client_type (ENUM: web_app, mobile_app, third_party, internal_service)
- api_key (VARCHAR, Unique, Encrypted)
- api_secret (VARCHAR, Encrypted)
- allowed_scopes (JSONB)
- rate_limit (INTEGER) -- requests per minute
- ip_whitelist (JSONB)
- webhook_urls (JSONB)
- is_active (BOOLEAN)
- created_by (UUID, Foreign Key to users)
- created_at (TIMESTAMP)
- expires_at (TIMESTAMP)

**api_usage_logs** (API usage tracking)
- usage_id (UUID, Primary Key)
- client_id (UUID, Foreign Key to api_clients)
- endpoint (VARCHAR)
- http_method (VARCHAR)
- request_size (INTEGER)
- response_size (INTEGER)
- response_time (INTEGER) -- milliseconds
- status_code (INTEGER)
- user_id (UUID, Foreign Key to users)
- ip_address (INET)
- user_agent (TEXT)
- timestamp (TIMESTAMP)

---

## 13. EMERGENCY & CRISIS MANAGEMENT SCHEMA

### 13.1 Emergency Response

**emergency_contacts** (System emergency contacts)
- contact_id (UUID, Primary Key)
- contact_type (ENUM: medical_director, it_support, legal_counsel, regulatory_body)
- contact_name (VARCHAR)
- phone_primary (VARCHAR, Encrypted)
- phone_secondary (VARCHAR, Encrypted)
- email (VARCHAR, Encrypted)
- availability_hours (JSONB)
- escalation_level (INTEGER)
- is_active (BOOLEAN)
- created_at (TIMESTAMP)

**system_alerts** (System-wide alerts and notifications)
- alert_id (UUID, Primary Key)
- alert_type (ENUM: system_down, security_breach, high_traffic, payment_failure, regulatory_deadline)
- severity_level (ENUM: info, warning, error, critical)
- alert_title (VARCHAR)
- alert_message (TEXT)
- affected_services (JSONB)
- target_audience (ENUM: all_users, doctors, patients, admins, technical_team)
- alert_status (ENUM: active, acknowledged, resolved, cancelled)
- auto_resolve (BOOLEAN)
- resolution_time (TIMESTAMP)
- created_by (UUID, Foreign Key to users)
- acknowledged_by (JSONB)
- created_at (TIMESTAMP)

### 13.2 Business Continuity

**backup_schedules** (System backup schedules)
- backup_id (UUID, Primary Key)
- backup_type (ENUM: full, incremental, differential, transaction_log)
- backup_scope (ENUM: database, files, system_config, complete)
- schedule_frequency (ENUM: hourly, daily, weekly, monthly)
- retention_period (INTEGER) -- days
- storage_location (VARCHAR, Encrypted)
- encryption_enabled (BOOLEAN)
- last_backup (TIMESTAMP)
- next_backup (TIMESTAMP)
- backup_status (ENUM: scheduled, running, completed, failed)
- backup_size (BIGINT)
- verification_status (ENUM: pending, verified, failed)
- created_at (TIMESTAMP)

---

## Database Performance & Security Features

### Indexing Strategy

**Primary Indexes:**
```sql
-- User management
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_type_status ON users(user_type, account_status);

-- Appointments
CREATE INDEX idx_appointments_patient_date ON appointments(patient_id, scheduled_date);
CREATE INDEX idx_appointments_doctor_date ON appointments(doctor_id, scheduled_date);
CREATE INDEX idx_appointments_status ON appointments(appointment_status);

-- Payments
CREATE INDEX idx_payments_patient ON payments(patient_id);
CREATE INDEX idx_payments_status ON payments(payment_status);
CREATE INDEX idx_payments_date ON payments(payment_date);

-- Medical records
CREATE INDEX idx_consultations_patient ON consultations(patient_id);
CREATE INDEX idx_consultations_doctor ON consultations(doctor_id);
CREATE INDEX idx_diagnoses_code ON diagnoses(diagnosis_code);
```

### Security Features

**Row Level Security (RLS):**
- Patients can only access their own records
- Doctors can only access their patients' records
- Admins have full access based on role permissions

**Data Encryption:**
- Column-level encryption for sensitive data (PII, PHI)
- Application-level encryption keys managed separately
- Encrypted fields marked with "Encrypted" notation

**Audit Logging:**
- All data modifications logged in audit_logs table
- Includes old and new values for change tracking
- IP address and user agent tracking for security

### Database Partitioning Strategy

**Time-based Partitioning:**
- audit_logs: Monthly partitions
- analytics_events: Monthly partitions  
- api_usage_logs: Monthly partitions
- system_metrics: Daily partitions

**User-based Partitioning:**
- Large tables partitioned by user_id hash for performance
- Separate read replicas for reporting and analytics

### Backup & Recovery

**Multi-tier Backup Strategy:**
- Real-time streaming replication
- Point-in-time recovery capability
- Encrypted backups stored in multiple geographic locations
- Regular disaster recovery testing

### Data Retention Policies

**Automated Data Lifecycle:**
- Patient data: Retained per legal requirements (typically 7-10 years)
- System logs: 2 years retention
- Analytics data: 3 years retention
- Payment records: 7 years retention
- Audit logs: Permanent retention for compliance

This comprehensive database schema supports a professional healthcare management system with enterprise-level features including compliance tracking, clinical decision support, advanced analytics, and robust security measures suitable for Rwanda's healthcare ecosystem.