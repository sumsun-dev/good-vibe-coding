/**
 * gv-execute 핸들러 E2E 테스트.
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { resolve } from 'path';

const CLI_PATH = resolve('scripts/cli.js');

function exec(command, input) {
  return JSON.parse(
    execSync(`node ${CLI_PATH} ${command}`, {
      input: JSON.stringify(input),
      encoding: 'utf-8',
      timeout: 10_000,
    }),
  );
}

function execRaw(command, input) {
  try {
    const stdout = execSync(`node ${CLI_PATH} ${command}`, {
      input: input !== undefined ? JSON.stringify(input) : '',
      encoding: 'utf-8',
      timeout: 10_000,
    });
    return { exitCode: 0, stdout, stderr: '' };
  } catch (err) {
    return { exitCode: err.status, stdout: '', stderr: err.stderr || '' };
  }
}

describe('handlers/gv-execute — E2E', () => {
  describe('5개 작업 유형 happy path (placeholder action)', () => {
    it.each(['ask', 'review', 'research', 'code', 'plan'])('%s', (taskType) => {
      const r = exec('gv-execute', { taskRoute: { taskType } });
      expect(r.success).toBe(true);
      expect(r.finalState).toBe('done');
      expect(r.steps).toBeGreaterThan(0);
      expect(r.panel).toMatch(/⚙️|done/); // 패널 markdown 포함
    });
  });

  describe('잘못된 입력', () => {
    it('taskRoute 누락 → INPUT_ERROR (exit 2)', () => {
      const r = execRaw('gv-execute', {});
      expect(r.exitCode).toBe(2);
      expect(r.stderr).toMatch(/taskRoute/);
    });

    it('taskType 없는 taskRoute → INPUT_ERROR', () => {
      const r = execRaw('gv-execute', { taskRoute: {} });
      expect(r.exitCode).toBe(2);
    });
  });

  describe('출력 스키마', () => {
    it('필수 필드 모두 반환', () => {
      const r = exec('gv-execute', { taskRoute: { taskType: 'ask' } });
      expect(r).toMatchObject({
        success: expect.any(Boolean),
        finalState: expect.any(String),
        steps: expect.any(Number),
        history: expect.any(Array),
        panel: expect.any(String),
      });
    });
  });

  describe('자가발전 자동 평가 (evaluateOnComplete)', () => {
    it('기본은 평가 안 함 → completionSummary=null', () => {
      const r = exec('gv-execute', { taskRoute: { taskType: 'ask' } });
      expect(r.completionSummary).toBeNull();
      expect(r.evaluationError).toBeNull();
    });

    it('evaluateOnComplete=true이지만 projectId 없으면 평가 생략', () => {
      const r = exec('gv-execute', {
        taskRoute: { taskType: 'ask' },
        evaluateOnComplete: true,
      });
      expect(r.completionSummary).toBeNull();
      expect(r.evaluationError).toBeNull();
    });

    it('evaluateOnComplete=true + 존재하지 않는 projectId → evaluationError', () => {
      const r = exec('gv-execute', {
        taskRoute: { taskType: 'ask' },
        evaluateOnComplete: true,
        projectId: 'nonexistent-project-id-for-test',
      });
      expect(r.completionSummary).toBeNull();
      expect(r.evaluationError).toMatch(/not found|nonexistent/i);
    });
  });
});
