// ============================================
// TrackingTrade — Server Entrypoint
// ============================================
// Thin wrapper around app.js — this is the only file that actually
// starts listening on a port. Kept separate so tests can `require('./app')`
// without spinning up a real server (see Item — Jest/Supertest).
const app    = require('./app');
const logger = require('./utils/logger');

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err.stack || err.message);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  logger.info(`📈 TrackingTrade Backend running on port ${PORT}`);
});
