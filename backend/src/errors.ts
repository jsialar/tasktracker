import type { ErrorRequestHandler } from 'express';
import { z } from 'zod';

/** An error that should reach the client with a specific HTTP status code. */
export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Express calls this for any error thrown in a route handler and turns it
 * into a JSON response of the form `{ "error": "..." }`.
 */
export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof z.ZodError) {
    const details = error.issues
      .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
      .join('; ');
    res.status(400).json({ error: details });
    return;
  }
  // Thrown by express.json() when the request body is malformed
  if (error instanceof SyntaxError) {
    res.status(400).json({ error: 'Request body is not valid JSON' });
    return;
  }
  // Other express.json() errors (e.g. 413 body too large) say they are safe to show
  if (error.expose && typeof error.status === 'number') {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
};
