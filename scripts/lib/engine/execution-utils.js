/**
 * execution-utils — 실행 루프 유틸리티 함수
 *
 * 순수 함수 모음: 실패 분류, 실패 컨텍스트 생성, 기여도 추출, 요약, 부실 감지.
 * state-machine.js / execution-loop.js에서 사용.
 */

import { trackRoleContribution } from '../agent/agent-optimizer.js';
import { config } from '../core/config.js';

const MAX_FIX_ATTEMPTS = config.execution.maxFixAttempts;

/** 실패 카테고리 — 사전 컴파일 정규식 매핑 (O(1) 매칭) */
const FAILURE_CATEGORY_PATTERNS = [
  ['security', /security|xss|injection|csrf|auth|owasp|보안|취약점|인증/],
  ['build', /build|compile|syntax|import|module|빌드|컴파일/],
  ['test', /test|coverage|assertion|expect|tdd|테스트|커버리지/],
  ['performance', /performance|memory|latency|timeout|slow|성능|메모리/],
  ['type', /type|typescript|typing|interface|타입/],
  ['architecture', /architecture|design|pattern|coupling|dependency|아키텍처|설계/],
  ['logic', /logic|bug|error|null|undefined|race|로직|버그/],
];

/** 실패 카테고리 한국어 라벨 매핑 */
export const FAILURE_CATEGORY_LABELS = {
  security: '보안 문제',
  build: '빌드 오류',
  test: '테스트 실패',
  performance: '성능 문제',
  type: '타입 오류',
  architecture: '구조 문제',
  logic: '로직 오류',
};

/**
 * 카테고리를 한국어 라벨로 변환한다.
 * @param {string} category
 * @returns {string}
 */
export function getCategoryLabel(category) {
  return FAILURE_CATEGORY_LABELS[category] || category;
}

/**
 * 이슈를 7개 카테고리 중 하나로 분류한다 (pure).
 * @param {{ severity?: string, description?: string, suggestion?: string }} issue - 이슈 객체
 * @returns {'security'|'build'|'test'|'performance'|'type'|'architecture'|'logic'} 카테고리
 */
export function categorizeFailure(issue) {
  const text = `${issue.description || ''} ${issue.suggestion || ''}`.toLowerCase();
  for (const [category, regex] of FAILURE_CATEGORY_PATTERNS) {
    if (regex.test(text)) return category;
  }
  return 'logic';
}

/**
 * 품질 게이트 실패 시 실패 컨텍스트를 생성한다 (pure).
 * @param {object} state - 현재 ExecutionState
 * @param {object} stepResult - 품질 게이트 결과를 포함한 stepResult
 * @returns {object} failureContext 객체
 */
export function buildFailureContext(state, stepResult) {
  const issues = (stepResult.qualityGateResult && stepResult.qualityGateResult.issues) || [];
  return {
    attempt: (state.fixAttempt || 0) + 1,
    maxAttempts: MAX_FIX_ATTEMPTS,
    issues: issues.map((i) => {
      const issue = typeof i === 'string' ? { description: i, severity: 'critical' } : i;
      return { ...issue, category: categorizeFailure(issue) };
    }),
    previousAttempts: state.failureHistory || [],
  };
}

/**
 * 리뷰 결과에서 역할별 기여도를 추출한다 (내부 헬퍼).
 * @param {Array} reviews - 리뷰 결과 배열
 * @returns {Array<{roleId: string, contributionScore: number, uniqueIssues: number, criticalsCaught: number}>}
 */
export function extractContributions(reviews) {
  const byRole = {};
  for (const r of reviews) {
    const roleId = r.reviewerId || r.roleId;
    if (!roleId) continue;
    if (!byRole[roleId]) byRole[roleId] = [];
    byRole[roleId].push(r);
  }
  return Object.entries(byRole).map(([roleId, roleReviews]) => {
    const c = trackRoleContribution(roleId, roleReviews);
    return {
      roleId,
      contributionScore: c.contributionScore,
      uniqueIssues: c.uniqueIssues,
      criticalsCaught: c.criticalsCaught,
    };
  });
}

/**
 * 프로젝트의 총 phase 수를 계산한다.
 * @param {object} project - 프로젝트 객체
 * @returns {number}
 */
export function getTotalPhases(project) {
  const tasks = project.tasks || [];
  const phases = new Set(tasks.map((t) => t.phase).filter(Boolean));
  return phases.size || 1;
}

/**
 * 특정 phase의 태스크를 반환한다.
 * @param {object} project - 프로젝트 객체
 * @param {number} phase - phase 번호
 * @returns {Array}
 */
export function getTasksForPhase(project, phase) {
  return (project.tasks || []).filter((t) => (t.phase || 1) === phase);
}

/**
 * 실행 진행 요약을 반환한다 (pure).
 * @param {object} project - 프로젝트 객체
 * @returns {object} 요약 정보
 */
export function getExecutionSummary(project) {
  const state = project.executionState;
  const totalPhases = getTotalPhases(project);

  if (!state) {
    return {
      status: 'idle',
      currentPhase: 0,
      totalPhases,
      phaseStep: null,
      percentage: 0,
      display: '실행 대기 중',
    };
  }

  const completedCount = state.completedPhases.length;
  const percentage =
    state.status === 'completed'
      ? 100
      : totalPhases > 0
        ? Math.round((completedCount / totalPhases) * 100)
        : 0;

  const stepLabels = {
    'execute-tasks': '팀 작업 수행',
    materialize: '코드 파일 생성',
    review: '팀 검토',
    'quality-gate': '품질 검증',
    fix: '수정',
    commit: '저장',
    'build-context': '다음 단계 준비',
  };

  const stepLabel = stepLabels[state.phaseStep] || state.phaseStep;

  let display;
  switch (state.status) {
    case 'completed':
      display = `전체 완료 (${totalPhases}개 Phase)`;
      break;
    case 'escalated':
      display = `Phase ${state.currentPhase}/${totalPhases}: CEO 결정 대기`;
      break;
    case 'paused':
      display = `Phase ${state.currentPhase}/${totalPhases}: 일시 중지`;
      break;
    default:
      display = `Phase ${state.currentPhase}/${totalPhases}: ${stepLabel} (${percentage}%)`;
  }

  return {
    status: state.status,
    currentPhase: state.currentPhase,
    totalPhases,
    phaseStep: state.phaseStep,
    percentage,
    display,
  };
}

/**
 * 마지막 저널 엔트리 기준으로 실행이 부실(stale)한지 감지한다.
 * @param {object} state - ExecutionState 객체
 * @param {number} maxAgeMs - 최대 허용 나이 (밀리초)
 * @returns {boolean} 부실 여부
 */
export function isStaleExecution(state, maxAgeMs) {
  if (!state || !state.journal || state.journal.length === 0) {
    // 저널이 없으면 startedAt 기준 (UTC ISO 8601 타임스탬프)
    if (!state || !state.startedAt) return true;
    const startMs = new Date(state.startedAt).getTime();
    return isNaN(startMs) || Date.now() - startMs > maxAgeMs;
  }
  const lastEntry = state.journal[state.journal.length - 1];
  const lastMs = new Date(lastEntry.timestamp).getTime();
  return isNaN(lastMs) || Date.now() - lastMs > maxAgeMs;
}
