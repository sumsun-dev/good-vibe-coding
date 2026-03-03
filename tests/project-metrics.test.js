import { describe, it, expect } from 'vitest';
import {
  COST_RATES,
  createMetricsSnapshot,
  recordAgentCall,
  recordPhaseCompletion,
  getCostSummary,
  getAgentPerformanceSummary,
  buildMetricsDashboard,
} from '../scripts/lib/project/project-metrics.js';

// --- createMetricsSnapshot ---

describe('createMetricsSnapshot', () => {
  it('빈 메트릭스 스냅샷을 생성한다', () => {
    const snap = createMetricsSnapshot();
    expect(snap.totalInputTokens).toBe(0);
    expect(snap.totalOutputTokens).toBe(0);
    expect(snap.totalCostUsd).toBe(0);
    expect(snap.agentCalls).toEqual([]);
    expect(snap.phaseMetrics).toEqual({});
    expect(snap.byRole).toEqual({});
    expect(snap.byProvider).toEqual({});
  });
});

// --- COST_RATES ---

describe('COST_RATES', () => {
  it('3개 프로바이더 비용이 정의되어 있다', () => {
    expect(COST_RATES.claude).toBeDefined();
    expect(COST_RATES.openai).toBeDefined();
    expect(COST_RATES.gemini).toBeDefined();
  });

  it('각 프로바이더에 input/output 비용이 있다', () => {
    for (const [, rates] of Object.entries(COST_RATES)) {
      expect(rates.input).toBeGreaterThan(0);
      expect(rates.output).toBeGreaterThan(0);
    }
  });
});

// --- recordAgentCall ---

describe('recordAgentCall', () => {
  it('토큰과 비용을 누적한다', () => {
    const metrics = recordAgentCall(createMetricsSnapshot(), {
      roleId: 'cto',
      provider: 'claude',
      inputTokens: 1000,
      outputTokens: 500,
    });

    expect(metrics.totalInputTokens).toBe(1000);
    expect(metrics.totalOutputTokens).toBe(500);
    expect(metrics.totalCostUsd).toBeGreaterThan(0);
  });

  it('여러 호출을 누적한다', () => {
    let metrics = createMetricsSnapshot();
    metrics = recordAgentCall(metrics, { roleId: 'cto', inputTokens: 100, outputTokens: 50 });
    metrics = recordAgentCall(metrics, { roleId: 'backend', inputTokens: 200, outputTokens: 100 });

    expect(metrics.totalInputTokens).toBe(300);
    expect(metrics.totalOutputTokens).toBe(150);
    expect(metrics.agentCalls).toHaveLength(2);
  });

  it('byRole에 역할별 집계를 기록한다', () => {
    let metrics = createMetricsSnapshot();
    metrics = recordAgentCall(metrics, { roleId: 'cto', inputTokens: 100, outputTokens: 50 });
    metrics = recordAgentCall(metrics, { roleId: 'cto', inputTokens: 200, outputTokens: 100 });

    expect(metrics.byRole.cto.callCount).toBe(2);
    expect(metrics.byRole.cto.inputTokens).toBe(300);
    expect(metrics.byRole.cto.outputTokens).toBe(150);
  });

  it('byProvider에 프로바이더별 집계를 기록한다', () => {
    let metrics = createMetricsSnapshot();
    metrics = recordAgentCall(metrics, {
      roleId: 'cto',
      provider: 'claude',
      inputTokens: 100,
      outputTokens: 50,
    });
    metrics = recordAgentCall(metrics, {
      roleId: 'backend',
      provider: 'openai',
      inputTokens: 200,
      outputTokens: 100,
    });

    expect(metrics.byProvider.claude.callCount).toBe(1);
    expect(metrics.byProvider.openai.callCount).toBe(1);
  });

  it('provider 기본값은 claude이다', () => {
    const metrics = recordAgentCall(createMetricsSnapshot(), {
      roleId: 'cto',
      inputTokens: 100,
      outputTokens: 50,
    });

    expect(metrics.byProvider.claude).toBeDefined();
    expect(metrics.byProvider.claude.callCount).toBe(1);
  });

  it('agentCalls가 500개를 초과하면 오래된 것을 제거한다', () => {
    let metrics = createMetricsSnapshot();
    for (let i = 0; i < 510; i++) {
      metrics = recordAgentCall(metrics, { roleId: 'cto', inputTokens: 1, outputTokens: 1 });
    }
    expect(metrics.agentCalls.length).toBe(500);
  });

  it('null 입력은 무시한다', () => {
    expect(recordAgentCall(null, {})).toBeNull();
    const metrics = createMetricsSnapshot();
    expect(recordAgentCall(metrics, null)).toBe(metrics);
  });

  it('비용 계산이 올바르다 (claude)', () => {
    const metrics = recordAgentCall(createMetricsSnapshot(), {
      roleId: 'cto',
      provider: 'claude',
      inputTokens: 1000,
      outputTokens: 1000,
    });

    const expectedCost = 1000 * COST_RATES.claude.input + 1000 * COST_RATES.claude.output;
    expect(metrics.totalCostUsd).toBeCloseTo(expectedCost, 10);
  });

  it('원본 메트릭스를 변경하지 않는다 (immutability)', () => {
    const original = createMetricsSnapshot();
    const updated = recordAgentCall(original, {
      roleId: 'cto',
      inputTokens: 100,
      outputTokens: 50,
    });

    expect(original.totalInputTokens).toBe(0);
    expect(updated.totalInputTokens).toBe(100);
    expect(original.agentCalls).toHaveLength(0);
    expect(updated.agentCalls).toHaveLength(1);
  });
});

// --- recordPhaseCompletion ---

describe('recordPhaseCompletion', () => {
  it('페이즈 메트릭스를 기록한다', () => {
    const metrics = recordPhaseCompletion(createMetricsSnapshot(), {
      phase: 1,
      startedAt: '2026-01-01T00:00:00Z',
      durationMs: 5000,
      fixAttempts: 1,
      taskCount: 3,
    });

    expect(metrics.phaseMetrics['phase-1']).toBeDefined();
    expect(metrics.phaseMetrics['phase-1'].durationMs).toBe(5000);
    expect(metrics.phaseMetrics['phase-1'].fixAttempts).toBe(1);
    expect(metrics.phaseMetrics['phase-1'].taskCount).toBe(3);
  });

  it('여러 페이즈를 기록한다', () => {
    let metrics = createMetricsSnapshot();
    metrics = recordPhaseCompletion(metrics, { phase: 1, durationMs: 1000, taskCount: 2 });
    metrics = recordPhaseCompletion(metrics, { phase: 2, durationMs: 2000, taskCount: 3 });

    expect(Object.keys(metrics.phaseMetrics)).toHaveLength(2);
  });

  it('null 입력은 무시한다', () => {
    expect(recordPhaseCompletion(null, {})).toBeNull();
    const metrics = createMetricsSnapshot();
    expect(recordPhaseCompletion(metrics, null)).toBe(metrics);
  });

  it('원본 메트릭스를 변경하지 않는다 (immutability)', () => {
    const original = createMetricsSnapshot();
    const updated = recordPhaseCompletion(original, { phase: 1, durationMs: 5000, taskCount: 3 });

    expect(Object.keys(original.phaseMetrics)).toHaveLength(0);
    expect(Object.keys(updated.phaseMetrics)).toHaveLength(1);
  });
});

// --- getCostSummary ---

describe('getCostSummary', () => {
  it('비용 요약을 반환한다', () => {
    const metrics = recordAgentCall(createMetricsSnapshot(), {
      roleId: 'cto',
      inputTokens: 1000,
      outputTokens: 500,
    });

    const summary = getCostSummary(metrics);
    expect(summary.totalInputTokens).toBe(1000);
    expect(summary.totalOutputTokens).toBe(500);
    expect(summary.totalCostUsd).toBeGreaterThan(0);
    expect(summary.byRole.cto).toBeDefined();
  });

  it('null 메트릭스는 빈 요약을 반환한다', () => {
    const summary = getCostSummary(null);
    expect(summary.totalCostUsd).toBe(0);
    expect(summary.totalInputTokens).toBe(0);
  });
});

// --- getAgentPerformanceSummary ---

describe('getAgentPerformanceSummary', () => {
  it('에이전트별 성능 요약을 반환한다', () => {
    let metrics = createMetricsSnapshot();
    metrics = recordAgentCall(metrics, { roleId: 'cto', inputTokens: 1000, outputTokens: 500 });
    metrics = recordAgentCall(metrics, {
      roleId: 'backend',
      inputTokens: 2000,
      outputTokens: 1000,
    });

    const summary = getAgentPerformanceSummary(metrics, { cto: 0.8, backend: 0.9 });
    expect(summary).toHaveLength(2);
    expect(summary.find((s) => s.roleId === 'cto').contributionScore).toBe(0.8);
    expect(summary.find((s) => s.roleId === 'backend').contributionScore).toBe(0.9);
  });

  it('기여도가 없으면 0을 반환한다', () => {
    const metrics = recordAgentCall(createMetricsSnapshot(), {
      roleId: 'cto',
      inputTokens: 100,
      outputTokens: 50,
    });

    const summary = getAgentPerformanceSummary(metrics);
    expect(summary[0].contributionScore).toBe(0);
  });

  it('null 메트릭스는 빈 배열을 반환한다', () => {
    expect(getAgentPerformanceSummary(null)).toEqual([]);
  });
});

// --- buildMetricsDashboard ---

describe('buildMetricsDashboard', () => {
  it('마크다운 대시보드를 생성한다', () => {
    let metrics = createMetricsSnapshot();
    metrics = recordAgentCall(metrics, {
      roleId: 'cto',
      provider: 'claude',
      inputTokens: 1000,
      outputTokens: 500,
    });
    metrics = recordPhaseCompletion(metrics, { phase: 1, durationMs: 5000, taskCount: 3 });

    const dashboard = buildMetricsDashboard({ metrics });
    expect(dashboard).toContain('비용/성능 대시보드');
    expect(dashboard).toContain('총 비용');
    expect(dashboard).toContain('역할별 비용');
    expect(dashboard).toContain('프로바이더별 비용');
    expect(dashboard).toContain('페이즈별 성능');
  });

  it('메트릭스가 없으면 안내 메시지를 반환한다', () => {
    expect(buildMetricsDashboard({})).toBe('메트릭스 데이터가 없습니다.');
    expect(buildMetricsDashboard(null)).toBe('메트릭스 데이터가 없습니다.');
  });

  it('빈 메트릭스에서도 기본 대시보드를 생성한다', () => {
    const metrics = createMetricsSnapshot();
    const dashboard = buildMetricsDashboard({ metrics });
    expect(dashboard).toContain('$0.0000');
    expect(dashboard).toContain('에이전트 호출 수');
  });
});
