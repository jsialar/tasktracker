-- Part 1: core schema.
-- Files in this folder are run in alphabetical order by the postgres image
-- the first time the database volume is created.

CREATE TABLE skills (
  id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE developers (
  id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL
);

-- Many-to-many: a developer can have many skills, a skill can belong to many developers.
CREATE TABLE developer_skills (
  developer_id INTEGER NOT NULL REFERENCES developers (id) ON DELETE CASCADE,
  skill_id     INTEGER NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
  PRIMARY KEY (developer_id, skill_id)
);

CREATE TABLE tasks (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title            TEXT NOT NULL CHECK (length(trim(title)) > 0),
  status           TEXT NOT NULL DEFAULT 'To-do'
                   CHECK (status IN ('To-do', 'In Progress', 'Done')),
  assignee_id      INTEGER REFERENCES developers (id) ON DELETE SET NULL,
  -- true when the required skills were identified by the LLM rather than the user
  skills_generated BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tasks_assignee_id_idx ON tasks (assignee_id);

-- Many-to-many: the skills a task requires.
CREATE TABLE task_skills (
  task_id  INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  skill_id INTEGER NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, skill_id)
);
