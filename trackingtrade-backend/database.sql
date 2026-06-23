-- ============================================
-- TrackingTrade Database Schema
-- Run this in MySQL to setup the database
-- ============================================

CREATE DATABASE IF NOT EXISTS trackingtrade;
USE trackingtrade;

-- ── USERS TABLE ──
CREATE TABLE IF NOT EXISTS users (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  email        VARCHAR(100) NOT NULL UNIQUE,
  password     VARCHAR(255) NOT NULL,
  timezone     VARCHAR(50) DEFAULT 'UTC',
  currency     VARCHAR(10) DEFAULT 'USD',
  plan         ENUM('starter','pro','elite') DEFAULT 'starter',
  avatar       VARCHAR(255),
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ── TRADING ACCOUNTS TABLE ──
CREATE TABLE IF NOT EXISTS trading_accounts (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL,
  name            VARCHAR(100) NOT NULL,
  broker          VARCHAR(100) NOT NULL,
  platform        ENUM('MT4','MT5','cTrader','TradeLocker') DEFAULT 'MT5',
  account_number  VARCHAR(50),
  account_type    ENUM('Live','Demo','Prop Firm') DEFAULT 'Demo',
  balance         DECIMAL(15,2) DEFAULT 0,
  equity          DECIMAL(15,2) DEFAULT 0,
  currency        VARCHAR(10) DEFAULT 'USD',
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── TRADES TABLE ──
CREATE TABLE IF NOT EXISTS trades (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT NOT NULL,
  account_id      INT,
  pair            VARCHAR(20) NOT NULL,
  type            ENUM('BUY','SELL') NOT NULL,
  lots            DECIMAL(10,4) NOT NULL,
  entry_price     DECIMAL(15,5) NOT NULL,
  exit_price      DECIMAL(15,5),
  stop_loss       DECIMAL(15,5),
  take_profit     DECIMAL(15,5),
  pnl             DECIMAL(15,2) DEFAULT 0,
  rr_ratio        VARCHAR(20),
  duration        VARCHAR(50),
  open_time       DATETIME NOT NULL,
  close_time      DATETIME,
  status          ENUM('open','closed') DEFAULT 'open',
  strategy        ENUM('Trend Follow','Breakout','Reversal','Scalp','Swing','Other') DEFAULT 'Other',
  session         ENUM('Asian','London','New York','London/NY','Asian/London') DEFAULT 'London',
  notes           TEXT,
  screenshot_url  VARCHAR(255),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)    REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES trading_accounts(id) ON DELETE SET NULL
);

-- ── AI INSIGHTS TABLE ──
CREATE TABLE IF NOT EXISTS ai_insights (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  type        ENUM('strength','improvement','warning','insight') NOT NULL,
  title       VARCHAR(100) NOT NULL,
  message     TEXT NOT NULL,
  impact      ENUM('high','medium','low') DEFAULT 'medium',
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── LEADERBOARD TABLE (Monthly snapshot) ──
CREATE TABLE IF NOT EXISTS leaderboard (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  month       VARCHAR(7) NOT NULL,  -- e.g. '2025-05'
  roi         DECIMAL(8,2) DEFAULT 0,
  win_rate    DECIMAL(5,2) DEFAULT 0,
  total_trades INT DEFAULT 0,
  max_drawdown DECIMAL(8,2) DEFAULT 0,
  points      INT DEFAULT 0,
  rank_position INT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_month (user_id, month),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ── SAMPLE DATA ──
INSERT INTO users (name, email, password, plan) VALUES
('John Doe', 'john@example.com', '$2a$10$examplehashedpassword', 'pro'),
('Sarah Chen', 'sarah@example.com', '$2a$10$examplehashedpassword', 'elite');

INSERT INTO trading_accounts (user_id, name, broker, platform, account_number, account_type, balance, equity) VALUES
(1, 'FTMO Challenge', 'FTMO', 'MT5', '#5841920', 'Prop Firm', 47280.00, 49120.00),
(1, 'IC Markets Demo', 'IC Markets', 'MT4', '#7720044', 'Demo', 10000.00, 10840.00);

INSERT INTO trades (user_id, account_id, pair, type, lots, entry_price, exit_price, stop_loss, take_profit, pnl, rr_ratio, duration, open_time, close_time, status, strategy, session, notes) VALUES
(1, 1, 'EURUSD', 'BUY',  0.10, 1.08450, 1.08920, 1.08200, 1.09100,  470.00, '1:2.1', '4h 20m', '2025-05-27 08:00:00', '2025-05-27 12:20:00', 'closed', 'Trend Follow', 'London',   'Clean breakout above H4 resistance'),
(1, 1, 'XAUUSD', 'SELL', 0.05, 2340.50, 2318.20, 2352.00, 2315.00,  558.00, '1:2.8', '6h 10m', '2025-05-26 10:00:00', '2025-05-26 16:10:00', 'closed', 'Reversal',    'New York', 'Bearish engulfing at supply zone'),
(1, 1, 'GBPUSD', 'BUY',  0.08, 1.27310, 1.27090, 1.27090, 1.27700, -141.00, '1:1.0', '1h 45m', '2025-05-26 09:00:00', '2025-05-26 10:45:00', 'closed', 'Breakout',    'London',   'False breakout — news spike'),
(1, 1, 'BTCUSD', 'BUY',  0.01, 67400,   68100,   67000,   68500,    700.00, '1:3.5', '12h 00m','2025-05-25 06:00:00', '2025-05-25 18:00:00', 'closed', 'Breakout',    'New York', 'Weekly level breakout with volume');

SELECT 'TrackingTrade database setup complete!' AS Status;
