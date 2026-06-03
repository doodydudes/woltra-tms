-- InsForge auth user IDs may not be standard UUIDs (e.g. usr_abc123 format).
-- Change auth_id from UUID to TEXT so any ID format is accepted.
DROP INDEX IF EXISTS idx_users_auth_id;
ALTER TABLE users ALTER COLUMN auth_id TYPE TEXT;
CREATE UNIQUE INDEX idx_users_auth_id ON users(auth_id);
