const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
require('dotenv').config();

const logger = require('./utils/logger');
const { attachResponseHelpers } = require('./utils/response');
const db = require('./config/database');

const app = express();
app.set('trust proxy', 1);

if (!process.env.JWT_SECRET) {
  logger.error('JWT_SECRET is missing in environment variables');
  process.exit(1);
}

// ── MIDDLEWARE ──
app.use(helmet({ crossOriginResourcePolicy: false }));

// FIX (Item 6 — CORS Improvement): the allowed origins were hardcoded
// inline. Moved to an env var (comma-separated) with the previous values
// kept as the default, so staging/preview URLs or a custom domain can be
// added later via Railway env vars without a code change + redeploy.
// Also switched to an origin *function* so requests with no Origin header
// (server-to-server calls, curl, the Railway health checker) aren't
// rejected — only browser requests from a disallowed origin are blocked.
const defaultOrigins = [
  'https://trackingtrade.vercel.app',
  'https://www.trackingtrade.vercel.app'
];
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : defaultOrigins;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    logger.warn('CORS: blocked request from disallowed origin', { origin });
    return callback(new Error('Not allowed by CORS'));
  },
  methods:      ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.options('*', cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Item 9 — request logging (replaces scattered console.logs)
app.use(logger.requestLogger);

// Item 7 — attach res.success()/res.fail() helpers used across controllers
app.use(attachResponseHelpers);

// ── ROUTES ──
app.use('/api/auth',        require('./routes/authRoutes'));
app.use('/api/trades',      require('./routes/tradeRoutes'));
app.use('/api/analytics',   require('./routes/analyticsRoutes'));
app.use('/api/ai',          require('./routes/aiRoutes'));
app.use('/api/accounts',    require('./routes/accountRoutes'));
app.use('/api/leaderboard', require('./routes/leaderboardRoutes'));

// ── ROOT ──
app.get('/', (req, res) => {
  res.success({ version: '1.0.0' }, '📈 TrackingTrade API is running!');
});

// ── HEALTH CHECK ──
// FIX (Item 13): the old /health always returned 200 "healthy" even if
// the database connection pool was down, which defeats the point of a
// health check on a platform (Railway) that uses it for restart
// decisions. Now it actually pings the DB and reports uptime.
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: 'unknown'
  };

  try {
    await db.query('SELECT 1');
    health.database = 'connected';
    return res.status(200).json({ success: true, ...health });
  } catch (err) {
    logger.error('Health check: database ping failed', err.message);
    health.status = 'degraded';
    health.database = 'disconnected';
    return res.status(503).json({ success: false, ...health });
  }
});

// ── 404 ──
app.use((req, res) => {
  res.fail(`Route ${req.originalUrl} not found`, 404);
});

// ── ERROR HANDLER ──
// Item 14: every error now flows through res.fail() so the response
// shape is identical to every other error in the app, and raw error
// details are never sent to the client in production.
app.use((err, req, res, next) => {
  logger.error('Unhandled request error:', err.stack || err.message);
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? (statusCode < 500 ? err.message : 'Internal Server Error')
    : err.message;
  res.fail(message, statusCode);
});

// Item 14: catch anything that slips past Express entirely (e.g. an
// error thrown outside a request context) so the process logs it clearly
// instead of crashing silently or with an opaque stack trace.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err.stack || err.message);
});

// ── START ──
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`📈 TrackingTrade Backend running on port ${PORT}`);
  logger.info(`🌍 Accepting requests from: ${allowedOrigins.join(', ')}`);
});
