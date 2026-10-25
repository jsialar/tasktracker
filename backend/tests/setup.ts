import { readdirSync, readFileSync } from 'node:fs';
import { afterAll, beforeEach, vi } from 'vitest';
import { pool } from '../src/db.ts';

// Tests never call the real LLM. By default it identifies no skills; a test can
// change that with vi.mocked(identifySkills).mockResolvedValueOnce(...).
// The module's other functions (buildPrompt, parseAnswer) stay real.
vi.mock('../src/llm/skillIdentifier.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/llm/skillIdentifier.ts')>()),
  identifySkills: vi.fn(async (tasks: unknown[]) => tasks.map(() => [])),
}));

// The same SQL files the real database is built from (../../db/*.sql)
const dbFolder = new URL('../../db/', import.meta.url);
const sqlFiles = readdirSync(dbFolder)
  .filter((file) => file.endsWith('.sql'))
  .sort();

// Rebuild the schema and seed data before every test, so tests cannot affect each other.
beforeEach(async () => {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  for (const file of sqlFiles) {
    await pool.query(readFileSync(new URL(file, dbFolder), 'utf8'));
  }
});

afterAll(async () => {
  await pool.end();
});
