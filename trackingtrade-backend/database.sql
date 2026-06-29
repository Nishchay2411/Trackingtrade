```sql
-- ============================================
-- TrackingTrade Database Schema v2
-- Production Ready
-- ============================================

CREATE DATABASE IF NOT EXISTS trackingtrade;
USE trackingtrade;

-- ============================================
-- USERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id                    INT AUTO_INCREMENT PRIMARY KEY,

  name                  VARCHAR(100) NOT NULL,

  email                 VARCHAR(255) NOT NULL UNIQUE,

  password              VARCHAR(255) NOT NULL,

  timezone              VARCHAR(50) DEFAULT 'UTC',
  currency              VARCHAR(10) DEFAULT 'USD',

  plan                  ENUM('starter','pro','elite')
                        DEFAULT 'starter',

  avatar                VARCHAR(255),

  is_verified           BOOLEAN DEFAULT FALSE,

  verification_token    VARCHAR(255) UNIQUE,

  login_attempts        INT DEFAULT 0,

  lock_until            BIGINT DEFAULT NULL,

  reset_token           VARCHAR(255) UNIQUE,

  reset_token_expiry    DATETIME,

  last_login            TIMESTAMP NULL DEFAULT NULL,

  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- TRADING ACCOUNTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS trading_accounts (

  id                    INT AUTO_INCREMENT PRIMARY KEY,

  user_id               INT NOT NULL,

  name                  VARCHAR(100) NOT NULL,

  broker                VARCHAR(100) NOT NULL,

  broker_logo           VARCHAR(255),

  platform              ENUM(
                            'MT4',
                            'MT5',
                            'cTrader',
                            'TradeLocker'
                          ) DEFAULT 'MT5',

  account_number        VARCHAR(50),

  account_type          ENUM(
                            'Live',
                            'Demo',
                            'Prop Firm'
                          ) DEFAULT 'Demo',

  balance               DECIMAL(15,2) DEFAULT 0,

  equity                DECIMAL(15,2) DEFAULT 0,

  currency              VARCHAR(10) DEFAULT 'USD',

  is_active             BOOLEAN DEFAULT TRUE,

  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id)
  REFERENCES users(id)
  ON DELETE CASCADE
);

-- ============================================
-- TRADES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS trades (

  id                    INT AUTO_INCREMENT PRIMARY KEY,

  user_id               INT NOT NULL,

  account_id            INT,

  pair                  VARCHAR(20) NOT NULL,

  type                  ENUM('BUY','SELL') NOT NULL,

  lots                  DECIMAL(10,4) NOT NULL,

  entry_price           DECIMAL(15,5) NOT NULL,

  exit_price            DECIMAL(15,5),

  stop_loss             DECIMAL(15,5),

  take_profit           DECIMAL(15,5),

  pnl                   DECIMAL(15,2) DEFAULT 0,

  commission            DECIMAL(15,2) DEFAULT 0,

  swap                  DECIMAL(15,2) DEFAULT 0,

  rr_ratio              VARCHAR(20),

  duration              VARCHAR(50),

  open_time             DATETIME NOT NULL,

  close_time            DATETIME,

  status                ENUM('open','closed')
                         DEFAULT 'open',

  strategy              ENUM(
                            'Trend Follow',
                            'Breakout',
                            'Reversal',
                            'Scalp',
                            'Swing',
                            'Other'
                         ) DEFAULT 'Other',

  session               ENUM(
                            'Asian',
                            'London',
                            'New York',
                            'London/NY',
                            'Asian/London'
                         ) DEFAULT 'London',

  emotion               ENUM(
                            'Confident',
                            'Fear',
                            'Greed',
                            'FOMO',
                            'Revenge',
                            'Calm'
                         ) DEFAULT 'Calm',

  notes                 TEXT,

  screenshot_url        TEXT,

  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id)
  REFERENCES users(id)
  ON DELETE CASCADE,

  FOREIGN KEY (account_id)
  REFERENCES trading_accounts(id)
  ON DELETE SET NULL
);

-- ============================================
-- AI INSIGHTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS ai_insights (

  id                    INT AUTO_INCREMENT PRIMARY KEY,

  user_id               INT NOT NULL,

  type                  ENUM(
                            'strength',
                            'improvement',
                            'warning',
                            'insight'
                         ) NOT NULL,

  title                 VARCHAR(100) NOT NULL,

  message               TEXT NOT NULL,

  impact                ENUM(
                            'high',
                            'medium',
                            'low'
                         ) DEFAULT 'medium',

  is_read               BOOLEAN DEFAULT FALSE,

  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id)
  REFERENCES users(id)
  ON DELETE CASCADE
);

-- ============================================
-- LEADERBOARD TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS leaderboard (

  id                    INT AUTO_INCREMENT PRIMARY KEY,

  user_id               INT NOT NULL,

  month                 VARCHAR(7) NOT NULL,

  roi                   DECIMAL(8,2) DEFAULT 0,

  win_rate              DECIMAL(5,2) DEFAULT 0,

  total_trades          INT DEFAULT 0,

  max_drawdown          DECIMAL(8,2) DEFAULT 0,

  points                INT DEFAULT 0,

  rank_position         INT,

  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY unique_user_month
  (user_id, month),

  FOREIGN KEY (user_id)
  REFERENCES users(id)
  ON DELETE CASCADE
);

-- ============================================
-- PERFORMANCE INDEXES
-- ============================================

CREATE INDEX idx_users_email
ON users(email);

CREATE INDEX idx_users_verified
ON users(is_verified);

CREATE INDEX idx_trades_user
ON trades(user_id);

CREATE INDEX idx_trades_account
ON trades(account_id);

CREATE INDEX idx_trades_status
ON trades(status);

CREATE INDEX idx_trades_open_time
ON trades(open_time);

CREATE INDEX idx_accounts_user
ON trading_accounts(user_id);

CREATE INDEX idx_ai_user
ON ai_insights(user_id);

CREATE INDEX idx_leaderboard_month
ON leaderboard(month);

-- ============================================
-- SAMPLE DATA
-- ============================================

INSERT INTO users
(name, email, password, plan, is_verified)
VALUES
(
'John Doe',
'john@example.com',
'$2b$10$XhQvWzKx3J5LhG0tGx8fEut2Wv9k1z9vS2A7mR7d8cJ5pL6nB8r8S',
'pro',
TRUE
),
(
'Sarah Chen',
'sarah@example.com',
'$2b$10$XhQvWzKx3J5LhG0tGx8fEut2Wv9k1z9vS2A7mR7d8cJ5pL6nB8r8S',
'elite',
TRUE
);

INSERT INTO trading_accounts
(
user_id,
name,
broker,
platform,
account_number,
account_type,
balance,
equity
)
VALUES
(
1,
'FTMO Challenge',
'FTMO',
'MT5',
'#5841920',
'Prop Firm',
47280.00,
49120.00
),
(
1,
'IC Markets Demo',
'IC Markets',
'MT4',
'#7720044',
'Demo',
10000.00,
10840.00
);

SELECT
'TrackingTrade database setup complete!'
AS Status;
```
