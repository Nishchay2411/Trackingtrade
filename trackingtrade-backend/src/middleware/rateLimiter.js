const rateLimit = require('express-rate-limit');

// Rate limiters use in-memory state that persists for the life of the
// process — great in production, but it means a test file that fires
// off more than `max` requests to the same route (entirely normal in a
// thorough test suite) would start getting 429s unrelated to whatever
// that test is actually checking. Skip limiting under Jest so tests
// exercise the real auth logic instead of the limiter's shared counters.
const skipInTest = () => process.env.NODE_ENV === 'test';

// Login limiter
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,

  message: {
    success: false,
    message:
      'Too many login attempts. Please try again after 15 minutes.'
  }
});

// Register limiter
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  skip: skipInTest,

  message: {
    success: false,
    message:
      'Too many registrations from this IP. Please try again later.'
  }
});

// Forgot Password limiter
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  skip: skipInTest,

  message: {
    success: false,
    message:
      'Too many password reset requests. Please try again later.'
  }
});

// Resend Verification limiter
const resendVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  skip: skipInTest,

  message: {
    success: false,
    message:
      'Too many verification email requests. Please try again later.'
  }
});

module.exports = {
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  resendVerificationLimiter
};
