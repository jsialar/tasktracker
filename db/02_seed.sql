-- Part 1.2: seed developers and skills.

INSERT INTO skills (name) VALUES ('Frontend'), ('Backend');

INSERT INTO developers (name) VALUES ('Alice'), ('Bob'), ('Carol'), ('Dave');

INSERT INTO developer_skills (developer_id, skill_id)
SELECT d.id, s.id
FROM (VALUES
  ('Alice', 'Frontend'),
  ('Bob',   'Backend'),
  ('Carol', 'Frontend'),
  ('Carol', 'Backend'),
  ('Dave',  'Backend')
) AS pairs (developer_name, skill_name)
JOIN developers d ON d.name = pairs.developer_name
JOIN skills s     ON s.name = pairs.skill_name;

-- Sample tasks from the wireframe, so the task list is not empty on first run.
INSERT INTO tasks (title, assignee_id) VALUES
  ('As a visitor, I want to see a responsive homepage so that I can easily navigate on both desktop and mobile devices.',
   (SELECT id FROM developers WHERE name = 'Alice')),
  ('As a system administrator, I want audit logs of all data access and modifications so that I can ensure compliance with data protection regulations and investigate any security incidents.',
   NULL),
  ('As a logged-in user, I want to update my profile information and upload a profile picture so that my account details are accurate and personalized.',
   NULL);

INSERT INTO task_skills (task_id, skill_id)
SELECT t.id, s.id
FROM (VALUES
  ('As a visitor, %',              'Frontend'),
  ('As a system administrator, %', 'Backend'),
  ('As a logged-in user, %',       'Frontend'),
  ('As a logged-in user, %',       'Backend')
) AS pairs (title_pattern, skill_name)
JOIN tasks t  ON t.title LIKE pairs.title_pattern
JOIN skills s ON s.name = pairs.skill_name;
