import type { NewTask } from './types.ts';

/** The create form's in-progress values for one task (and its subtasks) before saving. */
export interface TaskDraft {
  key: number; // stable id so React can tell drafts apart when one is removed
  title: string;
  skillIds: number[];
  subtasks: TaskDraft[];
}

let nextKey = 1;

export function emptyDraft(): TaskDraft {
  return { key: nextKey++, title: '', skillIds: [], subtasks: [] };
}

/** Converts a draft tree into the request body the API expects (dropping the React keys). */
export function toNewTask(draft: TaskDraft): NewTask {
  return {
    title: draft.title,
    skillIds: draft.skillIds,
    subtasks: draft.subtasks.map(toNewTask),
  };
}
