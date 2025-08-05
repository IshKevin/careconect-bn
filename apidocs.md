# API DOCUMANTION

* **3 User Types**: `patient`, `doctor`, `admin`
* **Authentication**: Shared login mechanism for all user types
* **Registration**:

  * **Patients** self-register
  * **Doctors** are created by **admins** and receive credentials by **email**
  * **Admins** are seeded directly via database (manual/initial setup)
* **All users** can access services depending on their roles

Below is a **professionally organized and exhaustive list of APIs** required for the system, **mapped to their corresponding database tables**, grouped by **functional domain**.

---

## ✅ 1. **Authentication & Authorization APIs**

**Purpose**: Handle login, logout, password reset, etc.
**Tables involved**: `users`

| Method | Endpoint                | Description                                | Tables                   |
| ------ | ----------------------- | ------------------------------------------ | ------------------------ |
| `POST` | `/auth/login`           | Login with email/phone + password          | `users`                  |
| `POST` | `/auth/logout`          | Invalidate access token/session            | —                        |
| `POST` | `/auth/refresh-token`   | Refresh access token using refresh token   | —                        |
| `POST` | `/auth/register`        | Register a new **patient**                 | `users`, `user_profiles` |
| `POST` | `/auth/forgot-password` | Start password reset process (email-based) | `users`                  |
| `POST` | `/auth/reset-password`  | Reset password using token                 | `users`                  |
| `POST` | `/auth/change-password` | Change password (authenticated users)      | `users`                  |

---

## 👤 2. **User Management APIs**

**Purpose**: CRUD operations for users and profiles.
**Tables involved**: `users`, `user_profiles`

### 2.1 Users (All Roles)

| Method   | Endpoint    | Description                                    | Tables                   |
| -------- | ----------- | ---------------------------------------------- | ------------------------ |
| `GET`    | `/users/me` | Get authenticated user details                 | `users`, `user_profiles` |
| `PATCH`  | `/users/me` | Update self account (e.g., change phone/email) | `users`                  |
| `DELETE` | `/users/me` | Deactivate own account                         | `users`                  |

### 2.2 Admin - Manage Users

| Method   | Endpoint                        | Description                       | Tables                   |
| -------- | ------------------------------- | --------------------------------- | ------------------------ |
| `GET`    | `/admin/users`                  | List all users (filtered by type) | `users`                  |
| `GET`    | `/admin/users/{user_id}`        | View a specific user              | `users`, `user_profiles` |
| `PATCH`  | `/admin/users/{user_id}`        | Update any user                   | `users`                  |
| `PATCH`  | `/admin/users/{user_id}/status` | Activate/deactivate a user        | `users`                  |
| `DELETE` | `/admin/users/{user_id}`        | Delete user (soft or hard)        | `users`, `user_profiles` |

---

## 🧑‍⚕️ 3. **Doctor Management APIs**

**Purpose**: Admin-only doctor onboarding and visibility.
**Tables involved**: `doctors`, `users`, `user_profiles`

| Method  | Endpoint                            | Description                              | Tables                              |
| ------- | ----------------------------------- | ---------------------------------------- | ----------------------------------- |
| `POST`  | `/admin/doctors`                    | Create doctor account and profile        | `users`, `user_profiles`, `doctors` |
| `GET`   | `/doctors`                          | Public/Patient listing of active doctors | `doctors`, `user_profiles`          |
| `GET`   | `/doctors/{doctor_id}`              | View detailed doctor profile             | `doctors`, `user_profiles`          |
| `PATCH` | `/admin/doctors/{doctor_id}`        | Admin updates doctor details             | `doctors`                           |
| `PATCH` | `/admin/doctors/{doctor_id}/status` | Admin toggles availability               | `doctors`                           |

---

## 🕒 4. **Doctor Availability APIs**

**Purpose**: Manage doctor's weekly availability slots.
**Tables involved**: `doctor_availability`

| Method   | Endpoint                                 | Description                      | Tables                |
| -------- | ---------------------------------------- | -------------------------------- | --------------------- |
| `GET`    | `/doctors/{doctor_id}/availability`      | Get doctor's active availability | `doctor_availability` |
| `POST`   | `/doctors/{doctor_id}/availability`      | Add new time slots               | `doctor_availability` |
| `PATCH`  | `/availability/{availability_id}`        | Update a slot                    | `doctor_availability` |
| `PATCH`  | `/availability/{availability_id}/status` | Enable/disable slot              | `doctor_availability` |
| `DELETE` | `/availability/{availability_id}`        | Remove availability slot         | `doctor_availability` |

---

## 📆 5. **Appointment APIs**

**Purpose**: Allow patients to book, manage, and view appointments.
**Tables involved**: `appointments`

| Method   | Endpoint                                | Description                        | Tables         |
| -------- | --------------------------------------- | ---------------------------------- | -------------- |
| `GET`    | `/appointments`                         | List appointments (filter by role) | `appointments` |
| `GET`    | `/appointments/{appointment_id}`        | Get appointment detail             | `appointments` |
| `POST`   | `/appointments`                         | Book a new appointment             | `appointments` |
| `PATCH`  | `/appointments/{appointment_id}`        | Modify appointment details         | `appointments` |
| `DELETE` | `/appointments/{appointment_id}`        | Cancel appointment                 | `appointments` |
| `PATCH`  | `/appointments/{appointment_id}/status` | Update appointment status          | `appointments` |

---

## 🩺 6. **Consultation APIs**

**Purpose**: Doctors record notes post-appointment.
**Tables involved**: `consultations`

| Method  | Endpoint                           | Description                                       | Tables          |
| ------- | ---------------------------------- | ------------------------------------------------- | --------------- |
| `POST`  | `/consultations`                   | Doctor records consultation notes                 | `consultations` |
| `GET`   | `/consultations`                   | View list of consultations (by doctor or patient) | `consultations` |
| `GET`   | `/consultations/{consultation_id}` | Detailed view of consultation                     | `consultations` |
| `PATCH` | `/consultations/{consultation_id}` | Update notes (doctor only)                        | `consultations` |

---

## 🧾 7. **Invoice APIs**

**Purpose**: Billing and payment tracking post-consultation.
**Tables involved**: `invoices`

| Method  | Endpoint                          | Description                           | Tables     |
| ------- | --------------------------------- | ------------------------------------- | ---------- |
| `POST`  | `/invoices`                       | Generate invoice (post-consultation)  | `invoices` |
| `GET`   | `/invoices`                       | List invoices (filter by role/status) | `invoices` |
| `GET`   | `/invoices/{invoice_id}`          | View invoice detail                   | `invoices` |
| `PATCH` | `/invoices/{invoice_id}`          | Update invoice details                | `invoices` |
| `PATCH` | `/invoices/{invoice_id}/status`   | Mark invoice as paid/cancelled        | `invoices` |
| `GET`   | `/invoices/{invoice_id}/download` | Download invoice as PDF               | `invoices` |

---

## 📊 8. **Admin Reporting & Analytics APIs**

**Purpose**: Internal analytics & system health monitoring.
**Tables involved**: Multiple

| Method | Endpoint                      | Description                                    | Tables         |
| ------ | ----------------------------- | ---------------------------------------------- | -------------- |
| `GET`  | `/admin/metrics/overview`     | System KPIs (total users, revenue, appt count) | All            |
| `GET`  | `/admin/activity/logs`        | Logs of system actions (optional)              | —              |
| `GET`  | `/admin/reports/appointments` | Appointment trends over time                   | `appointments` |
| `GET`  | `/admin/reports/invoices`     | Invoice summaries by doctor/date               | `invoices`     |

---

## 🔍 9. **Search & Lookup APIs**

**Purpose**: Dynamic search for users and services
**Tables involved**: Various

| Method | Endpoint               | Description                             | Tables                     |
| ------ | ---------------------- | --------------------------------------- | -------------------------- |
| `GET`  | `/search/doctors`      | Search doctors by name, specialty, etc. | `doctors`, `user_profiles` |
| `GET`  | `/search/appointments` | Filtered search (date, doctor, patient) | `appointments`             |
| `GET`  | `/search/invoices`     | Filter by invoice number, status, user  | `invoices`                 |

---

## 🛠️ 10. **Miscellaneous APIs**

**Purpose**: Auxiliary data & dropdowns
**Tables involved**: Optional lookup tables

| Method | Endpoint       | Description                    | Tables                |
| ------ | -------------- | ------------------------------ | --------------------- |
| `GET`  | `/specialties` | List all supported specialties | Optional static table |
| `GET`  | `/timezones`   | Timezone list (optional)       | —                     |

---

## 🔐 Role-Based Access Control Summary

| Endpoint Category | Accessible by             |
| ----------------- | ------------------------- |
| Auth/Login        | All users                 |
| Register Patient  | Public                    |
| Doctor Creation   | Admin only                |
| Appointments      | Patients, Doctors         |
| Consultations     | Doctors, Patients         |
| Invoices          | Admins, Doctors, Patients |
| Admin Reports     | Admin only                |


