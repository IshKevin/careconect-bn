# CareConnect API – Implemented Endpoints

This document lists all API endpoints that are actually implemented in the codebase, including required data for each endpoint. All endpoints are grouped by functional area.

---

## Auth Endpoints (`/auth`)

| Method | Path                | Description                | Data Required (Body/Query)         |
|--------|---------------------|----------------------------|-------------------------------------|
| POST   | /auth/login         | User login                 | `{ email/phone, password }`         |
| POST   | /auth/register      | User registration          | `{ name, email, password, ... }`    |
| POST   | /auth/logout        | Logout (auth required)     | Auth token (header)                 |
| POST   | /auth/refresh-token | Refresh JWT token          | `{ refreshToken }`                  |
| POST   | /auth/forgot-password | Request password reset   | `{ email }`                         |
| POST   | /auth/reset-password | Confirm password reset    | `{ token, newPassword }`            |
| POST   | /auth/change-password | Change current password  | `{ oldPassword, newPassword }` (auth required) |

---

## User Endpoints (`/users`)

| Method | Path                        | Description                        | Data Required (Body/Query)         |
|--------|-----------------------------|------------------------------------|-------------------------------------|
| GET    | /users/profile              | Get current user profile           | Auth token (header)                 |
| PUT    | /users/profile              | Update current user profile        | `{ firstName, lastName, ... }`      |
| DELETE | /users/profile              | Delete current user account        | Auth token (header)                 |
| GET    | /users/profile/completeness | Check profile completeness         | Auth token (header)                 |
| GET    | /users/search               | Search users (admin)               | Query: `userType`, `status`, ...    |
| GET    | /users/                     | List all users (admin)             | Query: filters, pagination          |
| POST   | /users/                     | Create user by admin               | `{ userType, email, ... }`          |
| GET    | /users/:userId/profile      | Get specific user profile (admin)  |                                     |
| PUT    | /users/:userId/profile      | Update user profile (admin)        | `{ ...fields }`                     |
| PUT    | /users/:userId/status       | Update user status (admin)         | `{ status }`                        |
| POST   | /users/:userId/unlock       | Unlock user account (admin)        |                                     |
| POST   | /users/:userId/reset-password | Reset password (super admin)      | `{ newPassword }`                   |
| DELETE | /users/:userId              | Delete user (super admin)          |                                     |
| GET    | /users/me                   | Get current user profile (legacy)  |                                     |
| PATCH  | /users/me                   | Update current user profile        | `{ ...fields }`                     |
| DELETE | /users/me                   | Delete current user account        |                                     |

---

## Admin Endpoints (`/admin`)

| Method | Path                          | Description                        | Data Required (Body/Query)         |
|--------|-------------------------------|------------------------------------|-------------------------------------|
| GET    | /admin/users                  | List all users                     | Query: filters, pagination          |
| GET    | /admin/users/:user_id         | Get user details                   |                                     |
| PATCH  | /admin/users/:user_id         | Update user                        | `{ ...fields }`                     |
| PATCH  | /admin/users/:user_id/status  | Update user status                 | `{ status }`                        |
| DELETE | /admin/users/:user_id         | Delete user                        |                                     |
| GET    | /admin/metrics/overview       | Get system metrics                 |                                     |
| PATCH  | /admin/settings               | Update system settings             | `{ ...settings }`                   |
| GET    | /admin/audit-logs             | Get audit logs                     | Query: filters, pagination          |
| POST   | /admin/reports/generate       | Trigger report generation          | `{ reportType, dateRange, ... }`    |

---

## Appointment Endpoints (`/appointments`)

| Method | Path                                         | Description                        | Data Required (Body/Query)         |
|--------|----------------------------------------------|------------------------------------|-------------------------------------|
| POST   | /appointments/book                           | Book new appointment (patient)     | `{ doctorId, date, time, ... }`     |
| GET    | /appointments/my-appointments                | Get patient's appointments         | Auth token (header)                 |
| PUT    | /appointments/:appointmentId/reschedule      | Reschedule appointment (patient)   | `{ newDate, newTime }`              |
| PUT    | /appointments/:appointmentId/cancel          | Cancel appointment (patient)       | `{ reason }`                        |
| GET    | /appointments/doctor-appointments            | Get doctor's appointments          | Auth token (header)                 |
| PUT    | /appointments/:appointmentId/status          | Update appointment status (doctor) | `{ status }`                        |
| GET    | /appointments/availability/:doctorId/:date   | Get available time slots           | Path params: doctorId, date         |
| GET    | /appointments/                               | List all appointments (admin)      | Query: filters, pagination          |
| GET    | /appointments/:appointmentId                 | Get appointment details (admin)    |                                     |
| PUT    | /appointments/:appointmentId                 | Update appointment (admin)         | `{ ...fields }`                     |
| DELETE | /appointments/:appointmentId                 | Delete appointment (admin)         |                                     |

---

## Consultation Endpoints (`/consultations`)

| Method | Path                                 | Description                        | Data Required (Body/Query)         |
|--------|--------------------------------------|------------------------------------|-------------------------------------|
| POST   | /consultations                       | Create consultation                | `{ patientId, doctorId, ... }`      |
| GET    | /consultations                       | List consultations                 | Query: filters, pagination          |
| GET    | /consultations/:consultation_id      | Get consultation details           |                                     |
| PATCH  | /consultations/:consultation_id      | Update consultation                | `{ ...fields }`                     |
| POST   | /consultations/:consultationId/complete | Complete consultation           |                                     |
| GET    | /consultations/patient/:patientId    | Get patient's consultation history |                                     |
| GET    | /consultations/doctor/:doctorId      | Get doctor's consultations         |                                     |
| GET    | /consultations/:consultationId/summary | Get consultation summary         |                                     |

---

## Invoice Endpoints (`/invoices`)

| Method | Path                                 | Description                        | Data Required (Body/Query)         |
|--------|--------------------------------------|------------------------------------|-------------------------------------|
| POST   | /invoices                            | Create invoice                     | `{ patientId, items, total, ... }`  |
| GET    | /invoices                            | List invoices                      | Query: filters, pagination          |
| GET    | /invoices/:invoice_id                | Get invoice details                |                                     |
| PATCH  | /invoices/:invoice_id                | Update invoice                     | `{ ...fields }`                     |
| PATCH  | /invoices/:invoice_id/status         | Update invoice status              | `{ status }`                        |
| GET    | /invoices/:invoice_id/download       | Download invoice                   |                                     |
| POST   | /invoices/:invoiceId/pay             | Process payment                    | `{ amount, method, ... }`           |
| GET    | /invoices/patient/:patientId         | Get patient's invoices             |                                     |
| GET    | /invoices/overdue                    | Get overdue invoices               |                                     |

---

## Availability Endpoints

| Method | Path                                         | Description                        | Data Required (Body/Query)         |
|--------|----------------------------------------------|------------------------------------|-------------------------------------|
| GET    | /doctors/:doctor_id/availability             | Get doctor availability            | Path param: doctor_id               |
| POST   | /doctors/:doctor_id/availability             | Add availability (doctor)          | `{ date, slots, ... }`              |
| PATCH  | /availability/:availability_id               | Update availability                | `{ ...fields }`                     |
| PATCH  | /availability/:availability_id/status        | Update availability status         | `{ status }`                        |
| DELETE | /availability/:availability_id               | Delete availability                |                                     |
| GET    | /slots/:doctorId/:date                       | Get available slots                | Path params: doctorId, date         |
| POST   | /bulk-update                                 | Bulk update availability           | `{ updates: [{ date, slots, ... }] }` |

---

## Search Endpoints

| Method | Path                | Description                        | Data Required (Body/Query)         |
|--------|---------------------|------------------------------------|-------------------------------------|
| GET    | /search/doctors     | Search doctors                     | Query: filters, search term         |
| GET    | /search/appointments| Search appointments                | Query: filters, search term         |
| GET    | /search/invoices    | Search invoices                    | Query: filters, search term         |
| GET    | /search/global      | Global search                      | Query: `q` (search term), `entityType` |
| GET    | /search/suggestions | Get search suggestions             | Query: `q` (partial search term)    |
| GET    | /search/history     | Get search history                 |                                     |

---

## Report Endpoints (`/admin`)

| Method | Path                                 | Description                        | Data Required (Body/Query)         |
|--------|--------------------------------------|------------------------------------|-------------------------------------|
| GET    | /admin/metrics/overview              | Get overview metrics (admin)       |                                     |
| GET    | /admin/activity/logs                 | Get activity logs (admin)          | Query: filters, pagination          |
| GET    | /admin/reports/appointments          | Get appointment trends (admin)     | Query: date range, filters          |
| GET    | /admin/reports/invoices              | Get invoice summaries (admin)      | Query: date range, filters          |
| GET    | /admin/reports/financial             | Get financial reports (admin)      | Query: date range, type             |
| GET    | /admin/reports/clinical              | Get clinical reports (admin)       | Query: date range, type             |
| GET    | /admin/reports/user-activity         | Get user activity reports (admin)  | Query: date range, userId           |
| GET    | /admin/reports/system-performance    | Get system performance reports (admin) | Query: date range                 |
| POST   | /admin/reports/custom/generate       | Generate custom report (admin)     | `{ reportConfig }`                  |
| GET    | /admin/reports/:reportId/export      | Export report (PDF/Excel) (admin)  | Query: `format` (pdf/excel)         |

---

## Miscellaneous

| Method | Path                | Description                        | Data Required (Body/Query)         |
|--------|---------------------|------------------------------------|-------------------------------------|
| GET    | /specialties        | Get list of specialties            |                                     |
| GET    | /timezones          | Get list of timezones              |                                     |
| GET    | /health-check       | Get system health status           |                                     |
| GET    | /configuration      | Get system configuration           |                                     |
| POST   | /upload-file        | Upload a file                      | `file` (multipart/form-data)        |
| POST   | /send-notification  | Send a notification                | `{ type, recipient, message }`      |
