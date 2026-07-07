-- ============================================
-- TrackingTrade — Migration v3
-- Run this ONCE against your existing Railway MySQL database, AFTER
-- migration_v2.sql. Adds support for: refresh tokens + Google Login.
--
-- Run with:  mysql -h <host> -u <user> -p <db> < migration_v3.sql
-- Same note as v2: if a statement errors with "Duplicate column/key
-- name", it's already applied — comment that line out and re-run the rest.
-- ============================================

-- Google Login: allow accounts with no password, and store Google's
-- unique subject id so we can match a Google login to a user.
ALTER TABLE users MODIFY password VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN google_id VARCHAR(255) DEFAULT NULL AFTER password;
ALTER TABLE users ADD UNIQUE INDEX idx_google_id (google_id);

-- Refresh Tokens: revocable, hashed, one row per active session.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  token_hash  VARCHAR(64) NOT NULL,
  expires_at  DATETIME NOT NULL,
  revoked_at  DATETIME DEFAULT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_refresh_user (user_id),
  INDEX idx_refresh_hash (token_hash)
);

SELECT 'Migration v3 complete!' AS Status;
