-- Sample subtasks (two levels deep) under the "logged-in user" profile task.

INSERT INTO tasks (title, parent_task_id) VALUES
  ('Build the profile edit form with a picture preview',
   (SELECT id FROM tasks WHERE title LIKE 'As a logged-in user, %')),
  ('Create an API endpoint that saves profile details and uploaded pictures',
   (SELECT id FROM tasks WHERE title LIKE 'As a logged-in user, %'));

INSERT INTO tasks (title, parent_task_id) VALUES
  ('Validate the uploaded picture''s file type and size on the server',
   (SELECT id FROM tasks WHERE title LIKE 'Create an API endpoint that saves %'));

INSERT INTO task_skills (task_id, skill_id)
SELECT t.id, s.id
FROM (VALUES
  ('Build the profile edit form %',       'Frontend'),
  ('Create an API endpoint that saves %', 'Backend'),
  ('Validate the uploaded picture%',      'Backend')
) AS pairs (title_pattern, skill_name)
JOIN tasks t  ON t.title LIKE pairs.title_pattern
JOIN skills s ON s.name = pairs.skill_name;
