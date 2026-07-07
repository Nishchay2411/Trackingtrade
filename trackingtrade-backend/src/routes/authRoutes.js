const router = require('express').Router();

const {
  register,
  login,
  googleLogin,
  refresh,
  logout,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification
} = require('../controllers/authController');

const { protect } = require('../middleware/auth');

const {
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  resendVerificationLimiter
} = require('../middleware/rateLimiter');

// ============================================
// PUBLIC ROUTES
// ============================================

router.post('/register', registerLimiter, register);
router.post('/resend-verification', resendVerificationLimiter, resendVerification);
router.post('/login', loginLimiter, login);
router.post('/google', loginLimiter, googleLogin);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password', forgotPasswordLimiter, resetPassword);
router.get('/verify-email/:token', verifyEmail);

// ============================================
// PROTECTED ROUTES
// ============================================

router.get('/me', protect, getMe);
router.put('/update', protect, updateProfile);
router.put('/change-password', protect, changePassword);

module.exports = router;
