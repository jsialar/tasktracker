import { Router } from 'express';
import { createTask, getTask, listTasks, updateTask } from '../services/taskService.ts';
import { createTaskSchema, parseId, updateTaskSchema } from '../validation.ts';

export const tasksRouter = Router();

tasksRouter.get('/', async (req, res) => {
  res.json(await listTasks());
});

tasksRouter.get('/:id', async (req, res) => {
  res.json(await getTask(parseId(req.params.id)));
});

tasksRouter.post('/', async (req, res) => {
  const input = createTaskSchema.parse(req.body);
  res.status(201).json(await createTask(input));
});

tasksRouter.patch('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const changes = updateTaskSchema.parse(req.body);
  res.json(await updateTask(id, changes));
});
