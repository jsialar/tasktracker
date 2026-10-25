// Shapes of the JSON the backend sends and accepts (only the fields the UI uses).

export type TaskStatus = 'To-do' | 'In Progress' | 'Done';
export const TASK_STATUSES: TaskStatus[] = ['To-do', 'In Progress', 'Done'];

export interface IdName {
  id: number;
  name: string;
}

export interface Skill {
  id: number;
  name: string;
}

export interface Developer {
  id: number;
  name: string;
  skills: IdName[];
}

export interface Task {
  id: number;
  title: string;
  status: TaskStatus;
  skills: IdName[];
  skillsGenerated: boolean;
  assignee: IdName | null;
  parentTaskId: number | null;
  subtasks: Task[];
}

/** Body of POST /api/tasks */
export interface NewTask {
  title: string;
  skillIds: number[];
  subtasks: NewTask[];
}

/** Body of PATCH /api/tasks/:id (send only the fields that change) */
export interface TaskUpdate {
  status?: TaskStatus;
  assigneeId?: number | null;
}
