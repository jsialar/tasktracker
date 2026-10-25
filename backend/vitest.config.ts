import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './tests/testDatabase.ts';

export default defineConfig({
  test: {
    globalSetup: './tests/globalSetup.ts',
    setupFiles: ['./tests/setup.ts'],
    // All test files share one database, so run them one at a time
    fileParallelism: false,
    clearMocks: true, // forget recorded mock calls between tests
    env: { DATABASE_URL: TEST_DATABASE_URL },
  },
});
