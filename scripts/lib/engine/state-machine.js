/**
 * state-machine — 실행 상태 머신 (순수 함수)
 *
 * 상태 전이 다이어그램:
 * [execute-tasks] → [materialize] → [review] → [quality-gate]
 *                                                     │
 *                                         passed ◄────┤───► failed
 *                                            │               │
 *                                            ↓        fixAttempt < 2?
 *                                        [commit]     yes → [fix] → [materialize] (재진입)
 *                                            │         no → [escalated] → CEO 결정
 *                                            ↓                              │
 *                                     [build-context]              continue/skip/abort
 *                                            │
 *                                   hasMorePhases?
 *                                   yes → Phase++ → [execute-tasks]
 *                                   no  → [completed]
 */

import { isCodeTask } from './task-distributor.js';
import { config } from '../core/config.js';
import { inputError } from '../core/validators.js';
import { buildFailureContext, getTotalPhases, getTasksForPhase } from './execution-utils.js';

const VALID_STATUSES = [
  'idle',
  'executing',
  'reviewing',
  'fixing',
  'committing',
  'paused',
  'escalated',
  'completed',
];
const VALID_PHASE_STEPS = [
  'execute-tasks',
  'materialize',
  'review',
  'quality-gate',
  'fix',
  'commit',
  'build-context',
];
const MAX_FIX_ATTEMPTS = config.execution.maxFixAttempts;

/**
 * 유효한 phaseStep 전이 맵.
 * 각 단계에서 이동할 수 있는 다음 단계를 정의한다.
 */
export const PHASE_TRANSITIONS = {
  'execute-tasks': ['materialize'],
  materialize: ['review'],
  review: ['quality-gate'],
  'quality-gate': ['commit', 'fix', 'escalated'], // passed → commit, failed → fix/escalated
  fix: ['materialize'], // 수정 후 materialize로 재진입
  commit: ['build-context'],
  'build-context': ['execute-tasks', 'completed'], // 다음 phase 또는 완료
};

/**
 * phaseStep 전이가 유효한지 검증한다.
 * @param {string} from - 현재 단계
 * @param {string} to - 다음 단계
 * @returns {boolean}
 */
export function isValidTransition(from, to) {
  const allowed = PHASE_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/**
 * 초기 실행 상태 객체를 생성한다 (pure).
 * @param {'interactive'|'auto'} [mode='interactive'] - 실행 모드
 * @returns {object} 초기 ExecutionState
 */
export function createInitialExecutionState(mode = 'interactive', options = {}) {
  const validModes = ['interactive', 'semi-auto', 'auto'];
  const resolvedMode = validModes.includes(mode) ? mode : 'interactive';
  const batchSize = resolvedMode === 'semi-auto' ? options.batchSize || 3 : 0;

  return {
    status: 'executing',
    currentPhase: 1,
    phaseStep: 'execute-tasks',
    fixAttempt: 0,
    mode: resolvedMode,
    batchSize,
    lastCompletedStep: null,
    completedPhases: [],
    pendingEscalation: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
    phaseResults: {},
    journal: [],
    failureContext: null,
    failureHistory: [],
    branchName: null,
  };
}

/**
 * ExecutionState가 유효한지 검증한다 (pure).
 * @param {object} state - 검증할 상태 객체
 * @returns {boolean}
 */
export function isValidExecutionState(state) {
  if (!state || typeof state !== 'object') return false;
  if (!VALID_STATUSES.includes(state.status)) return false;
  if (!VALID_PHASE_STEPS.includes(state.phaseStep)) return false;
  if (typeof state.currentPhase !== 'number' || state.currentPhase < 1) return false;
  if (typeof state.fixAttempt !== 'number' || state.fixAttempt < 0) return false;
  if (!['interactive', 'semi-auto', 'auto'].includes(state.mode)) return false;
  if (!Array.isArray(state.completedPhases)) return false;
  // 시맨틱 검증 강화
  if (state.fixAttempt > MAX_FIX_ATTEMPTS) return false;
  if (state.status === 'completed' && !state.completedAt) return false;
  if (state.status === 'escalated' && !state.pendingEscalation) return false;
  if (new Set(state.completedPhases).size !== state.completedPhases.length) return false;
  return true;
}

/** phaseStep별 액션 생성 핸들러 맵 */
const STEP_HANDLERS = {
  'execute-tasks': (phase, phaseTasks) => ({
    action: 'execute-tasks',
    phase,
    tasks: phaseTasks,
    description: `Phase ${phase}: 태스크 실행 (${phaseTasks.length}개)`,
  }),
  materialize: (phase, phaseTasks) => ({
    action: 'materialize',
    phase,
    tasks: phaseTasks.filter((t) => isCodeTask(t)),
    description: `Phase ${phase}: 코드 Materialization`,
  }),
  review: (phase, phaseTasks) => ({
    action: 'review',
    phase,
    tasks: phaseTasks,
    description: `Phase ${phase}: 크로스 리뷰`,
  }),
  'quality-gate': (phase) => ({
    action: 'quality-gate',
    phase,
    description: `Phase ${phase}: 품질 게이트 체크`,
  }),
  fix: (phase, phaseTasks, state) => ({
    action: 'fix',
    phase,
    tasks: phaseTasks,
    description: `Phase ${phase}: 수정 (시도 ${state.fixAttempt + 1}/${MAX_FIX_ATTEMPTS})`,
  }),
  commit: (phase) => ({
    action: 'commit',
    phase,
    description: `Phase ${phase}: 커밋`,
  }),
  'build-context': (phase, phaseTasks, state, totalPhases) => {
    if (phase >= totalPhases) {
      return {
        action: 'complete',
        phase,
        description: '모든 Phase가 완료되었습니다. 실행을 종료합니다.',
      };
    }
    if (state.mode === 'interactive') {
      return {
        action: 'confirm-next-phase',
        phase,
        description: `Phase ${phase} 완료. Phase ${phase + 1}로 진행할까요?`,
      };
    }
    // semi-auto: batchSize Phase마다 확인 (예: batchSize=3이면 Phase 3, 6, 9... 에서 확인)
    if (state.mode === 'semi-auto' && state.batchSize > 0 && phase % state.batchSize === 0) {
      return {
        action: 'confirm-next-phase',
        phase,
        description: `Phase ${phase} 완료 (${state.batchSize}개 배치 완료). Phase ${phase + 1}로 진행할까요?`,
      };
    }
    return {
      action: 'build-context',
      phase,
      tasks: phaseTasks,
      description: `Phase ${phase}: 컨텍스트 생성 후 다음 Phase로 진행`,
    };
  },
};

/**
 * 다음 실행 단계를 결정한다 (pure).
 * @param {object} project - 프로젝트 객체 (executionState 포함)
 * @returns {object} 액션 descriptor
 */
export function getNextExecutionStep(project) {
  const state = project.executionState;

  if (!state) {
    return {
      action: 'not-started',
      phase: 0,
      description: '실행이 시작되지 않았습니다. init-execution을 먼저 실행하세요.',
    };
  }

  if (state.status === 'completed') {
    if (state.branchName && !(project.pullRequests || []).length) {
      return {
        action: 'suggest-pr',
        phase: state.currentPhase,
        branchName: state.branchName,
        description: `실행 완료. PR을 생성하시겠습니까? (branch: ${state.branchName})`,
      };
    }
    return {
      action: 'already-completed',
      phase: state.currentPhase,
      description: '이미 모든 실행이 완료되었습니다.',
    };
  }

  if (state.status === 'paused') {
    return {
      action: 'paused',
      phase: state.currentPhase,
      description: '실행이 일시 중지되었습니다. resume으로 재개하세요.',
    };
  }

  if (state.status === 'escalated') {
    return {
      action: 'escalate',
      phase: state.currentPhase,
      description: `Phase ${state.currentPhase}: CEO 결정이 필요합니다.`,
      context: { escalation: state.pendingEscalation },
    };
  }

  const totalPhases = getTotalPhases(project);
  const currentPhase = state.currentPhase;
  const phaseTasks = getTasksForPhase(project, currentPhase);

  const handler = STEP_HANDLERS[state.phaseStep];
  if (handler) {
    return handler(currentPhase, phaseTasks, state, totalPhases);
  }

  return {
    action: 'not-started',
    phase: currentPhase,
    description: `알 수 없는 phaseStep: ${state.phaseStep}`,
  };
}

/**
 * 순수 상태 전이 함수. I/O 없이 프로젝트 상태를 전이한다.
 * SDK에서 스토리지에 독립적으로 상태 전이를 계산할 때 사용.
 * @param {object} project - 프로젝트 객체 (executionState 포함)
 * @param {object} stepResult - 완료된 단계 결과
 * @returns {object} 업데이트된 프로젝트 객체 (새 객체, 원본 불변)
 */
export function computeStateTransition(project, stepResult) {
  if (!stepResult || typeof stepResult !== 'object') {
    throw inputError('stepResult 객체가 필요합니다');
  }
  if (!stepResult.completedAction || typeof stepResult.completedAction !== 'string') {
    throw inputError('stepResult.completedAction 문자열이 필요합니다');
  }
  if (!project.executionState) throw inputError('실행 상태가 초기화되지 않았습니다.');

  const state = structuredClone(project.executionState);
  const totalPhases = getTotalPhases(project);
  const phase = state.currentPhase;

  // phase 결과 캐시 초기화 (deep clone)
  if (!state.phaseResults[phase]) {
    state.phaseResults[phase] = {
      taskResults: [],
      reviews: [],
      qualityGate: null,
      committed: false,
    };
  } else {
    state.phaseResults[phase] = { ...state.phaseResults[phase] };
  }
  const phaseResult = state.phaseResults[phase];

  switch (stepResult.completedAction) {
    case 'execute-tasks':
      if (stepResult.taskResults) phaseResult.taskResults = stepResult.taskResults;
      state.phaseStep = 'materialize';
      state.lastCompletedStep = 'execute-tasks';
      break;

    case 'materialize':
      if (stepResult.materializeResult) {
        phaseResult.materializeResult = stepResult.materializeResult;
      }
      state.phaseStep = 'review';
      state.lastCompletedStep = 'materialize';
      state.status = 'reviewing';
      break;

    case 'review':
      if (stepResult.reviews) phaseResult.reviews = stepResult.reviews;
      state.phaseStep = 'quality-gate';
      state.lastCompletedStep = 'review';
      break;

    case 'quality-gate':
      if (stepResult.qualityGateResult) {
        phaseResult.qualityGate = stepResult.qualityGateResult;
      }
      if (stepResult.qualityGateResult && stepResult.qualityGateResult.passed) {
        state.phaseStep = 'commit';
        state.status = 'committing';
        state.failureContext = null;
      } else if (state.fixAttempt < MAX_FIX_ATTEMPTS) {
        state.phaseStep = 'fix';
        state.status = 'fixing';
        state.failureContext = buildFailureContext(state, stepResult);
      } else {
        state.failureContext = buildFailureContext(state, stepResult);
        state.status = 'escalated';
        state.pendingEscalation = {
          reason: `Phase ${phase}: 품질 게이트 ${MAX_FIX_ATTEMPTS}회 수정 후에도 실패`,
          unresolvedIssues: stepResult.qualityGateResult ? stepResult.qualityGateResult.issues : [],
          failureHistory: state.failureHistory || [],
        };
      }
      state.lastCompletedStep = 'quality-gate';
      break;

    case 'fix': {
      // 현재 실패 컨텍스트를 이력에 누적
      state.failureHistory = [...(state.failureHistory || [])];
      if (state.failureContext) {
        state.failureHistory.push({
          attempt: state.fixAttempt + 1,
          issues: state.failureContext.issues,
          timestamp: new Date().toISOString(),
        });
      }
      state.fixAttempt += 1;
      state.phaseStep = 'materialize';
      state.status = 'executing';
      state.lastCompletedStep = 'fix';
      break;
    }

    case 'commit':
      phaseResult.committed = true;
      state.phaseStep = 'build-context';
      state.status = 'executing';
      state.lastCompletedStep = 'commit';
      break;

    case 'build-context': {
      state.completedPhases = [...state.completedPhases, phase];
      state.lastCompletedStep = 'build-context';

      if (phase >= totalPhases) {
        state.status = 'completed';
        state.completedAt = new Date().toISOString();
      } else {
        state.currentPhase = phase + 1;
        state.phaseStep = 'execute-tasks';
        state.fixAttempt = 0;
        state.status = 'executing';
      }
      break;
    }

    case 'escalation-response':
      switch (stepResult.escalationDecision) {
        case 'continue':
          state.escalationCount = (state.escalationCount || 0) + 1;
          if (state.escalationCount > config.execution.maxEscalationAttempts) {
            throw inputError(
              `에스컬레이션 최대 횟수(${config.execution.maxEscalationAttempts}회)를 초과했습니다. skip 또는 abort를 선택하세요.`,
            );
          }
          state.fixAttempt = 0;
          state.phaseStep = 'fix';
          state.status = 'fixing';
          state.pendingEscalation = null;
          // CEO 피드백을 failureContext에 주입
          if (stepResult.ceoGuidance) {
            state.failureContext = {
              ...(state.failureContext || {}),
              ceoGuidance: stepResult.ceoGuidance,
            };
          }
          break;
        case 'skip':
          state.phaseStep = 'commit';
          state.status = 'committing';
          state.pendingEscalation = null;
          break;
        case 'abort':
          state.status = 'paused';
          break;
        default:
          throw inputError(`알 수 없는 에스컬레이션 결정: ${stepResult.escalationDecision}`);
      }
      state.lastCompletedStep = 'escalation-response';
      break;

    default:
      throw inputError(`알 수 없는 completedAction: ${stepResult.completedAction}`);
  }

  // 전이 유효성 검증
  const fromStep = project.executionState.phaseStep;
  const toStep = state.phaseStep;
  if (fromStep !== toStep && !isValidTransition(fromStep, toStep)) {
    throw inputError(`유효하지 않은 상태 전이: ${fromStep} → ${toStep}`);
  }

  // 저널 기록
  state.journal = [...(state.journal || [])];
  const journalEntry = {
    timestamp: new Date().toISOString(),
    action: stepResult.completedAction,
    fromStep,
    toStep,
    phase: state.currentPhase,
  };
  if (stepResult.completedAction === 'quality-gate' && state.failureContext) {
    const categories = [...new Set(state.failureContext.issues.map((i) => i.category))];
    journalEntry.failureSummary = {
      issueCount: state.failureContext.issues.length,
      categories,
    };
  }
  if (stepResult.completedAction === 'fix') {
    journalEntry.fixAttempt = state.fixAttempt;
  }
  state.journal.push(journalEntry);

  state.phaseResults[phase] = phaseResult;

  return { ...project, executionState: state };
}
