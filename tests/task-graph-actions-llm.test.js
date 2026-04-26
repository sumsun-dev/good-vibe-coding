/**
 * task-graph-actions LLM builder 테스트.
 * mock callLLM으로 ask/review/research 다단계 동작 검증.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  buildAskActions,
  buildReviewActions,
  buildResearchActions,
  defaultActions,
} from '../scripts/lib/engine/task-graph-actions.js';
import { runGraph } from '../scripts/lib/engine/task-graph-runner.js';

function mockLLM(responseText = 'mocked response') {
  return vi.fn(async () => ({ text: responseText, model: 'mock-model' }));
}

const askRoute = { taskType: 'ask', input: '인증 어떻게 동작해?' };
const reviewRoute = { taskType: 'review', input: '이 PR 리뷰' };
const researchRoute = { taskType: 'research', input: 'A vs B' };

describe('buildAskActions', () => {
  it('answering에서 callLLM 호출 후 COMPLETE', async () => {
    const callLLM = mockLLM('답변 내용');
    const actions = buildAskActions({ callLLM });
    const r = await actions.answering('answering', askRoute);
    expect(r.event).toBe('COMPLETE');
    expect(r.output.answer).toBe('답변 내용');
    expect(callLLM).toHaveBeenCalledOnce();
  });

  it('callLLM 실패 → FAIL event', async () => {
    const callLLM = vi.fn(async () => {
      throw new Error('LLM 실패');
    });
    const actions = buildAskActions({ callLLM });
    const r = await actions.answering('answering', askRoute);
    expect(r.event).toBe('FAIL');
    expect(r.output.error).toMatch(/LLM 실패/);
  });

  it('runGraph 통합 — 그래프가 done까지 진행', async () => {
    const callLLM = mockLLM();
    const r = await runGraph(askRoute, { actions: buildAskActions({ callLLM }) });
    expect(r.success).toBe(true);
    expect(r.finalState).toBe('done');
  });

  it('LLM 실패 시 그래프는 failed + history에 error 포함', async () => {
    const callLLM = vi.fn(async () => {
      throw new Error('네트워크 오류');
    });
    const r = await runGraph(askRoute, { actions: buildAskActions({ callLLM }) });
    expect(r.success).toBe(false);
    expect(r.finalState).toBe('failed');
    // 마지막 history 항목 또는 reason에 에러 메시지
    const hasError = r.history.some((h) => h.output?.error?.includes('네트워크 오류'));
    expect(hasError).toBe(true);
  });
});

describe('buildReviewActions', () => {
  it('3단계 LLM 호출 (fetching-diff/reviewing/synthesizing)', async () => {
    const callLLM = mockLLM('mock');
    const actions = buildReviewActions({ callLLM });
    const r = await runGraph(reviewRoute, { actions });
    expect(r.success).toBe(true);
    // 3 LLM stage + START transition (1 step) = 총 4 step
    expect(callLLM).toHaveBeenCalledTimes(3);
  });

  it('이전 stage output을 다음 stage prompt에 누적', async () => {
    const callLLM = vi.fn(async (provider, prompt) => ({
      text: `response-for-${prompt.slice(0, 20)}`,
      model: 'mock',
    }));
    const actions = buildReviewActions({ callLLM });
    await runGraph(reviewRoute, { actions });
    // 두 번째 호출(reviewing) prompt에는 첫 번째 결과(요약)가 포함되어야 함
    const reviewingCallPrompt = callLLM.mock.calls[1][1];
    expect(reviewingCallPrompt).toContain('검토 컨텍스트');
  });

  it('중간 단계 LLM 실패 → 그래프 failed', async () => {
    let calls = 0;
    const callLLM = vi.fn(async () => {
      calls++;
      if (calls === 2) throw new Error('reviewing 실패');
      return { text: 'ok', model: 'mock' };
    });
    const r = await runGraph(reviewRoute, { actions: buildReviewActions({ callLLM }) });
    expect(r.success).toBe(false);
  });
});

describe('buildResearchActions', () => {
  it('3단계 LLM 호출 (researching/cross-reviewing/synthesizing)', async () => {
    const callLLM = mockLLM();
    const r = await runGraph(researchRoute, {
      actions: buildResearchActions({ callLLM }),
    });
    expect(r.success).toBe(true);
    expect(callLLM).toHaveBeenCalledTimes(3);
  });

  it('cross-review prompt에 1차 조사 결과 포함', async () => {
    const callLLM = mockLLM('research findings');
    await runGraph(researchRoute, { actions: buildResearchActions({ callLLM }) });
    const crossPrompt = callLLM.mock.calls[1][1];
    expect(crossPrompt).toContain('1차 조사 결과');
  });
});

describe('defaultActions(taskType, options)', () => {
  it('options 미주입 → placeholder (기존 회귀)', () => {
    const a = defaultActions('ask');
    expect(typeof a.answering).toBe('function');
    // placeholder는 callLLM 의존 없이 동기 결과
  });

  it('options.callLLM 주입 → LLM 동작', async () => {
    const callLLM = mockLLM();
    const a = defaultActions('ask', { callLLM });
    const r = await a.answering('answering', askRoute);
    expect(callLLM).toHaveBeenCalled();
    expect(r.event).toBe('COMPLETE');
  });

  it('plan은 useLLM=true 시 LLM 모드 (B-4d 적용 후)', async () => {
    const callLLM = mockLLM('mock');
    const plan = defaultActions('plan', { callLLM });
    const r = await plan.discussing('discussing', { taskType: 'plan', input: 'test' });
    expect(r.event).toBe('CONVERGE');
    expect(callLLM).toHaveBeenCalled();
  });

  it('plan options 미주입 → placeholder', async () => {
    const plan = defaultActions('plan');
    const r = await plan.discussing('discussing', { taskType: 'plan' });
    expect(r.output.placeholder).toBe(true);
  });

  it('code는 B-4c 이후 useLLM=true 시 LLM 모드 진입', async () => {
    const callLLM = mockLLM('[VERDICT: PASS]');
    const code = defaultActions('code', { callLLM });
    const r = await code.executing('executing', { taskType: 'code', input: 'test' });
    expect(r.event).toBe('COMPLETE');
    expect(callLLM).toHaveBeenCalled();
  });

  it('지원하지 않는 taskType → throw', () => {
    expect(() => defaultActions('unknown')).toThrow();
  });
});
