// Functions that call the backend API. Pages use these instead of calling fetch directly.
import type { Developer, NewTask, Skill, Task, TaskUpdate } from './types.ts';

/** Sends a request to /api and returns the JSON response, or throws the API's error message. */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json' },
  });
  // Error pages from a proxy may not be JSON, so fall back to null
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error ?? `Request failed with status ${response.status}`);
  }
  return body;
}

export function getTasks() {
  return request<Task[]>('/tasks');
}

export function getDevelopers() {
  return request<Developer[]>('/developers');
}

export function getSkills() {
  return request<Skill[]>('/skills');
}

export function createTask(task: NewTask) {
  return request<Task>('/tasks', { method: 'POST', body: JSON.stringify(task) });
}

export function updateTask(id: number, changes: TaskUpdate) {
  return request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(changes) });
}

/** Turns anything caught in a try/catch into a readable message. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
