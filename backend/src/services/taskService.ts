import type { PoolClient } from 'pg';
import { query, withTransaction } from '../db.ts';
import { HttpError } from '../errors.ts';
import { identifySkills } from '../llm/skillIdentifier.ts';
import type { Task, TaskStatus } from '../types.ts';
import type { CreateTaskInput, UpdateTaskInput } from '../validation.ts';

/** A task as returned by SELECT_TASKS, before its subtasks are attached. */
type TaskRow = Omit<Task, 'subtasks'>;

// Column aliases in double quotes ("skillsGenerated") keep the camelCase
// names used in the JSON response.
const SELECT_TASKS = `
  SELECT t.id, t.title, t.status,
    t.skills_generated AS "skillsGenerated",
    t.parent_task_id AS "parentTaskId",
    t.created_at AS "createdAt",
    t.updated_at AS "updatedAt",
    CASE WHEN d.id IS NULL THEN NULL
         ELSE json_build_object('id', d.id, 'name', d.name)
    END AS assignee,
    COALESCE((
      SELECT json_agg(json_build_object('id', s.id, 'name', s.name) ORDER BY s.id)
      FROM task_skills ts
      JOIN skills s ON s.id = ts.skill_id
      WHERE ts.task_id = t.id
    ), '[]') AS skills
  FROM tasks t
  LEFT JOIN developers d ON d.id = t.assignee_id`;

/** All top-level tasks, each with its subtasks nested inside. */
export async function listTasks(): Promise<Task[]> {
  const rows = await query<TaskRow>(`${SELECT_TASKS} ORDER BY t.id`);
  return buildTree(rows);
}

/** One task (or subtask) with its subtasks nested inside. */
export async function getTask(id: number): Promise<Task> {
  // The recursive query collects the task's id plus the ids of all its descendants
  const rows = await query<TaskRow>(
    `WITH RECURSIVE subtree AS (
       SELECT id FROM tasks WHERE id = $1
       UNION ALL
       SELECT child.id FROM tasks child JOIN subtree ON child.parent_task_id = subtree.id
     )
     ${SELECT_TASKS}
     WHERE t.id IN (SELECT id FROM subtree)
     ORDER BY t.id`,
    [id],
  );
  const [task] = buildTree(rows);
  if (!task) throw new HttpError(404, `Task ${id} not found`);
  return task;
}

/**
 * Turns a flat list of rows into a tree by putting each row into its
 * parent's `subtasks`. Rows whose parent is not in the list are the roots.
 */
function buildTree(rows: TaskRow[]): Task[] {
  const tasksById = new Map<number, Task>();
  for (const row of rows) {
    tasksById.set(row.id, { ...row, subtasks: [] });
  }

  const roots: Task[] = [];
  for (const task of tasksById.values()) {
    const parent = task.parentTaskId === null ? undefined : tasksById.get(task.parentTaskId);
    if (parent) {
      parent.subtasks.push(task);
    } else {
      roots.push(task);
    }
  }
  return roots;
}

/**
 * Creates a task and all its nested subtasks. Either all are saved or none are.
 * Tasks created without skills get them from the LLM.
 */
export async function createTask(input: CreateTaskInput): Promise<Task> {
  const allTasks = flattenTree(input);

  // Check the user-chosen skills first, so a bad request fails before any LLM call
  await checkSkillsExist(allTasks.flatMap(({ task }) => task.skillIds));

  // Ask the LLM before opening the transaction, so no transaction waits on the network
  const generatedSkills = await generateMissingSkills(
    allTasks.filter(({ task }) => task.skillIds.length === 0),
  );

  const taskId = await withTransaction((client) =>
    insertTaskTree(client, input, null, generatedSkills),
  );
  return getTask(taskId);
}

/** A task from a create request, with its parent's title (for LLM context). */
interface TreeEntry {
  task: CreateTaskInput;
  parentTitle?: string;
}

/** Lists a task and all its subtasks, at every level, in one flat array. */
function flattenTree(task: CreateTaskInput, parentTitle?: string): TreeEntry[] {
  const entries: TreeEntry[] = [{ task, parentTitle }];
  for (const subtask of task.subtasks) {
    entries.push(...flattenTree(subtask, task.title));
  }
  return entries;
}

/** Skill ids the LLM chose, keyed by the task (from the request) they belong to. */
type GeneratedSkills = Map<CreateTaskInput, number[]>;

/**
 * Asks the LLM for the skills of every given task in one batch.
 * If the LLM fails, the tasks are still created, just without skills.
 */
async function generateMissingSkills(needSkills: TreeEntry[]): Promise<GeneratedSkills> {
  const generated: GeneratedSkills = new Map();
  if (needSkills.length === 0) return generated;

  const skills = await query<{ id: number; name: string }>('SELECT id, name FROM skills');
  if (skills.length === 0) return generated;

  try {
    const skillNamesPerTask = await identifySkills(
      needSkills.map(({ task, parentTitle }) => ({ title: task.title, parentTitle })),
      skills.map((skill) => skill.name),
    );
    needSkills.forEach(({ task }, index) => {
      const ids = skills
        .filter((skill) => skillNamesPerTask[index].includes(skill.name))
        .map((skill) => skill.id);
      if (ids.length > 0) generated.set(task, ids);
    });
  } catch (error) {
    console.warn('Could not identify skills with the LLM; saving without them.', error);
  }
  return generated;
}

/** Inserts one task, then calls itself for each subtask with this task as the parent. */
async function insertTaskTree(
  client: PoolClient,
  task: CreateTaskInput,
  parentTaskId: number | null,
  generatedSkills: GeneratedSkills,
): Promise<number> {
  const llmSkillIds = generatedSkills.get(task);
  const skillIds = llmSkillIds ?? task.skillIds;

  const inserted = await client.query<{ id: number }>(
    `INSERT INTO tasks (title, parent_task_id, skills_generated)
     VALUES ($1, $2, $3) RETURNING id`,
    [task.title, parentTaskId, llmSkillIds !== undefined],
  );
  const newId = inserted.rows[0].id;

  for (const skillId of skillIds) {
    await client.query(
      'INSERT INTO task_skills (task_id, skill_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [newId, skillId],
    );
  }

  for (const subtask of task.subtasks) {
    await insertTaskTree(client, subtask, newId, generatedSkills);
  }
  return newId;
}

export async function updateTask(id: number, changes: UpdateTaskInput): Promise<Task> {
  await withTransaction(async (client) => {
    // FOR UPDATE locks the row, so concurrent updates to the same task run one at a time
    const found = await client.query('SELECT id FROM tasks WHERE id = $1 FOR UPDATE', [id]);
    if (found.rows.length === 0) throw new HttpError(404, `Task ${id} not found`);

    if (changes.assigneeId !== undefined) {
      if (changes.assigneeId !== null) {
        await checkDeveloperHasRequiredSkills(client, id, changes.assigneeId);
      }
      await client.query('UPDATE tasks SET assignee_id = $2, updated_at = now() WHERE id = $1', [
        id,
        changes.assigneeId,
      ]);
    }

    if (changes.status !== undefined) {
      await checkStatusChangeAllowed(client, id, changes.status);
      await client.query('UPDATE tasks SET status = $2, updated_at = now() WHERE id = $1', [
        id,
        changes.status,
      ]);
    }
  });
  return getTask(id);
}

async function checkSkillsExist(skillIds: number[]): Promise<void> {
  const uniqueIds = [...new Set(skillIds)];
  const found = await query<{ id: number }>('SELECT id FROM skills WHERE id = ANY($1)', [
    uniqueIds,
  ]);
  const foundIds = found.map((row) => row.id);
  const unknownIds = uniqueIds.filter((skillId) => !foundIds.includes(skillId));
  if (unknownIds.length > 0) {
    throw new HttpError(400, `Unknown skill id(s): ${unknownIds.join(', ')}`);
  }
}

/** A task can only be assigned to a developer who has every skill the task requires. */
async function checkDeveloperHasRequiredSkills(
  client: PoolClient,
  taskId: number,
  developerId: number,
): Promise<void> {
  const developer = await client.query<{ name: string }>(
    'SELECT name FROM developers WHERE id = $1',
    [developerId],
  );
  if (developer.rows.length === 0) {
    throw new HttpError(400, `Developer ${developerId} does not exist`);
  }

  // Skills the task requires that the developer does not have
  const missing = await client.query<{ name: string }>(
    `SELECT s.name
     FROM task_skills ts
     JOIN skills s ON s.id = ts.skill_id
     WHERE ts.task_id = $1
       AND ts.skill_id NOT IN (SELECT skill_id FROM developer_skills WHERE developer_id = $2)
     ORDER BY s.id`,
    [taskId, developerId],
  );
  if (missing.rows.length > 0) {
    const skillNames = missing.rows.map((row) => row.name).join(', ');
    throw new HttpError(
      409,
      `${developer.rows[0].name} does not have the required skill(s): ${skillNames}`,
    );
  }
}

/**
 * Keeps this rule true: a task that is Done only has subtasks that are Done.
 * - A task can only become Done once all its subtasks are Done.
 * - A subtask cannot leave Done while its parent is Done (reopen the parent first).
 * Checking direct subtasks is enough, because the rule holds at every level.
 */
async function checkStatusChangeAllowed(
  client: PoolClient,
  taskId: number,
  newStatus: TaskStatus,
): Promise<void> {
  if (newStatus === 'Done') {
    const unfinished = await client.query<{ id: number }>(
      `SELECT id FROM tasks WHERE parent_task_id = $1 AND status <> 'Done' ORDER BY id`,
      [taskId],
    );
    if (unfinished.rows.length > 0) {
      const ids = unfinished.rows.map((row) => row.id).join(', ');
      throw new HttpError(
        409,
        `Task ${taskId} cannot be Done until all its subtasks are Done (not done: ${ids})`,
      );
    }
    return;
  }

  // Lock the parent row too. Someone marking the parent Done at the same time
  // also locks it, so the two changes cannot both slip through.
  const parent = await client.query<{ id: number; status: TaskStatus }>(
    `SELECT id, status FROM tasks
     WHERE id = (SELECT parent_task_id FROM tasks WHERE id = $1)
     FOR UPDATE`,
    [taskId],
  );
  if (parent.rows.length > 0 && parent.rows[0].status === 'Done') {
    throw new HttpError(
      409,
      `Task ${taskId} cannot be set to ${newStatus} while its parent task ${parent.rows[0].id} is Done. Reopen the parent first.`,
    );
  }
}
