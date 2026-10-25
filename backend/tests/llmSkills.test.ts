import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { app } from '../src/app.ts';
import { buildPrompt, identifySkills, parseAnswer } from '../src/llm/skillIdentifier.ts';

// identifySkills is mocked in tests/setup.ts
const mockedIdentifySkills = vi.mocked(identifySkills);

describe('creating tasks without skills', () => {
  it('fills in skills from the LLM, in one batch for the whole tree', async () => {
    mockedIdentifySkills.mockResolvedValueOnce([['Frontend', 'Backend'], ['Backend']]);

    const res = await request(app)
      .post('/api/tasks')
      .send({
        title: 'Profile page',
        subtasks: [{ title: 'Avatar upload UI', skillIds: [1] }, { title: 'Store avatars' }],
      });

    expect(res.status).toBe(201);
    expect(mockedIdentifySkills).toHaveBeenCalledTimes(1);
    expect(mockedIdentifySkills).toHaveBeenCalledWith(
      [{ title: 'Profile page' }, { title: 'Store avatars', parentTitle: 'Profile page' }],
      ['Frontend', 'Backend'],
    );

    expect(res.body).toMatchObject({
      skillsGenerated: true,
      skills: [{ name: 'Frontend' }, { name: 'Backend' }],
    });
    const [userChosen, generated] = res.body.subtasks;
    expect(userChosen).toMatchObject({ skillsGenerated: false, skills: [{ name: 'Frontend' }] });
    expect(generated).toMatchObject({ skillsGenerated: true, skills: [{ name: 'Backend' }] });
  });

  it('rejects unknown skill ids before calling the LLM', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'Parent', subtasks: [{ title: 'Child', skillIds: [999] }] });

    expect(res.status).toBe(400);
    expect(mockedIdentifySkills).not.toHaveBeenCalled();
  });

  it('does not call the LLM when every task has skills', async () => {
    await request(app).post('/api/tasks').send({ title: 'Login form', skillIds: [1] });

    expect(mockedIdentifySkills).not.toHaveBeenCalled();
  });

  it('still creates the task if the LLM fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockedIdentifySkills.mockRejectedValueOnce(new Error('quota exceeded'));

    const res = await request(app).post('/api/tasks').send({ title: 'Something vague' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ skills: [], skillsGenerated: false });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('parseAnswer', () => {
  const skillNames = ['Frontend', 'Backend'];

  it('returns skills in task order', () => {
    const text = JSON.stringify({
      results: [
        { task: 2, skills: ['Backend'] },
        { task: 1, skills: ['Frontend', 'Backend'] },
      ],
    });

    expect(parseAnswer(text, 2, skillNames)).toEqual([['Frontend', 'Backend'], ['Backend']]);
  });

  it('drops unknown and duplicate skills, and fills in missing tasks', () => {
    const text = JSON.stringify({ results: [{ task: 1, skills: ['Frontend', 'DevOps', 'Frontend'] }] });

    expect(parseAnswer(text, 2, skillNames)).toEqual([['Frontend'], []]);
  });

  it('throws on a reply that is not the expected JSON', () => {
    expect(() => parseAnswer('not json', 1, skillNames)).toThrow();
    expect(() => parseAnswer('{"answer": []}', 1, skillNames)).toThrow();
  });
});

describe('buildPrompt', () => {
  it('lists the allowed skills and numbers the tasks, with parent context', () => {
    const prompt = buildPrompt(
      [{ title: 'Checkout' }, { title: 'Payment API', parentTitle: 'Checkout' }],
      ['Frontend', 'Backend'],
    );

    expect(prompt).toContain('The available skills are: Frontend, Backend.');
    expect(prompt).toContain('1. "Checkout"');
    expect(prompt).toContain('2. "Payment API" (a subtask of: "Checkout")');
  });
});
