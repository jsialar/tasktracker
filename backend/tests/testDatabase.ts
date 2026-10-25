// Tests use their own database (on the same Postgres server) so they never touch app data.
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5433/taskdb_test';
