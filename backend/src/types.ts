// Shapes of the JSON objects returned by the API.

export const TASK_STATUSES = ['To-do', 'In Progress', 'Done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number]; // 'To-do' | 'In Progress' | 'Done'

/** A short reference to another record, e.g. a task's assignee or skills. */
export interface IdName {
  id: number;
  name: string;
}

export interface Skill {
  id: number;
  name: string;
  developers: IdName[];
}

export interface TaskSummary {
  id: number;
  title: string;
  status: TaskStatus;
}

export interface Developer {
  id: number;
  name: string;
  skills: IdName[];
  tasks: TaskSummary[];
}

export interface Task {
  id: number;
  title: string;
  status: TaskStatus;
  skills: IdName[];
  skillsGenerated: boolean;
  assignee: IdName | null;
  parentTaskId: number | null;
  createdAt: Date;
  updatedAt: Date;
  subtasks: Task[];
}
