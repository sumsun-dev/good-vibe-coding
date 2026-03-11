import { defineConfig } from 'vitest/config';
import { tmpdir } from 'os';
import { resolve } from 'path';

const TEST_BASE_DIR = resolve(tmpdir(), 'good-vibe-test-global');

export default defineConfig({
  test: {
    globalSetup: ['tests/setup-env.js'],
    env: {
      GOOD_VIBE_BASE_DIR: TEST_BASE_DIR,
    },
    coverage: {
      provider: 'v8',
      include: ['scripts/lib/**/*.js', 'src/**/*.js'],
      thresholds: { lines: 95, functions: 90, statements: 95, branches: 85, check: true },
      reporter: ['text', 'text-summary'],
    },
  },
});
