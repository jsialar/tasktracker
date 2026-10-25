import { useEffect, useState } from 'react';
import { errorMessage, getDevelopers, getTasks, updateTask } from '../api.ts';
import { ErrorBanner } from '../components/ErrorBanner.tsx';
import { TaskRow } from '../components/TaskRow.tsx';
import type { Developer, Task, TaskUpdate } from '../types.ts';

export function TaskListPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false); // true while a change is being sent
  const [error, setError] = useState<string | null>(null);

  // Fetches tasks and developers in parallel, then stores them in state
  function loadData() {
    return Promise.all([getTasks(), getDevelopers()])
      .then(([taskList, developerList]) => {
        setTasks(taskList);
        setDevelopers(developerList);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }

  // Load the data once, when the page first appears
  useEffect(() => {
    loadData();
  }, []);

  // The dropdowns are disabled while `saving` is true, so changes go one at a time
  async function handleUpdate(taskId: number, changes: TaskUpdate) {
    setError(null);
    setSaving(true);
    try {
      await updateTask(taskId, changes);
      await loadData(); // re-fetch so the table shows exactly what the server saved
    } catch (err) {
      // The dropdowns still show the saved values, because `tasks` was not changed
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Loading tasks…</p>;

  return (
    <section>
      <h2>Tasks</h2>
      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {tasks.length === 0 ? (
        <p>No tasks yet.</p>
      ) : (
        <table className="task-table">
          <thead>
            <tr>
              <th className="col-id">#</th>
              <th>Task Title</th>
              <th className="col-skills">Skills</th>
              <th className="col-subtasks">Subtasks</th>
              <th className="col-select">Status</th>
              <th className="col-select">Assignee</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                developers={developers}
                onUpdate={handleUpdate}
                disabled={saving}
              />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
