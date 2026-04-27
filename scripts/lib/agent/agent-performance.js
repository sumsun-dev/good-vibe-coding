/**
 * agent-performance — 에이전트 자가발전을 위한 다차원 학습 신호 추출
 *
 * 기존 extractAgentPerformance는 critical/important 이슈 카운트만 본다.
 * 자가발전(self-evolution) 루프가 더 균형 잡힌 결정을 하려면 비용·시간·재시도·
 * 에스컬레이션 신호도 함께 봐야 한다. 이 모듈은 6개 신호를 독립 함수로 추출하고
 * 가중치 기반 통합 점수를 계산한다.
 *
 * - quality      : critical*3 + important. 낮을수록 좋음.
 * - time         : phase-completion 사이 누적 ms. 낮을수록 좋음.
 * - cost         : 프로젝트 누적 USD. 낮을수록 좋음.
 * - retry        : Phase별 fix 시도 합계. 낮을수록 좋음.
 * - escalation   : escalating state 진입 횟수. 낮을수록 좋음.
 * - contribution : 유니크 이슈 / 전체 이슈. 높을수록 좋음 (중복 리뷰어 패널티).
 *
 * computeAggregateScore는 페널티 신호를 음수로, 기여 신호를 양수로 합산한다.
 * 절대값 자체는 의미 없고 비교 용도(shadow vs active 등)로 쓰인다.
 */

/**
 * @typedef {Object} AgentSignals
 * @property {number} quality
 * @property {number} time
 * @property {number} cost
 * @property {number} retry
 * @property {number} escalation
 * @property {number} contribution
 */

export const DEFAULT_SIGNAL_WEIGHTS = Object.freeze({
  quality: 1.0,
  time: 0.001, // ms 단위 → 초당 0.001 페널티
  cost: 1.0, // USD 직접
  retry: 0.5,
  escalation: 2.0,
  contribution: 5.0,
});

/**
 * 리뷰 이슈에서 quality 신호 추출 (critical*3 + important).
 * @param {{ issues?: Array<{ severity?: string }> }} performance
 * @returns {number}
 */
export function extractQualitySignal(performance) {
  const issues = performance?.issues || [];
  let critical = 0;
  let important = 0;
  for (const i of issues) {
    if (i?.severity === 'critical') critical++;
    else if (i?.severity === 'important') important++;
  }
  return critical * 3 + important;
}

/**
 * journal에서 phase-completion 이벤트 사이의 누적 ms를 시간 신호로 추출.
 * 이벤트가 2개 미만이면 0.
 * @param {object} project
 * @returns {number}
 */
export function extractTimeSignal(project) {
  const journal = project?.executionState?.journal || [];
  const completions = journal.filter((e) => e?.type === 'phase-completion' && e.timestamp);
  if (completions.length < 2) return 0;
  const first = completions[0].timestamp;
  const last = completions[completions.length - 1].timestamp;
  return Math.max(0, last - first);
}

/**
 * 프로젝트 누적 비용 신호 (cost-tracker가 project.metrics에 기록한 값 사용).
 * 누적값이 없으면 0.
 * @param {object} project
 * @returns {number}
 */
export function extractCostSignal(project) {
  const cost = project?.metrics?.totalCost;
  return typeof cost === 'number' && cost >= 0 ? cost : 0;
}

/**
 * journal의 phase-completion entry에서 fixAttempts 합계를 retry 신호로 추출.
 * @param {object} project
 * @returns {number}
 */
export function extractRetrySignal(project) {
  const journal = project?.executionState?.journal || [];
  let total = 0;
  for (const entry of journal) {
    if (entry?.type === 'phase-completion' && typeof entry.fixAttempts === 'number') {
      total += entry.fixAttempts;
    }
  }
  return total;
}

/**
 * graph-transition 이벤트 중 toState === 'escalating' 횟수를 에스컬레이션 신호로 추출.
 * 'escalating' state는 fix 2회 실패 시 진입한다.
 * @param {object} project
 * @returns {number}
 */
export function extractEscalationSignal(project) {
  const journal = project?.executionState?.journal || [];
  let count = 0;
  for (const entry of journal) {
    if (entry?.type === 'graph-transition' && entry.toState === 'escalating') count++;
  }
  return count;
}

/**
 * 유니크 이슈 description / 전체 이슈 비율을 기여도 신호로 추출.
 * 이슈가 0개면 0 (기여 측정 불가).
 * @param {{ reviews?: Array<{ issues?: Array<{ description?: string }> }> }} performance
 * @returns {number}
 */
export function extractContributionSignal(performance) {
  const reviews = performance?.reviews || [];
  const allIssues = reviews.flatMap((r) => r?.issues || []);
  if (allIssues.length === 0) return 0;
  const unique = new Set(allIssues.map((i) => (i?.description || '').trim()).filter(Boolean));
  return unique.size / allIssues.length;
}

/**
 * 6개 신호를 한 번에 추출한다.
 * @param {object} project
 * @param {object} performance - extractAgentPerformance의 단일 항목
 * @returns {AgentSignals}
 */
export function extractAllSignals(project, performance) {
  return {
    quality: extractQualitySignal(performance),
    time: extractTimeSignal(project),
    cost: extractCostSignal(project),
    retry: extractRetrySignal(project),
    escalation: extractEscalationSignal(project),
    contribution: extractContributionSignal(performance),
  };
}

/**
 * 가중치 기반 통합 점수. 페널티 신호는 음수, 기여 신호는 양수로 합산.
 * 두 후보 비교(shadow vs active 등)에서 더 높은 점수가 우수.
 * @param {AgentSignals} signals
 * @param {Partial<AgentSignals>} [weights] - DEFAULT_SIGNAL_WEIGHTS와 병합
 * @returns {number}
 */
export function computeAggregateScore(signals, weights = DEFAULT_SIGNAL_WEIGHTS) {
  const w = { ...DEFAULT_SIGNAL_WEIGHTS, ...weights };
  return (
    -signals.quality * w.quality -
    signals.time * w.time -
    signals.cost * w.cost -
    signals.retry * w.retry -
    signals.escalation * w.escalation +
    signals.contribution * w.contribution
  );
}
