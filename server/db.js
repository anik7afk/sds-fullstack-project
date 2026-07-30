const mongoose = require('mongoose');

const URI = 'mongodb://127.0.0.1:27017/stack';

// build YYYY-MM-DD from local time; toISOString would give the UTC date,
// which is a day off in the evening/early morning
function today() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// mongo has no AUTOINCREMENT, so ids come out of a tiny counters collection,
// one document per collection. keeping them plain numbers means the ids from
// the sqlite version still work and the client does not have to change.
const counterSchema = new mongoose.Schema(
  {
    _id: String,
    seq: { type: Number, default: 0 },
  },
  { versionKey: false }
);

const projectSchema = new mongoose.Schema(
  {
    _id: Number,
    name: { type: String, required: true },
    created_at: { type: String, default: today },
  },
  { versionKey: false }
);

const taskSchema = new mongoose.Schema(
  {
    _id: Number,
    title: { type: String, required: true },
    notes: { type: String, default: '' },
    due_date: { type: String, default: null },
    due_time: { type: String, default: null }, // optional time of day (HH:MM)
    priority: { type: Number, default: 4 },
    done: { type: Number, default: 0 }, // 0/1, same as the old sqlite column
    repeats: { type: String, default: null }, // daily / weekly / monthly, null = one-off
    project_id: { type: Number, default: null }, // null = no project
    created_at: { type: String, default: today },
  },
  { versionKey: false }
);

// checklist items under a task. sqlite removed them with ON DELETE CASCADE,
// mongo has no such thing so the delete route clears them by hand.
const subtaskSchema = new mongoose.Schema(
  {
    _id: Number,
    task_id: { type: Number, required: true },
    title: { type: String, required: true },
    done: { type: Number, default: 0 },
  },
  { versionKey: false }
);

const Counter = mongoose.model('Counter', counterSchema, 'counters');
const Project = mongoose.model('Project', projectSchema, 'projects');
const Task = mongoose.model('Task', taskSchema, 'tasks');
const Subtask = mongoose.model('Subtask', subtaskSchema, 'subtasks');

// the next free id for a collection
async function nextId(name) {
  const counter = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  return counter.seq;
}

// mongo calls the key _id, the API has always called it id
function withId(doc) {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

// ids arrive from the URL as strings. anything that is not a number can never
// match a document, and -1 is never handed out, so those requests fall through
// to the usual 404 instead of blowing up on a cast error.
function asId(value) {
  return /^\d+$/.test(value) ? Number(value) : -1;
}

const connect = () => mongoose.connect(URI);

module.exports = {
  connect,
  Counter,
  Project,
  Task,
  Subtask,
  nextId,
  withId,
  asId,
  today,
};
