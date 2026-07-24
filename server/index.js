const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// ---------- Projects ----------

app.get('/api/projects', (req, res) => {
  res.json(db.prepare('SELECT * FROM projects ORDER BY name COLLATE NOCASE').all());
});

app.post('/api/projects', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const info = db.prepare('INSERT INTO projects (name) VALUES (?)').run(name.trim());
  res.status(201).json(db.prepare('SELECT * FROM projects WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/projects/:id', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const info = db
    .prepare('UPDATE projects SET name = ? WHERE id = ?')
    .run(name.trim(), req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'project not found' });
  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id));
});

// deleting a project keeps its tasks, they just go back to having no project
app.delete('/api/projects/:id', (req, res) => {
  const remove = db.transaction((id) => {
    db.prepare('UPDATE tasks SET project_id = NULL WHERE project_id = ?').run(id);
    return db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  });
  const info = remove(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'project not found' });
  res.status(204).end();
});

// ---------- Tasks ----------

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
  sql += " ORDER BY done ASC, due_date IS NULL, due_date ASC, due_time IS NULL, due_time ASC, priority ASC";

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
  const { title, notes, due_date, due_time, priority } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  if (due_time && !due_date) {
    return res.status(400).json({ error: 'a due time needs a due date' });
  }
  const info = db
    .prepare('INSERT INTO tasks (title, notes, due_date, due_time, priority) VALUES (?, ?, ?, ?, ?)')
    .run(title.trim(), notes || '', due_date || null, due_time || null, priority || 4);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(task);
});

// UPDATE
app.put('/api/tasks/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'task not found' });

  const { title, notes, due_date, due_time, priority, done } = req.body;
  if (title !== undefined && !title.trim()) {
    return res.status(400).json({ error: 'title cannot be empty' });
  }

  const nextDate = due_date !== undefined ? due_date : existing.due_date;
  let nextTime = due_time !== undefined ? due_time : existing.due_time;
  if (!nextDate) nextTime = null; // a time without a date makes no sense

  db.prepare(
    'UPDATE tasks SET title = ?, notes = ?, due_date = ?, due_time = ?, priority = ?, done = ? WHERE id = ?'
  ).run(
    title !== undefined ? title.trim() : existing.title,
    notes !== undefined ? notes : existing.notes,
    nextDate,
    nextTime,
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
