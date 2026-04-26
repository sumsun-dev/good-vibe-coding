/**
 * cost 핸들러 (gv-budget-*) E2E 테스트.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdir, rm } from 'fs/promises';
import { resolve } from 'path';

const CLI_PATH = resolve('scripts/cli.js');
const TMP_DIR = resolve('.tmp-test-cost-handler');

beforeEach(async () => {
  await rm(TMP_DIR, { recursive: true, force: true });
  await mkdir(TMP_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TMP_DIR, { recursive: true, force: true });
});

function exec(command, input) {
  return JSON.parse(
    execSync(`node ${CLI_PATH} ${command}`, {
      input: input !== undefined ? JSON.stringify(input) : '',
      encoding: 'utf-8',
      timeout: 10_000,
      env: { ...process.env, GOOD_VIBE_BASE_DIR: TMP_DIR },
    }),
  );
}

function execRaw(command, input) {
  try {
    const stdout = execSync(`node ${CLI_PATH} ${command}`, {
      input: input !== undefined ? JSON.stringify(input) : '',
      encoding: 'utf-8',
      timeout: 10_000,
      env: { ...process.env, GOOD_VIBE_BASE_DIR: TMP_DIR },
    });
    return { exitCode: 0, stdout, stderr: '' };
  } catch (err) {
    return { exitCode: err.status, stdout: '', stderr: err.stderr || '' };
  }
}

describe('handlers/cost — gv-budget-*', () => {
  it('초기 상태 → 빈 임계', () => {
    const r = exec('gv-budget-get');
    expect(r.maxCostUsd).toBeNull();
    expect(r.maxTokens).toBeNull();
  });

  it('gv-budget-set + gv-budget-get 왕복', () => {
    const setR = exec('gv-budget-set', { maxCostUsd: 10, maxTokens: 100000 });
    expect(setR.success).toBe(true);
    expect(setR.current.maxCostUsd).toBe(10);
    const getR = exec('gv-budget-get');
    expect(getR.maxCostUsd).toBe(10);
    expect(getR.maxTokens).toBe(100000);
  });

  it('null 전달로 개별 해제', () => {
    exec('gv-budget-set', { maxCostUsd: 10, maxTokens: 100000 });
    const setR = exec('gv-budget-set', { maxCostUsd: null });
    expect(setR.current.maxCostUsd).toBeNull();
    expect(setR.current.maxTokens).toBe(100000);
  });

  it('gv-budget-clear → 두 임계 모두 null', () => {
    exec('gv-budget-set', { maxCostUsd: 10, maxTokens: 100000 });
    const clearR = exec('gv-budget-clear');
    expect(clearR.current.maxCostUsd).toBeNull();
    expect(clearR.current.maxTokens).toBeNull();
  });

  it('빈 set 입력 → INPUT_ERROR (exit 2)', () => {
    const r = execRaw('gv-budget-set', {});
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/하나 이상/);
  });

  it('음수 → INPUT_ERROR', () => {
    const r = execRaw('gv-budget-set', { maxCostUsd: -1 });
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/0 이상/);
  });
});
