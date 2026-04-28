/**
 * dispatch 핸들러 (gv-dispatch) E2E 테스트.
 * 이슈 #247 AC: 5개 task 유형 정확 매핑, modify downgrade, 빈 입력 안전.
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { resolve } from 'path';

const CLI_PATH = resolve('scripts/cli.js');

function cliExec(command, input) {
  return JSON.parse(
    execSync(`node ${CLI_PATH} ${command}`, {
      input: JSON.stringify(input),
      encoding: 'utf-8',
      timeout: 10_000,
    }),
  );
}

describe('handlers/dispatch — gv-dispatch', () => {
  describe('우선순위 카테고리 (status/resume/modify)', () => {
    it('"상태 보여줘" → status', () => {
      const r = cliExec('gv-dispatch', { input: '상태 보여줘', hasProject: true });
      expect(r.category).toBe('status');
      expect(r.nextActions).toBeInstanceOf(Array);
      expect(r.nextActions.join(' ')).toMatch(/status/i);
    });

    it('"이어서 진행해줘" → resume', () => {
      const r = cliExec('gv-dispatch', { input: '이어서 진행해줘', hasProject: true });
      expect(r.category).toBe('resume');
      expect(r.nextActions.join(' ')).toMatch(/execute|재개/i);
    });

    it('"수정해줘" + hasProject=true → modify', () => {
      const r = cliExec('gv-dispatch', { input: '수정해줘', hasProject: true });
      expect(r.category).toBe('modify');
      expect(r.nextActions.join(' ')).toMatch(/modify|수정/i);
    });

    it('"수정해줘" + hasProject=false → task로 downgrade', () => {
      const r = cliExec('gv-dispatch', { input: '수정해줘', hasProject: false });
      expect(r.category).toBe('task');
      expect(r.taskRoute).toBeDefined();
    });
  });

  describe('task 카테고리 — 5개 작업 유형 매핑', () => {
    it.each([
      ['이 PR 리뷰해줘', 'review'],
      ['결제 시스템 구현해줘', 'code'],
      ['BullMQ vs Temporal 비교해줘', 'research'],
      ['이 코드베이스에서 인증은 어떻게 동작해?', 'ask'],
      ['마이크로서비스 SaaS 플랫폼 만들고 싶어', 'plan'],
    ])('"%s" → task + %s', (input, expectedTaskType) => {
      const r = cliExec('gv-dispatch', { input, hasProject: false });
      expect(r.category).toBe('task');
      expect(r.taskRoute.taskType).toBe(expectedTaskType);
      expect(r.nextActions).toBeInstanceOf(Array);
      expect(r.nextActions.length).toBeGreaterThan(0);
    });
  });

  describe('빈 입력 / 잘못된 입력', () => {
    it('빈 input → task + escalate', () => {
      const r = cliExec('gv-dispatch', { input: '', hasProject: false });
      expect(r.category).toBe('task');
      expect(r.taskRoute.escalateForConfirm).toBe(true);
    });

    it('input 누락 → task + escalate', () => {
      const r = cliExec('gv-dispatch', { hasProject: false });
      expect(r.category).toBe('task');
      expect(r.taskRoute.escalateForConfirm).toBe(true);
    });
  });

  describe('출력 스키마', () => {
    it('category + nextActions 필수', () => {
      const r = cliExec('gv-dispatch', { input: '상태 보여줘' });
      expect(r).toMatchObject({
        category: expect.any(String),
        nextActions: expect.any(Array),
      });
    });

    it('task 카테고리에서만 taskRoute 존재', () => {
      const taskResult = cliExec('gv-dispatch', { input: '이 PR 리뷰', hasProject: false });
      expect(taskResult.taskRoute).toBeDefined();
      const statusResult = cliExec('gv-dispatch', { input: '상태 보여줘', hasProject: false });
      expect(statusResult.taskRoute).toBeNull();
    });
  });

  describe('needsProjectSetup 플래그 (코드 task + 프로젝트 없음)', () => {
    it('코드 task + hasProject=false → needsProjectSetup=true + /gv-init 안내', () => {
      const r = cliExec('gv-dispatch', { input: '결제 시스템 구현해줘', hasProject: false });
      expect(r.category).toBe('task');
      expect(r.taskRoute.taskType).toBe('code');
      expect(r.needsProjectSetup).toBe(true);
      expect(r.nextActions.join(' ')).toMatch(/gv-init/);
    });

    it('코드 task + hasProject=true → needsProjectSetup=false', () => {
      const r = cliExec('gv-dispatch', { input: '결제 시스템 구현해줘', hasProject: true });
      expect(r.needsProjectSetup).toBe(false);
      expect(r.nextActions.join(' ')).not.toMatch(/gv-init/);
    });

    it('research task → needsProjectSetup=false (코드/기획 아님)', () => {
      const r = cliExec('gv-dispatch', { input: 'BullMQ vs Temporal 비교', hasProject: false });
      expect(r.taskRoute.taskType).toBe('research');
      expect(r.needsProjectSetup).toBe(false);
    });

    it('plan task + hasProject=false → needsProjectSetup=true (대형 기획도 신규 프로젝트)', () => {
      const r = cliExec('gv-dispatch', {
        input: '마이크로서비스 SaaS 플랫폼 만들고 싶어',
        hasProject: false,
      });
      expect(r.taskRoute.taskType).toBe('plan');
      expect(r.needsProjectSetup).toBe(true);
      expect(r.nextActions.join(' ')).toMatch(/gv-init/);
    });

    it('escalate 입력 → needsProjectSetup=false (모호하므로 setup 권유 안 함)', () => {
      const r = cliExec('gv-dispatch', { input: '', hasProject: false });
      expect(r.taskRoute.escalateForConfirm).toBe(true);
      expect(r.needsProjectSetup).toBe(false);
    });
  });
});
