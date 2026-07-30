// one-shot import of the old stack.db into mongodb. run it once from this
// folder with `npm run migrate`, then better-sqlite3 is no longer needed.
const Database = require('better-sqlite3');
const mongoose = require('mongoose');
const { connect, Counter, Project, Task, Subtask } = require('./db');

async function main() {
  const db = new Database('stack.db');
  const projects = db.prepare('SELECT * FROM projects ORDER BY id').all();
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY id').all();
  const subtasks = db.prepare('SELECT * FROM subtasks ORDER BY id').all();
  db.close();

  await connect();

  // start from empty so the script can be run again without doubling everything
  await Project.deleteMany({});
  await Task.deleteMany({});
  await Subtask.deleteMany({});
  await Counter.deleteMany({});

  // the sqlite ids become the mongo _id, so project_id and task_id still line up
  await Project.insertMany(
    projects.map((p) => ({
      _id: p.id,
      name: p.name,
      created_at: p.created_at,
    }))
  );
  await Task.insertMany(
    tasks.map((t) => ({
      _id: t.id,
      title: t.title,
      notes: t.notes || '',
      due_date: t.due_date,
      due_time: t.due_time,
      priority: t.priority,
      done: t.done,
      repeats: t.repeats,
      project_id: t.project_id,
      created_at: t.created_at,
    }))
  );
  await Subtask.insertMany(
    subtasks.map((s) => ({
      _id: s.id,
      task_id: s.task_id,
      title: s.title,
      done: s.done,
    }))
  );

  // new ids have to carry on above the highest one already in use
  const highest = (rows) => rows.reduce((max, row) => Math.max(max, row.id), 0);
  await Counter.insertMany([
    { _id: 'projects', seq: highest(projects) },
    { _id: 'tasks', seq: highest(tasks) },
    { _id: 'subtasks', seq: highest(subtasks) },
  ]);

  console.log(
    `imported ${projects.length} projects, ${tasks.length} tasks, ${subtasks.length} subtasks`
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
