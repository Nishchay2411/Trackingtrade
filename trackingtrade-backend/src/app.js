// ============================================
// TrackingTrade — Express App
// ============================================
// Split out from server.js (Item — Jest/Supertest): tests need to import
// the configured Express `app` and drive requests at it directly via
// supertest, without actually binding a port or requiring a live
// database connection. server.js now just imports this file and calls
// app.listen().
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const logger = require('./utils/logger');
const { attachResponseHelpers } = require('./utils/response');
const db = require('./config/database');

const app = express();
app.set('trust proxy', 1);

if (!process.env.JWT_SECRET) {
  logger.error('JWT_SECRET is missing in environment variables');
  if (process.env.NODE_ENV !== 'test') process.exit(1);
}

// ── MIDDLEWARE ──
app.use(helmet({ crossOriginResourcePolicy: false }));

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
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  // Required for the refresh-token httpOnly cookie to flow cross-site
  // between the Vercel frontend and Railway backend.
  credentials: true
}));

app.options('*', cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

app.use(logger.requestLogger);
app.use(attachResponseHelpers);

// ── ROUTES ──
app.use('/api/auth',        require('./routes/authRoutes'));
app.use('/api/trades',      require('./routes/tradeRoutes'));
app.use('/api/analytics',   require('./routes/analyticsRoutes'));
app.use('/api/ai',          require('./routes/aiRoutes'));
app.use('/api/accounts',    require('./routes/accountRoutes'));
app.use('/api/leaderboard', require('./routes/leaderboardRoutes'));

app.get('/', (req, res) => {
  res.success({ version: '1.0.0' }, '📈 TrackingTrade API is running!');
});

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

app.use((req, res) => {
  res.fail(`Route ${req.originalUrl} not found`, 404);
});

app.use((err, req, res, next) => {
  logger.error('Unhandled request error:', err.stack || err.message);
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? (statusCode < 500 ? err.message : 'Internal Server Error')
    : err.message;
  res.fail(message, statusCode);
});

module.exports = app;
