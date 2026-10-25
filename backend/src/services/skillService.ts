import { query } from '../db.ts';
import { HttpError } from '../errors.ts';
import type { Skill } from '../types.ts';

// For each skill, the sub-select gathers the developers who have it into a JSON array.
const SELECT_SKILLS = `
  SELECT s.id, s.name,
    COALESCE((
      SELECT json_agg(json_build_object('id', d.id, 'name', d.name) ORDER BY d.id)
      FROM developer_skills ds
      JOIN developers d ON d.id = ds.developer_id
      WHERE ds.skill_id = s.id
    ), '[]') AS developers
  FROM skills s`;

export async function listSkills(): Promise<Skill[]> {
  return query<Skill>(`${SELECT_SKILLS} ORDER BY s.id`);
}

export async function getSkill(id: number): Promise<Skill> {
  const [skill] = await query<Skill>(`${SELECT_SKILLS} WHERE s.id = $1`, [id]);
  if (!skill) throw new HttpError(404, `Skill ${id} not found`);
  return skill;
}
