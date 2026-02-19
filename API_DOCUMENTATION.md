# CareConnect BN - API Documentation

**Base URL**: `http://localhost:3000/api/v1`

## 1. Authentication
Base Path: `/auth`

### 1.1 Login
**POST** `/auth/login`
**Description**: Authenticate a user and receive access/refresh tokens.
**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "Password123!"
}
```
**Response (200 OK)**:
```json
{
  "user": {
    "userId": "uuid-string",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "patient"
  },
  "tokens": {
    "accessToken": "jwt-token-string",
    "refreshToken": "jwt-token-string"
  }
}
```

### 1.2 Register
**POST** `/auth/register`
**Request Body**:
```json
{
  "email": "newuser@example.com",
  "password": "Password123!",
  "firstName": "Jane",
  "lastName": "Doe",
  "role": "patient", // "patient" or "doctor"
  "phoneNumber": "+250780000000"
}
```
**Response (201 Created)**: (Same structure as Login response)

### 1.3 Refresh Token
**POST** `/auth/refresh-token`
**Request Body**:
```json
{
  "refreshToken": "jwt-token-string"
}
```
**Response (200 OK)**:
```json
{
  "accessToken": "new-jwt-token-string",
  "refreshToken": "new-jwt-token-string"
}
```

## 2. Patients
Base Path: `/patient` (Headers: `Authorization: Bearer <token>`)

### 2.1 Get Profile
**GET** `/patient/profile`
**Response (200 OK)**:
```json
{
  "patientId": "uuid",
  "userId": "uuid",
  "dateOfBirth": "1990-01-01",
  "gender": "male",
  "bloodType": "O+",
  "address": "Kigali, Rwanda",
  "emergencyContact": {
    "name": "Jane",
    "phone": "+250..."
  }
}
```

### 2.2 Update Profile
**PUT** `/patient/profile`
**Request Body**:
```json
{
  "dateOfBirth": "1990-01-01",
  "gender": "male",
  "bloodType": "O+", // Optional
  "address": "Kigali",
  "emergencyContact": { "name": "Mom", "phone": "+2507..." }
}
```

### 2.3 Get Medical History
**GET** `/patient/medical-history`
**Response (200 OK)**:
```json
[
  {
    "historyId": "uuid",
    "condition": "Hypertension",
    "diagnosedDate": "2023-05-10",
    "notes": "Mild case",
    "status": "active"
  }
]
```

## 3. Doctors
Base Path: `/doctors`

### 3.1 List Doctors
**GET** `/doctors/public/search?specialty=Cardiology&name=Smith`
**Response (200 OK)**:
```json
[
  {
    "doctorId": "uuid",
    "firstName": "Alice",
    "lastName": "Smith",
    "specialty": "Cardiology",
    "consultationFee": 15000,
    "rating": 4.8
  }
]
```

### 3.2 Get Doctor Profile
**GET** `/doctors/public/:doctorId/profile`
**Response (200 OK)**:
```json
{
  "doctorId": "uuid",
  "bio": "Expert cardiologist...",
  "specialties": ["Cardiology"],
  "education": ["MD - University of Rwanda"],
  "languages": ["English", "Kinyarwanda"],
  "availability": [] // Basic availability info
}
```

## 4. Appointments
Base Path: `/appointments`

### 4.1 Book Appointment
**POST** `/appointments/book`
**Request Body**:
```json
{
  "doctorId": "uuid-of-doctor",
  "startTime": "2026-03-10T09:00:00Z",
  "endTime": "2026-03-10T09:30:00Z",
  "type": "video", // "video" or "in-person"
  "reason": "Chest pain"
}
```
**Response (201 Created)**:
```json
{
  "appointmentId": "uuid",
  "status": "scheduled",
  "startTime": "2026-03-10T09:00:00Z"
}
```

### 4.2 List My Appointments
**GET** `/appointments/my-appointments?status=scheduled`
**Response (200 OK)**:
```json
[
  {
    "appointmentId": "uuid",
    "doctor": { "firstName": "Alice", "specialty": "Cardiology" },
    "startTime": "2026-03-10T09:00:00Z",
    "status": "scheduled"
  }
]
```

### 4.3 Cancel Appointment
**PUT** `/appointments/:id/cancel`
**Request Body**:
```json
{
  "reason": "Something came up"
}
```

## 5. Doctor Availability
Base Path: `/schedule`

### 5.1 Get Available Slots
**GET** `/schedule/slots/:doctorId/:date`
**Example**: `/schedule/slots/uuid/2026-03-10`
**Response (200 OK)**:
```json
[
  {
    "startTime": "2026-03-10T09:00:00Z",
    "endTime": "2026-03-10T09:30:00Z",
    "available": true
  },
  {
    "startTime": "2026-03-10T09:30:00Z",
    "endTime": "2026-03-10T10:00:00Z",
    "available": false // Booked
  }
]
```

## 6. Consultations
Base Path: `/consultation`

### 6.1 Create Consultation Note (Doctor)
**POST** `/consultation/consultations`
**Request Body**:
```json
{
  "appointmentId": "uuid",
  "diagnosis": "Acute Bronchitis",
  "symptoms": ["Cough", "Fever"],
  "prescription": "Amoxicillin 500mg",
  "notes": "Patient should rest for 3 days."
}
```

### 6.2 Get Consultation Details
**GET** `/consultation/consultations/:id`
**Response (200 OK)**:
```json
{
  "consultationId": "uuid",
  "diagnosis": "Acute Bronchitis",
  "notes": "...",
  "doctor": { "firstName": "Alice" },
  "createdAt": "2026-03-10T10:00:00Z"
}
```

## 7. Invoices
Base Path: `/invoice`

### 7.1 Create Invoice (Doctor/Admin)
**POST** `/invoice/invoices`
**Request Body**:
```json
{
  "patientId": "uuid",
  "consultationId": "uuid", // Optional
  "amount": 15000,
  "currency": "RWF",
  "dueDate": "2026-03-20",
  "items": [
    { "description": "Consultation Fee", "amount": 15000, "quantity": 1 }
  ]
}
```

### 7.2 Get Patient Invoices
**GET** `/invoice/invoices/patient/:patientId`
**Response (200 OK)**:
```json
[
  {
    "invoiceId": "uuid",
    "amount": 15000,
    "status": "pending", // "pending", "paid", "overdue"
    "dueDate": "2026-03-20"
  }
]
```

## 8. Payments (Mobile Money - Rwanda)
Base Path: `/payments`

### 8.1 Initiate Payment
**POST** `/payments/initiate`
**Request Body**:
```json
{
  "invoiceId": "uuid-of-invoice",
  "phoneNumber": "250780000000", // Start with 250 (12 digits)
  "paymentMethod": "mtn_momo" // or "airtel_money"
}
```
**Response (200 OK)**:
```json
{
  "status": "pending",
  "message": "Payment initiated. Please confirm on your phone.",
  "referenceId": "momo-transaction-id"
}
```

### 8.2 Check Status
**GET** `/payments/status/:referenceId`
**Response**:
```json
{
  "status": "successful", // "pending", "failed"
  "providerRef": "12345678"
}
```

### 8.3 Webhooks (Public)
**POST** `/payments/webhook/mtn` or `/payments/webhook/airtel`
- Receives callback from provider.
- Verifies signature (if configured).
- Updates invoice status to `paid`.

## 9. Miscellaneous
Base Path: `/misc`

### 9.1 Get Specialties
**GET** `/misc/specialties`
**Response**: `["Cardiology", "Dermatology", "General Practice", ...]`

### 9.2 Health Check
**GET** `/health`
**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-20T..."
}
```
