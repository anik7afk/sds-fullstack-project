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

// added later: optional time of day for the due date (HH:MM)
const columns = db.prepare('PRAGMA table_info(tasks)').all();
if (!columns.some((c) => c.name === 'due_time')) {
  db.exec('ALTER TABLE tasks ADD COLUMN due_time TEXT');
}

module.exports = db;
