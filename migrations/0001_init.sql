CREATE TABLE items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  owner      TEXT NOT NULL,              -- Access email, or "demo:<session-id>"
  text       TEXT NOT NULL,
  done       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_items_owner ON items(owner);
CREATE INDEX idx_items_created ON items(created_at);
