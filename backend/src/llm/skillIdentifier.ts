// Uses Google Gemini to work out which skills a task needs from its title.
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

export interface TaskToClassify {
  title: string;
  parentTitle?: string; // gives the model context for short subtask titles
}

const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
// Free-tier response times vary a lot (measured 1–17 s for the same request).
// Keep this below nginx's 60 s proxy timeout (frontend/nginx.conf).
const TIMEOUT_MS = 45_000;

/**
 * Asks Gemini which skills each task needs, in a single request.
 * Returns one list of skill names per task, in the same order as `tasks`.
 * Only names from `skillNames` are ever returned. Throws if the call fails.
 */
export async function identifySkills(
  tasks: TaskToClassify[],
  skillNames: string[],
): Promise<string[][]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: TIMEOUT_MS } });
  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
    contents: buildPrompt(tasks, skillNames),
    config: {
      temperature: 0,
      // Structured output: the model must reply with JSON matching this schema,
      // and each skill must be one of the allowed names
      responseMimeType: 'application/json',
      responseJsonSchema: {
        type: 'object',
        properties: {
          results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                task: { type: 'integer', description: 'The task number from the list' },
                skills: { type: 'array', items: { type: 'string', enum: skillNames } },
              },
              required: ['task', 'skills'],
            },
          },
        },
        required: ['results'],
      },
    },
  });

  return parseAnswer(response.text ?? '', tasks.length, skillNames);
}

export function buildPrompt(tasks: TaskToClassify[], skillNames: string[]): string {
  const taskLines = tasks.map((task, index) => {
    const context = task.parentTitle ? ` (a subtask of: "${task.parentTitle}")` : '';
    return `${index + 1}. "${task.title}"${context}`;
  });

  return [
    'You assign required developer skills to software development tasks.',
    `The available skills are: ${skillNames.join(', ')}.`,
    'For each task below, choose every skill needed to complete it, using only the available skills.',
    'A task can need one skill or several.',
    '',
    'Examples:',
    '"As a visitor, I want to see a responsive homepage so that I can easily navigate on both desktop and mobile devices." -> Frontend',
    '"As a system administrator, I want audit logs of all data access and modifications so that I can ensure compliance with data protection regulations and investigate any security incidents." -> Backend',
    '"As a logged-in user, I want to update my profile information and upload a profile picture so that my account details are accurate and personalized." -> Frontend, Backend',
    '',
    'Tasks:',
    ...taskLines,
  ].join('\n');
}

// What we expect back. The model is asked for this shape, but we still check it.
const answerSchema = z.object({
  results: z.array(z.object({ task: z.int(), skills: z.array(z.string()) })),
});

/** Turns the model's JSON reply into one list of skill names per task. */
export function parseAnswer(text: string, taskCount: number, skillNames: string[]): string[][] {
  const answer = answerSchema.parse(JSON.parse(text));

  const skillsPerTask: string[][] = [];
  for (let taskNumber = 1; taskNumber <= taskCount; taskNumber++) {
    const result = answer.results.find((r) => r.task === taskNumber);
    const names = (result?.skills ?? []).filter((name) => skillNames.includes(name));
    skillsPerTask.push([...new Set(names)]); // a Set drops duplicates
  }
  return skillsPerTask;
}
