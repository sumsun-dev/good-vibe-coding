import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['scripts/lib/**/*.js'],
      thresholds: { lines: 95, functions: 90, statements: 95, branches: 85, check: true },
      reporter: ['text', 'text-summary'],
    },
  },
});
