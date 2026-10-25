import { Router } from 'express';
import { getSkill, listSkills } from '../services/skillService.ts';
import { parseId } from '../validation.ts';

export const skillsRouter = Router();

skillsRouter.get('/', async (req, res) => {
  res.json(await listSkills());
});

skillsRouter.get('/:id', async (req, res) => {
  res.json(await getSkill(parseId(req.params.id)));
});
