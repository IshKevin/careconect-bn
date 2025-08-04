import { config } from '@/config/env';
import { logger } from '@/config/logger';

describe('Project Setup', () => {
  test('should load environment configuration', () => {
    expect(config.env).toBeDefined();
    expect(config.port).toBeDefined();
    expect(config.apiVersion).toBeDefined();
    expect(config.database.url).toBeDefined();
  });

  test('should have valid JWT configuration', () => {
    expect(config.jwt.secret).toBeDefined();
    expect(config.jwt.secret.length).toBeGreaterThanOrEqual(32);
    expect(config.jwt.refreshSecret).toBeDefined();
    expect(config.jwt.refreshSecret.length).toBeGreaterThanOrEqual(32);
  });

  test('should have valid encryption configuration', () => {
    expect(config.encryption.key).toBeDefined();
    expect(config.encryption.key.length).toBeGreaterThanOrEqual(32);
    expect(config.encryption.saltRounds).toBeGreaterThanOrEqual(10);
  });

  test('should initialize logger', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  test('should have Rwanda-specific configuration', () => {
    expect(config.rwanda.timezone).toBe('Africa/Kigali');
    expect(config.rwanda.currency).toBe('RWF');
    expect(config.rwanda.languages).toContain('en');
  });

  test('should have PayPack configuration', () => {
    expect(config.paypack.baseUrl).toBeDefined();
    expect(config.paypack.environment).toMatch(/^(sandbox|production)$/);
  });
});
