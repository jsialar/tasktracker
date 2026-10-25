import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { createTask, errorMessage, getSkills } from '../api.ts';
import { ErrorBanner } from '../components/ErrorBanner.tsx';
import { NewTaskForm } from '../components/NewTaskForm.tsx';
import { emptyDraft, toNewTask } from '../taskDraft.ts';
import type { TaskDraft } from '../taskDraft.ts';
import type { Skill } from '../types.ts';

export function CreateTaskPage() {
  const navigate = useNavigate();
  const [skills, setSkills] = useState<Skill[]>([]);
  // The whole tree of tasks being created lives in this one piece of state
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the skill list once, for the checkboxes
  useEffect(() => {
    getSkills()
      .then(setSkills)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault(); // stop the browser from reloading the page
    setSaving(true);
    setError(null);
    try {
      await createTask(toNewTask(draft));
      navigate('/');
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <section>
      <h2>Create Task(s)</h2>
      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      <form onSubmit={handleSubmit}>
        <NewTaskForm draft={draft} skills={skills} label="1" onChange={setDraft} />
        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </section>
  );
}
