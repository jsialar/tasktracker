-- Part 4: subtasks.
-- A subtask is a task with a parent task, so it has every property a task has
-- (title, status, required skills, assignee) and can have subtasks of its own.

ALTER TABLE tasks
  ADD COLUMN parent_task_id INTEGER REFERENCES tasks (id) ON DELETE CASCADE,
  ADD CONSTRAINT tasks_not_own_parent CHECK (parent_task_id <> id);

CREATE INDEX tasks_parent_task_id_idx ON tasks (parent_task_id);
