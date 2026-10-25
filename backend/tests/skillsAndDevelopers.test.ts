import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app.ts';

// Seed data (db/02_seed.sql): skills 1=Frontend, 2=Backend;
// developers 1=Alice, 2=Bob, 3=Carol, 4=Dave; task 1 is assigned to Alice.

describe('GET /api/skills', () => {
  it('lists skills with the developers who have them', async () => {
    const res = await request(app).get('/api/skills');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      {
        id: 1,
        name: 'Frontend',
        developers: [
          { id: 1, name: 'Alice' },
          { id: 3, name: 'Carol' },
        ],
      },
      {
        id: 2,
        name: 'Backend',
        developers: [
          { id: 2, name: 'Bob' },
          { id: 3, name: 'Carol' },
          { id: 4, name: 'Dave' },
        ],
      },
    ]);
  });

  it('reads a single skill', async () => {
    const res = await request(app).get('/api/skills/2');

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Backend');
  });

  it('returns 404 for an unknown skill', async () => {
    const res = await request(app).get('/api/skills/99');

    expect(res.status).toBe(404);
  });
});

describe('GET /api/developers', () => {
  it('lists the seeded developers with their skills', async () => {
    const res = await request(app).get('/api/developers');

    expect(res.status).toBe(200);
    const summary = res.body.map((dev: { name: string; skills: { name: string }[] }) => ({
      name: dev.name,
      skills: dev.skills.map((skill) => skill.name),
    }));
    expect(summary).toEqual([
      { name: 'Alice', skills: ['Frontend'] },
      { name: 'Bob', skills: ['Backend'] },
      { name: 'Carol', skills: ['Frontend', 'Backend'] },
      { name: 'Dave', skills: ['Backend'] },
    ]);
  });

  it('reads a single developer with their assigned tasks', async () => {
    const res = await request(app).get('/api/developers/1');

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Alice');
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0]).toMatchObject({ id: 1, status: 'To-do' });
  });

  it('returns 400 for a non-numeric id', async () => {
    const res = await request(app).get('/api/developers/abc');

    expect(res.status).toBe(400);
  });
});
