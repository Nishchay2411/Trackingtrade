// ============================================
// TrackingTrade — Lightweight Logger
// No external dependency (kept simple on purpose).
// In production this can be swapped for Winston/Pino later
// (see roadmap item: Performance/Observability) without
// changing any call sites, since they all go through this file.
// ============================================

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const CURRENT_LEVEL = LEVELS[process.env.LOG_LEVEL] ?? (process.env.NODE_ENV === 'production' ? LEVELS.info : LEVELS.debug);

const ts = () => new Date().toISOString();

function write(level, icon, args) {
  if (LEVELS[level] > CURRENT_LEVEL) return;
  const stream = level === 'error' ? console.error : console.log;
  stream(`${ts()} ${icon} [${level.toUpperCase()}]`, ...args);
}

const logger = {
  error: (...args) => write('error', '❌', args),
  warn:  (...args) => write('warn',  '⚠️', args),
  info:  (...args) => write('info',  'ℹ️', args),
  debug: (...args) => write('debug', '🐛', args),

  // Lightweight request logger middleware (replaces ad-hoc console.logs).
  // Logs method, path, status code and response time.
  requestLogger: (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      write(level, res.statusCode >= 400 ? '⚠️' : '➡️', [`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`]);
    });
    next();
  }
};

module.exports = logger;
