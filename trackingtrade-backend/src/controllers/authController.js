const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('../config/database');

const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const generateToken = (id, email, plan) =>
  jwt.sign(
    { id, email, plan },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );

// ============================================
// REGISTER
// ============================================
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and password are required'
      });
    }

    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }

    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message:
          'Password must contain at least 8 characters, one uppercase, one lowercase, one number and one special character'
      });
    }

    const [existing] = await db.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    const hashed = await bcrypt.hash(password, 12);
    const verificationToken =
  crypto.randomBytes(32).toString('hex');

  const [result] = await db.query(
  `INSERT INTO users
   (name, email, password, verification_token)
   VALUES (?, ?, ?, ?)`,
  [name, email, hashed, verificationToken]
);



    const verifyLink =
`${process.env.FRONTEND_URL}/verify-email.html?token=${verificationToken}`;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

await transporter.sendMail({
  from: process.env.EMAIL_USER,
  to: email,
  subject: 'Verify your TrackingTrade account',
  html: `
    <h2>Welcome to TrackingTrade 🚀</h2>

    <p>Please verify your email by clicking below:</p>

    <a href="${verifyLink}">
      Verify Email
    </a>

    <p>If you didn't create this account, ignore this email.</p>
  `
});
    const token = generateToken(
      result.insertId,
      email,
      'starter'
    );

    res.status(201).json({
      success: true,
      message: 'Account created! Welcome to TrackingTrade 🎉',
      token,
      user: {
        id: result.insertId,
        name,
        email,
        plan: 'starter'
      }
    });

  } catch (err) {
    console.error('Register Error:', err);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ============================================
// LOGIN
// ============================================
// POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password required'
      });
    }

    const [users] = await db.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (!users.length) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = users[0];
    
    if (!user.is_verified) {
  return res.status(401).json({
    success: false,
    message:
      'Please verify your email before logging in.'
  });
}

    // Check if account is locked
    if (user.lock_until && user.lock_until > Date.now()) {
      const minutesLeft = Math.ceil(
        (user.lock_until - Date.now()) / 60000
      );

      return res.status(423).json({
        success: false,
        message: `Account locked. Try again in ${minutesLeft} minute(s).`
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {

      let attempts = user.login_attempts + 1;
      let lockUntil = null;

      // Lock account after 5 failed attempts
      if (attempts >= 5) {
        lockUntil = Date.now() + (15 * 60 * 1000); // 15 min

        await db.query(
          `UPDATE users
           SET login_attempts = ?, lock_until = ?
           WHERE id = ?`,
          [attempts, lockUntil, user.id]
        );

        return res.status(423).json({
          success: false,
          message:
            'Account locked for 15 minutes due to too many failed attempts.'
        });
      }

      await db.query(
        `UPDATE users
         SET login_attempts = ?
         WHERE id = ?`,
        [attempts, user.id]
      );

      return res.status(401).json({
        success: false,
        message: `Invalid credentials. ${5 - attempts} attempts remaining.`
      });
    }

    // Successful login -> reset attempts
    await db.query(
      `UPDATE users
       SET login_attempts = 0,
           lock_until = NULL
       WHERE id = ?`,
      [user.id]
    );

    const token = generateToken(
      user.id,
      user.email,
      user.plan
    );

    res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        timezone: user.timezone,
        currency: user.currency
      }
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ============================================
// GET CURRENT USER
// ============================================
const getMe = async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT id, name, email, timezone,
      currency, plan, avatar, created_at
      FROM users WHERE id = ?`,
      [req.user.id]
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: users[0]
    });

  } catch (err) {
    console.error('GetMe Error:', err);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ============================================
// UPDATE PROFILE
// ============================================
const updateProfile = async (req, res) => {
  try {
    const { name, timezone, currency } = req.body;

    await db.query(
      `UPDATE users
      SET name=?, timezone=?, currency=?
      WHERE id=?`,
      [name, timezone, currency, req.user.id]
    );

    res.json({
      success: true,
      message: 'Profile updated successfully!'
    });

  } catch (err) {
    console.error('Update Profile Error:', err);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ============================================
// CHANGE PASSWORD
// ============================================
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          'New password must contain at least 8 characters, one uppercase, one lowercase, one number and one special character'
      });
    }

    const [users] = await db.query(
      'SELECT password FROM users WHERE id=?',
      [req.user.id]
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isMatch = await bcrypt.compare(
      currentPassword,
      users[0].password
    );

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password incorrect'
      });
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    await db.query(
      'UPDATE users SET password=? WHERE id=?',
      [hashed, req.user.id]
    );

    res.json({
      success: true,
      message: 'Password changed successfully!'
    });

  } catch (err) {
    console.error('Change Password Error:', err);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// ============================================
// FORGOT PASSWORD
// ============================================
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const [users] = await db.query(
      'SELECT id, email FROM users WHERE email=?',
      [email]
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const token = crypto.randomBytes(32).toString('hex');

    const expiry = new Date(
      Date.now() + 60 * 60 * 1000
    );

    await db.query(
      `UPDATE users
      SET reset_token=?, reset_token_expiry=?
      WHERE email=?`,
      [token, expiry, email]
    );

    const resetLink =
      `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'TrackingTrade Password Reset',
      html: `
        <h2>Password Reset</h2>
        <p>Click below to reset your password:</p>

        <a href="${resetLink}">
          Reset Password
        </a>

        <p>This link expires in 1 hour.</p>
      `
    });

    res.json({
      success: true,
      message: 'Password reset link sent'
    });

  } catch (err) {
    console.error('Forgot Password Error:', err);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};


// ============================================
// RESET PASSWORD
// ============================================
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Token and password are required'
      });
    }

    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message:
          'Password must contain at least 8 characters, one uppercase, one lowercase, one number and one special character'
      });
    }

    const [users] = await db.query(
      `SELECT id
       FROM users
       WHERE reset_token = ?
       AND reset_token_expiry > NOW()`,
      [token]
    );

    if (!users.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await db.query(
      `UPDATE users
       SET password = ?,
           reset_token = NULL,
           reset_token_expiry = NULL,
           login_attempts = 0,
           lock_until = NULL
       WHERE id = ?`,
      [hashedPassword, users[0].id]
    );

    res.json({
      success: true,
      message: 'Password reset successful. Please login.'
    });

  } catch (err) {
    console.error('Reset Password Error:', err);

    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};


module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword
};
