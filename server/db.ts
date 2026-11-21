import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const dataDir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'));
fs.mkdirSync(dataDir, { recursive: true });

export const dbPath = path.join(dataDir, 'frontkommando.db');
export const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

function ensureColumn(table: string, column: string, definition: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
}

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS alliances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag TEXT UNIQUE NOT NULL,
      name TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      leader_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      commander_title TEXT NOT NULL DEFAULT 'Oberst',
      faction TEXT NOT NULL DEFAULT 'mitteleuropa',
      alliance_id INTEGER,
      last_seen_at INTEGER NOT NULL DEFAULT 0,
      is_ai INTEGER NOT NULL DEFAULT 0,
      ai_difficulty TEXT,
      building_points INTEGER NOT NULL DEFAULT 0,
      research_points INTEGER NOT NULL DEFAULT 0,
      military_points INTEGER NOT NULL DEFAULT 0,
      total_points INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      sector INTEGER NOT NULL,
      position INTEGER NOT NULL,
      is_home INTEGER NOT NULL DEFAULT 0,
      steel REAL NOT NULL DEFAULT 1200,
      munition REAL NOT NULL DEFAULT 800,
      fuel REAL NOT NULL DEFAULT 400,
      buildings_json TEXT NOT NULL,
      units_json TEXT NOT NULL,
      defenses_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(sector, position),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_research (
      user_id INTEGER PRIMARY KEY,
      levels_json TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS build_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      base_id INTEGER UNIQUE NOT NULL,
      building_id TEXT NOT NULL,
      target_level INTEGER NOT NULL,
      started_at INTEGER NOT NULL,
      ends_at INTEGER NOT NULL,
      FOREIGN KEY (base_id) REFERENCES bases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS research_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      base_id INTEGER NOT NULL,
      research_id TEXT NOT NULL,
      target_level INTEGER NOT NULL,
      started_at INTEGER NOT NULL,
      ends_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (base_id) REFERENCES bases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS unit_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      base_id INTEGER NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      count INTEGER NOT NULL,
      unit_duration_sec INTEGER NOT NULL,
      started_at INTEGER NOT NULL,
      next_ends_at INTEGER NOT NULL,
      FOREIGN KEY (base_id) REFERENCES bases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS missions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      origin_base_id INTEGER NOT NULL,
      target_sector INTEGER NOT NULL,
      target_position INTEGER NOT NULL,
      mission_type TEXT NOT NULL,
      units_json TEXT NOT NULL,
      cargo_json TEXT NOT NULL,
      departed_at INTEGER NOT NULL,
      arrives_at INTEGER NOT NULL,
      returns_at INTEGER,
      status TEXT NOT NULL DEFAULT 'outbound',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (origin_base_id) REFERENCES bases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      data_json TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel TEXT NOT NULL,
      alliance_id INTEGER,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      alliance_tag TEXT,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_bases_sector ON bases(sector, position);
    CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status, arrives_at, returns_at);
    CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_chat_channel ON chat_messages(channel, alliance_id, created_at DESC);
  `);

  // Safe migration for existing databases
  ensureColumn('users', 'faction', "TEXT NOT NULL DEFAULT 'mitteleuropa'");
  ensureColumn('users', 'alliance_id', 'INTEGER');
  ensureColumn('users', 'last_seen_at', 'INTEGER NOT NULL DEFAULT 0');
}
