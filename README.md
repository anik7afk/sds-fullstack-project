# Stack — Task Manager

**Author:** Mehedi Haque
**Course:** Software Development Skills: Full-Stack 2025-26, LUT University

## What it is
Stack is a task manager web app. React frontend, Node.js/Express backend, SQLite database.

## Features
- Add tasks with details, a due date, a time of day and a priority
- Tasks that are past their date or time are marked overdue
- Views for today, the coming week (Upcoming) and a month calendar you can add tasks to
- Projects to group tasks, kept in the sidebar
- A checklist of steps inside each task
- Tasks that repeat daily, weekly or monthly — finishing one creates the next
- Search, open/done filtering, dark mode and a layout that works on a phone

## Tech stack
- Frontend: React (Vite)
- Backend: Node.js + Express
- Database: SQLite (better-sqlite3)

## How to run
You need Node.js installed. Run the server and the client in two terminals:

```
cd server
npm install
npm start        # API on http://localhost:3001
```

```
cd client
npm install
npm run dev      # app on http://localhost:5173
```

## API
| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api/tasks` | list tasks (`?search=`, `?status=open\|done`, `?project_id=`) |
| GET | `/api/tasks/:id` | one task |
| POST | `/api/tasks` | create a task |
| PUT | `/api/tasks/:id` | update a task |
| DELETE | `/api/tasks/:id` | delete a task and its steps |
| GET | `/api/tasks/:id/subtasks` | steps of a task |
| POST | `/api/tasks/:id/subtasks` | add a step |
| PUT | `/api/subtasks/:id` | update a step |
| DELETE | `/api/subtasks/:id` | delete a step |
| GET | `/api/projects` | list projects |
| POST | `/api/projects` | create a project |
| PUT | `/api/projects/:id` | rename a project |
| DELETE | `/api/projects/:id` | delete a project, its tasks stay |

## Project structure
- `client/` — React frontend
- `server/` — Express API + SQLite database
- `LEARNING_DIARY.md` — dated learning diary
- `VIDEO.md` — link to demo video (added at the end)
