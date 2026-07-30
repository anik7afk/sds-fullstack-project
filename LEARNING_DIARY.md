# Learning Diary, Full-Stack Module

**Name:** Mehedi Haque
**Student number:** 002348812
**Course:** Software Development Skills: Full-Stack 2025-26, LUT University

## 23.7.2026

I read the general course information and picked the full-stack module. Then
the setup: VS Code, Node, Git. I created the GitHub repository with the `gh`
command line tool instead of clicking through the website, and set the git name
and email for this repository only, because my global config uses a nickname
and I want my real name on the course commits. First commit was the README and
this diary.

Later the same day I started the app. It is a task manager and I called it
Stack. The server is Express with a SQLite database through better-sqlite3 and
a CRUD API for tasks; the client is React built with Vite, and it reaches the
API through a dev proxy so I do not have to write the full localhost URL
anywhere. A task has a title, notes, a priority and a due date. There is a
search box and a couple of filter views. I committed it in pieces, server then
API then client then the list UI, instead of one big commit, so the history
shows the order I actually worked in.

Then I used it for ten minutes and found the first thing missing. A date is not
a deadline. "Friday" and "Friday at 14:00" are different promises, so I added
an optional time. Adding a column to a table that already exists was new to me:
`CREATE TABLE IF NOT EXISTS` does nothing at all when the table is already
there, so my new column never appeared. I now read the existing columns with
`PRAGMA table_info` and run `ALTER TABLE` only when the column is missing.

The SQL was not what cost me the evening. My API changes simply did nothing, no
error, just the old behaviour, and I re-read the same twenty lines several times
before I realised an old server process was still sitting on port 3001 and
answering my requests. Killed it, restarted, fine. Tasks due today with a time
already past now show as overdue, which the date-only version could not do.

## 24.7.2026

Calendar view today. A month grid with weeks starting on Monday, every task
drawn as a small chip on its due date, and buttons for previous month, today
and next month. Clicking a day lists that day's tasks under the grid, and the
add box then creates the task with that date already filled in. The grid itself
took me a while. What I settled on is: take the weekday of the 1st, walk
backwards to the nearest Monday, and always draw 42 days, so the grid is six
weeks tall every month and a short February needs no special case.

The calendar also found a bug I would probably never have noticed. The app
thought today was the 23rd when it was already the 24th. The cause was
`toISOString()`, which returns the date in UTC. I was working past midnight and
Finland is ahead of UTC, so the "today" string was still yesterday. I build it
from `getFullYear`, `getMonth` and `getDate` now. That function has lost my
trust.

Then some things that were just annoying to use. The sidebar scrolled away with
the task list, so it is sticky with its own overflow. The add box only accepted
a title, so there is an optional details field. Clicking a task used to jump
straight into the edit form, which meant I could not read a task without also
being able to break it; now clicking expands it and editing sits behind an Edit
button. Small change, but I had been treating reading and editing as one action
without noticing.

After that I worked through the rest of the features I had planned. The
Upcoming view has a section for each of the next seven days, overdue at the top
and a "Later" group at the bottom. Projects came next: a second table, a
`project_id` column on tasks, CRUD endpoints, and the project list in the
sidebar. Deleting a project does not delete its tasks, it only clears their
project, and both statements run in one better-sqlite3 transaction so it cannot
half happen.

Subtasks were the most interesting part. Every task can have a checklist, so
this was my first real foreign key with `ON DELETE CASCADE`, and it did nothing
at first because SQLite does not enforce foreign keys unless you switch them on
with `PRAGMA foreign_keys = ON`. I tested it by deleting a task and checking
its steps had gone with it. The list needs to show "2/5" on each row and I did
not want one request per task for that, so the task query counts the steps with
two subqueries and sends the numbers along with the row.

Last feature was repeating tasks. Ticking off a repeating task keeps it done
and inserts a fresh copy on the next date, checklist included with the boxes
cleared. Working out "the next date" taught me that `setMonth(getMonth() + 1)`
on the 31st can land in the month after next, because JavaScript rolls the
overflow forward instead of clamping. I know it is wrong and I left it.

I also lost time to port 3001 again, exactly like yesterday, this time certain
my new `/api/projects` route was broken when it was an old server answering.
Twice in two days. It is the first thing I check from now on.

The rest of the day was appearance. The heading names the view you are in
instead of always showing the date. Task rows used to colour every priority and
it looked loud, so only urgent and high are marked now. The add box can set a
date, time and priority without opening the edit form. Colours follow the
system dark mode. The delete buttons only appeared on hover, which is useless
on a touch screen, so below a certain width they are always visible.

To finish I wrote the README with the run instructions and the endpoint list.
What I take away from these two days is that the hard parts were not React.
They were dates, and my own habit of not checking whether the thing I am
testing is even the thing I am running. The decision I am glad about is
committing in small pieces, because every time something broke I could see
which change did it instead of guessing.

## 30.7.2026

Wrapping up for submission. I recorded a video of the app running through the
basics: adding a task, ticking it done, deleting one, reloading the page to
show the tasks survive, and a look at the calendar and project views. The file went
to Google Drive and VIDEO.md has the link.

I also went back over the README. It had the run instructions and the endpoint
table but nothing about how the pieces connect, so I added two diagrams with
Mermaid, which GitHub draws directly from a code block in the markdown: one of
the request path from the browser through the Vite proxy to Express and the
storage, and one of the three database tables and how they reference each
other. Writing the database section made me state out loud a decision that was
only implicit in the code: deleting a task removes its checklist through the
cascade, but deleting a project deliberately keeps its tasks.

The big job of the day: the course project is meant to be MERN, and my M was
SQLite. So the storage moved to MongoDB with Mongoose. Because the client only
ever talks to the API, the whole swap stayed inside `server/`: the three
tables became three Mongoose models, the SQL became model calls, and every
endpoint kept its URL and its JSON shape, so the React side needed no changes
at all. I wrote a one-shot script that copies the existing rows over from the
SQLite file, checked the new `/api/tasks` output against the old one field by
field, and clicked through the app afterwards to be sure.

Two things from the swap are worth writing down. First, ids. Mongo wants to
give every document an ObjectId string, but my edit form runs its project
choice through `Number(...)` before saving, and `Number` of an ObjectId is
NaN, which would have quietly wiped the project off a task every time the form
was saved. So the models hand out plain numbers from a little counters
collection instead, and the old ids survived the move unchanged. Second, the
subtask counts on each row: in SQL that was two subqueries, in Mongo it became
a `$lookup` in an aggregation, which took the longest to get right of anything
today. I also lost the SQLite transactions around the repeat logic, since a
single plain mongod cannot do multi-document transactions. I decided to live
with that and noted it instead of pretending it is not there.
