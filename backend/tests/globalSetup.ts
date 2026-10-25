import pg from 'pg';
import { TEST_DATABASE_URL } from './testDatabase.ts';

/** Runs once before all tests: creates the test database if it does not exist yet. */
export default async function createTestDatabase() {
  const url = new URL(TEST_DATABASE_URL);
  const databaseName = url.pathname.slice(1);
  url.pathname = '/postgres'; // connect to the default database to run CREATE DATABASE

  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
    databaseName,
  ]);
  if (existing.rows.length === 0) {
    await client.query(`CREATE DATABASE "${databaseName}"`);
  }
  await client.end();
}
