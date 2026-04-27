/**
 * agent-performance — 6개 학습 신호 추출 + 가중치 통합 점수 단위 테스트
 */
import { describe, it, expect } from 'vitest';
import {
  extractQualitySignal,
  extractTimeSignal,
  extractCostSignal,
  extractRetrySignal,
  extractEscalationSignal,
  extractContributionSignal,
  extractAllSignals,
  computeAggregateScore,
  DEFAULT_SIGNAL_WEIGHTS,
} from '../scripts/lib/agent/agent-performance.js';

describe('extractQualitySignal', () => {
  it('critical 1개당 3점, important 1개당 1점을 누적한다', () => {
    const performance = {
      issues: [
        { severity: 'critical' },
        { severity: 'critical' },
        { severity: 'important' },
        { severity: 'minor' }, // 무시
      ],
    };
    expect(extractQualitySignal(performance)).toBe(3 * 2 + 1);
  });

  it('이슈가 없으면 0', () => {
    expect(extractQualitySignal({})).toBe(0);
    expect(extractQualitySignal({ issues: [] })).toBe(0);
    expect(extractQualitySignal(null)).toBe(0);
  });

  it('severity 누락 이슈는 무시한다', () => {
    expect(extractQualitySignal({ issues: [{ description: 'x' }] })).toBe(0);
  });
});

describe('extractTimeSignal', () => {
  it('phase-completion 이벤트 첫/마지막 timestamp 차이를 ms로 반환', () => {
    const project = {
      executionState: {
        journal: [
          { type: 'phase-completion', timestamp: 1000 },
          { type: 'agent-call', timestamp: 1500 },
          { type: 'phase-completion', timestamp: 5000 },
        ],
      },
    };
    expect(extractTimeSignal(project)).toBe(4000);
  });

  it('phase-completion이 2개 미만이면 0', () => {
    expect(extractTimeSignal({})).toBe(0);
    expect(
      extractTimeSignal({
        executionState: { journal: [{ type: 'phase-completion', timestamp: 100 }] },
      }),
    ).toBe(0);
  });

  it('timestamp 없는 entry는 무시', () => {
    const project = {
      executionState: {
        journal: [{ type: 'phase-completion' }, { type: 'phase-completion', timestamp: 2000 }],
      },
    };
    expect(extractTimeSignal(project)).toBe(0);
  });
});

describe('extractCostSignal', () => {
  it('project.metrics.totalCost를 그대로 반환', () => {
    expect(extractCostSignal({ metrics: { totalCost: 1.23 } })).toBe(1.23);
  });

  it('값 없으면 0', () => {
    expect(extractCostSignal({})).toBe(0);
    expect(extractCostSignal(null)).toBe(0);
  });

  it('음수 값은 0으로 정규화', () => {
    expect(extractCostSignal({ metrics: { totalCost: -1 } })).toBe(0);
  });

  it('비-숫자 값은 0', () => {
    expect(extractCostSignal({ metrics: { totalCost: '5' } })).toBe(0);
  });
});

describe('extractRetrySignal', () => {
  it('phase-completion entry의 fixAttempts 합계', () => {
    const project = {
      executionState: {
        journal: [
          { type: 'phase-completion', fixAttempts: 1 },
          { type: 'phase-completion', fixAttempts: 0 },
          { type: 'phase-completion', fixAttempts: 2 },
          { type: 'agent-call', fixAttempts: 99 }, // 무시
        ],
      },
    };
    expect(extractRetrySignal(project)).toBe(3);
  });

  it('journal 없으면 0', () => {
    expect(extractRetrySignal({})).toBe(0);
  });
});

describe('extractEscalationSignal', () => {
  it("graph-transition 중 toState === 'escalating' 횟수", () => {
    const project = {
      executionState: {
        journal: [
          { type: 'graph-transition', toState: 'fixing' },
          { type: 'graph-transition', toState: 'escalating' },
          { type: 'graph-transition', toState: 'escalating' },
          { type: 'graph-transition', toState: 'reviewing' },
        ],
      },
    };
    expect(extractEscalationSignal(project)).toBe(2);
  });

  it('escalating 진입이 없으면 0', () => {
    expect(extractEscalationSignal({})).toBe(0);
  });
});

describe('extractContributionSignal', () => {
  it('유니크 이슈 description / 전체 이슈 비율', () => {
    const performance = {
      reviews: [
        { issues: [{ description: 'XSS' }, { description: 'SQL injection' }] },
        { issues: [{ description: 'XSS' }] }, // 중복
      ],
    };
    expect(extractContributionSignal(performance)).toBeCloseTo(2 / 3);
  });

  it('이슈가 없으면 0', () => {
    expect(extractContributionSignal({})).toBe(0);
    expect(extractContributionSignal({ reviews: [{ issues: [] }] })).toBe(0);
  });

  it('빈 description은 유니크에서 제외', () => {
    const performance = {
      reviews: [{ issues: [{ description: '' }, { description: 'real' }] }],
    };
    // unique = {'real'} (1개), allIssues = 2개 → 0.5
    expect(extractContributionSignal(performance)).toBe(0.5);
  });
});

describe('extractAllSignals', () => {
  it('6개 신호를 한 번에 추출한다', () => {
    const project = {
      metrics: { totalCost: 0.5 },
      executionState: {
        journal: [
          { type: 'phase-completion', timestamp: 1000, fixAttempts: 1 },
          { type: 'phase-completion', timestamp: 3000, fixAttempts: 0 },
          { type: 'graph-transition', toState: 'escalating' },
        ],
      },
    };
    const performance = {
      issues: [{ severity: 'critical' }, { severity: 'important' }],
      reviews: [{ issues: [{ description: 'XSS' }] }],
    };
    const signals = extractAllSignals(project, performance);

    expect(signals).toEqual({
      quality: 4,
      time: 2000,
      cost: 0.5,
      retry: 1,
      escalation: 1,
      contribution: 1,
    });
  });
});

describe('computeAggregateScore', () => {
  it('페널티 신호는 음수로, 기여는 양수로 합산', () => {
    const signals = {
      quality: 4,
      time: 2000,
      cost: 0.5,
      retry: 1,
      escalation: 1,
      contribution: 1,
    };
    const score = computeAggregateScore(signals);
    // -4*1 - 2000*0.001 - 0.5*1 - 1*0.5 - 1*2 + 1*5
    //  = -4 - 2 - 0.5 - 0.5 - 2 + 5 = -4
    expect(score).toBeCloseTo(-4);
  });

  it('가중치 override가 적용된다', () => {
    const signals = {
      quality: 1,
      time: 0,
      cost: 0,
      retry: 0,
      escalation: 0,
      contribution: 0,
    };
    const score = computeAggregateScore(signals, { quality: 10 });
    expect(score).toBe(-10);
  });

  it('동일 신호에서는 점수 동일', () => {
    const a = extractAllSignals({}, {});
    const b = extractAllSignals({}, {});
    expect(computeAggregateScore(a)).toBe(computeAggregateScore(b));
  });

  it('quality가 더 낮은(좋은) 후보가 더 높은 점수를 받는다 (shadow 비교 시나리오)', () => {
    const baseline = { quality: 5, time: 0, cost: 0, retry: 0, escalation: 0, contribution: 0 };
    const candidate = { quality: 2, time: 0, cost: 0, retry: 0, escalation: 0, contribution: 0 };
    expect(computeAggregateScore(candidate)).toBeGreaterThan(computeAggregateScore(baseline));
  });
});

describe('DEFAULT_SIGNAL_WEIGHTS', () => {
  it('frozen 객체로 외부 변경을 차단한다', () => {
    expect(Object.isFrozen(DEFAULT_SIGNAL_WEIGHTS)).toBe(true);
  });

  it('6개 신호 모두 가중치가 정의되어 있다', () => {
    expect(DEFAULT_SIGNAL_WEIGHTS).toMatchObject({
      quality: expect.any(Number),
      time: expect.any(Number),
      cost: expect.any(Number),
      retry: expect.any(Number),
      escalation: expect.any(Number),
      contribution: expect.any(Number),
    });
  });
});
