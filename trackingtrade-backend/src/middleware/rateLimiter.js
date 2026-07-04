const rateLimit = require('express-rate-limit');

// Login limiter
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,

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

  message: {
    success: false,
    message:
      'Too many password reset requests. Please try again later.'
  }
});

// Resend Verification limiter (Item 5 — new endpoint needs its own limit
// so it can't be used to hammer Brevo's send quota or as an email-enumeration
// oracle via response timing)
const resendVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,

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
