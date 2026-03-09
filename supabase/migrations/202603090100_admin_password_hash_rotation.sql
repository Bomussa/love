-- Security hotfix: migrate admin authentication to bcrypt hashes
-- and rotate leaked plaintext passwords immediately.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Force immediate credential rotation with new strong passwords.
-- NOTE: Communicate these values securely to authorized admins only,
-- then rotate again through an internal secret-management process.
UPDATE admin_users
SET password_hash = crypt('B0mussa!2026#R0tate', gen_salt('bf', 12)),
    updated_at = NOW()
WHERE username = 'bomussa';

UPDATE admin_users
SET password_hash = crypt('Adm1n!2026#R0tate', gen_salt('bf', 12)),
    updated_at = NOW()
WHERE username = 'admin';

UPDATE admin_users
SET password_hash = crypt('St4ff!2026#R0tate', gen_salt('bf', 12)),
    updated_at = NOW()
WHERE username = 'staff';

-- Remove legacy plaintext password values.
UPDATE admin_users
SET password = 'ROTATED'
WHERE username IN ('bomussa', 'admin', 'staff');
