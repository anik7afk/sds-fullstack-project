import { useEffect, useState } from 'react';
import * as api from './api.js';

// checklist inside an expanded task; it keeps its own list and tells the
// parent to reload so the "2/3" counter on the task row stays right
export default function Subtasks({ taskId, onChange }) {
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setItems(await api.getSubtasks(taskId));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
  }, [taskId]);

  const run = async (fn) => {
    try {
      await fn();
      await load();
      onChange();
    } catch (e) {
      setError(e.message);
    }
  };

  const add = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    run(async () => {
      await api.createSubtask(taskId, title.trim());
      setTitle('');
    });
  };

  const doneCount = items.filter((s) => s.done).length;

  return (
    <div className="subtasks">
      <p className="subtask-head">
        Checklist{items.length > 0 && ` · ${doneCount}/${items.length}`}
      </p>
      {error && <p className="error">{error}</p>}
      <ul className="subtask-list">
        {items.map((s) => (
          <li key={s.id} className="subtask">
            <input
              type="checkbox"
              className="check small"
              checked={!!s.done}
              onChange={() => run(() => api.updateSubtask(s.id, { done: !s.done }))}
              aria-label={`Mark step "${s.title}" ${s.done ? 'open' : 'done'}`}
            />
            <span className={s.done ? 'subtask-title done' : 'subtask-title'}>
              {s.title}
            </span>
            <button
              className="btn-delete"
              type="button"
              onClick={() => run(() => api.deleteSubtask(s.id))}
              aria-label={`Delete step "${s.title}"`}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={add}>
        <input
          className="subtask-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a step…"
          aria-label="New checklist step"
        />
      </form>
    </div>
  );
}
