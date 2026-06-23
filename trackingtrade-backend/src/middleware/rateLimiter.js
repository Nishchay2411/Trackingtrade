const rateLimit = require('express-rate-limit');

// Login limiter
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per IP
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
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,

  message: {
    success: false,
    message:
      'Too many registrations from this IP. Please try again later.'
  }
});

module.exports = {
  loginLimiter,
  registerLimiter
};