import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';

config({ path: '.env.test', override: true });

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/setup/globalSetup.ts'],
    fileParallelism: false,
    dangerouslyForceExit: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/workers/*.ts', 'src/db/pool.ts'],
    },
  },
});
