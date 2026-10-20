-- Private IsPanel inbox. Timestamps are Unix milliseconds; message retention is exactly 90 days.
-- Apply to the CONTACTS_DB D1 binding before enabling CONTACTS_ENABLED on isa-forms.
-- isa-panel is the sole owner of the daily expiration purge. Every inbox query also excludes expired rows.
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY NOT NULL,
  request_key TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at = created_at + 7776000000),
  site TEXT NOT NULL CHECK (site IN ('inicio', 'cv', 'isacademy')),
  page TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('es', 'en')),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  email TEXT NOT NULL CHECK (length(email) BETWEEN 3 AND 120),
  phone TEXT NOT NULL DEFAULT '' CHECK (length(phone) <= 30),
  company TEXT NOT NULL DEFAULT '' CHECK (length(company) <= 120),
  message TEXT NOT NULL CHECK (length(message) <= 2000),
  details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json)),
  context_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(context_json)),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'following', 'resolved', 'archived')),
  notification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (notification_status IN ('pending', 'accepted', 'failed', 'unknown')),
  provider_id TEXT,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contacts_created ON contacts (created_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_contacts_site_created ON contacts (site, created_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_contacts_status_created ON contacts (status, created_at DESC, id);
CREATE INDEX IF NOT EXISTS idx_contacts_expires ON contacts (expires_at);
