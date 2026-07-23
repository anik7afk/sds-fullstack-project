const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// READ all tasks, with optional search and status filter
app.get('/api/tasks', (req, res) => {
  const { search, status } = req.query;
  let sql = 'SELECT * FROM tasks';
  const where = [];
  const params = [];

  if (search) {
    where.push('(title LIKE ? OR notes LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (status === 'open') where.push('done = 0');
  if (status === 'done') where.push('done = 1');

  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += " ORDER BY done ASC, due_date IS NULL, due_date ASC, priority ASC";

  res.json(db.prepare(sql).all(...params));
});

// READ one task
app.get('/api/tasks/:id', (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'task not found' });
  res.json(task);
});

// CREATE
app.post('/api/tasks', (req, res) => {
  const { title, notes, due_date, priority } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  const info = db
    .prepare('INSERT INTO tasks (title, notes, due_date, priority) VALUES (?, ?, ?, ?)')
    .run(title.trim(), notes || '', due_date || null, priority || 4);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(task);
});

// UPDATE
app.put('/api/tasks/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'task not found' });

  const { title, notes, due_date, priority, done } = req.body;
  if (title !== undefined && !title.trim()) {
    return res.status(400).json({ error: 'title cannot be empty' });
  }

  db.prepare(
    'UPDATE tasks SET title = ?, notes = ?, due_date = ?, priority = ?, done = ? WHERE id = ?'
  ).run(
    title !== undefined ? title.trim() : existing.title,
    notes !== undefined ? notes : existing.notes,
    due_date !== undefined ? due_date : existing.due_date,
    priority !== undefined ? priority : existing.priority,
    done !== undefined ? (done ? 1 : 0) : existing.done,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id));
});

// DELETE
app.delete('/api/tasks/:id', (req, res) => {
  const info = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'task not found' });
  res.status(204).end();
});

// 404 for unknown API routes
app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));

const PORT = 3001;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
