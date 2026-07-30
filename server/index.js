const express = require('express');
const cors = require('cors');
const { connect, Project, Task, Subtask, nextId, withId, asId } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// ---------- Projects ----------

app.get('/api/projects', async (req, res) => {
  const projects = await Project.find()
    .sort({ name: 1 })
    .collation({ locale: 'en', strength: 2 }) // strength 2 ignores case, like COLLATE NOCASE
    .lean();
  res.json(projects.map(withId));
});

app.post('/api/projects', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const project = await Project.create({
    _id: await nextId('projects'),
    name: name.trim(),
  });
  res.status(201).json(withId(project.toObject()));
});

app.put('/api/projects/:id', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const project = await Project.findByIdAndUpdate(
    asId(req.params.id),
    { name: name.trim() },
    { returnDocument: 'after' }
  ).lean();
  if (!project) return res.status(404).json({ error: 'project not found' });
  res.json(withId(project));
});

// deleting a project keeps its tasks, they just go back to having no project
app.delete('/api/projects/:id', async (req, res) => {
  const id = asId(req.params.id);
  const info = await Project.deleteOne({ _id: id });
  if (!info.deletedCount) return res.status(404).json({ error: 'project not found' });
  await Task.updateMany({ project_id: id }, { project_id: null });
  res.status(204).end();
});

// ---------- Tasks ----------

// a search box can hold regex characters, they are meant literally
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// READ all tasks, with optional search and status filter
app.get('/api/tasks', async (req, res) => {
  const { search, status, project_id } = req.query;
  const where = {};

  if (search) {
    // LIKE '%x%' ignored case, a case-insensitive regex is the mongo version
    const like = new RegExp(escapeRegex(search), 'i');
    where.$or = [{ title: like }, { notes: like }];
  }
  if (status === 'open') where.done = 0;
  if (status === 'done') where.done = 1;
  if (project_id === 'none') {
    where.project_id = null;
  } else if (project_id) {
    where.project_id = asId(project_id);
  }

  // the counts come along so the list can show checklist progress in one request
  const tasks = await Task.aggregate([
    { $match: where },
    {
      $lookup: {
        from: 'subtasks',
        localField: '_id',
        foreignField: 'task_id',
        as: 'steps',
      },
    },
    {
      $addFields: {
        subtask_count: { $size: '$steps' },
        subtask_done: {
          $size: { $filter: { input: '$steps', cond: { $eq: ['$$this.done', 1] } } },
        },
        // sqlite put the rows without a date/time last, mongo sorts nulls first
        no_date: { $cond: [{ $eq: ['$due_date', null] }, 1, 0] },
        no_time: { $cond: [{ $eq: ['$due_time', null] }, 1, 0] },
      },
    },
    {
      $sort: {
        done: 1,
        no_date: 1,
        due_date: 1,
        no_time: 1,
        due_time: 1,
        priority: 1,
        _id: 1, // sqlite fell back to insert order, mongo needs to be told
      },
    },
    { $project: { steps: 0, no_date: 0, no_time: 0 } },
  ]);

  res.json(tasks.map(withId));
});

// READ one task
app.get('/api/tasks/:id', async (req, res) => {
  const task = await Task.findById(asId(req.params.id)).lean();
  if (!task) return res.status(404).json({ error: 'task not found' });
  res.json(withId(task));
});

const projectExists = async (id) => !!(await Project.exists({ _id: asId(id) }));

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
async function repeatTask(task) {
  const copy = await Task.create({
    _id: await nextId('tasks'),
    title: task.title,
    notes: task.notes,
    due_date: nextDueDate(task.due_date, task.repeats),
    due_time: task.due_time,
    priority: task.priority,
    project_id: task.project_id,
    repeats: task.repeats,
  });
  const steps = await Subtask.find({ task_id: task._id }).sort({ _id: 1 }).lean();
  for (const step of steps) {
    await Subtask.create({
      _id: await nextId('subtasks'),
      task_id: copy._id,
      title: step.title,
    });
  }
}

// CREATE
app.post('/api/tasks', async (req, res) => {
  const { title, notes, due_date, due_time, priority, project_id, repeats } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  if (due_time && !due_date) {
    return res.status(400).json({ error: 'a due time needs a due date' });
  }
  if (project_id && !(await projectExists(project_id))) {
    return res.status(400).json({ error: 'project not found' });
  }
  if (repeats && !REPEATS.includes(repeats)) {
    return res.status(400).json({ error: 'repeats must be daily, weekly or monthly' });
  }
  if (repeats && !due_date) {
    return res.status(400).json({ error: 'a repeating task needs a due date' });
  }
  const task = await Task.create({
    _id: await nextId('tasks'),
    title: title.trim(),
    notes: notes || '',
    due_date: due_date || null,
    due_time: due_time || null,
    priority: priority || 4,
    project_id: project_id || null,
    repeats: repeats || null,
  });
  res.status(201).json(withId(task.toObject()));
});

// UPDATE
app.put('/api/tasks/:id', async (req, res) => {
  const existing = await Task.findById(asId(req.params.id)).lean();
  if (!existing) return res.status(404).json({ error: 'task not found' });

  const { title, notes, due_date, due_time, priority, done, project_id, repeats } = req.body;
  if (title !== undefined && !title.trim()) {
    return res.status(400).json({ error: 'title cannot be empty' });
  }
  if (project_id && !(await projectExists(project_id))) {
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

  const task = await Task.findByIdAndUpdate(
    existing._id,
    {
      title: title !== undefined ? title.trim() : existing.title,
      notes: notes !== undefined ? notes : existing.notes,
      due_date: nextDate,
      due_time: nextTime,
      priority: priority !== undefined ? priority : existing.priority,
      done: done !== undefined ? (done ? 1 : 0) : existing.done,
      project_id: project_id !== undefined ? project_id || null : existing.project_id,
      repeats: nextRepeats,
    },
    { returnDocument: 'after' }
  ).lean();

  // ticking off a repeating task creates the next one
  if (!existing.done && task.done && task.repeats && task.due_date) {
    await repeatTask(task);
  }
  res.json(withId(task));
});

// ---------- Subtasks ----------

app.get('/api/tasks/:id/subtasks', async (req, res) => {
  const steps = await Subtask.find({ task_id: asId(req.params.id) })
    .sort({ _id: 1 })
    .lean();
  res.json(steps.map(withId));
});

app.post('/api/tasks/:id/subtasks', async (req, res) => {
  const id = asId(req.params.id);
  if (!(await Task.exists({ _id: id }))) {
    return res.status(404).json({ error: 'task not found' });
  }

  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  const step = await Subtask.create({
    _id: await nextId('subtasks'),
    task_id: id,
    title: title.trim(),
  });
  res.status(201).json(withId(step.toObject()));
});

app.put('/api/subtasks/:id', async (req, res) => {
  const existing = await Subtask.findById(asId(req.params.id)).lean();
  if (!existing) return res.status(404).json({ error: 'subtask not found' });

  const { title, done } = req.body;
  if (title !== undefined && !title.trim()) {
    return res.status(400).json({ error: 'title cannot be empty' });
  }
  const step = await Subtask.findByIdAndUpdate(
    existing._id,
    {
      title: title !== undefined ? title.trim() : existing.title,
      done: done !== undefined ? (done ? 1 : 0) : existing.done,
    },
    { returnDocument: 'after' }
  ).lean();
  res.json(withId(step));
});

app.delete('/api/subtasks/:id', async (req, res) => {
  const info = await Subtask.deleteOne({ _id: asId(req.params.id) });
  if (!info.deletedCount) return res.status(404).json({ error: 'subtask not found' });
  res.status(204).end();
});

// DELETE
app.delete('/api/tasks/:id', async (req, res) => {
  const id = asId(req.params.id);
  const info = await Task.deleteOne({ _id: id });
  if (!info.deletedCount) return res.status(404).json({ error: 'task not found' });
  // sqlite dropped the checklist with ON DELETE CASCADE, here it is manual
  await Subtask.deleteMany({ task_id: id });
  res.status(204).end();
});

// 404 for unknown API routes
app.use('/api', (req, res) => res.status(404).json({ error: 'not found' }));

// anything a route throws comes back as json instead of an html error page
app.use('/api', (err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'something went wrong' });
});

const PORT = 3001;
connect()
  .then(() => app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`)))
  .catch((err) => {
    console.error('could not reach mongodb:', err.message);
    process.exit(1);
  });
