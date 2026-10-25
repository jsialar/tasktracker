import { TASK_STATUSES } from '../types.ts';
import type { Developer, Task, TaskStatus, TaskUpdate } from '../types.ts';

interface TaskRowProps {
  task: Task;
  developers: Developer[];
  onUpdate: (taskId: number, changes: TaskUpdate) => void;
  disabled: boolean; // true while any change is being saved
  depth?: number; // 0 for a top-level task, 1 for its subtasks, and so on
  parentIsDone?: boolean;
}

/**
 * One row of the task table, with dropdowns to change the status and assignee.
 * After its own row it renders a TaskRow for each subtask, one level deeper.
 */
export function TaskRow({
  task,
  developers,
  onUpdate,
  disabled,
  depth = 0,
  parentIsDone = false,
}: TaskRowProps) {
  // Only developers who have every skill the task requires can be picked
  const eligibleDevelopers = developers.filter((developer) =>
    task.skills.every((required) => developer.skills.some((skill) => skill.id === required.id)),
  );

  const doneSubtasks = task.subtasks.filter((subtask) => subtask.status === 'Done').length;
  const allSubtasksDone = doneSubtasks === task.subtasks.length;

  return (
    <>
      <tr className={depth > 0 ? 'subtask-row' : undefined}>
        <td>{task.id}</td>
        <td style={{ paddingLeft: `${0.75 + depth * 1.5}rem` }}>
          {depth > 0 && <span className="subtask-marker">↳ </span>}
          {task.title}
        </td>
        <td>
          {task.skills.map((skill) => (
            <span key={skill.id} className="skill-chip">
              {skill.name}
            </span>
          ))}
          {task.skillsGenerated && (
            <span className="ai-tag" title="Skills identified by AI from the task title">
              AI
            </span>
          )}
        </td>
        <td className="subtask-count">
          {task.subtasks.length > 0 ? `${doneSubtasks}/${task.subtasks.length} done` : '—'}
        </td>
        <td>
          <select
            aria-label={`Status of task ${task.id}`}
            value={task.status}
            disabled={disabled || parentIsDone}
            title={parentIsDone ? 'The parent task is Done. Reopen it first.' : undefined}
            onChange={(event) => onUpdate(task.id, { status: event.target.value as TaskStatus })}
          >
            {TASK_STATUSES.map((status) => (
              <option key={status} value={status} disabled={status === 'Done' && !allSubtasksDone}>
                {status}
              </option>
            ))}
          </select>
        </td>
        <td>
          <select
            aria-label={`Assignee of task ${task.id}`}
            value={task.assignee?.id ?? ''}
            disabled={disabled}
            onChange={(event) => {
              const value = event.target.value;
              onUpdate(task.id, { assigneeId: value === '' ? null : Number(value) });
            }}
          >
            <option value="">Unassigned</option>
            {eligibleDevelopers.map((developer) => (
              <option key={developer.id} value={developer.id}>
                {developer.name}
              </option>
            ))}
          </select>
        </td>
      </tr>

      {task.subtasks.map((subtask) => (
        <TaskRow
          key={subtask.id}
          task={subtask}
          developers={developers}
          onUpdate={onUpdate}
          disabled={disabled}
          depth={depth + 1}
          parentIsDone={task.status === 'Done'}
        />
      ))}
    </>
  );
}
