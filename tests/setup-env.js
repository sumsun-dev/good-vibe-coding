/**
 * Vitest 글로벌 setup — 테스트가 실제 사용자 데이터에 쓰지 않도록 격리
 */
import { tmpdir } from 'os';
import { resolve } from 'path';
import { mkdirSync, rmSync } from 'fs';

const TEST_BASE_DIR = resolve(tmpdir(), 'good-vibe-test-global');

export function setup() {
  mkdirSync(TEST_BASE_DIR, { recursive: true });
  process.env.GOOD_VIBE_BASE_DIR = TEST_BASE_DIR;
}

export function teardown() {
  rmSync(TEST_BASE_DIR, { recursive: true, force: true });
  delete process.env.GOOD_VIBE_BASE_DIR;
}
