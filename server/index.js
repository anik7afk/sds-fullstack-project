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
  const { search, status, project_id } = req.query;
  // the counts come along so the list can show checklist progress in one request
  let sql = `SELECT tasks.*,
    (SELECT COUNT(*) FROM subtasks WHERE subtasks.task_id = tasks.id) AS subtask_count,
    (SELECT COUNT(*) FROM subtasks WHERE subtasks.task_id = tasks.id AND subtasks.done = 1) AS subtask_done
    FROM tasks`;
  const where = [];
  const params = [];

  if (search) {
    where.push('(title LIKE ? OR notes LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (status === 'open') where.push('done = 0');
  if (status === 'done') where.push('done = 1');
  if (project_id === 'none') {
    where.push('project_id IS NULL');
  } else if (project_id) {
    where.push('project_id = ?');
    params.push(project_id);
  }

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

const projectExists = (id) =>
  !!db.prepare('SELECT id FROM projects WHERE id = ?').get(id);

const REPEATS = ['daily', 'weekly', 'monthly'];

// the date of the next round, e.g. weekly on 2026-07-24 -> 2026-07-31
function nextDueDate(iso, repeats) {
  const d = new Date(iso + 'T00:00:00');
  if (repeats === 'daily') d.setDate(d.getDate() + 1);
  else if (repeats === 'weekly') d.setDate(d.getDate() + 7);
  else if (repeats === 'monthly') d.setMonth(d.getMonth() + 1);
  else return null;
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// a finished repeating task stays in the list as done and a fresh copy of it
// is made for the next date, with the checklist ticked back to empty
const repeatTask = db.transaction((task) => {
  const due = nextDueDate(task.due_date, task.repeats);
  const info = db
    .prepare(
      `INSERT INTO tasks (title, notes, due_date, due_time, priority, project_id, repeats)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      task.title,
      task.notes,
      due,
      task.due_time,
      task.priority,
      task.project_id,
      task.repeats
    );
  const steps = db.prepare('SELECT title FROM subtasks WHERE task_id = ? ORDER BY id').all(task.id);
  const addStep = db.prepare('INSERT INTO subtasks (task_id, title) VALUES (?, ?)');
  for (const step of steps) addStep.run(info.lastInsertRowid, step.title);
});

// CREATE
app.post('/api/tasks', (req, res) => {
  const { title, notes, due_date, due_time, priority, project_id, repeats } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  if (due_time && !due_date) {
    return res.status(400).json({ error: 'a due time needs a due date' });
  }
  if (project_id && !projectExists(project_id)) {
    return res.status(400).json({ error: 'project not found' });
  }
  if (repeats && !REPEATS.includes(repeats)) {
    return res.status(400).json({ error: 'repeats must be daily, weekly or monthly' });
  }
  if (repeats && !due_date) {
    return res.status(400).json({ error: 'a repeating task needs a due date' });
  }
  const info = db
    .prepare(
      'INSERT INTO tasks (title, notes, due_date, due_time, priority, project_id, repeats) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      title.trim(),
      notes || '',
      due_date || null,
      due_time || null,
      priority || 4,
      project_id || null,
      repeats || null
    );
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(task);
});

// UPDATE
app.put('/api/tasks/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'task not found' });

  const { title, notes, due_date, due_time, priority, done, project_id, repeats } = req.body;
  if (title !== undefined && !title.trim()) {
    return res.status(400).json({ error: 'title cannot be empty' });
  }
  if (project_id && !projectExists(project_id)) {
    return res.status(400).json({ error: 'project not found' });
  }
  if (repeats && !REPEATS.includes(repeats)) {
    return res.status(400).json({ error: 'repeats must be daily, weekly or monthly' });
  }

  const nextDate = due_date !== undefined ? due_date : existing.due_date;
  let nextTime = due_time !== undefined ? due_time : existing.due_time;
  if (!nextDate) nextTime = null; // a time without a date makes no sense
  // without a date there is nothing to move the repeat forward from
  const nextRepeats = nextDate ? (repeats !== undefined ? repeats || null : existing.repeats) : null;

  db.prepare(
    'UPDATE tasks SET title = ?, notes = ?, due_date = ?, due_time = ?, priority = ?, done = ?, project_id = ?, repeats = ? WHERE id = ?'
  ).run(
    title !== undefined ? title.trim() : existing.title,
    notes !== undefined ? notes : existing.notes,
    nextDate,
    nextTime,
    priority !== undefined ? priority : existing.priority,
    done !== undefined ? (done ? 1 : 0) : existing.done,
    project_id !== undefined ? project_id || null : existing.project_id,
    nextRepeats,
    req.params.id
  );

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  // ticking off a repeating task creates the next one
  if (!existing.done && task.done && task.repeats && task.due_date) {
    repeatTask(task);
  }
  res.json(task);
});

// ---------- Subtasks ----------

app.get('/api/tasks/:id/subtasks', (req, res) => {
  res.json(db.prepare('SELECT * FROM subtasks WHERE task_id = ? ORDER BY id').all(req.params.id));
});

app.post('/api/tasks/:id/subtasks', (req, res) => {
  const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'task not found' });

  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  const info = db
    .prepare('INSERT INTO subtasks (task_id, title) VALUES (?, ?)')
    .run(req.params.id, title.trim());
  res.status(201).json(db.prepare('SELECT * FROM subtasks WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/subtasks/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'subtask not found' });

  const { title, done } = req.body;
  if (title !== undefined && !title.trim()) {
    return res.status(400).json({ error: 'title cannot be empty' });
  }
  db.prepare('UPDATE subtasks SET title = ?, done = ? WHERE id = ?').run(
    title !== undefined ? title.trim() : existing.title,
    done !== undefined ? (done ? 1 : 0) : existing.done,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM subtasks WHERE id = ?').get(req.params.id));
});

app.delete('/api/subtasks/:id', (req, res) => {
  const info = db.prepare('DELETE FROM subtasks WHERE id = ?').run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: 'subtask not found' });
  res.status(204).end();
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
