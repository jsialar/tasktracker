# Task Assignment

A web app for creating tasks (with nested subtasks), assigning them to developers with the right skills, and tracking their status. If a task is created without skills, AI (Google Gemini) identifies them from the title.

## Requirements

- Docker with the Compose plugin (`docker compose version` should work)
- A Google Gemini API key (free at https://aistudio.google.com/apikey)

## Set up

```bash
git clone <this-repository-url>
cd tasktracker
cp .env.example .env
```

Open `.env` and set your key:

```
GEMINI_API_KEY=your-key-here
```

## Run

```bash
docker compose up --build
```

Open **http://localhost:8080**.

The database starts with four developers (Alice, Bob, Carol, Dave), two skills (Frontend, Backend) and a few sample tasks.

## Use

**Tasks page** (`/`)
- Lists every task, with subtasks indented under their parent.
- **Status** dropdown: To-do, In Progress or Done. A task can only be marked Done once all its subtasks are Done.
- **Assignee** dropdown: only lists developers who have every skill the task needs.
- An **AI** tag means the skills were identified by Gemini.

**Create Task page** (`/new`)
- Enter a title and, optionally, tick the required skills. Leave them unticked to let AI choose.
- Click **Add Subtask** to add a subtask; each subtask can have its own subtasks.
- Click **Save** to create the task and all its subtasks.

## Stop and reset

| Action | Command |
| --- | --- |
| Stop | `Ctrl+C`, or `docker compose down` |
| Reset the data to the starting state | `docker compose down -v`, then `docker compose up` |

## Troubleshooting

- **"permission denied" from Docker:** run the commands with `sudo`.
- **Port 8080 or 5433 already in use:** set `FRONTEND_PORT` or `DB_PORT` in `.env` to a free port.
- **New tasks get no skills:** check that `GEMINI_API_KEY` is set in `.env`, then restart with `docker compose up`. Saving can take several seconds while Gemini responds.

## System design

```
Browser ──> nginx (frontend container, port 8080) ──/api──> Express API (backend container) ──> PostgreSQL (db container)
                                                                     └──> Google Gemini (only for tasks without skills)
```

- **Frontend:** React + TypeScript single-page app. nginx serves it and forwards `/api` calls to the backend, so the browser only talks to one address.
- **Backend:** Node.js + Express + TypeScript. Routes handle HTTP; services hold the business rules and SQL.
- **Database:** PostgreSQL. Tables are created and seeded from `db/*.sql` on first start.

**Database tables**

| Table | Holds |
| --- | --- |
| `developers` | Developer names |
| `skills` | Skill names (unique) |
| `developer_skills` | Which developer has which skills (many-to-many) |
| `tasks` | Title, status, assignee, and `parent_task_id` (set for subtasks, so a subtask has every property a task has) |
| `task_skills` | Which skills each task requires (many-to-many) |

**Business rules** (checked by the backend, which returns `409` if broken)

- A task can only be assigned to a developer who has every skill it requires.
- A task can only be marked Done when all its subtasks are Done.
- A subtask cannot be reopened while its parent is Done.

**AI skill identification:** when a task or subtask is saved without skills, the backend sends all such titles to Gemini in one request and asks for a JSON reply limited to the existing skill names. If Gemini fails, the task is still saved, just without skills.

## API

Base URL: `http://localhost:8080/api`. Errors are returned as `{ "error": "message" }` with status `400` (invalid input), `404` (not found) or `409` (business rule broken).

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/tasks` | All tasks, with subtasks nested inside |
| `GET` | `/tasks/:id` | One task with its subtasks |
| `POST` | `/tasks` | Create a task and its subtasks |
| `PATCH` | `/tasks/:id` | Change status and/or assignee |
| `GET` | `/developers`, `/developers/:id` | Developers with their skills and assigned tasks |
| `GET` | `/skills`, `/skills/:id` | Skills with the developers who have them |

**Create a task** (leave `skillIds` empty for AI to choose):

```json
POST /api/tasks
{
  "title": "As a user, I want to reset my password",
  "skillIds": [],
  "subtasks": [{ "title": "Build the reset form", "skillIds": [1], "subtasks": [] }]
}
```

**Update a task** (`status` is `"To-do"`, `"In Progress"` or `"Done"`; `assigneeId: null` unassigns):

```json
PATCH /api/tasks/2
{ "status": "In Progress", "assigneeId": 2 }
```

## Libraries and dependencies

| Package | Why it is used |
| --- | --- |
| **express** | Widely used, minimal Node.js web framework. Version 5 passes errors from async routes to one error handler. |
| **pg** | Standard PostgreSQL driver. Plain SQL with parameters prevents SQL injection and allows recursive queries for subtasks; an ORM would add complexity for five small tables. |
| **zod** | Checks request bodies and the AI's reply at runtime and gives clear error messages. |
| **@google/genai** | Google's official Gemini SDK; Gemini has a free API tier. |
| **react**, **react-dom** | Required by the specification; components suit the nested task forms. |
| **react-router** | Switches between the two pages without reloading. |
| **vite** | Fast development server and production build for React. |
| **typescript** | Required by the specification; catches type errors before the code runs. |
| **vitest**, **supertest** | Run the backend tests and send HTTP requests to the API in tests. |
| **nginx** | Serves the built frontend and forwards `/api` to the backend. |
| **Docker Compose** | Starts the database, backend and frontend with one command, in the right order. |

