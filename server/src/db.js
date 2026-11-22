import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(dirname, '../../data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, 'messenger.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    nickname      TEXT UNIQUE COLLATE NOCASE,
    hide_email    INTEGER NOT NULL DEFAULT 0,
    avatar        TEXT,
    verified      INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS verification_codes (
    email      TEXT PRIMARY KEY COLLATE NOCASE,
    code       TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts   INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS contacts (
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, contact_id)
  );

  CREATE TABLE IF NOT EXISTS chats (
    id         TEXT PRIMARY KEY,
    type       TEXT NOT NULL CHECK (type IN ('direct', 'group')),
    name       TEXT,
    avatar     TEXT,
    direct_key TEXT UNIQUE,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_members (
    chat_id      TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at INTEGER NOT NULL DEFAULT 0,
    muted        INTEGER NOT NULL DEFAULT 0,
    joined_at    INTEGER NOT NULL,
    PRIMARY KEY (chat_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id             TEXT PRIMARY KEY,
    chat_id        TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id      TEXT NOT NULL REFERENCES users(id),
    text           TEXT NOT NULL,
    created_at     INTEGER NOT NULL,
    edited_at      INTEGER,
    deleted        INTEGER NOT NULL DEFAULT 0,
    forwarded_from TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_messages_chat_time ON messages(chat_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);
`);
