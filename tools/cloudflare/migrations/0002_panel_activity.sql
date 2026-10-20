-- IsPanel v2.1 private activity and single-use access links.
-- Timestamps are Unix milliseconds. Apply locally first; do not enable production capture with this migration alone.
-- TRAFFIC_ENABLED is a separate, opt-in flag on isa-forms. Detailed events expire exactly 30 days after creation.
-- isa-panel excludes expired events on every read and owns the scheduled purge.
CREATE TABLE IF NOT EXISTS traffic_events (
  id TEXT PRIMARY KEY NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at = created_at + 2592000000),
  site TEXT NOT NULL CHECK (site IN ('inicio', 'cv', 'isacademy')),
  page TEXT NOT NULL CHECK (length(page) BETWEEN 1 AND 200),
  referrer TEXT NOT NULL DEFAULT '' CHECK (length(referrer) <= 253),
  context_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(context_json) AND json_type(context_json) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_traffic_created ON traffic_events (created_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_traffic_site_created ON traffic_events (site, created_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_traffic_expires ON traffic_events (expires_at);
CREATE INDEX IF NOT EXISTS idx_traffic_ip_created
  ON traffic_events (json_extract(context_json, '$.ip'), created_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_traffic_asn_created
  ON traffic_events (json_extract(context_json, '$.asn'), created_at DESC, id);

-- Only SHA-256 token fingerprints are stored; never the magic link itself.
-- An atomic conditional UPDATE consumes a live unused fingerprint across concurrent requests.
CREATE TABLE IF NOT EXISTS panel_link_tokens (
  token_hash TEXT PRIMARY KEY NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at),
  used_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_panel_link_tokens_expires ON panel_link_tokens (expires_at);
