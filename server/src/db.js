import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// Each entry is one migration; the array index + 1 is the schema version.
// To change the schema later, APPEND a new string. Never edit an old one.
const MIGRATIONS = [
  /* v1 */ `
  CREATE TABLE admins (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name          TEXT NOT NULL DEFAULT 'Admin',
    password_hash TEXT NOT NULL,
    token_version INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE batches (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_code  TEXT NOT NULL UNIQUE COLLATE NOCASE,
    seed_name   TEXT NOT NULL,
    brand       TEXT NOT NULL,
    crop        TEXT NOT NULL,
    variety     TEXT NOT NULL DEFAULT '',
    germination INTEGER CHECK (germination IS NULL OR (germination BETWEEN 0 AND 100)),
    status      TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Verified','Pending','Rejected')),
    packed      TEXT,
    expiry      TEXT,
    soil        TEXT NOT NULL DEFAULT '',
    season      TEXT NOT NULL DEFAULT '',
    fertilizer  TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    icon        TEXT NOT NULL DEFAULT '🌱',
    color       TEXT NOT NULL DEFAULT 'green',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_batches_crop    ON batches(crop);
  CREATE INDEX idx_batches_status  ON batches(status);
  CREATE INDEX idx_batches_expiry  ON batches(expiry);

  -- One row per public lookup. Unknown codes (found = 0) help spot fake or mistyped packets.
  CREATE TABLE lookups (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_code TEXT NOT NULL,
    found      INTEGER NOT NULL,
    source     TEXT NOT NULL DEFAULT 'web',
    ip_hash    TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_lookups_created ON lookups(created_at);
  CREATE INDEX idx_lookups_code    ON lookups(batch_code);

  CREATE TABLE audit_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id    INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    admin_email TEXT,
    action      TEXT NOT NULL,
    batch_code  TEXT,
    details     TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_audit_created ON audit_log(created_at);
  `,
];

export function openDb(file) {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  migrate(db);
  return db;
}

function migrate(db) {
  let version = db.prepare("PRAGMA user_version").get().user_version;
  while (version < MIGRATIONS.length) {
    db.exec("BEGIN");
    try {
      db.exec(MIGRATIONS[version]);
      db.exec(`PRAGMA user_version = ${version + 1}`);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
    version += 1;
  }
}

/** Run fn inside a transaction; rolls back if it throws. */
export function transaction(db, fn) {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
