-- Security hotfix: migrate admin authentication to bcrypt hashes
-- and rotate leaked plaintext passwords immediately.

ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Store precomputed bcrypt hashes only (no plaintext secrets in migrations).
UPDATE admins
SET password_hash = '$2b$12$Uk9MoKbs6U8uH1WsEO1roOSQBrEOUyak.kXl2DxSkTKx0NKOwlyca',
    updated_at = NOW()
WHERE username = 'bomussa';

UPDATE admins
SET password_hash = '$2b$12$ZMnr6ccEqkF3GEuXqFkhleargGVFIzl1l.kkJzhBKm7Klbn4hYYh6',
    updated_at = NOW()
WHERE username = 'admin';

UPDATE admins
SET password_hash = '$2b$12$hmzYUy35JhOGrCyvuE.6EubyTiqAB6Z/qF/4B7zPKFf5VRlL5hfQm',
    updated_at = NOW()
WHERE username = 'staff';

-- Remove legacy plaintext password values.
UPDATE admins
SET password = 'ROTATED'
WHERE username IN ('bomussa', 'admin', 'staff');
