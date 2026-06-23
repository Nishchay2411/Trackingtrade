const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is missing in .env');
  process.exit(1);
}

// ── MIDDLEWARE ──
app.use(
 helmet({
   crossOriginResourcePolicy: false
  })
);

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    'https://trackingtrade.vercel.app',
    'https://www.trackingtrade.vercel.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.options('*', cors());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({
  extended: true,
  limit: '10mb'
}));

// ── ROUTES ──
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/trades', require('./routes/tradeRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/accounts', require('./routes/accountRoutes'));
app.use('/api/leaderboard', require('./routes/leaderboardRoutes'));

// ── ROOT ROUTE ──
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '📈 TrackingTrade API is running!',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      trades: '/api/trades',
      analytics: '/api/analytics',
      ai: '/api/ai',
      accounts: '/api/accounts',
      leaderboard: '/api/leaderboard'
    }
  });
});

// ── HEALTH CHECK ──
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    message: 'TrackingTrade Backend is running 🚀'
  });
});

// ── 404 HANDLER ──
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// ── ERROR HANDLER ──
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.stack);

  res.status(err.statusCode || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production'
        ? 'Internal Server Error'
        : err.message
  });
});

// ── START SERVER ──
const PORT = process.env.PORT || 8080;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`📈 TrackingTrade Backend running on port ${PORT}`);
  console.log(`📋 Health check available at /health`);
});
