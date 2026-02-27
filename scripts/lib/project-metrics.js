/**
 * project-metrics — 프로젝트 관측성 모듈
 * 비용/성능 추적, 에이전트 호출 기록, 대시보드 생성
 */

/** 프로바이더별 토큰 비용 (USD per token) */
export const COST_RATES = {
  claude: { input: 0.000003, output: 0.000015 },
  openai: { input: 0.000005, output: 0.000015 },
  gemini: { input: 0.000001, output: 0.000004 },
};

/** 에이전트 호출 기록 최대 개수 */
const MAX_AGENT_CALLS = 500;

/**
 * 빈 메트릭스 스냅샷을 생성한다.
 * @returns {object} 메트릭스 스냅샷
 */
export function createMetricsSnapshot() {
  return {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsd: 0,
    agentCalls: [],
    phaseMetrics: {},
    byRole: {},
    byProvider: {},
  };
}

/**
 * 에이전트 호출 이벤트를 기록한다 (토큰/비용 누적).
 * @param {object} metrics - 메트릭스 객체 (in-place 변경)
 * @param {object} event - 호출 이벤트
 * @param {string} event.roleId - 역할 ID
 * @param {string} [event.provider='claude'] - 프로바이더
 * @param {number} [event.inputTokens=0] - 입력 토큰 수
 * @param {number} [event.outputTokens=0] - 출력 토큰 수
 * @param {number} [event.durationMs=0] - 소요 시간
 * @returns {object} 업데이트된 메트릭스
 */
export function recordAgentCall(metrics, event) {
  if (!metrics || !event) return metrics;

  const provider = event.provider || 'claude';
  const inputTokens = event.inputTokens || 0;
  const outputTokens = event.outputTokens || 0;

  const rates = COST_RATES[provider] || COST_RATES.claude;
  const cost = (inputTokens * rates.input) + (outputTokens * rates.output);

  metrics.totalInputTokens += inputTokens;
  metrics.totalOutputTokens += outputTokens;
  metrics.totalCostUsd += cost;

  // 에이전트 호출 기록 (rolling max)
  metrics.agentCalls.push({
    roleId: event.roleId,
    provider,
    inputTokens,
    outputTokens,
    cost,
    durationMs: event.durationMs || 0,
    timestamp: new Date().toISOString(),
  });
  if (metrics.agentCalls.length > MAX_AGENT_CALLS) {
    metrics.agentCalls = metrics.agentCalls.slice(-MAX_AGENT_CALLS);
  }

  // byRole 집계
  if (event.roleId) {
    if (!metrics.byRole[event.roleId]) {
      metrics.byRole[event.roleId] = { callCount: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
    }
    const r = metrics.byRole[event.roleId];
    r.callCount += 1;
    r.inputTokens += inputTokens;
    r.outputTokens += outputTokens;
    r.costUsd += cost;
  }

  // byProvider 집계
  if (!metrics.byProvider[provider]) {
    metrics.byProvider[provider] = { callCount: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
  }
  const p = metrics.byProvider[provider];
  p.callCount += 1;
  p.inputTokens += inputTokens;
  p.outputTokens += outputTokens;
  p.costUsd += cost;

  return metrics;
}

/**
 * 페이즈 완료 이벤트를 기록한다.
 * @param {object} metrics - 메트릭스 객체 (in-place 변경)
 * @param {object} event - 페이즈 이벤트
 * @param {number} event.phase - 페이즈 번호
 * @param {string} [event.startedAt] - 시작 시각
 * @param {string} [event.completedAt] - 완료 시각
 * @param {number} [event.durationMs=0] - 소요 시간
 * @param {number} [event.fixAttempts=0] - 수정 시도 횟수
 * @param {number} [event.taskCount=0] - 태스크 수
 * @returns {object} 업데이트된 메트릭스
 */
export function recordPhaseCompletion(metrics, event) {
  if (!metrics || !event || event.phase === undefined) return metrics;

  const key = `phase-${event.phase}`;
  metrics.phaseMetrics[key] = {
    startedAt: event.startedAt || null,
    completedAt: event.completedAt || new Date().toISOString(),
    durationMs: event.durationMs || 0,
    fixAttempts: event.fixAttempts || 0,
    taskCount: event.taskCount || 0,
  };

  return metrics;
}

/**
 * 비용 브레이크다운을 반환한다.
 * @param {object} metrics - 메트릭스 객체
 * @returns {{ totalCostUsd: number, totalInputTokens: number, totalOutputTokens: number, byRole: object, byProvider: object }}
 */
export function getCostSummary(metrics) {
  if (!metrics) {
    return { totalCostUsd: 0, totalInputTokens: 0, totalOutputTokens: 0, byRole: {}, byProvider: {} };
  }

  return {
    totalCostUsd: metrics.totalCostUsd,
    totalInputTokens: metrics.totalInputTokens,
    totalOutputTokens: metrics.totalOutputTokens,
    byRole: metrics.byRole,
    byProvider: metrics.byProvider,
  };
}

/**
 * 에이전트 성능 요약을 반환한다 (기여도 통합).
 * @param {object} metrics - 메트릭스 객체
 * @param {object} [contributions={}] - roleId → contributionScore 매핑
 * @returns {Array<{ roleId: string, callCount: number, costUsd: number, contributionScore: number }>}
 */
export function getAgentPerformanceSummary(metrics, contributions = {}) {
  if (!metrics || !metrics.byRole) return [];

  return Object.entries(metrics.byRole).map(([roleId, data]) => ({
    roleId,
    callCount: data.callCount,
    costUsd: data.costUsd,
    contributionScore: contributions[roleId] || 0,
  }));
}

/**
 * 마크다운 메트릭스 대시보드를 생성한다.
 * @param {object} project - 프로젝트 데이터
 * @returns {string} 마크다운 대시보드
 */
export function buildMetricsDashboard(project) {
  const metrics = project?.metrics;
  if (!metrics) return '메트릭스 데이터가 없습니다.';

  const costSummary = getCostSummary(metrics);
  const totalTokens = costSummary.totalInputTokens + costSummary.totalOutputTokens;

  let dashboard = `## 비용/성능 대시보드

| 항목 | 값 |
|------|-----|
| 총 비용 | $${costSummary.totalCostUsd.toFixed(4)} |
| 입력 토큰 | ${costSummary.totalInputTokens.toLocaleString()} |
| 출력 토큰 | ${costSummary.totalOutputTokens.toLocaleString()} |
| 총 토큰 | ${totalTokens.toLocaleString()} |
| 에이전트 호출 수 | ${metrics.agentCalls.length} |`;

  // 역할별 비용
  const roleEntries = Object.entries(costSummary.byRole);
  if (roleEntries.length > 0) {
    dashboard += '\n\n### 역할별 비용\n\n| 역할 | 호출 수 | 비용 |\n|------|---------|------|\n';
    dashboard += roleEntries
      .sort((a, b) => b[1].costUsd - a[1].costUsd)
      .map(([role, data]) => `| ${role} | ${data.callCount} | $${data.costUsd.toFixed(4)} |`)
      .join('\n');
  }

  // 프로바이더별 비용
  const providerEntries = Object.entries(costSummary.byProvider);
  if (providerEntries.length > 0) {
    dashboard += '\n\n### 프로바이더별 비용\n\n| 프로바이더 | 호출 수 | 비용 |\n|------------|---------|------|\n';
    dashboard += providerEntries
      .map(([prov, data]) => `| ${prov} | ${data.callCount} | $${data.costUsd.toFixed(4)} |`)
      .join('\n');
  }

  // 페이즈별 성능
  const phaseEntries = Object.entries(metrics.phaseMetrics);
  if (phaseEntries.length > 0) {
    dashboard += '\n\n### 페이즈별 성능\n\n| 페이즈 | 소요 시간 | 태스크 수 | 수정 횟수 |\n|--------|-----------|-----------|----------|\n';
    dashboard += phaseEntries
      .map(([phase, data]) => {
        const duration = data.durationMs ? `${(data.durationMs / 1000).toFixed(1)}s` : '-';
        return `| ${phase} | ${duration} | ${data.taskCount} | ${data.fixAttempts} |`;
      })
      .join('\n');
  }

  return dashboard;
}
