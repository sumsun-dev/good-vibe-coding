/**
 * buildCodeActions 단위 테스트 (Phase B-4c).
 * happy path 5개 state LLM 통합. fixing/escalating은 placeholder 유지.
 */

import { describe, it, expect, vi } from 'vitest';
import { buildCodeActions, defaultActions } from '../scripts/lib/engine/task-graph-actions.js';
import { runGraph } from '../scripts/lib/engine/task-graph-runner.js';

const codeRoute = {
  taskType: 'code',
  intent: 'feature',
  input: '결제 시스템 추가해줘',
};

function mockLLM(responseText = 'mock response') {
  return vi.fn(async () => ({ text: responseText, model: 'mock-model' }));
}

describe('buildCodeActions', () => {
  describe('happy path — 5개 LLM stage', () => {
    it('reviewing이 PASS verdict → committing → done', async () => {
      const callLLM = vi.fn(async (provider, prompt) => {
        if (prompt.includes('보안/성능/회귀')) {
          return { text: '리뷰 결과...\n[VERDICT: PASS]', model: 'mock' };
        }
        return { text: 'mock', model: 'mock' };
      });
      const r = await runGraph(codeRoute, { actions: buildCodeActions({ callLLM }) });
      expect(r.success).toBe(true);
      expect(r.finalState).toBe('done');
      // 5개 LLM 호출 (analyze/execute/materialize/review/commit)
      expect(callLLM).toHaveBeenCalledTimes(5);
    });

    it('side-impact가 SKIP 반환 시 executing 직행', async () => {
      const callLLM = vi.fn(async (provider, prompt) => {
        if (prompt.includes('영향 범위')) {
          return { text: 'SKIP — 변경 없이 진행 가능', model: 'mock' };
        }
        if (prompt.includes('보안/성능/회귀')) {
          return { text: '...[VERDICT: PASS]', model: 'mock' };
        }
        return { text: 'mock', model: 'mock' };
      });
      const r = await runGraph(codeRoute, { actions: buildCodeActions({ callLLM }) });
      expect(r.success).toBe(true);
      // 첫 번째 transition은 SKIP (동일 target executing)
      const sideImpactStep = r.history.find((h) => h.state === 'analyzing-side-impact');
      expect(sideImpactStep.event).toBe('SKIP');
    });
  });

  describe('reviewing FAIL → fixing → placeholder GIVE_UP → failed', () => {
    it('FAIL verdict → fixing → failed (placeholder GIVE_UP)', async () => {
      const callLLM = vi.fn(async (provider, prompt) => {
        if (prompt.includes('보안/성능/회귀')) {
          return { text: '심각한 결함 발견...\n[VERDICT: FAIL]', model: 'mock' };
        }
        return { text: 'mock', model: 'mock' };
      });
      const r = await runGraph(codeRoute, { actions: buildCodeActions({ callLLM }) });
      // reviewing → fixing → GIVE_UP → failed
      expect(r.finalState).toBe('failed');
      const reviewingStep = r.history.find((h) => h.state === 'reviewing');
      expect(reviewingStep.event).toBe('FAIL');
      const fixingStep = r.history.find((h) => h.state === 'fixing');
      expect(fixingStep).toBeDefined();
    });
  });

  describe('LLM 실패 → FAIL event', () => {
    it.each(['analyzing-side-impact', 'executing', 'materializing', 'reviewing', 'committing'])(
      '%s 단계 LLM 실패',
      async (failState) => {
        let calls = 0;
        const stateOrder = [
          'analyzing-side-impact',
          'executing',
          'materializing',
          'reviewing',
          'committing',
        ];
        const failIdx = stateOrder.indexOf(failState);
        const callLLM = vi.fn(async (provider, prompt) => {
          if (calls === failIdx) {
            calls++;
            throw new Error(`${failState} 실패`);
          }
          calls++;
          if (prompt.includes('보안/성능/회귀')) {
            return { text: '[VERDICT: PASS]', model: 'mock' };
          }
          return { text: 'mock', model: 'mock' };
        });
        const r = await runGraph(codeRoute, { actions: buildCodeActions({ callLLM }) });
        expect(r.success).toBe(false);
        const hasError = r.history.some((h) => h.output?.error?.includes('실패'));
        expect(hasError).toBe(true);
      },
    );
  });

  describe('각 stage 출력이 다음 stage prompt에 누적', () => {
    it('execute prompt에 side-impact 분석 포함', async () => {
      const callLLM = vi.fn(async (provider, prompt) => {
        if (prompt.includes('보안/성능/회귀')) {
          return { text: '[VERDICT: PASS]', model: 'mock' };
        }
        return { text: 'side-impact-result', model: 'mock' };
      });
      const actions = buildCodeActions({ callLLM });
      await runGraph(codeRoute, { actions });
      const executePrompt = callLLM.mock.calls[1][1];
      expect(executePrompt).toContain('영향 분석');
    });

    it('materialize prompt에 작성 코드 포함', async () => {
      const callLLM = vi.fn(async (provider, prompt) => {
        if (prompt.includes('보안/성능/회귀')) return { text: '[VERDICT: PASS]', model: 'mock' };
        return { text: 'mock', model: 'mock' };
      });
      const actions = buildCodeActions({ callLLM });
      await runGraph(codeRoute, { actions });
      const materializePrompt = callLLM.mock.calls[2][1];
      expect(materializePrompt).toContain('작성된 코드');
    });
  });

  describe('defaultActions(code, options)', () => {
    it('useLLM=true → buildCodeActions', async () => {
      const callLLM = mockLLM('[VERDICT: PASS]');
      const actions = defaultActions('code', { callLLM });
      // 위 mock은 모든 호출에 [VERDICT: PASS] 반환 → reviewing PASS
      const r = await runGraph(codeRoute, { actions });
      expect(r.success).toBe(true);
    });

    it('options 미주입 → placeholder (회귀)', () => {
      const a = defaultActions('code');
      // placeholder는 시그니처가 다름 (단순 동기 placeholder fn)
      expect(typeof a.executing).toBe('function');
    });
  });
});
