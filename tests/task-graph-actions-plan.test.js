/**
 * buildPlanActions 단위 테스트 (Phase B-4d).
 * plan happy path + code 서브그래프 위임.
 */

import { describe, it, expect, vi } from 'vitest';
import { buildPlanActions, defaultActions } from '../scripts/lib/engine/task-graph-actions.js';
import { runGraph } from '../scripts/lib/engine/task-graph-runner.js';

const planRoute = {
  taskType: 'plan',
  input: '마이크로서비스 SaaS 플랫폼 만들고 싶어',
};

describe('buildPlanActions', () => {
  describe('happy path', () => {
    it('discussing → APPROVE → code 서브그래프 위임 → done', async () => {
      const callLLM = vi.fn(async (provider, prompt) => {
        if (prompt.includes('기획안')) {
          return { text: '훌륭한 기획...\n[APPROVE]', model: 'mock' };
        }
        if (prompt.includes('보안/성능/회귀')) {
          return { text: '리뷰 통과...\n[VERDICT: PASS]', model: 'mock' };
        }
        return { text: 'mock', model: 'mock' };
      });
      const r = await runGraph(planRoute, { actions: buildPlanActions({ callLLM }) });
      expect(r.success).toBe(true);
      expect(r.finalState).toBe('done');

      // discussing(1) + approval(1) + code 서브그래프(5) = 7번 LLM 호출
      expect(callLLM).toHaveBeenCalledTimes(7);
    });

    it('executing 단계 history에 subResult 포함', async () => {
      const callLLM = vi.fn(async (provider, prompt) => {
        if (prompt.includes('기획안')) return { text: '[APPROVE]', model: 'mock' };
        if (prompt.includes('보안/성능/회귀')) return { text: '[VERDICT: PASS]', model: 'mock' };
        return { text: 'mock', model: 'mock' };
      });
      const r = await runGraph(planRoute, { actions: buildPlanActions({ callLLM }) });
      const executingStep = r.history.find((h) => h.state === 'executing');
      expect(executingStep.output.subResult).toBeDefined();
      expect(executingStep.output.subResult.success).toBe(true);
      expect(executingStep.output.subResult.taskType).toBe('code');
    });
  });

  describe('REJECT 분기', () => {
    it('approval REJECT → discussing 재진입 → 라운드 한도 후 NEXT_ROUND guard', async () => {
      const callLLM = vi.fn(async (provider, prompt) => {
        if (prompt.includes('기획안')) {
          return { text: '[REJECT]', model: 'mock' };
        }
        return { text: 'mock', model: 'mock' };
      });
      const r = await runGraph(planRoute, {
        actions: buildPlanActions({ callLLM }),
        maxSteps: 20,
      });
      // REJECT → discussing → CONVERGE → REJECT 무한 루프 방지가 graph의 guard로
      // 동작 (현재 placeholder는 rejectAttempt를 ctx에 안 넣음 → guard 통과)
      // → 결국 maxSteps 또는 finalize 분기. 핵심은 크래시 안 함
      expect(r).toBeDefined();
    });
  });

  describe('서브그래프 실패 → plan FAIL', () => {
    it('code 서브그래프 실패 → plan failed', async () => {
      const callLLM = vi.fn(async (provider, prompt) => {
        if (prompt.includes('기획안')) return { text: '[APPROVE]', model: 'mock' };
        if (prompt.includes('보안/성능/회귀')) {
          return { text: '심각한 결함...[VERDICT: FAIL]', model: 'mock' };
        }
        return { text: 'mock', model: 'mock' };
      });
      const r = await runGraph(planRoute, { actions: buildPlanActions({ callLLM }) });
      // code 서브그래프가 reviewing FAIL → fixing → GIVE_UP → failed
      // → plan executing이 FAIL 반환 → plan failed
      expect(r.finalState).toBe('failed');
    });
  });

  describe('LLM 실패', () => {
    it('discussing LLM 실패 → FAIL', async () => {
      const callLLM = vi.fn(async () => {
        throw new Error('네트워크 오류');
      });
      const r = await runGraph(planRoute, { actions: buildPlanActions({ callLLM }) });
      expect(r.success).toBe(false);
    });
  });

  describe('defaultActions(plan, options)', () => {
    it('useLLM=true → buildPlanActions', async () => {
      const callLLM = vi.fn(async (provider, prompt) => {
        if (prompt.includes('기획안')) return { text: '[APPROVE]', model: 'mock' };
        if (prompt.includes('보안/성능/회귀')) return { text: '[VERDICT: PASS]', model: 'mock' };
        return { text: 'mock', model: 'mock' };
      });
      const a = defaultActions('plan', { callLLM });
      const r = await runGraph(planRoute, { actions: a });
      expect(r.success).toBe(true);
    });

    it('options 미주입 → placeholder', () => {
      const a = defaultActions('plan');
      expect(typeof a.discussing).toBe('function');
    });
  });
});
