// Rules for what the API accepts as input. Route handlers call `.parse()` on
// these schemas; invalid input throws a ZodError, which becomes a 400 response.
// strictObject rejects unknown fields, so typos like {"stauts": "Done"} are reported.
import { z } from 'zod';
import { HttpError } from './errors.ts';
import { TASK_STATUSES } from './types.ts';

/** Parses the `:id` part of a URL such as /api/tasks/42. */
export function parseId(value: string): number {
  const id = Number(value);
  // Postgres INTEGER columns top out at 2,147,483,647
  if (!Number.isInteger(id) || id <= 0 || id > 2_147_483_647) {
    throw new HttpError(400, `Invalid id: ${value}`);
  }
  return id;
}

const id = z.int32().positive();

const MAX_TASKS_PER_REQUEST = 100;

const taskSchema = z.strictObject({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(1000, 'Title is too long (max 1000 characters)')
    .refine((title) => !title.includes('\0'), 'Title cannot contain NUL characters'),
  skillIds: z.array(id).default([]),
  // Each subtask has the same shape as a task. The getter lets the schema refer to itself.
  get subtasks() {
    return z.array(taskSchema).default([]);
  },
});
export type CreateTaskInput = z.infer<typeof taskSchema>;

/** Counts a task plus all its subtasks, at every level. */
export function countTasks(task: CreateTaskInput): number {
  let count = 1;
  for (const subtask of task.subtasks) count += countTasks(subtask);
  return count;
}

// Body of POST /api/tasks: one task tree, limited in size so one request can't
// trigger an unbounded amount of database and LLM work.
export const createTaskSchema = taskSchema.refine(
  (task) => countTasks(task) <= MAX_TASKS_PER_REQUEST,
  `A request can create at most ${MAX_TASKS_PER_REQUEST} tasks including subtasks`,
);

export const updateTaskSchema = z
  .strictObject({
    status: z.enum(TASK_STATUSES).optional(),
    // A number assigns a developer, null unassigns, and leaving it out changes nothing
    assigneeId: id.nullable().optional(),
  })
  .refine(
    (changes) => changes.status !== undefined || changes.assigneeId !== undefined,
    'Provide status and/or assigneeId',
  );
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
