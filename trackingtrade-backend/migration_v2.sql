-- ============================================
-- TrackingTrade — Migration v2
-- Run this ONCE against your existing Railway MySQL database.
-- database.sql only affects fresh installs (CREATE TABLE IF NOT EXISTS
-- does nothing on tables that already exist) — this file brings an
-- existing database up to date with the same changes.
--
-- Run with:  mysql -h <host> -u <user> -p <db> < migration_v2.sql
--
-- IMPORTANT: run each statement individually (or run the whole file —
-- MySQL will just stop at the first error). If a statement errors with
-- "Duplicate column name" or "Duplicate key name", that column/index
-- already exists — comment that one line out and re-run the rest.
-- (Deliberately NOT using "IF NOT EXISTS" here since support for it on
-- ADD COLUMN/ADD INDEX varies by MySQL version — this way works on any
-- version Railway gives you.)
-- ============================================

-- Item 1: verification token expiry
ALTER TABLE users
  ADD COLUMN verification_token_expiry DATETIME DEFAULT NULL AFTER verification_token;

-- Item 11: track last successful login
ALTER TABLE users
  ADD COLUMN last_login DATETIME DEFAULT NULL AFTER reset_token_expiry;

-- Item 12: indexes for lookup/filter columns actually used in queries
ALTER TABLE users            ADD INDEX idx_verification_token (verification_token);
ALTER TABLE users            ADD INDEX idx_reset_token (reset_token);
ALTER TABLE trading_accounts ADD INDEX idx_accounts_user (user_id);
ALTER TABLE trades           ADD INDEX idx_trades_user (user_id);
ALTER TABLE trades           ADD INDEX idx_trades_user_status (user_id, status);
ALTER TABLE trades           ADD INDEX idx_trades_user_opentime (user_id, open_time);
ALTER TABLE trades           ADD INDEX idx_trades_account (account_id);
ALTER TABLE ai_insights      ADD INDEX idx_insights_user (user_id);
ALTER TABLE leaderboard      ADD INDEX idx_leaderboard_month_points (month, points);

-- Backfill note: existing verified users have no verification_token, so
-- the new expiry check in verifyEmail() never runs against them —
-- nothing to backfill. Any existing unverified users will need to use
-- the new "Resend verification email" feature to get a fresh, expiring
-- token, since their old token has no expiry set (NULL = never expires
-- under the new check — run the UPDATE below if you want to force them
-- to re-request instead):
--
-- UPDATE users SET verification_token = NULL, verification_token_expiry = NULL
--   WHERE is_verified = FALSE;

SELECT 'Migration v2 complete!' AS Status;
