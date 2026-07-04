const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const db     = require('../config/database');
const logger = require('../utils/logger');
const { validateRegisterInput, isValidEmail, isValidPassword } = require('../utils/validators');

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const RESET_TOKEN_TTL_MS        = 60 * 60 * 1000;       // 1h
const LOCK_DURATION_MS          = 15 * 60 * 1000;        // 15min
const MAX_LOGIN_ATTEMPTS        = 5;

const generateToken = (id, email, plan) =>
  jwt.sign({ id, email, plan }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

// ── Brevo HTTP API (no SMTP, works on Railway) ──
const sendBrevoMail = async ({ to, subject, html }) => {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept':       'application/json',
      'api-key':      process.env.BREVO_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender:      { name: 'TrackingTrade', email: process.env.EMAIL_FROM },
      to:          [{ email: to }],
      subject,
      htmlContent: html
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Brevo API error: ${errText}`);
  }

  return response.json();
};

const verifyEmailHtml = (name, verifyLink) => `
  <h2>Welcome to TrackingTrade 🚀</h2>
  <p>Hi ${name}, please verify your email by clicking the button below:</p>
  <a href="${verifyLink}" style="background:#7C5CFC;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0;">Verify Email</a>
  <p>This link expires in 24 hours. If you didn't create this account, ignore this email.</p>
`;

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

    const hashed            = await bcrypt.hash(password, 12);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    // FIX (Critical #1): verification tokens never expired before — a link
    // leaked or sitting in an old inbox would stay valid forever.
    const tokenExpiry       = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

    const [result] = await db.query(
      'INSERT INTO users (name, email, password, verification_token, verification_token_expiry) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), email, hashed, verificationToken, tokenExpiry]
    );

    const verifyLink = `${process.env.FRONTEND_URL}/verify-email.html?token=${verificationToken}`;

    // FIX (Item 10 — Email Failure Handling): the user row is already
    // committed at this point. If Brevo is down or rate-limited, we must
    // NOT return a 500 (the account exists, "failed" would be a lie, and
    // the user can't re-register since the email is now taken). Log the
    // failure, still return 201, and let them use "Resend verification".
    try {
      await sendBrevoMail({
        to:      email,
        subject: 'Verify your TrackingTrade account',
        html:    verifyEmailHtml(name, verifyLink)
      });
    } catch (mailErr) {
      logger.error('Register: verification email failed to send', { userId: result.insertId, email, err: mailErr.message });
      return res.success({}, 'Account created, but we could not send the verification email right now. Use "Resend verification email" on the login page to try again.', 201);
    }

    return res.success({}, 'Account created! Please check your email to verify before logging in.', 201);

  } catch (err) {
    logger.error('Register Error:', err);
    res.fail('Server error', 500);
  }
};

// ============================================
// RESEND VERIFICATION EMAIL   (Critical #5 — was missing entirely)
// ============================================
const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !isValidEmail(email)) return res.fail('A valid email is required', 400);

    // Same generic-response pattern as forgotPassword — never reveal
    // whether an email is registered or already verified.
    const generic = { message: 'If that account exists and is not yet verified, a new verification link has been sent.' };

    const [users] = await db.query('SELECT id, name, is_verified FROM users WHERE email=?', [email]);
    if (!users.length || users[0].is_verified) {
      return res.success({}, generic.message);
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry       = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

    await db.query(
      'UPDATE users SET verification_token=?, verification_token_expiry=? WHERE id=?',
      [verificationToken, tokenExpiry, users[0].id]
    );

    const verifyLink = `${process.env.FRONTEND_URL}/verify-email.html?token=${verificationToken}`;

    try {
      await sendBrevoMail({
        to:      email,
        subject: 'Verify your TrackingTrade account',
        html:    verifyEmailHtml(users[0].name, verifyLink)
      });
    } catch (mailErr) {
      logger.error('Resend verification: email failed to send', { userId: users[0].id, email, err: mailErr.message });
      // Still return the generic success message — don't leak delivery
      // state to the client, but the user can retry the resend action.
    }

    return res.success({}, generic.message);
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

    if (!user.is_verified) {
      return res.fail('Please verify your email before logging in.', 401);
    }

    if (user.lock_until && user.lock_until > Date.now()) {
      const minutesLeft = Math.ceil((user.lock_until - Date.now()) / 60000);
      return res.fail(`Account locked. Try again in ${minutesLeft} minute(s).`, 423);
    }

    // FIX (Critical #3 — Login Attempt Lock bug): once a lock expired, the
    // old code never reset `login_attempts`. The very next wrong password
    // pushed attempts from 5 straight to 6, re-triggering the >=5 branch
    // and re-locking the account for another 15 minutes immediately —
    // the user never actually got their 5 fresh attempts back. Reset the
    // counter here once we know any previous lock has expired.
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

    // FIX (Item 11 — last_login): track last successful login.
    await db.query('UPDATE users SET login_attempts=0, lock_until=NULL, last_login=NOW() WHERE id=?', [user.id]);

    const token = generateToken(user.id, user.email, user.plan);

    res.success({
      token,
      user: {
        id:       user.id,
        name:     user.name,
        email:    user.email,
        plan:     user.plan,
        timezone: user.timezone,
        currency: user.currency
      }
    }, 'Login successful!');

  } catch (err) {
    logger.error('Login Error:', err);
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

    const isMatch = await bcrypt.compare(currentPassword, users[0].password);
    if (!isMatch) return res.fail('Current password incorrect', 400);

    const hashed = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password=? WHERE id=?', [hashed, req.user.id]);

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

    // Always return the same generic response whether or not the email
    // exists, so this endpoint can't be used to enumerate registered users.
    const genericMessage = 'If an account exists for that email, a reset link has been sent.';

    const [users] = await db.query('SELECT id, name FROM users WHERE email=?', [email]);
    if (!users.length) return res.success({}, genericMessage);

    const token  = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await db.query('UPDATE users SET reset_token=?, reset_token_expiry=? WHERE email=?', [token, expiry, email]);

    const resetLink = `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;

    try {
      await sendBrevoMail({
        to:      email,
        subject: 'TrackingTrade Password Reset',
        html: `
          <h2>Password Reset Request</h2>
          <p>Hi ${users[0].name}, click below to reset your password:</p>
          <a href="${resetLink}" style="background:#7C5CFC;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0;">Reset Password</a>
          <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
        `
      });
    } catch (mailErr) {
      // Item 10: don't blow up the request or leak delivery failure —
      // just log it. The user can retry "forgot password" again.
      logger.error('Forgot Password: email failed to send', { userId: users[0].id, email, err: mailErr.message });
    }

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

    // FIX (Critical #1): reject expired tokens instead of accepting them
    // forever, and point the user at the recovery path.
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

module.exports = { register, login, getMe, updateProfile, changePassword, forgotPassword, resetPassword, verifyEmail, resendVerification };
