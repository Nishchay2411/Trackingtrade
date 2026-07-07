// ============================================
// TrackingTrade — Access & Refresh Token Helpers
// ============================================
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');

// Short-lived JWT — this is what's sent in the Authorization header and
// stored in localStorage on the frontend (same as before). Kept short so
// that if it's ever stolen (e.g. via XSS), the exposure window is small.
const ACCESS_TOKEN_EXPIRE = process.env.ACCESS_TOKEN_EXPIRE || '15m';

// Long-lived opaque refresh token — NOT a JWT on purpose. It's a random
// value whose SHA-256 hash is stored in the `refresh_tokens` table, so:
//   - it can be individually revoked (logout, password change, theft)
//   - the raw value is never stored anywhere, only its hash
//   - it never touches localStorage/JS at all — it only ever lives in an
//     httpOnly cookie, so it's invisible to any XSS payload that might
//     get past the escaping elsewhere in the app.
const REFRESH_TOKEN_TTL_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRE_DAYS || '30', 10);
const REFRESH_TOKEN_TTL_MS   = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, plan: user.plan },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRE }
  );
}

function generateRefreshTokenValue() {
  return crypto.randomBytes(40).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Cookie options for the refresh token. sameSite:'none' + secure:true is
// required for a cross-site cookie (Vercel frontend <-> Railway backend
// are different domains) — but that combination requires HTTPS, so in
// local dev (NODE_ENV !== 'production', typically http://localhost) we
// fall back to sameSite:'lax'/secure:false so refresh actually works
// while developing.
function refreshCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? 'none' : 'lax',
    path:     '/api/auth', // only sent to auth endpoints (refresh/logout), not every request
    maxAge:   REFRESH_TOKEN_TTL_MS
  };
}

module.exports = {
  generateAccessToken,
  generateRefreshTokenValue,
  hashToken,
  refreshCookieOptions,
  REFRESH_TOKEN_TTL_MS
};
