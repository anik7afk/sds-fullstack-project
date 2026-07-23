const Database = require('better-sqlite3');

const db = new Database('stack.db');
db.pragma('journal_mode = WAL');

db.exec(`CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  notes TEXT DEFAULT '',
  due_date TEXT,
  priority INTEGER DEFAULT 4,
  done INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (date('now'))
)`);

module.exports = db;
