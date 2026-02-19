# CareConnect API Endpoints Specification

## Overview
This document outlines all API endpoints required for the CareConnect healthcare management system based on the database schema analysis.

## Base URL Structure
- Base URL: `/api/v1`
- All endpoints require appropriate authentication unless specified otherwise

---

## 1. AUTHENTICATION & USER MANAGEMENT

### Auth Endpoints (`/auth`)
```
POST   /auth/register                    # User registration (patient/doctor)
POST   /auth/login                       # User login
POST   /auth/logout                      # User logout
POST   /auth/refresh-token               # Refresh JWT token
POST   /auth/forgot-password             # Request password reset
POST   /auth/reset-password              # Confirm password reset
PUT    /auth/change-password             # Change current password
POST   /auth/verify-email                # Request email verification
POST   /auth/verify-email/confirm        # Confirm email verification
POST   /auth/verify-phone                # Request phone verification
POST   /auth/verify-phone/confirm        # Confirm phone verification
```

### User Profile Endpoints (`/users`)
```
GET    /users/profile                    # Get current user profile
PUT    /users/profile                    # Update current user profile
DELETE /users/profile                    # Delete current user account
GET    /users/:userId/profile            # Get specific user profile (admin)
PUT    /users/:userId/profile            # Update user profile (admin)
GET    /users/search                     # Search users (admin)
GET    /users                            # List all users (admin, with filters)
POST   /users                            # Create user by admin
PUT    /users/:userId/status             # Update user status (admin)
GET    /users/:userId/security-logs      # Get user security logs (admin)
POST   /users/:userId/unlock             # Unlock user account (admin)
GET    /users/profile/completeness       # Check profile completeness
```

---

## 2. PATIENT MANAGEMENT

### Patient Endpoints (`/patients`)
```
POST   /patients/register                # Register as patient
GET    /patients/profile                 # Get patient profile
PUT    /patients/profile                 # Update patient profile
DELETE /patients/profile                 # Delete patient profile

# Medical History
GET    /patients/medical-history         # Get patient medical history
POST   /patients/medical-history         # Add medical history entry
PUT    /patients/medical-history/:historyId  # Update medical history
DELETE /patients/medical-history/:historyId  # Delete medical history

# Allergies
GET    /patients/allergies               # Get patient allergies
POST   /patients/allergies               # Add allergy
PUT    /patients/allergies/:allergyId    # Update allergy
DELETE /patients/allergies/:allergyId    # Delete allergy

# Medications
GET    /patients/medications             # Get current medications
POST   /patients/medications             # Add medication
PUT    /patients/medications/:medicationId  # Update medication
DELETE /patients/medications/:medicationId  # Remove medication
PUT    /patients/medications/:medicationId/adherence  # Update adherence

# Preferences
GET    /patients/preferences             # Get patient preferences
PUT    /patients/preferences             # Update patient preferences

# Family Links
GET    /patients/family-links            # Get family connections
POST   /patients/family-links            # Create family link
PUT    /patients/family-links/:linkId    # Update family link
DELETE /patients/family-links/:linkId    # Remove family link
POST   /patients/family-links/:linkId/approve  # Approve family link

# Admin endpoints
GET    /patients                         # List all patients (admin)
GET    /patients/:patientId              # Get specific patient (admin/doctor)
PUT    /patients/:patientId/primary-physician  # Assign primary physician
```

---

## 3. DOCTOR MANAGEMENT

### Doctor Endpoints (`/doctors`)
```
POST   /doctors/register                 # Register as doctor
GET    /doctors/profile                  # Get doctor profile
PUT    /doctors/profile                  # Update doctor profile
DELETE /doctors/profile                  # Delete doctor profile
PUT    /doctors/status                   # Update doctor status (active/inactive)

# Doctor Information
GET    /doctors                          # List all doctors (public, filtered)
GET    /doctors/:doctorId                # Get specific doctor info
PUT    /doctors/:doctorId/consultation-fee  # Update consultation fee
GET    /doctors/specialties              # Get list of specialties
GET    /doctors/by-specialty/:specialty  # Get doctors by specialty

# Statistics & Analytics
GET    /doctors/stats                    # Get doctor statistics
GET    /doctors/:doctorId/stats          # Get specific doctor stats
GET    /doctors/:doctorId/patients       # Get doctor's patients
GET    /doctors/:doctorId/reviews        # Get doctor reviews (future feature)

# Admin endpoints
POST   /doctors                          # Create doctor by admin
PUT    /doctors/:doctorId                # Update doctor by admin
PUT    /doctors/:doctorId/status         # Update doctor status (admin)
DELETE /doctors/:doctorId                # Delete doctor (admin)
GET    /doctors/:doctorId/performance    # Get performance metrics (admin)
```

---

## 4. AVAILABILITY MANAGEMENT

### Availability Endpoints (`/availability`)
```
# Doctor Availability
GET    /availability/doctors/:doctorId   # Get doctor availability
POST   /availability/doctors/:doctorId   # Set doctor availability
PUT    /availability/:availabilityId     # Update specific availability slot
DELETE /availability/:availabilityId     # Delete availability slot
PUT    /availability/doctors/:doctorId/bulk  # Bulk update availability

# Slot Management
GET    /availability/doctors/:doctorId/slots  # Get available slots for date
GET    /availability/doctors/:doctorId/schedule  # Get weekly schedule
POST   /availability/doctors/:doctorId/block    # Block time slots
DELETE /availability/doctors/:doctorId/block/:blockId  # Remove blocked slots

# Public endpoints
GET    /availability/search              # Search available slots
GET    /availability/doctors/:doctorId/public  # Public availability view
```

---

## 5. APPOINTMENT MANAGEMENT

### Appointment Endpoints (`/appointments`)
```
# Patient Appointment Management
GET    /appointments                     # Get current user's appointments
POST   /appointments                     # Book new appointment
GET    /appointments/:appointmentId      # Get specific appointment
PUT    /appointments/:appointmentId      # Update appointment
DELETE /appointments/:appointmentId      # Cancel appointment
PUT    /appointments/:appointmentId/reschedule  # Reschedule appointment
PUT    /appointments/:appointmentId/status      # Update appointment status

# Appointment Operations
POST   /appointments/check-availability  # Check slot availability
GET    /appointments/upcoming            # Get upcoming appointments
GET    /appointments/history             # Get appointment history
POST   /appointments/:appointmentId/remind  # Send appointment reminder

# Doctor Appointment Management
GET    /appointments/doctor              # Get doctor's appointments
PUT    /appointments/:appointmentId/confirm    # Confirm appointment
PUT    /appointments/:appointmentId/complete   # Mark as complete
PUT    /appointments/:appointmentId/no-show    # Mark as no-show

# Admin endpoints
GET    /appointments/all                 # List all appointments (admin)
GET    /appointments/statistics          # Get appointment statistics (admin)
PUT    /appointments/:appointmentId/admin      # Admin update appointment
```

---

## 6. CONSULTATION MANAGEMENT

### Consultation Endpoints (`/consultations`)
```
# Consultation Management
GET    /consultations                    # Get consultations
POST   /consultations                    # Create consultation
GET    /consultations/:consultationId    # Get specific consultation
PUT    /consultations/:consultationId    # Update consultation notes
DELETE /consultations/:consultationId    # Delete consultation

# Consultation History
GET    /consultations/patient/:patientId # Get patient consultation history
GET    /consultations/doctor             # Get doctor's consultations
GET    /consultations/search             # Search consultations
GET    /consultations/summary            # Get consultation summaries

# Consultation Operations
POST   /consultations/:consultationId/complete  # Complete consultation
GET    /consultations/:consultationId/notes     # Get consultation notes
PUT    /consultations/:consultationId/notes     # Update consultation notes

# Admin endpoints
GET    /consultations/all                # List all consultations (admin)
GET    /consultations/analytics          # Get consultation analytics (admin)
```

---

## 7. INVOICE & BILLING MANAGEMENT

### Invoice Endpoints (`/invoices`)
```
# Invoice Management
GET    /invoices                         # Get current user's invoices
POST   /invoices                         # Create invoice
GET    /invoices/:invoiceId              # Get specific invoice
PUT    /invoices/:invoiceId              # Update invoice
DELETE /invoices/:invoiceId              # Delete invoice (admin only)

# Invoice Operations
PUT    /invoices/:invoiceId/status       # Update invoice status
POST   /invoices/:invoiceId/pay          # Process payment
GET    /invoices/:invoiceId/download     # Download invoice PDF
POST   /invoices/:invoiceId/send         # Send invoice via email

# Payment Management
GET    /invoices/payments                # Get payment history
POST   /invoices/payments                # Record payment
GET    /invoices/payments/:paymentId     # Get payment details
POST   /invoices/:invoiceId/partial-payment  # Partial payment

# Billing Reports
GET    /invoices/overdue                 # Get overdue invoices
GET    /invoices/summary                 # Get invoice summary
GET    /invoices/reports                 # Generate billing reports
GET    /invoices/statistics              # Get billing statistics

# Admin endpoints
GET    /invoices/all                     # List all invoices (admin)
PUT    /invoices/:invoiceId/admin        # Admin update invoice
POST   /invoices/bulk-generate           # Bulk generate invoices
GET    /invoices/revenue-reports         # Revenue reports (admin)
```

---

## 8. SEARCH & DISCOVERY

### Search Endpoints (`/search`)
```
GET    /search/doctors                   # Search doctors
GET    /search/patients                  # Search patients (admin/doctor)
GET    /search/appointments              # Search appointments
GET    /search/consultations             # Search consultations
GET    /search/invoices                  # Search invoices
GET    /search/global                    # Global search (admin)
GET    /search/suggestions               # Get search suggestions
```

---

## 9. ADMIN MANAGEMENT

### Admin Endpoints (`/admin`)
```
# User Management
GET    /admin/users                      # List all users
POST   /admin/users                      # Create user
PUT    /admin/users/:userId              # Update user
DELETE /admin/users/:userId              # Delete user
PUT    /admin/users/:userId/status       # Update user status
POST   /admin/users/:userId/reset-password  # Reset user password

# Doctor Management
GET    /admin/doctors                    # List all doctors
POST   /admin/doctors                    # Create doctor
PUT    /admin/doctors/:doctorId          # Update doctor
DELETE /admin/doctors/:doctorId          # Delete doctor
PUT    /admin/doctors/:doctorId/approve  # Approve doctor registration

# System Management
GET    /admin/dashboard                  # Admin dashboard data
GET    /admin/statistics                 # System statistics
GET    /admin/logs                       # System logs
GET    /admin/security-logs              # Security logs
POST   /admin/backup                     # Create system backup
POST   /admin/maintenance                # System maintenance mode

# Reports & Analytics
GET    /admin/reports/users              # User reports
GET    /admin/reports/appointments       # Appointment reports
GET    /admin/reports/revenue            # Revenue reports
GET    /admin/reports/system-health      # System health reports
GET    /admin/reports/usage              # Usage analytics
```

---

## 10. REPORTING & ANALYTICS

### Report Endpoints (`/reports`)
```
# Patient Reports
GET    /reports/patients/demographics    # Patient demographics
GET    /reports/patients/conditions      # Common conditions report
GET    /reports/patients/medications     # Medication usage report

# Doctor Reports
GET    /reports/doctors/performance      # Doctor performance metrics
GET    /reports/doctors/specialties      # Specialty distribution
GET    /reports/doctors/workload         # Doctor workload analysis

# Appointment Reports
GET    /reports/appointments/trends      # Appointment trends
GET    /reports/appointments/cancellations  # Cancellation analysis
GET    /reports/appointments/utilization    # Utilization rates

# Financial Reports
GET    /reports/financial/revenue        # Revenue reports
GET    /reports/financial/outstanding    # Outstanding payments
GET    /reports/financial/trends         # Financial trends

# System Reports
GET    /reports/system/usage             # System usage statistics
GET    /reports/system/performance       # System performance metrics
GET    /reports/system/errors            # Error reports
```

---

## 11. NOTIFICATION & COMMUNICATION

### Notification Endpoints (`/notifications`)
```
GET    /notifications                    # Get user notifications
POST   /notifications                    # Create notification (admin)
PUT    /notifications/:notificationId/read  # Mark as read
DELETE /notifications/:notificationId    # Delete notification
PUT    /notifications/mark-all-read      # Mark all as read

# Communication
POST   /notifications/send-email         # Send email notification
POST   /notifications/send-sms           # Send SMS notification
POST   /notifications/appointment-reminder  # Send appointment reminder
POST   /notifications/bulk-send          # Bulk send notifications (admin)

# Settings
GET    /notifications/preferences        # Get notification preferences
PUT    /notifications/preferences        # Update notification preferences
```

---

## 12. MISCELLANEOUS ENDPOINTS

### Utility Endpoints (`/misc`)
```
GET    /misc/health                      # Health check
GET    /misc/version                     # API version info
GET    /misc/config                      # Public configuration
GET    /misc/countries                   # List of countries
GET    /misc/timezones                   # List of timezones
GET    /misc/specialties                 # Medical specialties
GET    /misc/conditions                  # Common medical conditions
GET    /misc/medications                 # Common medications
POST   /misc/feedback                    # Submit feedback
GET    /misc/announcements               # System announcements
```

---

## HTTP Status Codes

### Success Codes
- `200` - OK (GET, PUT)
- `201` - Created (POST)
- `204` - No Content (DELETE)

### Client Error Codes
- `400` - Bad Request (Invalid data)
- `401` - Unauthorized (Authentication required)
- `403` - Forbidden (Access denied)
- `404` - Not Found
- `409` - Conflict (Duplicate data)
- `422` - Unprocessable Entity (Validation error)
- `429` - Too Many Requests (Rate limiting)

### Server Error Codes
- `500` - Internal Server Error
- `502` - Bad Gateway
- `503` - Service Unavailable

---

## Authentication & Authorization

### JWT Token Structure
- **Access Token**: Short-lived (1 hour)
- **Refresh Token**: Long-lived (7 days)
- **Reset Token**: Short-lived (1 hour)

### User Roles & Permissions
1. **Patient**: Can manage own data, book appointments
2. **Doctor**: Can manage patients, appointments, consultations
3. **Admin**: Can manage all system data
4. **Super Admin**: Full system access including admin management

### Protected Endpoints
All endpoints except public ones require authentication:
- Public: Login, Register, Doctor search, Specialties list
- Patient: All patient-specific endpoints
- Doctor: All doctor-specific endpoints + patient data access
- Admin: All endpoints including user management
- Super Admin: All endpoints including admin management

---

## Pagination & Filtering

### Standard Query Parameters
```
page=1              # Page number (default: 1)
limit=10            # Items per page (default: 10, max: 100)
search=term         # Search term
sort=field          # Sort field
order=asc|desc      # Sort order (default: desc)
startDate=YYYY-MM-DD  # Date range start
endDate=YYYY-MM-DD    # Date range end
```

### Response Format
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "pages": 10,
    "hasNext": true,
    "hasPrev": false
  },
  "requestId": "uuid"
}
```

---

## Rate Limiting

### Limits by User Type
- **Guest**: 60 requests/hour
- **Patient**: 1000 requests/hour  
- **Doctor**: 2000 requests/hour
- **Admin**: 5000 requests/hour
- **Super Admin**: Unlimited

### Special Limits
- **Login**: 5 attempts per 15 minutes
- **Password Reset**: 3 attempts per hour
- **Email/SMS**: 10 per day per user

---

## File Upload Endpoints

### Upload Endpoints
```
POST   /uploads/profile-image            # Upload profile image
POST   /uploads/medical-documents        # Upload medical documents
POST   /uploads/prescription-images      # Upload prescription images
DELETE /uploads/:fileId                  # Delete uploaded file
GET    /uploads/:fileId/download         # Download file
```

### File Constraints
- **Profile Images**: Max 5MB, JPG/PNG only
- **Medical Documents**: Max 10MB, PDF/JPG/PNG
- **Prescriptions**: Max 10MB, JPG/PNG/PDF

This comprehensive API specification covers all major functionality needed for the CareConnect healthcare management system based on the database schema analysis.
