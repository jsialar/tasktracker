import express from 'express';
import { query } from './db.ts';
import { errorHandler } from './errors.ts';
import { developersRouter } from './routes/developers.ts';
import { skillsRouter } from './routes/skills.ts';
import { tasksRouter } from './routes/tasks.ts';

// The app is created here but started in index.ts, so tests can use it without opening a port.
export const app = express();

app.use(express.json());

// Used by the Docker health check: healthy only if the database answers too
app.get('/api/health', async (req, res) => {
  await query('SELECT 1');
  res.json({ status: 'ok' });
});
app.use('/api/skills', skillsRouter);
app.use('/api/developers', developersRouter);
app.use('/api/tasks', tasksRouter);

app.use('/api', (req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` });
});

// Must be registered last
app.use(errorHandler);
