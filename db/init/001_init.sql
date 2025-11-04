CREATE TABLE IF NOT EXISTS audit_events (
  id BIGSERIAL PRIMARY KEY,
  ts timestamptz NOT NULL,
  event text NOT NULL,
  payload jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_events (ts);
CREATE INDEX IF NOT EXISTS idx_audit_event ON audit_events (event);

-- Minimal schema for application users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE,
  role TEXT,
  active BOOLEAN DEFAULT TRUE
);
