# Description

A full-stack web application for creating tasks (with nested subtasks), assigning them to developers with the right skills, and tracking their status. When a task is created without any skills, the backend asks an LLM (Google Gemini) to identify the required skills from the task title.

- **Frontend:** React 19 + TypeScript single-page app, built with Vite and served by nginx
- **Backend:** Node.js 24 + Express 5 + TypeScript REST API
- **Database:** PostgreSQL 17
- **LLM:** Google Gemini (via the official `@google/genai` SDK)
- **Packaging:** Docker + Docker Compose

---

## Contents

1. [Quick start (Docker)](#1-quick-start-docker)
2. [Configuration](#2-configuration)
3. [Running without Docker (development)](#3-running-without-docker-development)
4. [Running the tests](#4-running-the-tests)
5. [System design](#5-system-design)
6. [Libraries and dependencies](#6-libraries-and-dependencies)
7. [API reference](#7-api-reference)
8. [Assumptions](#8-assumptions)

---

## 1. Quick start (Docker)

**Prerequisites:** Docker with the Compose plugin (`docker compose version` should work).

```bash
git clone <this-repository-url>
cd task-assignment

cp .env.example .env
# Edit .env and set GEMINI_API_KEY (see "Configuration" below)

docker compose up --build
```

Open **http://localhost:8080** once all three containers are running.

- The database is created and seeded automatically on first start (developers Alice, Bob, Carol, Dave; skills Frontend and Backend; three sample tasks and some sample subtasks).
- To stop: `Ctrl+C`, or `docker compose down`.
- To reset the database to the seed data: `docker compose down -v` (deletes the data volume), then `docker compose up` again.

> If your user is not in the `docker` group, prefix the commands with `sudo`.

---

## 2. Configuration

All configuration is read from a `.env` file in the project root (next to `docker-compose.yml`). Copy `.env.example` to `.env` to start. `.env` is git-ignored, so the API key is never committed.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | Yes, for LLM skill identification | *(none)* | Google Gemini API key. Get a free one at https://aistudio.google.com/apikey. Without it, the app still works, but tasks created without skills are saved with no skills. |
| `GEMINI_MODEL` | No | `gemini-3.5-flash-lite` | Gemini model used to identify skills. |
| `FRONTEND_PORT` | No | `8080` | Host port for the web app. |
| `DB_PORT` | No | `5433` | Host port for PostgreSQL (bound to `127.0.0.1` only). 5433 avoids clashing with a local Postgres on 5432. |
| `DATABASE_URL` | No | `postgres://postgres:postgres@localhost:5433/taskdb` | Only needed when running the backend outside Docker with a non-default `DB_PORT`. Inside Docker it is set by `docker-compose.yml`. |
| `TEST_DATABASE_URL` | No | `postgres://postgres:postgres@localhost:5433/taskdb_test` | Database used by the backend tests. |

---

## 3. Running without Docker (development)

Useful for development with hot reload. **Prerequisites:** Node.js 24 and npm, plus Docker for the database.

```bash
# 1. Start only the database (published on localhost:5433)
docker compose up -d db

# 2. Backend API on http://localhost:3000 (reads ../.env for GEMINI_API_KEY)
cd backend
npm install
npm run dev

# 3. Frontend on http://localhost:5173 (in a second terminal)
cd frontend
npm install
npm run dev
```

The Vite dev server forwards `/api` requests to `http://localhost:3000`, so open **http://localhost:5173**.

Other useful scripts:

| Folder | Command | What it does |
| --- | --- | --- |
| `backend` | `npm run build` / `npm start` | Compile TypeScript to `dist/` and run it |
| `backend` | `npm run typecheck` | Type-check without emitting files |
| `frontend` | `npm run build` | Type-check and build static files to `dist/` |
| `frontend` | `npm run lint` | Lint with oxlint |

---

## 4. Running the tests

The backend has integration tests that call the real API (through Supertest) against a real PostgreSQL database.

```bash
docker compose up -d db   # tests need Postgres on localhost:5433
cd backend
npm install
npm test
```

- Tests use a separate database, `taskdb_test`, which is created automatically. They never touch the app's data.
- Before **every** test, the schema is dropped and rebuilt from the same `db/*.sql` files Docker uses, so tests are independent of each other.
- The Gemini call is mocked, so tests are free, fast and deterministic. The prompt-building and response-parsing functions are still tested for real.

Test files cover: task create/read/update and validation (`tasks.test.ts`), subtasks and the Done rule (`subtasks.test.ts`), skills and developers (`skillsAndDevelopers.test.ts`), and LLM skill identification (`llmSkills.test.ts`).

---

## 5. System design

### 5.1 Architecture

```mermaid
flowchart LR
  Browser["Browser<br/>(React SPA)"] -->|"http://localhost:8080"| Nginx
  subgraph Docker Compose
    Nginx["frontend container<br/>nginx: static files + /api proxy"] -->|"/api/*"| API["backend container<br/>Express API :3000"]
    API -->|SQL| DB[("db container<br/>PostgreSQL 17")]
  end
  API -->|"HTTPS (only when a task has no skills)"| Gemini["Google Gemini API"]
```

- **Single entry point.** The browser only talks to nginx on port 8080. nginx serves the built React files and forwards `/api/*` to the backend. Because the page and the API share one origin, no CORS setup is needed, and the backend and database are not exposed to the network (the database port is bound to `127.0.0.1` only, for local tooling and tests).
- **SPA routing.** nginx answers unknown paths (such as `/new`) with `index.html`, so React Router can render the right page on refresh.
- **Start-up order.** Compose health checks start the backend only after Postgres has finished running the seed scripts, and start nginx only after the backend's `/api/health` endpoint (which also queries the database) responds.
- **Small images.** Both Dockerfiles use multi-stage builds: dependencies and compilers stay in the build stage, and the final image contains only compiled output (and production dependencies for the backend, which runs as the non-root `node` user).

### 5.2 Backend structure

```
backend/src/
├── index.ts               Starts the HTTP server
├── app.ts                 Express app: JSON parsing, routes, 404, error handler
├── routes/                Thin HTTP layer: parse input, call a service, send JSON
├── services/              Business rules and SQL (tasks, developers, skills)
├── llm/skillIdentifier.ts Gemini prompt, structured output and response parsing
├── validation.ts          Zod schemas for request bodies and URL ids
├── errors.ts              HttpError class and the central error handler
├── db.ts                  Connection pool and a transaction helper
└── types.ts               Shapes of the JSON returned by the API
```

Routes only deal with HTTP; services hold all business rules. Any error thrown anywhere is turned into a consistent `{ "error": "..." }` JSON response by one error handler (Express 5 forwards errors from `async` handlers automatically).

### 5.3 Database schema

```mermaid
erDiagram
  developers ||--o{ developer_skills : has
  skills     ||--o{ developer_skills : "held by"
  tasks      ||--o{ task_skills : requires
  skills     ||--o{ task_skills : "required by"
  developers |o--o{ tasks : "assigned to"
  tasks      |o--o{ tasks : "parent of (subtasks)"

  developers {
    int id PK
    text name
  }
  skills {
    int id PK
    text name UK
  }
  developer_skills {
    int developer_id PK,FK
    int skill_id PK,FK
  }
  tasks {
    int id PK
    text title
    text status
    int assignee_id FK
    int parent_task_id FK
    bool skills_generated
    timestamptz created_at
    timestamptz updated_at
  }
  task_skills {
    int task_id PK,FK
    int skill_id PK,FK
  }
```

The SQL lives in `db/` and is run in order by the Postgres image the first time the data volume is created:

| File | Contents |
| --- | --- |
| `01_schema.sql` | Tables for skills, developers, tasks and the two join tables |
| `02_seed.sql` | The four developers and their skills (Part 1.2), plus the three wireframe tasks |
| `03_subtasks.sql` | Adds `parent_task_id` to `tasks` (Part 4) |
| `04_sample_subtasks.sql` | Sample nested subtasks |

Design decisions:

- **Many-to-many join tables** (`developer_skills`, `task_skills`) because a developer can have many skills, a skill can belong to many developers, and a task can require several skills.
- **Subtasks are rows in `tasks`** with a `parent_task_id` pointing at their parent. A subtask therefore has exactly the same properties as a task (title, status, skills, assignee) and can have its own subtasks, to any depth. Deleting a task deletes its subtasks (`ON DELETE CASCADE`). Nested trees are read with a recursive SQL query (`WITH RECURSIVE`).
- **Status** is a `TEXT` column limited by a `CHECK` constraint to `To-do`, `In Progress` and `Done`. A check constraint is easier to extend than a Postgres `ENUM` type.
- **`skills_generated`** records whether a task's skills came from the LLM, so the UI can label them "AI".
- **Constraints in the database as well as in code:** non-empty titles, unique skill names, valid statuses, and a task cannot be its own parent.

### 5.4 Business rules and where they are enforced

| Rule | Enforced in |
| --- | --- |
| A task can only be assigned to a developer who has **every** skill the task requires. | Backend (`409 Conflict` otherwise). The frontend only lists eligible developers in the Assignee dropdown. |
| A task can only be set to `Done` when **all its direct subtasks** are `Done`. | Backend (`409`). The frontend disables the "Done" option until then. |
| A subtask cannot leave `Done` while its parent is `Done` (reopen the parent first). This keeps the rule above true after the parent is Done. | Backend (`409`). The frontend disables the subtask's status dropdown. |
| A task with its subtasks is created all-or-nothing. | Backend: one database transaction. |
| Concurrent updates cannot break the rules above. | Backend: the task row (and its parent, when relevant) is locked with `SELECT ... FOR UPDATE` inside the transaction. |

Because the Done rule holds at every level, checking a task's direct subtasks is enough to guarantee that all its descendants are Done.

### 5.5 LLM skill identification (Part 5)

When `POST /api/tasks` is called, every task or subtask in the request that has an empty `skillIds` list gets its skills from Gemini. The user does not trigger this; it happens automatically on the backend.

1. **One request per save.** All tasks that need skills are sent to Gemini in a single numbered list, instead of one call per subtask. This keeps latency down and stays within free-tier rate limits.
2. **Context for subtasks.** Each subtask is sent with its parent's title, because short subtask titles (e.g. "Add validation") are ambiguous on their own.
3. **Prompt.** The prompt lists the skills that exist in the database (so new skills are picked up automatically) and includes the three examples from the specification as few-shot examples. `temperature` is `0` for consistent answers.
4. **Structured output.** Gemini is asked to reply with JSON that matches a schema, where each skill must be one of the allowed names (`enum`). The reply is still validated with Zod and filtered to known skill names, so an unexpected reply cannot insert bad data.
5. **Outside the transaction.** The LLM call happens before the database transaction opens, so no transaction is held open while waiting on the network.
6. **Graceful failure.** If the key is missing, the call times out (45 s, below nginx's 60 s proxy timeout) or the reply is invalid, the error is logged and the tasks are **still saved**, just without skills. A task with no skills can be assigned to any developer.

### 5.6 Frontend

- **Pages** (`src/pages/`): `TaskListPage` (`/`) and `CreateTaskPage` (`/new`), switched by React Router without full page reloads.
- **Task List:** one table row per task, with subtasks shown as indented rows beneath their parent (`TaskRow` renders itself recursively). Columns: id, title, skills (with an "AI" tag when generated), subtasks done count, status dropdown and assignee dropdown. After each change the list is re-fetched so the table always shows what the server saved; API errors appear in a dismissible banner.
- **Create Task(s):** `NewTaskForm` is the "New Task Component" from the wireframe. It holds a title, skill checkboxes and an **Add Subtask** button, and renders a `NewTaskForm` for each of its subtasks, so subtasks can be nested to any depth on the same page. Each form is labelled by its position (1, 1.1, 1.1.2, ...). Saving sends the whole tree in one request.
- **API access** is centralised in `src/api.ts`, which turns error responses into readable messages.

---

## 6. Libraries and dependencies

Dependencies were kept to a minimum: each one below replaces a substantial amount of code that would otherwise have to be written and maintained by hand.

### Backend

| Package | Why |
| --- | --- |
| **express** (v5) | The most widely used Node.js web framework; small, well documented, with a large ecosystem. Version 5 forwards errors thrown in `async` route handlers to the error handler, which removes try/catch boilerplate from every route. |
| **pg** (node-postgres) | The standard PostgreSQL driver for Node.js. Plain parameterised SQL (`$1`, `$2`) prevents SQL injection and allows features an ORM would hide, such as recursive queries, `json_agg` and row locks (`FOR UPDATE`). With five small tables, an ORM or query builder would add more complexity than it removes. |
| **zod** | Validates request bodies at runtime (types alone only exist at compile time) and produces clear error messages. The same schema also gives the TypeScript type, so validation and types cannot drift apart. Also used to validate the LLM's JSON reply. |
| **@google/genai** | Google's official Gemini SDK. Handles authentication, timeouts and structured JSON output. Gemini was chosen because it has a free API tier, as suggested in the specification. |
| **typescript** | Required by the specification; catches type errors before the code runs. |
| **tsx** *(dev)* | Runs TypeScript directly and restarts on file changes during development, with no separate compile step. |
| **vitest** *(dev)* | Fast test runner with built-in TypeScript support and module mocking (used to mock the Gemini call). |
| **supertest** *(dev)* | Sends HTTP requests to the Express app in tests without starting a real server on a port. |
| **@types/\*** *(dev)* | Type definitions for libraries written in JavaScript (Express, pg, Node, Supertest). |

### Frontend

| Package | Why |
| --- | --- |
| **react**, **react-dom** (v19) | Required by the specification. Component-based UI suits the recursive "task with subtasks" forms and rows. |
| **react-router** | The standard routing library for React; switches between the Task List and Create Task pages without reloading the page. |
| **vite** + **@vitejs/plugin-react** *(dev)* | Fast development server with hot reload and an optimised production build. The official React documentation recommends it for new single-page apps. Also proxies `/api` to the backend in development. |
| **typescript** *(dev)* | Type safety, shared request/response types with the API. |
| **oxlint** *(dev)* | Very fast linter; catches mistakes such as breaking the rules of React hooks. |

No UI component library or data-fetching library is used: the app has two pages and plain CSS (`src/index.css`) is enough.

### Infrastructure

| Component | Why |
| --- | --- |
| **postgres:17-alpine** | The database required by the specification; the Alpine variant keeps the image small. Runs the `db/*.sql` scripts automatically on first start. |
| **node:24-alpine** | Current long-term-support Node.js release, small image. |
| **nginx:stable-alpine** | Serves the static frontend efficiently and acts as a reverse proxy to the API, giving one origin and one exposed port. |
| **Docker Compose** | Required by the specification; starts all three services with one command, in the right order. |

---

## 7. API reference

Base URL: `http://localhost:8080/api` (through nginx), or `http://localhost:3000/api` when running the backend directly.

All request and response bodies are JSON. Errors always have the form:

```json
{ "error": "Human-readable message" }
```

| Status | Meaning |
| --- | --- |
| `200` / `201` | Success / created |
| `400` | Invalid input: malformed JSON, failed validation, unknown fields, unknown skill or developer id, invalid URL id |
| `404` | Task, developer or skill not found, or unknown route |
| `409` | Business rule violated: assignee lacks a required skill, or the Done rule (see 5.4) |
| `500` | Unexpected server error |

### Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Health check (also checks the database) |
| `GET` | `/api/tasks` | All top-level tasks, each with its subtasks nested inside |
| `GET` | `/api/tasks/:id` | One task or subtask, with its subtasks nested inside |
| `POST` | `/api/tasks` | Create a task with optional nested subtasks |
| `PATCH` | `/api/tasks/:id` | Change a task's status and/or assignee |
| `GET` | `/api/developers` | All developers with their skills and assigned tasks |
| `GET` | `/api/developers/:id` | One developer |
| `GET` | `/api/skills` | All skills with the developers who have them |
| `GET` | `/api/skills/:id` | One skill |

### Task object

```json
{
  "id": 3,
  "title": "As a logged-in user, I want to update my profile information ...",
  "status": "To-do",
  "skills": [{ "id": 1, "name": "Frontend" }, { "id": 2, "name": "Backend" }],
  "skillsGenerated": false,
  "assignee": { "id": 3, "name": "Carol" },
  "parentTaskId": null,
  "createdAt": "2026-10-22T08:00:00.000Z",
  "updatedAt": "2026-10-22T08:00:00.000Z",
  "subtasks": [ /* task objects, same shape */ ]
}
```

- `status` is one of `"To-do"`, `"In Progress"`, `"Done"`.
- `assignee` is `null` when unassigned.
- `skillsGenerated` is `true` when the skills were identified by the LLM.

### `POST /api/tasks`

Creates a task and any nested subtasks in one transaction. Returns `201` with the created task (including subtasks).

```json
{
  "title": "As a user, I want to reset my password",
  "skillIds": [],
  "subtasks": [
    {
      "title": "Build the reset password form",
      "skillIds": [1],
      "subtasks": []
    },
    {
      "title": "Send the reset email",
      "subtasks": [
        { "title": "Create the email template" }
      ]
    }
  ]
}
```

| Field | Type | Rules |
| --- | --- | --- |
| `title` | string | Required. Trimmed; 1 to 1000 characters. |
| `skillIds` | number[] | Optional, default `[]`. Must be existing skill ids. **If empty, the skills are identified by the LLM.** |
| `subtasks` | task[] | Optional, default `[]`. Same shape, nested to any depth. |

- New tasks always start as `To-do` and unassigned.
- Unknown fields are rejected, so typos are reported instead of ignored.
- At most 100 tasks (including all subtasks) per request, to bound database and LLM work.

### `PATCH /api/tasks/:id`

Changes the status, the assignee, or both. Returns `200` with the updated task. At least one field is required.

```json
{ "status": "Done", "assigneeId": 2 }
```

| Field | Type | Rules |
| --- | --- | --- |
| `status` | string | `"To-do"`, `"In Progress"` or `"Done"`. Subject to the Done rule. |
| `assigneeId` | number \| null | A developer id to assign, or `null` to unassign. The developer must have every skill the task requires. |

Example rule violation:

```http
PATCH /api/tasks/2
{ "assigneeId": 1 }

409 Conflict
{ "error": "Alice does not have the required skill(s): Backend" }
```

### `GET /api/developers` (and `/:id`)

```json
[
  {
    "id": 3,
    "name": "Carol",
    "skills": [{ "id": 1, "name": "Frontend" }, { "id": 2, "name": "Backend" }],
    "tasks": [{ "id": 3, "title": "As a logged-in user, ...", "status": "To-do" }]
  }
]
```

### `GET /api/skills` (and `/:id`)

```json
[
  {
    "id": 1,
    "name": "Frontend",
    "developers": [{ "id": 1, "name": "Alice" }, { "id": 3, "name": "Carol" }]
  }
]
```

### Example with curl

```bash
# Create a task without skills (Gemini will identify them)
curl -X POST http://localhost:8080/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title": "As an admin, I want a dashboard of daily sign-ups"}'

# Assign task 2 to Bob and start it
curl -X PATCH http://localhost:8080/api/tasks/2 \
  -H 'Content-Type: application/json' \
  -d '{"assigneeId": 2, "status": "In Progress"}'
```

---

## 8. Assumptions

- **Statuses** are `To-do`, `In Progress` and `Done` (the specification gives "To-do", "Done", etc.).
- **Skill matching:** a developer must have *all* skills a task requires (a task needing Frontend and Backend can only go to Carol among the seed data). A task with no skills can be assigned to anyone.
- **Developers and skills are read-only** through the API, as the specification only requires reading them; they are managed through the seed data.
- **No delete endpoint and no authentication**, as neither is in the specification.
- **Subtasks have their own assignee and skills**, independent of the parent, since a subtask "has the same properties as a Task".
- **Done rule in both directions:** besides "a task can only become Done when all subtasks are Done", a subtask cannot be reopened while its parent is Done. Otherwise a Done task could end up with unfinished subtasks.
- **LLM failure does not block task creation;** the task is saved without skills rather than failing the user's request.
- **Skills chosen by the user are never overridden** by the LLM; the LLM only fills in tasks with no skills.
