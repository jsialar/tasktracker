import { Router } from 'express';
import { getDeveloper, listDevelopers } from '../services/developerService.ts';
import { parseId } from '../validation.ts';

export const developersRouter = Router();

developersRouter.get('/', async (req, res) => {
  res.json(await listDevelopers());
});

developersRouter.get('/:id', async (req, res) => {
  res.json(await getDeveloper(parseId(req.params.id)));
});
