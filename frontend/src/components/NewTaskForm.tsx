import { emptyDraft } from '../taskDraft.ts';
import type { TaskDraft } from '../taskDraft.ts';
import type { Skill } from '../types.ts';

interface NewTaskFormProps {
  draft: TaskDraft;
  skills: Skill[];
  label: string; // position in the tree, e.g. "1.2.1"
  onChange: (draft: TaskDraft) => void;
  onRemove?: () => void; // not given for the top-level task, which cannot be removed
}

/**
 * The "New Task Component": a title and skill checkboxes for one task, followed
 * by a NewTaskForm for each of its subtasks. It does not store anything itself;
 * every edit produces an updated copy of `draft` that is passed to `onChange`.
 */
export function NewTaskForm({ draft, skills, label, onChange, onRemove }: NewTaskFormProps) {
  function toggleSkill(skillId: number) {
    const skillIds = draft.skillIds.includes(skillId)
      ? draft.skillIds.filter((id) => id !== skillId)
      : [...draft.skillIds, skillId];
    onChange({ ...draft, skillIds });
  }

  function addSubtask() {
    onChange({ ...draft, subtasks: [...draft.subtasks, emptyDraft()] });
  }

  function updateSubtask(index: number, updated: TaskDraft) {
    const subtasks = draft.subtasks.map((subtask, i) => (i === index ? updated : subtask));
    onChange({ ...draft, subtasks });
  }

  function removeSubtask(index: number) {
    const subtasks = draft.subtasks.filter((_subtask, i) => i !== index);
    onChange({ ...draft, subtasks });
  }

  return (
    <fieldset className="task-draft">
      <legend>{onRemove ? `Subtask ${label}` : `Task ${label}`}</legend>

      <div className="draft-actions">
        <button type="button" className="secondary" onClick={addSubtask}>
          Add Subtask
        </button>
        {onRemove && (
          <button type="button" className="secondary danger" onClick={onRemove}>
            Remove
          </button>
        )}
      </div>

      <label className="field">
        Title
        <textarea
          rows={2}
          required
          value={draft.title}
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
        />
      </label>

      <div className="field">
        Skills
        <div className="checkbox-row">
          {skills.map((skill) => (
            <label key={skill.id}>
              <input
                type="checkbox"
                checked={draft.skillIds.includes(skill.id)}
                onChange={() => toggleSkill(skill.id)}
              />
              {skill.name}
            </label>
          ))}
        </div>
        {draft.skillIds.length === 0 && (
          <p className="hint">No skills selected: AI will identify them from the title.</p>
        )}
      </div>

      {draft.subtasks.map((subtask, index) => (
        <NewTaskForm
          key={subtask.key}
          draft={subtask}
          skills={skills}
          label={`${label}.${index + 1}`}
          onChange={(updated) => updateSubtask(index, updated)}
          onRemove={() => removeSubtask(index)}
        />
      ))}
    </fieldset>
  );
}
