import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app.ts';

// Seed data: task 3 has subtasks 4 and 5, and task 5 has subtask 6 (db/04_sample_subtasks.sql).

/** Creates root → child → grandchild and returns their ids. */
async function createThreeLevelTree() {
  const res = await request(app)
    .post('/api/tasks')
    .send({
      title: 'Root',
      subtasks: [{ title: 'Child', subtasks: [{ title: 'Grandchild' }] }],
    });
  expect(res.status).toBe(201);
  const root = res.body;
  const child = root.subtasks[0];
  const grandchild = child.subtasks[0];
  return { rootId: root.id, childId: child.id, grandchildId: grandchild.id };
}

function setStatus(taskId: number, status: string) {
  return request(app).patch(`/api/tasks/${taskId}`).send({ status });
}

describe('reading subtasks', () => {
  it('lists only top-level tasks, with subtasks nested inside', async () => {
    const res = await request(app).get('/api/tasks');

    expect(res.body.map((task: { id: number }) => task.id)).toEqual([1, 2, 3]);
    const profileTask = res.body[2];
    expect(profileTask.subtasks.map((task: { id: number }) => task.id)).toEqual([4, 5]);
    expect(profileTask.subtasks[1].subtasks[0]).toMatchObject({ id: 6, parentTaskId: 5 });
  });

  it('reads a subtask with its own subtree', async () => {
    const res = await request(app).get('/api/tasks/5');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 5, parentTaskId: 3, skills: [{ name: 'Backend' }] });
    expect(res.body.subtasks).toHaveLength(1);
  });
});

describe('creating subtasks', () => {
  it('creates nested subtasks with the same properties as a task', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({
        title: 'Checkout flow',
        skillIds: [1, 2],
        subtasks: [
          { title: 'Checkout page', skillIds: [1] },
          { title: 'Payment API', skillIds: [2], subtasks: [{ title: 'Refunds', skillIds: [2] }] },
        ],
      });

    expect(res.status).toBe(201);
    const [page, api] = res.body.subtasks;
    expect(page).toMatchObject({
      title: 'Checkout page',
      status: 'To-do',
      parentTaskId: res.body.id,
      skills: [{ name: 'Frontend' }],
    });
    expect(api.subtasks[0]).toMatchObject({ title: 'Refunds', parentTaskId: api.id });
  });

  it('saves nothing when any subtask is invalid', async () => {
    const before = await request(app).get('/api/tasks');

    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'Parent', subtasks: [{ title: 'Ok' }, { title: 'Bad skill', skillIds: [99] }] });

    expect(res.status).toBe(400);
    const after = await request(app).get('/api/tasks');
    expect(after.body).toHaveLength(before.body.length);
  });

  it('reports where a nested validation error is', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'Parent', subtasks: [{ title: 'Child', subtasks: [{ title: '' }] }] });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('subtasks.0.subtasks.0.title');
  });
});

describe('Done rule', () => {
  it('blocks Done while a subtask is not Done', async () => {
    const { rootId, childId } = await createThreeLevelTree();

    const res = await setStatus(rootId, 'Done');

    expect(res.status).toBe(409);
    expect(res.body.error).toContain(`not done: ${childId}`);
  });

  it('applies at every level of nesting', async () => {
    const { rootId, childId, grandchildId } = await createThreeLevelTree();

    expect((await setStatus(childId, 'Done')).status).toBe(409);
    expect((await setStatus(grandchildId, 'Done')).status).toBe(200);
    expect((await setStatus(childId, 'Done')).status).toBe(200);
    expect((await setStatus(rootId, 'Done')).status).toBe(200);
  });

  it('allows other status changes while subtasks are open', async () => {
    const { rootId } = await createThreeLevelTree();

    const res = await setStatus(rootId, 'In Progress');

    expect(res.status).toBe(200);
  });

  it('blocks reopening a subtask while its parent is Done', async () => {
    const { rootId, childId, grandchildId } = await createThreeLevelTree();
    await setStatus(grandchildId, 'Done');
    await setStatus(childId, 'Done');
    await setStatus(rootId, 'Done');

    const blocked = await setStatus(childId, 'In Progress');
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toContain('Reopen the parent first');

    expect((await setStatus(rootId, 'In Progress')).status).toBe(200);
    expect((await setStatus(childId, 'In Progress')).status).toBe(200);
  });
});
