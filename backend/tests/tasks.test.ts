import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app.ts';

// Seed data (db/02_seed.sql): skills 1=Frontend, 2=Backend;
// developers 1=Alice (FE), 2=Bob (BE), 3=Carol (FE+BE), 4=Dave (BE);
// tasks 1 (Frontend, assigned to Alice), 2 (Backend), 3 (Frontend + Backend).

describe('GET /api/tasks', () => {
  it('lists tasks with skills and assignee', async () => {
    const res = await request(app).get('/api/tasks');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body[0]).toMatchObject({
      id: 1,
      status: 'To-do',
      skills: [{ id: 1, name: 'Frontend' }],
      assignee: { id: 1, name: 'Alice' },
    });
    expect(res.body[1].assignee).toBeNull();
  });

  it('returns 404 for an unknown task', async () => {
    const res = await request(app).get('/api/tasks/999');

    expect(res.status).toBe(404);
  });
});

describe('POST /api/tasks', () => {
  it('creates a task with the given skills', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: '  Build login page  ', skillIds: [1] });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: 'Build login page',
      status: 'To-do',
      assignee: null,
      skills: [{ id: 1, name: 'Frontend' }],
      skillsGenerated: false,
    });
  });

  it('rejects a missing title', async () => {
    const res = await request(app).post('/api/tasks').send({ title: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Title is required');
  });

  it('rejects unknown skill ids', async () => {
    const res = await request(app).post('/api/tasks').send({ title: 'Task', skillIds: [1, 42] });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('42');
  });

  it('rejects fields it does not accept', async () => {
    const res = await request(app).post('/api/tasks').send({ title: 'Task', status: 'Done' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('status');
  });

  it('limits how many tasks one request can create', async () => {
    const subtasks = Array.from({ length: 100 }, (_, i) => ({ title: `Subtask ${i}` }));
    const res = await request(app).post('/api/tasks').send({ title: 'Big', subtasks });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('at most 100 tasks');
  });

  it('returns 413 for an oversized body', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'x'.repeat(200_000) });

    expect(res.status).toBe(413);
  });
});

describe('PATCH /api/tasks/:id', () => {
  it('assigns a developer who has all required skills', async () => {
    const res = await request(app).patch('/api/tasks/3').send({ assigneeId: 3 });

    expect(res.status).toBe(200);
    expect(res.body.assignee).toEqual({ id: 3, name: 'Carol' });
  });

  it('refuses a developer missing a required skill', async () => {
    const res = await request(app).patch('/api/tasks/3').send({ assigneeId: 2 });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Bob does not have the required skill(s): Frontend');

    const task = await request(app).get('/api/tasks/3');
    expect(task.body.assignee).toBeNull();
  });

  it('unassigns with null', async () => {
    const res = await request(app).patch('/api/tasks/1').send({ assigneeId: null });

    expect(res.status).toBe(200);
    expect(res.body.assignee).toBeNull();
  });

  it('allows anyone to take a task that requires no skills', async () => {
    const created = await request(app).post('/api/tasks').send({ title: 'Write docs' });
    const res = await request(app).patch(`/api/tasks/${created.body.id}`).send({ assigneeId: 2 });

    expect(res.status).toBe(200);
  });

  it('rejects an unknown developer', async () => {
    const res = await request(app).patch('/api/tasks/1').send({ assigneeId: 99 });

    expect(res.status).toBe(400);
  });

  it('changes the status', async () => {
    const res = await request(app).patch('/api/tasks/2').send({ status: 'In Progress' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('In Progress');
  });

  it('rejects an unknown status', async () => {
    const res = await request(app).patch('/api/tasks/2').send({ status: 'Blocked' });

    expect(res.status).toBe(400);
  });

  it('rejects fields that cannot be changed, and empty updates', async () => {
    const rename = await request(app).patch('/api/tasks/2').send({ title: 'Renamed' });
    const empty = await request(app).patch('/api/tasks/2').send({});

    expect(rename.status).toBe(400);
    expect(empty.status).toBe(400);
  });
});
