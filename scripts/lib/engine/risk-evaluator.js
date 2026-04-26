/**
 * risk-evaluator — 위험 / 예산 임계 평가 모듈.
 *
 * PRD #235 §3.5, §8.2, §8.4. v2 단일 진입점에서 작업 시작 전·진행 중
 * 위험 신호와 비용 임계(opt-in)를 평가해 CEO 호출 트리거 여부를 반환한다.
 *
 * 핵심 정책:
 * - 비용 임계는 기본값 없음 (opt-in). 사용자가 budgetConfig 설정 시만 동작
 * - 보안/회귀 신호는 항상 동작 (임계와 무관)
 * - 80% 도달 시 WARNING(escalate 안 함), 100% 도달 시 CRITICAL(escalate)
 * - 우선순위: 보안 > 회귀 > 비용
 *
 * 순수 함수 — 호출자가 cost-tracker.getStats()와 journal 이벤트를 주입한다.
 */

export const RISK_SEVERITY = Object.freeze({
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
});

/**
 * 보안 위반 이벤트 type 목록. journal에서 이 type을 가진 최근 이벤트가 있으면
 * 임계와 무관하게 escalate.
 *
 * **호출자 계약**: 현재 v1 journal은 'phase-completion'/'agent-call'만 기록한다.
 * Phase B 통합 시점에 orchestrator/execution-loop의 보안 검증 실패 분기에서
 * 아래 type을 명시적으로 append하도록 매핑 작업 필요.
 */
export const SECURITY_EVENT_TYPES = Object.freeze([
  'security-violation',
  'secret-leak',
  'injection-detected',
  'path-traversal',
  'unauthorized-access',
]);

/**
 * 회귀 이벤트 type 목록. 빌드 실패, 테스트 깨짐 등 회복 어려운 상황.
 *
 * **호출자 계약**: SECURITY_EVENT_TYPES와 동일 — Phase B 통합 시
 * execution-loop의 quality-gate 실패 분기에서 아래 type을 append하도록 매핑 필요.
 * 현재 단계에서는 미래 확장을 위한 "예약 타입" 성격.
 */
export const REGRESSION_EVENT_TYPES = Object.freeze([
  'test-broken',
  'build-failed',
  'critical-issue',
  'regression-detected',
]);

const WARNING_RATIO = 0.8;
const CRITICAL_RATIO = 1.0;

const SECURITY_TYPES_SET = new Set(SECURITY_EVENT_TYPES);
const REGRESSION_TYPES_SET = new Set(REGRESSION_EVENT_TYPES);

const EMPTY_RESULT = Object.freeze({
  shouldEscalate: false,
  severity: RISK_SEVERITY.INFO,
  reason: '',
  suggestedAction: '',
});

/**
 * 위험/예산 임계 평가.
 *
 * @param {object} options
 * @param {object} [options.taskContext] - { taskType, intent, projectId }.
 *   현재 미사용. Phase B에서 taskType별 위험 가중치(예: code 작업은 build/test
 *   실패에 더 민감) 조정 시 활용 예정.
 * @param {object} [options.metrics] - { totalCostUsd, totalTokens, recentEvents }
 * @param {object|null} [options.budgetConfig] - { maxCostUsd?, maxTokens? }, null 시 비용 평가 스킵
 * @returns {{
 *   shouldEscalate: boolean,
 *   severity: 'info' | 'warning' | 'critical',
 *   reason: string,
 *   suggestedAction: string
 * }}
 */
export function evaluateRisk(options = {}) {
  const metrics = options.metrics || {};
  const budgetConfig = options.budgetConfig || null;

  // 1) 보안 신호 — 최우선
  const securityEvent = findEventByTypeSet(metrics.recentEvents, SECURITY_TYPES_SET);
  if (securityEvent) {
    return {
      shouldEscalate: true,
      severity: RISK_SEVERITY.CRITICAL,
      reason: `보안 위반 신호 감지: ${securityEvent.type}`,
      suggestedAction: '즉시 중단하고 보안 검토를 수행하세요',
    };
  }

  // 2) 회귀 신호 — 두 번째 우선
  const regressionEvent = findEventByTypeSet(metrics.recentEvents, REGRESSION_TYPES_SET);
  if (regressionEvent) {
    return {
      shouldEscalate: true,
      severity: RISK_SEVERITY.CRITICAL,
      reason: `회귀 신호 감지: ${regressionEvent.type}`,
      suggestedAction: '롤백 또는 회복 시도가 필요합니다',
    };
  }

  // 3) 비용 임계 — opt-in
  if (budgetConfig) {
    const budgetResult = evaluateBudget(metrics, budgetConfig);
    if (budgetResult) return budgetResult;
  }

  return { ...EMPTY_RESULT };
}

function findEventByTypeSet(events, typeSet) {
  if (!Array.isArray(events) || events.length === 0) return null;
  for (const ev of events) {
    if (ev && typeof ev.type === 'string' && typeSet.has(ev.type)) {
      return ev;
    }
  }
  return null;
}

function evaluateBudget(metrics, budgetConfig) {
  const checks = [
    {
      label: '예산',
      unit: 'USD',
      current: Number(metrics.totalCostUsd) || 0,
      max: Number(budgetConfig.maxCostUsd) || 0,
    },
    {
      label: '토큰',
      unit: 'tokens',
      current: Number(metrics.totalTokens) || 0,
      max: Number(budgetConfig.maxTokens) || 0,
    },
  ].filter((c) => c.max > 0);

  if (checks.length === 0) return null;

  let highestSeverity = RISK_SEVERITY.INFO;
  let triggerCheck = null;
  for (const c of checks) {
    const ratio = c.current / c.max;
    if (ratio >= CRITICAL_RATIO) {
      highestSeverity = RISK_SEVERITY.CRITICAL;
      triggerCheck = c;
      break; // 최고 등급 확정 — 조기 종료
    }
    if (ratio >= WARNING_RATIO && highestSeverity !== RISK_SEVERITY.CRITICAL) {
      highestSeverity = RISK_SEVERITY.WARNING;
      triggerCheck = c;
    }
  }

  if (highestSeverity === RISK_SEVERITY.INFO) return null;

  if (highestSeverity === RISK_SEVERITY.WARNING) {
    return {
      shouldEscalate: false,
      severity: RISK_SEVERITY.WARNING,
      reason: `${triggerCheck.label} 80% 도달 (${triggerCheck.current} / ${triggerCheck.max} ${triggerCheck.unit})`,
      suggestedAction: '진행 가능. 임계 초과 시 자동 중단됨',
    };
  }

  return {
    shouldEscalate: true,
    severity: RISK_SEVERITY.CRITICAL,
    reason: `${triggerCheck.label} 한도 도달 (${triggerCheck.current} / ${triggerCheck.max} ${triggerCheck.unit})`,
    suggestedAction: '예산을 확장하거나 작업을 중단하세요',
  };
}
