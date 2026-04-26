/**
 * buildCodeActions 단위 테스트 (Phase B-4c).
 * happy path 5개 state LLM 통합. fixing/escalating은 placeholder 유지.
 */

import { describe, it, expect, vi } from 'vitest';
import { buildCodeActions, defaultActions } from '../scripts/lib/engine/task-graph-actions.js';
import { runGraph } from '../scripts/lib/engine/task-graph-runner.js';

// 매 테스트마다 새 객체 — fixing action이 ctx.fixAttempt를 mutate하므로 공유 금지
function makeCodeRoute(extra = {}) {
  return { taskType: 'code', intent: 'feature', input: '결제 시스템 추가해줘', ...extra };
}

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
      const r = await runGraph(makeCodeRoute(), { actions: buildCodeActions({ callLLM }) });
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
      const r = await runGraph(makeCodeRoute(), { actions: buildCodeActions({ callLLM }) });
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
      const r = await runGraph(makeCodeRoute(), { actions: buildCodeActions({ callLLM }) });
      // reviewing → fixing → GIVE_UP → failed
      expect(r.finalState).toBe('failed');
      const reviewingStep = r.history.find((h) => h.state === 'reviewing');
      expect(reviewingStep.event).toBe('FAIL');
      const fixingStep = r.history.find((h) => h.state === 'fixing');
      expect(fixingStep).toBeDefined();
    });
  });

  describe('LLM 실패 → FAIL event', () => {
    // reviewing은 B-4c-2 fix-loop가 회복하므로 별도 검증.
    it.each(['analyzing-side-impact', 'executing', 'materializing', 'committing'])(
      '%s 단계 LLM 실패 → 그래프 failed',
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
        const r = await runGraph(makeCodeRoute(), { actions: buildCodeActions({ callLLM }) });
        expect(r.success).toBe(false);
        const hasError = r.history.some((h) => h.output?.error?.includes('실패'));
        expect(hasError).toBe(true);
      },
    );

    it('reviewing LLM 실패는 fix-loop로 회복 가능 (FAIL이지만 다음 reviewing이 PASS면 done)', async () => {
      let reviewCalls = 0;
      const callLLM = vi.fn(async (provider, prompt) => {
        if (prompt.includes('보안/성능/회귀')) {
          reviewCalls++;
          if (reviewCalls === 1) throw new Error('reviewing 일시 실패');
          return { text: '[VERDICT: PASS]', model: 'mock' };
        }
        return { text: 'mock', model: 'mock' };
      });
      // reviewing FAIL → fixing → reviewing 재진입 → PASS → done
      const r = await runGraph(makeCodeRoute(), { actions: buildCodeActions({ callLLM }) });
      expect(r.success).toBe(true);
    });
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
      await runGraph(makeCodeRoute(), { actions });
      const executePrompt = callLLM.mock.calls[1][1];
      expect(executePrompt).toContain('영향 분석');
    });

    it('materialize prompt에 작성 코드 포함', async () => {
      const callLLM = vi.fn(async (provider, prompt) => {
        if (prompt.includes('보안/성능/회귀')) return { text: '[VERDICT: PASS]', model: 'mock' };
        return { text: 'mock', model: 'mock' };
      });
      const actions = buildCodeActions({ callLLM });
      await runGraph(makeCodeRoute(), { actions });
      const materializePrompt = callLLM.mock.calls[2][1];
      expect(materializePrompt).toContain('작성된 코드');
    });
  });

  describe('B-4c-2: fix-loop + escalating', () => {
    it('FAIL → fixing(LLM) → reviewing 재진입 → 두 번째 시도 PASS → done', async () => {
      let reviewCallCount = 0;
      const callLLM = vi.fn(async (provider, prompt) => {
        if (prompt.includes('보안/성능/회귀')) {
          reviewCallCount++;
          // 첫 리뷰는 FAIL, 두 번째는 PASS
          return {
            text: reviewCallCount === 1 ? '결함...[VERDICT: FAIL]' : '통과...[VERDICT: PASS]',
            model: 'mock',
          };
        }
        if (prompt.includes('이전 코드')) {
          return { text: '```js\n// fixed\n```', model: 'mock' };
        }
        return { text: 'mock', model: 'mock' };
      });
      const r = await runGraph(makeCodeRoute(), { actions: buildCodeActions({ callLLM }) });
      expect(r.success).toBe(true);
      // 두 번째 reviewing이 PASS → committing → done
      expect(reviewCallCount).toBeGreaterThanOrEqual(2);
    });

    it('fixAttempt가 max 도달 → fixing이 ESCALATE → escalating', async () => {
      const callLLM = vi.fn(async (provider, prompt) => {
        if (prompt.includes('보안/성능/회귀')) {
          return { text: '[VERDICT: FAIL]', model: 'mock' };
        }
        if (prompt.includes('CONTINUE') || prompt.includes('SKIP') || prompt.includes('ABORT')) {
          return { text: '[ABORT]', model: 'mock' };
        }
        return { text: 'mock', model: 'mock' };
      });
      const route = { ...makeCodeRoute(), fixAttempt: 1, maxFixAttempts: 2 }; // 다음 fixing이 max
      const r = await runGraph(route, { actions: buildCodeActions({ callLLM }) });
      // fixing → ESCALATE → escalating → ABORT → failed
      const escalatingStep = r.history.find((h) => h.state === 'escalating');
      expect(escalatingStep).toBeDefined();
      expect(r.finalState).toBe('failed');
    });

    it('escalating SKIP 결정 → committing → done', async () => {
      const callLLM = vi.fn(async (provider, prompt) => {
        if (prompt.includes('보안/성능/회귀')) {
          return { text: '[VERDICT: FAIL]', model: 'mock' };
        }
        if (prompt.includes('CONTINUE') || prompt.includes('SKIP') || prompt.includes('ABORT')) {
          return { text: '경미한 이슈만 남음 [SKIP]', model: 'mock' };
        }
        return { text: 'mock', model: 'mock' };
      });
      const route = { ...makeCodeRoute(), fixAttempt: 1, maxFixAttempts: 2 };
      const r = await runGraph(route, { actions: buildCodeActions({ callLLM }) });
      // escalating → SKIP → committing → done
      expect(r.finalState).toBe('done');
      const escalatingStep = r.history.find((h) => h.state === 'escalating');
      expect(escalatingStep.output.decision).toBe('SKIP');
    });

    it('fixing LLM 실패 → FAIL', async () => {
      const callLLM = vi.fn(async (provider, prompt) => {
        if (prompt.includes('보안/성능/회귀')) {
          return { text: '[VERDICT: FAIL]', model: 'mock' };
        }
        if (prompt.includes('이전 코드')) {
          throw new Error('fix LLM 실패');
        }
        return { text: 'mock', model: 'mock' };
      });
      const r = await runGraph(makeCodeRoute(), { actions: buildCodeActions({ callLLM }) });
      expect(r.success).toBe(false);
      const fixingStep = r.history.find((h) => h.state === 'fixing');
      expect(fixingStep.output?.error).toMatch(/fix LLM 실패/);
    });

    it('escalating LLM 실패 → ABORT (안전)', async () => {
      const callLLM = vi.fn(async (provider, prompt) => {
        if (prompt.includes('보안/성능/회귀')) return { text: '[VERDICT: FAIL]', model: 'mock' };
        if (prompt.includes('CONTINUE')) {
          throw new Error('escalation LLM 실패');
        }
        return { text: 'mock', model: 'mock' };
      });
      const route = { ...makeCodeRoute(), fixAttempt: 1, maxFixAttempts: 2 };
      const r = await runGraph(route, { actions: buildCodeActions({ callLLM }) });
      expect(r.finalState).toBe('failed');
    });
  });

  describe('defaultActions(code, options)', () => {
    it('useLLM=true → buildCodeActions', async () => {
      const callLLM = mockLLM('[VERDICT: PASS]');
      const actions = defaultActions('code', { callLLM });
      // 위 mock은 모든 호출에 [VERDICT: PASS] 반환 → reviewing PASS
      const r = await runGraph(makeCodeRoute(), { actions });
      expect(r.success).toBe(true);
    });

    it('options 미주입 → placeholder (회귀)', () => {
      const a = defaultActions('code');
      // placeholder는 시그니처가 다름 (단순 동기 placeholder fn)
      expect(typeof a.executing).toBe('function');
    });
  });
});
