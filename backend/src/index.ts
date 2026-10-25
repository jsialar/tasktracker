import { app } from './app.ts';

const port = Number(process.env.PORT ?? 3000);

if (!process.env.GEMINI_API_KEY) {
  console.warn(
    'GEMINI_API_KEY is not set: tasks created without skills will be saved without them.',
  );
}

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
