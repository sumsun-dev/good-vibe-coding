import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['scripts/lib/**/*.js'],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 75 },
      reporter: ['text', 'text-summary'],
    },
  },
});
