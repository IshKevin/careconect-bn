# CareConnect Rwanda - Healthcare Management System Backend

A professional, enterprise-grade healthcare management system backend built with Node.js, Express, TypeScript, and Drizzle ORM, specifically designed for Rwanda's healthcare ecosystem.

## 🏥 Features

### Core Healthcare Features
- **Patient Management**: Comprehensive patient profiles, medical history, allergies, medications
- **Doctor Management**: Professional profiles, credentials, specializations, practice locations
- **Appointment System**: Smart scheduling, availability management, waitlist, recurring appointments
- **Consultation Management**: Digital consultations, diagnosis tracking, vital signs, prescriptions
- **Telemedicine Integration**: Video consultations, screen sharing, recording capabilities
- **Electronic Health Records (EHR)**: Structured clinical documentation, medical coding
- **Laboratory Integration**: Lab orders, results management, critical value alerts
- **Prescription Management**: E-prescribing, drug interactions, adherence tracking

### Payment & Billing
- **PayPack Integration**: MTN MoMo and Airtel Money support
- **Invoice Management**: Automated billing, payment tracking, reconciliation
- **Financial Analytics**: Revenue tracking, payment method performance
- **Doctor Payouts**: Automated commission calculations and payouts

### Security & Compliance
- **HIPAA Compliance**: Data encryption, audit logging, access controls
- **Multi-Factor Authentication**: SMS, Email, TOTP, backup codes
- **Role-Based Access Control (RBAC)**: Granular permissions system
- **Data Privacy**: GDPR compliance, consent management, data retention policies
- **Security Monitoring**: Suspicious activity detection, breach incident tracking

### Analytics & Reporting
- **Business Intelligence**: Executive dashboards, KPI tracking
- **Quality Metrics**: Patient outcomes, satisfaction scores, benchmarking
- **Regulatory Reporting**: Health Ministry compliance, public health surveillance
- **Performance Analytics**: Doctor statistics, appointment analytics, revenue insights

## 🚀 Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Caching**: Redis
- **Authentication**: JWT with refresh tokens
- **File Upload**: Multer with Sharp for image processing
- **Email**: Nodemailer
- **SMS**: Twilio
- **Payment**: PayPack (Rwanda Mobile Money)
- **Logging**: Winston
- **Testing**: Jest with Supertest
- **Documentation**: Swagger/OpenAPI
- **Code Quality**: ESLint, Prettier
- **Process Management**: PM2 (production)

## 📋 Prerequisites

- Node.js 18.0.0 or higher
- npm 8.0.0 or higher
- PostgreSQL 13+ database
- Redis server (optional but recommended)
- PayPack merchant account (for payments)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd careconnect-bn
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Database Setup**
   ```bash
   # Generate database schema
   npm run db:generate
   
   # Run migrations
   npm run db:migrate
   
   # (Optional) Open Drizzle Studio
   npm run db:studio
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

## 🔧 Configuration

### Environment Variables

Key environment variables that need to be configured:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/careconnect_dev

# JWT Secrets (generate secure random strings)
JWT_SECRET=your-super-secret-jwt-key-32-chars-minimum
JWT_REFRESH_SECRET=your-super-secret-refresh-key-32-chars

# Encryption Key (32 characters)
ENCRYPTION_KEY=your-32-character-encryption-key-here

# PayPack Configuration
PAYPACK_CLIENT_ID=your-paypack-client-id
PAYPACK_CLIENT_SECRET=your-paypack-client-secret
PAYPACK_ENVIRONMENT=sandbox

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# SMS Configuration (Twilio)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
```

## 📚 API Documentation

### Base URL
```
Development: http://localhost:3000/api/v1
Production: https://api.careconnect.rw/api/v1
```

### Authentication
All API requests (except public endpoints) require authentication:

```http
Authorization: Bearer <jwt_token>
X-API-Key: <api_key>
X-Request-ID: <unique_request_id>
```

### Response Format
All API responses follow a standardized format:

```json
{
  "success": true,
  "data": {},
  "metadata": {
    "requestId": "req_123456789",
    "timestamp": "2025-07-24T10:30:00.000Z",
    "version": "v1.0.0",
    "processingTime": "245ms",
    "region": "rw-central"
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1500,
    "totalPages": 75,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Key Endpoints

- **Authentication**: `/api/v1/auth/*`
- **Users**: `/api/v1/users/*`
- **Patients**: `/api/v1/patients/*`
- **Doctors**: `/api/v1/doctors/*`
- **Appointments**: `/api/v1/appointments/*`
- **Consultations**: `/api/v1/consultations/*`
- **Payments**: `/api/v1/payments/*`
- **Admin**: `/api/v1/admin/*`

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- --testPathPattern=auth
```

## 🚀 Deployment

### Production Build
```bash
# Build the application
npm run build

# Start production server
npm start
```

### Docker Deployment
```bash
# Build Docker image
docker build -t careconnect-backend .

# Run with Docker Compose
docker-compose up -d
```

### Environment-specific Configurations

- **Development**: Full logging, debug mode enabled
- **Staging**: Production-like environment for testing
- **Production**: Optimized performance, security hardened

## 📊 Monitoring & Logging

### Health Checks
- **Endpoint**: `GET /health`
- **Database**: Connection status
- **Redis**: Connection status
- **External APIs**: Service availability

### Logging Levels
- **Error**: System errors, exceptions
- **Warn**: Security events, validation failures
- **Info**: User actions, API requests
- **Debug**: Detailed debugging information

### Metrics Tracking
- API response times
- Database query performance
- Payment transaction success rates
- User activity patterns

## 🔒 Security Features

- **Data Encryption**: Column-level encryption for sensitive data
- **Rate Limiting**: Configurable request limits
- **Input Validation**: Comprehensive request validation
- **SQL Injection Protection**: Parameterized queries
- **XSS Protection**: Input sanitization
- **CSRF Protection**: Token-based protection
- **Audit Logging**: Complete audit trail

## 🌍 Rwanda-Specific Features

- **Local Payment Methods**: MTN MoMo, Airtel Money integration
- **Language Support**: English, Kinyarwanda, French
- **Timezone**: Africa/Kigali
- **Currency**: Rwandan Franc (RWF)
- **Phone Number Validation**: Rwanda phone number formats
- **National ID Validation**: Rwanda National ID format
- **Health Ministry Integration**: Regulatory compliance reporting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- **Email**: support@careconnect.rw
- **Documentation**: https://docs.careconnect.rw
- **API Support**: api-support@careconnect.rw

## 🙏 Acknowledgments

- Rwanda Ministry of Health for regulatory guidance
- PayPack for payment processing integration
- Healthcare professionals for domain expertise
- Open source community for excellent tools and libraries
