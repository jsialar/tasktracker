import pg from 'pg';

// One shared pool of database connections, reused by every request.
export const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5433/taskdb',
});

// Without a listener, an idle connection dropping (e.g. the database restarting)
// would crash the whole server. The pool replaces broken connections by itself.
pool.on('error', (error) => {
  console.error('Idle database connection failed:', error.message);
});

/** Runs one SQL statement and returns the result rows. */
export async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await pool.query(sql, params);
  return result.rows;
}

/**
 * Runs `work` inside a database transaction: everything it does is committed
 * together, or rolled back together if it throws.
 */
export async function withTransaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let connectionBroken = false;
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      connectionBroken = true; // if even ROLLBACK fails, the connection is unusable
    }
    throw error; // re-throw the original error, not the ROLLBACK one
  } finally {
    client.release(connectionBroken); // true = close it instead of returning it to the pool
  }
}
