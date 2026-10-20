-- Delivery metadata only: no message bodies, email addresses or visitor IPs.
CREATE TABLE IF NOT EXISTS panel_reports (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK(kind IN ('weekly','manual')),
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK(expires_at = created_at + 2592000000),
  status TEXT NOT NULL CHECK(status IN ('preparing','sending','accepted','failed','unknown')),
  provider_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  payload_hash TEXT,
  error_code TEXT
);
CREATE INDEX IF NOT EXISTS panel_reports_created ON panel_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS panel_reports_expiry ON panel_reports(expires_at);
