const Database = require('better-sqlite3');

const db = new Database('stack.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT DEFAULT (date('now'))
)`);

db.exec(`CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  notes TEXT DEFAULT '',
  due_date TEXT,
  priority INTEGER DEFAULT 4,
  done INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (date('now'))
)`);

// checklist items under a task, removed with it
db.exec(`CREATE TABLE IF NOT EXISTS subtasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done INTEGER DEFAULT 0
)`);

// added later: optional time of day for the due date (HH:MM)
const columns = db.prepare('PRAGMA table_info(tasks)').all();
if (!columns.some((c) => c.name === 'due_time')) {
  db.exec('ALTER TABLE tasks ADD COLUMN due_time TEXT');
}

// added later: a task can belong to a project (null = no project)
if (!columns.some((c) => c.name === 'project_id')) {
  db.exec('ALTER TABLE tasks ADD COLUMN project_id INTEGER REFERENCES projects(id)');
}

module.exports = db;
