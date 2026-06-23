const router = require('express').Router();

const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword
} = require('../controllers/authController');

const { protect } = require('../middleware/auth');

const {
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter
} = require('../middleware/rateLimiter');

// ============================================
// PUBLIC ROUTES
// ============================================

// Register
router.post(
  '/register',
  registerLimiter,
  register
);

// Login
router.post(
  '/login',
  loginLimiter,
  login
);

// Forgot Password
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  forgotPassword
);

// Reset Password
router.post(
  '/reset-password',
  forgotPasswordLimiter,
  resetPassword
);

// ============================================
// PROTECTED ROUTES
// ============================================

// Get logged in user
router.get(
  '/me',
  protect,
  getMe
);

// Update Profile
router.put(
  '/update',
  protect,
  updateProfile
);

// Change Password
router.put(
  '/change-password',
  protect,
  changePassword
);

module.exports = router;