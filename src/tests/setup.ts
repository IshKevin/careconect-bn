import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment
process.env['NODE_ENV'] = 'test';

// Mock console methods in test environment
if (process.env['NODE_ENV'] === 'test') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

// Global test setup
beforeAll(async () => {
  // Setup test database connection
  // Setup test Redis connection
  // Any other global setup
});

afterAll(async () => {
  // Cleanup test database
  // Close test connections
  // Any other global cleanup
});

// Global test utilities
export const testUtils = {
  // Generate test user data
  generateTestUser: () => ({
    email: `test${Date.now()}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User',
    userType: 'patient' as const,
  }),

  // Generate test patient data
  generateTestPatient: () => ({
    bloodType: 'O+' as const,
    height: 175,
    weight: 70,
    emergencyContactName: 'Emergency Contact',
    emergencyContactPhone: '+250788123456',
  }),

  // Generate test doctor data
  generateTestDoctor: () => ({
    medicalLicenseNumber: 'MD/2023/001234',
    yearsOfExperience: 5,
    consultationFeeTier: 'tier_2' as const,
    baseConsultationFee: 50000,
  }),

  // Generate test appointment data
  generateTestAppointment: () => ({
    appointmentType: 'consultation' as const,
    scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    scheduledTime: '10:00',
    estimatedDuration: 30,
  }),

  // Wait for async operations
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // Generate random string
  randomString: (length: number = 10) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  // Generate random email
  randomEmail: () => `test${Date.now()}${Math.random().toString(36).substring(7)}@example.com`,

  // Generate random phone number (Rwanda format)
  randomRwandaPhone: () => {
    const prefixes = ['788', '789', '790', '791', '792', '793'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return `+250${prefix}${suffix}`;
  },
};
