import rateLimit from 'express-rate-limit';

// Brute-force protection for credential endpoints, keyed by client IP.
export const authRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again in 15 minutes.' } },
});

// Login: only failed attempts count, so password guessing is still stopped, while many people signing in
// from one network (an office, or a room trying the demo accounts) are not locked out.
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many failed sign-in attempts. Try again in 15 minutes.' } },
});

// Payment initiation, keyed by the signed-in user (falls back to IP).
export const paymentRateLimit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.userId ?? req.ip ?? 'unknown',
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many payment attempts. Try again later.' } },
});
