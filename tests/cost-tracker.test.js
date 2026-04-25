import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCostTracker,
  estimateCost,
  PROVIDER_PRICING,
} from '../scripts/lib/llm/cost-tracker.js';

describe('PROVIDER_PRICING — 가격표', () => {
  it('Claude/OpenAI/Gemini 주요 모델이 정의되어 있다', () => {
    expect(PROVIDER_PRICING.claude).toBeDefined();
    expect(PROVIDER_PRICING.openai).toBeDefined();
    expect(PROVIDER_PRICING.gemini).toBeDefined();

    expect(PROVIDER_PRICING.claude['claude-sonnet-4-6']).toMatchObject({
      inputPerMillion: expect.any(Number),
      outputPerMillion: expect.any(Number),
    });
  });

  it('alias model name (sonnet/opus/haiku)도 매칭된다', () => {
    expect(PROVIDER_PRICING.claude.sonnet).toBeDefined();
    expect(PROVIDER_PRICING.claude.opus).toBeDefined();
    expect(PROVIDER_PRICING.claude.haiku).toBeDefined();
  });
});

describe('estimateCost', () => {
  it('input/output 토큰 × 가격으로 비용 계산', () => {
    const cost = estimateCost('claude', 'sonnet', {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    const pricing = PROVIDER_PRICING.claude.sonnet;
    expect(cost).toBeCloseTo(pricing.inputPerMillion + pricing.outputPerMillion, 6);
  });

  it('알 수 없는 모델은 0 반환 + warning', () => {
    const cost = estimateCost('claude', 'mystery-model', {
      inputTokens: 1000,
      outputTokens: 500,
    });
    expect(cost).toBe(0);
  });

  it('cacheReadInputTokens가 있으면 cached 가격 적용', () => {
    const cost = estimateCost('claude', 'sonnet', {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 1_000_000,
    });
    const pricing = PROVIDER_PRICING.claude.sonnet;
    if (pricing.cacheReadPerMillion !== undefined) {
      expect(cost).toBeCloseTo(pricing.cacheReadPerMillion, 6);
    }
  });

  it('cacheCreationInputTokens가 있으면 cache write 가격 적용', () => {
    const cost = estimateCost('claude', 'sonnet', {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 1_000_000,
    });
    const pricing = PROVIDER_PRICING.claude.sonnet;
    if (pricing.cacheWritePerMillion !== undefined) {
      expect(cost).toBeCloseTo(pricing.cacheWritePerMillion, 6);
    }
  });
});

describe('createCostTracker', () => {
  let tracker;
  beforeEach(() => {
    tracker = createCostTracker();
  });

  it('record + getStats 기본 사이클', () => {
    tracker.record({
      provider: 'claude',
      model: 'sonnet',
      inputTokens: 1000,
      outputTokens: 500,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
    });
    const stats = tracker.getStats();
    expect(stats.totalCalls).toBe(1);
    expect(stats.totalCost).toBeGreaterThan(0);
    expect(stats.byProvider.claude.calls).toBe(1);
    expect(stats.byProvider.claude.inputTokens).toBe(1000);
    expect(stats.byProvider.claude.outputTokens).toBe(500);
  });

  it('여러 record 누적', () => {
    for (let i = 0; i < 5; i++) {
      tracker.record({
        provider: 'claude',
        model: 'sonnet',
        inputTokens: 100,
        outputTokens: 50,
      });
    }
    const stats = tracker.getStats();
    expect(stats.totalCalls).toBe(5);
    expect(stats.byProvider.claude.inputTokens).toBe(500);
    expect(stats.byProvider.claude.outputTokens).toBe(250);
  });

  it('프로바이더/모델별 분리 기록', () => {
    tracker.record({ provider: 'claude', model: 'sonnet', inputTokens: 100, outputTokens: 50 });
    tracker.record({ provider: 'openai', model: 'gpt-4o', inputTokens: 200, outputTokens: 100 });
    const stats = tracker.getStats();
    expect(stats.byProvider.claude.calls).toBe(1);
    expect(stats.byProvider.openai.calls).toBe(1);
    expect(stats.byModel.sonnet).toBeDefined();
    expect(stats.byModel['gpt-4o']).toBeDefined();
  });

  it('budget 한도 초과 시 isOverBudget true', () => {
    const limited = createCostTracker({ budgetUsd: 0.001 });
    limited.record({
      provider: 'claude',
      model: 'opus',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    const stats = limited.getStats();
    expect(stats.isOverBudget).toBe(true);
    expect(stats.budgetRemainingUsd).toBeLessThan(0);
  });

  it('cache hit rate 추적', () => {
    tracker.record({
      provider: 'claude',
      model: 'sonnet',
      inputTokens: 1000,
      outputTokens: 500,
      cacheCreationInputTokens: 200,
      cacheReadInputTokens: 800,
    });
    const stats = tracker.getStats();
    expect(stats.cacheStats.hitTokens).toBe(800);
    expect(stats.cacheStats.creationTokens).toBe(200);
    // hit rate = read / (read + uncached input)
    expect(stats.cacheStats.hitRate).toBeCloseTo(800 / (800 + 1000), 4);
  });

  it('reset()으로 통계 초기화', () => {
    tracker.record({ provider: 'claude', model: 'sonnet', inputTokens: 100, outputTokens: 50 });
    tracker.reset();
    const stats = tracker.getStats();
    expect(stats.totalCalls).toBe(0);
    expect(stats.totalCost).toBe(0);
  });
});

describe('createCostTracker — onBudgetExceeded 콜백', () => {
  it('budget 초과 시점에 콜백이 실행된다', () => {
    let exceeded = null;
    const limited = createCostTracker({
      budgetUsd: 0.0001,
      onBudgetExceeded: (info) => {
        exceeded = info;
      },
    });
    limited.record({
      provider: 'claude',
      model: 'opus',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(exceeded).not.toBeNull();
    expect(exceeded.totalCost).toBeGreaterThan(0.0001);
    expect(exceeded.budgetUsd).toBe(0.0001);
  });

  it('budget 미초과 시 콜백 호출 안 함', () => {
    let called = false;
    const limited = createCostTracker({
      budgetUsd: 1000,
      onBudgetExceeded: () => {
        called = true;
      },
    });
    limited.record({ provider: 'claude', model: 'sonnet', inputTokens: 100, outputTokens: 50 });
    expect(called).toBe(false);
  });
});
