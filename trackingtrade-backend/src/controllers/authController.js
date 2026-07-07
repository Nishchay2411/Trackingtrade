const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');

const db     = require('../config/database');
const logger = require('../utils/logger');
const { validateRegisterInput, isValidEmail, isValidPassword } = require('../utils/validators');
const { sendMailAsync } = require('../utils/mailer');
const { verifyEmailTemplate } = require('../emails/verifyEmail');
const { resetPasswordTemplate } = require('../emails/resetPassword');
const {
  generateAccessToken,
  generateRefreshTokenValue,
  hashToken,
  refreshCookieOptions,
  REFRESH_TOKEN_TTL_MS
} = require('../utils/tokens');

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const RESET_TOKEN_TTL_MS        = 60 * 60 * 1000;       // 1h
const LOCK_DURATION_MS          = 15 * 60 * 1000;        // 15min
const MAX_LOGIN_ATTEMPTS        = 5;

const googleClient = process.env.GOOGLE_CLIENT_ID ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID) : null;

// ── Helper: issue a fresh access+refresh token pair for a user, set the
// refresh cookie, and return the access token + safe user object. Shared
// by login, google login, and refresh so the "session issuance" logic
// only lives in one place. ──
async function issueSession(res, user) {
  const accessToken  = generateAccessToken(user);
  const refreshValue = generateRefreshTokenValue();
  const refreshHash  = hashToken(refreshValue);
  const expiresAt    = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await db.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [user.id, refreshHash, expiresAt]
  );

  res.cookie('refreshToken', refreshValue, refreshCookieOptions());

  return {
    token: accessToken,
    user: {
      id:       user.id,
      name:     user.name,
      email:    user.email,
      plan:     user.plan,
      timezone: user.timezone,
      currency: user.currency
    }
  };
}

// Revoke every active refresh token for a user — used on password
// change/reset so a stolen password can't be paired with a still-valid
// long-lived session; forces re-login everywhere.
async function revokeAllRefreshTokens(userId) {
  await db.query('UPDATE refresh_tokens SET revoked_at=NOW() WHERE user_id=? AND revoked_at IS NULL', [userId]);
}

// ============================================
// REGISTER
// ============================================
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const check = validateRegisterInput({ name, email, password });
    if (!check.valid) return res.fail(check.message, 400);

    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.fail('Email already registered', 400);
    }

    const hashed             = await bcrypt.hash(password, 12);
    const verificationToken  = crypto.randomBytes(32).toString('hex');
    const tokenExpiry        = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

    const [result] = await db.query(
      'INSERT INTO users (name, email, password, verification_token, verification_token_expiry) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), email, hashed, verificationToken, tokenExpiry]
    );

    const verifyLink = `${process.env.FRONTEND_URL}/verify-email.html?token=${verificationToken}`;
    const { subject, html } = verifyEmailTemplate({ name, verifyLink });

    // FIX (Brevo non-blocking): fire-and-forget — the HTTP response below
    // does not wait on Brevo at all now. If it fails, it's logged
    // server-side and the user can always use "Resend verification email".
    sendMailAsync({ to: email, subject, html });

    return res.success({}, 'Account created! Please check your email to verify before logging in.', 201);

  } catch (err) {
    logger.error('Register Error:', err);
    res.fail('Server error', 500);
  }
};

// ============================================
// RESEND VERIFICATION EMAIL
// ============================================
const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !isValidEmail(email)) return res.fail('A valid email is required', 400);

    const genericMessage = 'If that account exists and is not yet verified, a new verification link has been sent.';

    const [users] = await db.query('SELECT id, name, is_verified FROM users WHERE email=?', [email]);
    if (!users.length || users[0].is_verified) {
      return res.success({}, genericMessage);
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry       = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

    await db.query(
      'UPDATE users SET verification_token=?, verification_token_expiry=? WHERE id=?',
      [verificationToken, tokenExpiry, users[0].id]
    );

    const verifyLink = `${process.env.FRONTEND_URL}/verify-email.html?token=${verificationToken}`;
    const { subject, html } = verifyEmailTemplate({ name: users[0].name, verifyLink });

    sendMailAsync({ to: email, subject, html });

    return res.success({}, genericMessage);
  } catch (err) {
    logger.error('Resend Verification Error:', err);
    res.fail('Server error', 500);
  }
};

// ============================================
// LOGIN
// ============================================
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.fail('Email and password required', 400);
    }

    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

    if (!users.length) {
      return res.fail('Invalid credentials', 401);
    }

    let user = users[0];

    if (!user.password) {
      // Account was created via Google Sign-In and has no password set.
      return res.fail('This account uses Google Sign-In. Please continue with Google.', 400);
    }

    if (!user.is_verified) {
      return res.fail('Please verify your email before logging in.', 401);
    }

    if (user.lock_until && user.lock_until > Date.now()) {
      const minutesLeft = Math.ceil((user.lock_until - Date.now()) / 60000);
      return res.fail(`Account locked. Try again in ${minutesLeft} minute(s).`, 423);
    }

    if (user.lock_until && user.lock_until <= Date.now()) {
      await db.query('UPDATE users SET login_attempts=0, lock_until=NULL WHERE id=?', [user.id]);
      user = { ...user, login_attempts: 0, lock_until: null };
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      const attempts = user.login_attempts + 1;
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        const lockUntil = Date.now() + LOCK_DURATION_MS;
        await db.query('UPDATE users SET login_attempts=?, lock_until=? WHERE id=?', [attempts, lockUntil, user.id]);
        return res.fail('Account locked for 15 minutes due to too many failed attempts.', 423);
      }
      await db.query('UPDATE users SET login_attempts=? WHERE id=?', [attempts, user.id]);
      return res.fail(`Invalid credentials. ${MAX_LOGIN_ATTEMPTS - attempts} attempts remaining.`, 401);
    }

    await db.query('UPDATE users SET login_attempts=0, lock_until=NULL, last_login=NOW() WHERE id=?', [user.id]);

    const session = await issueSession(res, user);
    res.success(session, 'Login successful!');

  } catch (err) {
    logger.error('Login Error:', err);
    res.fail('Server error', 500);
  }
};

// ============================================
// GOOGLE LOGIN
// ============================================
const googleLogin = async (req, res) => {
  try {
    if (!googleClient) {
      logger.error('Google login attempted but GOOGLE_CLIENT_ID is not configured');
      return res.fail('Google Sign-In is not configured on this server.', 500);
    }

    const { credential } = req.body;
    if (!credential) return res.fail('Missing Google credential', 400);

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      logger.warn('Google ID token verification failed:', verifyErr.message);
      return res.fail('Invalid Google credential', 401);
    }

    if (!payload.email_verified) {
      return res.fail('Google account email is not verified', 401);
    }

    const { email, name, sub: googleId } = payload;

    const [existing] = await db.query('SELECT * FROM users WHERE email=? OR google_id=?', [email, googleId]);

    let user;
    if (existing.length) {
      user = existing[0];
      // Account was previously created with a password — link the Google
      // identity to it (same email = same person) and trust Google's
      // verification of that email going forward.
      if (!user.google_id) {
        await db.query('UPDATE users SET google_id=?, is_verified=TRUE WHERE id=?', [googleId, user.id]);
        user.google_id = googleId;
        user.is_verified = 1;
      }
    } else {
      const [result] = await db.query(
        'INSERT INTO users (name, email, google_id, is_verified) VALUES (?, ?, ?, TRUE)',
        [name || email.split('@')[0], email, googleId]
      );
      const [rows] = await db.query('SELECT * FROM users WHERE id=?', [result.insertId]);
      user = rows[0];
    }

    await db.query('UPDATE users SET last_login=NOW() WHERE id=?', [user.id]);

    const session = await issueSession(res, user);
    res.success(session, 'Signed in with Google!');

  } catch (err) {
    logger.error('Google Login Error:', err);
    res.fail('Server error', 500);
  }
};

// ============================================
// REFRESH ACCESS TOKEN
// ============================================
const refresh = async (req, res) => {
  try {
    const refreshValue = req.cookies?.refreshToken;
    if (!refreshValue) return res.fail('No refresh token provided', 401);

    const tokenHash = hashToken(refreshValue);

    const [rows] = await db.query(
      `SELECT rt.*, u.id AS user_id, u.email, u.plan, u.name, u.timezone, u.currency
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token_hash=? AND rt.revoked_at IS NULL AND rt.expires_at > NOW()`,
      [tokenHash]
    );

    if (!rows.length) {
      res.clearCookie('refreshToken', { path: '/api/auth' });
      return res.fail('Invalid or expired session. Please login again.', 401);
    }

    const row = rows[0];

    // Rotation: revoke the token we just used and issue a brand new one.
    // If a stolen refresh token gets used by an attacker after the real
    // user already rotated it, this row will already be revoked and the
    // lookup above simply fails — a clean signal to force re-login.
    await db.query('UPDATE refresh_tokens SET revoked_at=NOW() WHERE id=?', [row.id]);

    const user = { id: row.user_id, email: row.email, plan: row.plan, name: row.name, timezone: row.timezone, currency: row.currency };
    const session = await issueSession(res, user);

    res.success({ token: session.token }, 'Session refreshed');
  } catch (err) {
    logger.error('Refresh Token Error:', err);
    res.fail('Server error', 500);
  }
};

// ============================================
// LOGOUT
// ============================================
const logout = async (req, res) => {
  try {
    const refreshValue = req.cookies?.refreshToken;
    if (refreshValue) {
      const tokenHash = hashToken(refreshValue);
      await db.query('UPDATE refresh_tokens SET revoked_at=NOW() WHERE token_hash=? AND revoked_at IS NULL', [tokenHash]);
    }
    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.success({}, 'Logged out');
  } catch (err) {
    logger.error('Logout Error:', err);
    res.fail('Server error', 500);
  }
};

// ============================================
// GET CURRENT USER
// ============================================
const getMe = async (req, res) => {
  try {
    const [users] = await db.query(
      'SELECT id, name, email, timezone, currency, plan, avatar, last_login, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!users.length) return res.fail('User not found', 404);
    res.success({ user: users[0] });
  } catch (err) {
    logger.error('GetMe Error:', err);
    res.fail('Server error', 500);
  }
};

// ============================================
// UPDATE PROFILE
// ============================================
const updateProfile = async (req, res) => {
  try {
    const { name, timezone, currency } = req.body;
    if (!name || String(name).trim().length < 2) return res.fail('Name must be at least 2 characters', 400);
    await db.query('UPDATE users SET name=?, timezone=?, currency=? WHERE id=?', [name.trim(), timezone, currency, req.user.id]);
    res.success({}, 'Profile updated successfully!');
  } catch (err) {
    logger.error('Update Profile Error:', err);
    res.fail('Server error', 500);
  }
};

// ============================================
// CHANGE PASSWORD
// ============================================
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!isValidPassword(newPassword)) {
      return res.fail('New password must be 8+ chars with uppercase, lowercase, number and special character', 400);
    }

    const [users] = await db.query('SELECT password FROM users WHERE id=?', [req.user.id]);
    if (!users.length) return res.fail('User not found', 404);

    const isMatch = await bcrypt.compare(currentPassword, users[0].password || '');
    if (!isMatch) return res.fail('Current password incorrect', 400);

    const hashed = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password=? WHERE id=?', [hashed, req.user.id]);

    // Force re-login on every other device/session.
    await revokeAllRefreshTokens(req.user.id);

    res.success({}, 'Password changed successfully!');
  } catch (err) {
    logger.error('Change Password Error:', err);
    res.fail('Server error', 500);
  }
};

// ============================================
// FORGOT PASSWORD
// ============================================
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.fail('A valid email is required', 400);
    }

    const genericMessage = 'If an account exists for that email, a reset link has been sent.';

    const [users] = await db.query('SELECT id, name FROM users WHERE email=?', [email]);
    if (!users.length) return res.success({}, genericMessage);

    const token  = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await db.query('UPDATE users SET reset_token=?, reset_token_expiry=? WHERE email=?', [token, expiry, email]);

    const resetLink = `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;
    const { subject, html } = resetPasswordTemplate({ name: users[0].name, resetLink });

    sendMailAsync({ to: email, subject, html });

    res.success({}, genericMessage);
  } catch (err) {
    logger.error('Forgot Password Error:', err);
    res.fail('Server error', 500);
  }
};

// ============================================
// RESET PASSWORD
// ============================================
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.fail('Token and password are required', 400);
    }

    if (!isValidPassword(password)) {
      return res.fail('Password must be 8+ chars with uppercase, lowercase, number and special character', 400);
    }

    const [users] = await db.query(
      'SELECT id FROM users WHERE reset_token=? AND reset_token_expiry > NOW()',
      [token]
    );

    if (!users.length) {
      return res.fail('Invalid or expired reset token', 400);
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await db.query(
      'UPDATE users SET password=?, reset_token=NULL, reset_token_expiry=NULL, login_attempts=0, lock_until=NULL WHERE id=?',
      [hashedPassword, users[0].id]
    );

    await revokeAllRefreshTokens(users[0].id);

    res.success({}, 'Password reset successful! Please login.');
  } catch (err) {
    logger.error('Reset Password Error:', err);
    res.fail('Server error', 500);
  }
};

// ============================================
// VERIFY EMAIL
// ============================================
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    const [users] = await db.query(
      'SELECT id, is_verified, verification_token_expiry FROM users WHERE verification_token=?',
      [token]
    );

    if (!users.length) {
      return res.fail('Invalid verification token', 400);
    }

    const user = users[0];

    if (user.is_verified) {
      return res.success({}, 'Email already verified. You can log in.');
    }

    if (user.verification_token_expiry && new Date(user.verification_token_expiry) < new Date()) {
      return res.fail('Verification link expired. Please request a new one from the login page.', 400);
    }

    await db.query('UPDATE users SET is_verified=TRUE, verification_token=NULL, verification_token_expiry=NULL WHERE id=?', [user.id]);

    res.success({}, 'Email verified successfully! You can now login.');
  } catch (err) {
    logger.error('Verify Email Error:', err);
    res.fail('Server error', 500);
  }
};

module.exports = {
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
};
