const mysql = require('mysql2');
require('dotenv').config();
const logger = require('../utils/logger');

// FIX Bug 7: Added SSL support for cloud MySQL providers (Aiven, PlanetScale, etc.)
// SSL is enabled when DB_SSL=true in .env (set this for Aiven/cloud, leave unset for local)
const sslConfig = process.env.DB_SSL === 'true'
  ? { rejectUnauthorized: true }
  : false;

const pool = mysql.createPool({
  host:               process.env.DB_HOST,
  user:               process.env.DB_USER,
  password:           process.env.DB_PASSWORD,
  database:           process.env.DB_NAME,
  port:               process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
  ssl:                sslConfig,
  waitForConnections: true,
  connectionLimit:    10,
});

pool.getConnection((err, connection) => {
  if (err) {
    logger.error('Database connection failed:', err.message);
  } else {
    logger.info('Database connected!');
    connection.release();
  }
});

module.exports = pool.promise();
