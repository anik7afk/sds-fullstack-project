import { useEffect, useState } from 'react';
import * as api from './api.js';

const VIEWS = [
  { key: 'all', label: 'All Tasks' },
  { key: 'today', label: 'Today' },
  { key: 'open', label: 'Open' },
  { key: 'done', label: 'Done' },
];

const PRIORITIES = { 1: '1 · Urgent', 2: '2 · High', 3: '3 · Medium', 4: '4 · Low' };

const todayStr = () => new Date().toISOString().slice(0, 10);
const nowTimeStr = () => new Date().toTimeString().slice(0, 5);

function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDue(task) {
  const date = formatDate(task.due_date);
  return task.due_time ? `${date}, ${task.due_time}` : date;
}

function isOverdue(task) {
  if (task.done || !task.due_date) return false;
  if (task.due_date < todayStr()) return true;
  return task.due_date === todayStr() && !!task.due_time && task.due_time < nowTimeStr();
}

function headingDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function matchesView(task, view) {
  if (view === 'today') return task.due_date === todayStr();
  if (view === 'open') return !task.done;
  if (view === 'done') return !!task.done;
  return true;
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('all');
  const [search, setSearch] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [editing, setEditing] = useState(null); // task being edited
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const data = await api.getTasks({ search });
      setTasks(data);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [search]);

  const addTask = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      await api.createTask({ title: newTitle });
      setNewTitle('');
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const toggleDone = async (task) => {
    try {
      await api.updateTask(task.id, { done: !task.done });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    try {
      await api.updateTask(editing.id, {
        title: editing.title,
        notes: editing.notes,
        due_date: editing.due_date || null,
        due_time: editing.due_date ? editing.due_time || null : null,
        priority: Number(editing.priority),
      });
      setEditing(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const removeTask = async (id) => {
    try {
      await api.deleteTask(id);
      if (editing && editing.id === id) setEditing(null);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const counts = Object.fromEntries(
    VIEWS.map((v) => [v.key, tasks.filter((t) => matchesView(t, v.key)).length])
  );

  const visible = tasks.filter((t) => matchesView(t, view));
  const openTasks = visible.filter((t) => !t.done);
  const doneTasks = visible.filter((t) => t.done);

  const groups =
    view === 'done'
      ? [{ label: `Done · ${doneTasks.length}`, items: doneTasks }]
      : view === 'open'
        ? [{ label: `Open · ${openTasks.length}`, items: openTasks }]
        : [
            { label: `Open · ${openTasks.length}`, items: openTasks },
            ...(doneTasks.length
              ? [{ label: `Done · ${doneTasks.length}`, items: doneTasks }]
              : []),
          ];

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <h1>Stack</h1>
          <span className="brand-sub">Task Manager</span>
        </div>
        <nav>
          {VIEWS.map((v) => (
            <button
              key={v.key}
              className={view === v.key ? 'nav-item active' : 'nav-item'}
              onClick={() => setView(v.key)}
            >
              {v.label}
              <span className="nav-count">{counts[v.key]}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span>Full-Stack 2025-26</span>
        </div>
      </aside>

      <main className="content">
        <header className="page-head">
          <div>
            <p className="eyebrow">{VIEWS.find((v) => v.key === view).label}</p>
            <h2 className="day-heading">{headingDate()}</h2>
          </div>
          <span className="head-note">
            {counts.open} open · {counts.done} done
          </span>
        </header>
        <hr className="rule" />

        <form className="add-row" onSubmit={addTask}>
          <input
            className="field add-input"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add a task…"
            aria-label="New task title"
          />
          <button className="btn-dark" type="submit" disabled={!newTitle.trim()}>
            Add
          </button>
        </form>

        {error && <p className="error" role="alert">{error}</p>}

        <div className="list-tools">
          <input
            className="search-input"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            aria-label="Search tasks"
          />
        </div>

        {loading ? (
          <p className="empty">Loading…</p>
        ) : (
          groups.map((group) => (
            <section key={group.label}>
              <p className="section-label">{group.label}</p>
              <ul className="task-list">
                {group.items.length === 0 && (
                  <li className="empty">
                    {search ? 'No tasks match your search.' : 'Nothing here yet — add a task above.'}
                  </li>
                )}
                {group.items.map((task) => (
                  <li key={task.id} className="task">
                    <div className="task-row">
                      <input
                        type="checkbox"
                        className="check"
                        checked={!!task.done}
                        onChange={() => toggleDone(task)}
                        aria-label={`Mark "${task.title}" ${task.done ? 'open' : 'done'}`}
                      />
                      <button
                        type="button"
                        className="task-main"
                        onClick={() =>
                          setEditing(
                            editing && editing.id === task.id ? null : { ...task }
                          )
                        }
                      >
                        <span className={task.done ? 'task-title done' : 'task-title'}>
                          {task.title}
                        </span>
                        <span className="task-meta">
                          {task.due_date && (
                            <span className={isOverdue(task) ? 'meta overdue' : 'meta'}>
                              {isOverdue(task)
                                ? `Overdue · was ${formatDue(task)}`
                                : `Due ${formatDue(task)}`}
                            </span>
                          )}
                          <span className="meta">{PRIORITIES[task.priority]}</span>
                          {task.notes && <span className="meta">Notes</span>}
                        </span>
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => removeTask(task.id)}
                        aria-label={`Delete "${task.title}"`}
                      >
                        ✕
                      </button>
                    </div>

                    {editing && editing.id === task.id && (
                      <form className="edit-panel" onSubmit={saveEdit}>
                        <label className="field-label" htmlFor="edit-title">
                          Title (required)
                        </label>
                        <input
                          id="edit-title"
                          className="field"
                          value={editing.title}
                          onChange={(e) =>
                            setEditing({ ...editing, title: e.target.value })
                          }
                        />

                        <label className="field-label" htmlFor="edit-notes">
                          Notes
                        </label>
                        <textarea
                          id="edit-notes"
                          className="field"
                          rows="3"
                          value={editing.notes || ''}
                          onChange={(e) =>
                            setEditing({ ...editing, notes: e.target.value })
                          }
                        />

                        <div className="field-grid">
                          <div>
                            <label className="field-label" htmlFor="edit-due">
                              Due date
                            </label>
                            <input
                              id="edit-due"
                              type="date"
                              className="field"
                              value={editing.due_date || ''}
                              onChange={(e) =>
                                setEditing({
                                  ...editing,
                                  due_date: e.target.value,
                                  due_time: e.target.value ? editing.due_time : '',
                                })
                              }
                            />
                          </div>
                          <div>
                            <label className="field-label" htmlFor="edit-time">
                              Time
                            </label>
                            <input
                              id="edit-time"
                              type="time"
                              className="field"
                              value={editing.due_time || ''}
                              disabled={!editing.due_date}
                              onChange={(e) =>
                                setEditing({ ...editing, due_time: e.target.value })
                              }
                            />
                          </div>
                          <div>
                            <label className="field-label" htmlFor="edit-priority">
                              Priority
                            </label>
                            <select
                              id="edit-priority"
                              className="field"
                              value={editing.priority}
                              onChange={(e) =>
                                setEditing({ ...editing, priority: e.target.value })
                              }
                            >
                              {Object.entries(PRIORITIES).map(([val, label]) => (
                                <option key={val} value={val}>{label}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="edit-actions">
                          <button
                            className="btn-dark"
                            type="submit"
                            disabled={!editing.title.trim()}
                          >
                            Save
                          </button>
                          <button
                            className="btn-plain"
                            type="button"
                            onClick={() => setEditing(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </main>
    </div>
  );
}
