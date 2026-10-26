-- Authoritative authorization state only; no addresses, messages or visitor metadata.
-- Reapplying the migration must preserve the current epoch and cooldown.
CREATE TABLE IF NOT EXISTS panel_auth_state (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  epoch TEXT NOT NULL CHECK(length(epoch) = 32 AND epoch NOT GLOB '*[^0-9a-f]*'),
  login_until_ms INTEGER NOT NULL DEFAULT 0 CHECK(login_until_ms >= 0)
);
INSERT OR IGNORE INTO panel_auth_state (id, epoch, login_until_ms)
VALUES (1, lower(hex(randomblob(16))), 0);
