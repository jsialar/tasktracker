import { query } from '../db.ts';
import { HttpError } from '../errors.ts';
import type { Developer } from '../types.ts';

// For each developer, the sub-selects gather their skills and assigned tasks into JSON arrays.
const SELECT_DEVELOPERS = `
  SELECT d.id, d.name,
    COALESCE((
      SELECT json_agg(json_build_object('id', s.id, 'name', s.name) ORDER BY s.id)
      FROM developer_skills ds
      JOIN skills s ON s.id = ds.skill_id
      WHERE ds.developer_id = d.id
    ), '[]') AS skills,
    COALESCE((
      SELECT json_agg(json_build_object('id', t.id, 'title', t.title, 'status', t.status) ORDER BY t.id)
      FROM tasks t
      WHERE t.assignee_id = d.id
    ), '[]') AS tasks
  FROM developers d`;

export async function listDevelopers(): Promise<Developer[]> {
  return query<Developer>(`${SELECT_DEVELOPERS} ORDER BY d.id`);
}

export async function getDeveloper(id: number): Promise<Developer> {
  const [developer] = await query<Developer>(`${SELECT_DEVELOPERS} WHERE d.id = $1`, [id]);
  if (!developer) throw new HttpError(404, `Developer ${id} not found`);
  return developer;
}
