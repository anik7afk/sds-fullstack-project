import { useState } from 'react';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// local date -> YYYY-MM-DD (avoid toISOString, it shifts by timezone)
function toIso(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// 6 weeks of 7 days covering the given month, weeks starting on Monday
function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // getDay: 0 = Sunday
  const start = new Date(year, month, 1 - offset);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return cells;
}

export default function Calendar({ tasks, selected, onSelect, todayIso }) {
  const today = new Date(todayIso + 'T00:00:00');
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const goMonths = (delta) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    onSelect(todayIso);
  };

  const byDay = {};
  for (const task of tasks) {
    if (!task.due_date) continue;
    (byDay[task.due_date] = byDay[task.due_date] || []).push(task);
  }

  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="calendar">
      <div className="cal-head">
        <span className="cal-month">{monthLabel}</span>
        <div className="cal-nav">
          <button type="button" className="btn-plain" onClick={() => goMonths(-1)} aria-label="Previous month">
            ‹
          </button>
          <button type="button" className="btn-plain" onClick={goToday}>
            Today
          </button>
          <button type="button" className="btn-plain" onClick={() => goMonths(1)} aria-label="Next month">
            ›
          </button>
        </div>
      </div>

      <div className="cal-grid" role="grid">
        {WEEKDAYS.map((w) => (
          <span key={w} className="cal-weekday">
            {w}
          </span>
        ))}
        {buildMonthGrid(year, month).map((day) => {
          const iso = toIso(day);
          const dayTasks = byDay[iso] || [];
          const classes = [
            'cal-cell',
            day.getMonth() !== month && 'out',
            iso === todayIso && 'today',
            iso === selected && 'selected',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button key={iso} type="button" className={classes} onClick={() => onSelect(iso)}>
              <span className="cal-daynum">{day.getDate()}</span>
              {dayTasks.slice(0, 3).map((t) => (
                <span key={t.id} className={t.done ? 'cal-chip done' : 'cal-chip'}>
                  {t.title}
                </span>
              ))}
              {dayTasks.length > 3 && (
                <span className="cal-more">+{dayTasks.length - 3} more</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
