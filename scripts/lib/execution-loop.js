/**
 * execution-loop — 상태 머신 기반 실행 루프 모듈
 *
 * 상태 전이 다이어그램:
 * initExecution()
 *     ↓
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
import { getProject, updateExecutionState } from './project-manager.js';

const VALID_STATUSES = ['idle', 'executing', 'reviewing', 'fixing', 'committing', 'paused', 'escalated', 'completed'];
const VALID_PHASE_STEPS = ['execute-tasks', 'materialize', 'review', 'quality-gate', 'fix', 'commit', 'build-context'];
const MAX_FIX_ATTEMPTS = 2;

/**
 * 유효한 phaseStep 전이 맵.
 * 각 단계에서 이동할 수 있는 다음 단계를 정의한다.
 */
export const PHASE_TRANSITIONS = {
  'execute-tasks': ['materialize'],
  'materialize': ['review'],
  'review': ['quality-gate'],
  'quality-gate': ['commit', 'fix', 'escalated'],   // passed → commit, failed → fix/escalated
  'fix': ['materialize'],                              // 수정 후 materialize로 재진입
  'commit': ['build-context'],
  'build-context': ['execute-tasks', 'completed'],     // 다음 phase 또는 완료
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
export function createInitialExecutionState(mode = 'interactive') {
  return {
    status: 'executing',
    currentPhase: 1,
    phaseStep: 'execute-tasks',
    fixAttempt: 0,
    mode: mode === 'auto' ? 'auto' : 'interactive',
    lastCompletedStep: null,
    completedPhases: [],
    pendingEscalation: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
    phaseResults: {},
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
  if (!['interactive', 'auto'].includes(state.mode)) return false;
  if (!Array.isArray(state.completedPhases)) return false;
  return true;
}

/**
 * 프로젝트의 총 phase 수를 계산한다.
 * @param {object} project - 프로젝트 객체
 * @returns {number}
 */
function getTotalPhases(project) {
  const tasks = project.tasks || [];
  const phases = new Set(tasks.map(t => t.phase).filter(Boolean));
  return phases.size || 1;
}

/**
 * 특정 phase의 태스크를 반환한다.
 * @param {object} project - 프로젝트 객체
 * @param {number} phase - phase 번호
 * @returns {Array}
 */
function getTasksForPhase(project, phase) {
  return (project.tasks || []).filter(t => (t.phase || 1) === phase);
}

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

  switch (state.phaseStep) {
    case 'execute-tasks':
      return {
        action: 'execute-tasks',
        phase: currentPhase,
        tasks: phaseTasks,
        description: `Phase ${currentPhase}: 태스크 실행 (${phaseTasks.length}개)`,
      };

    case 'materialize':
      return {
        action: 'materialize',
        phase: currentPhase,
        tasks: phaseTasks.filter(t => isCodeTask(t)),
        description: `Phase ${currentPhase}: 코드 Materialization`,
      };

    case 'review':
      return {
        action: 'review',
        phase: currentPhase,
        tasks: phaseTasks,
        description: `Phase ${currentPhase}: 크로스 리뷰`,
      };

    case 'quality-gate':
      return {
        action: 'quality-gate',
        phase: currentPhase,
        description: `Phase ${currentPhase}: 품질 게이트 체크`,
      };

    case 'fix':
      return {
        action: 'fix',
        phase: currentPhase,
        tasks: phaseTasks,
        description: `Phase ${currentPhase}: 수정 (시도 ${state.fixAttempt + 1}/${MAX_FIX_ATTEMPTS})`,
      };

    case 'commit':
      return {
        action: 'commit',
        phase: currentPhase,
        description: `Phase ${currentPhase}: 커밋`,
      };

    case 'build-context': {
      const isLastPhase = currentPhase >= totalPhases;

      if (isLastPhase) {
        return {
          action: 'complete',
          phase: currentPhase,
          description: '모든 Phase가 완료되었습니다. 실행을 종료합니다.',
        };
      }

      if (state.mode === 'interactive') {
        return {
          action: 'confirm-next-phase',
          phase: currentPhase,
          description: `Phase ${currentPhase} 완료. Phase ${currentPhase + 1}로 진행할까요?`,
        };
      }

      return {
        action: 'build-context',
        phase: currentPhase,
        tasks: phaseTasks,
        description: `Phase ${currentPhase}: 컨텍스트 생성 후 다음 Phase로 진행`,
      };
    }

    default:
      return {
        action: 'not-started',
        phase: currentPhase,
        description: `알 수 없는 phaseStep: ${state.phaseStep}`,
      };
  }
}

/**
 * 실행 상태를 전이시키고 영속화한다.
 * @param {string} projectId - 프로젝트 ID
 * @param {object} stepResult - 완료된 단계 결과
 * @returns {Promise<{project: object, nextStep: object}>}
 */
export async function advanceExecution(projectId, stepResult) {
  if (!stepResult || typeof stepResult !== 'object') {
    throw new Error('stepResult 객체가 필요합니다');
  }
  if (!stepResult.completedAction || typeof stepResult.completedAction !== 'string') {
    throw new Error('stepResult.completedAction 문자열이 필요합니다');
  }

  const project = await getProject(projectId);
  if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${projectId}`);
  if (!project.executionState) throw new Error('실행 상태가 초기화되지 않았습니다.');

  const state = {
    ...project.executionState,
    phaseResults: { ...project.executionState.phaseResults },
    completedPhases: [...project.executionState.completedPhases],
  };
  const totalPhases = getTotalPhases(project);
  const phase = state.currentPhase;

  // phase 결과 캐시 초기화 (deep clone)
  if (!state.phaseResults[phase]) {
    state.phaseResults[phase] = { taskResults: [], reviews: [], qualityGate: null, committed: false };
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
      } else if (state.fixAttempt < MAX_FIX_ATTEMPTS) {
        state.phaseStep = 'fix';
        state.status = 'fixing';
      } else {
        state.status = 'escalated';
        state.pendingEscalation = {
          reason: `Phase ${phase}: 품질 게이트 ${MAX_FIX_ATTEMPTS}회 수정 후에도 실패`,
          unresolvedIssues: stepResult.qualityGateResult ? stepResult.qualityGateResult.issues : [],
        };
      }
      state.lastCompletedStep = 'quality-gate';
      break;

    case 'fix':
      state.fixAttempt += 1;
      state.phaseStep = 'materialize';
      state.status = 'executing';
      state.lastCompletedStep = 'fix';
      break;

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
          state.fixAttempt = 0;
          state.phaseStep = 'fix';
          state.status = 'fixing';
          state.pendingEscalation = null;
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
          throw new Error(`알 수 없는 에스컬레이션 결정: ${stepResult.escalationDecision}`);
      }
      state.lastCompletedStep = 'escalation-response';
      break;

    default:
      throw new Error(`알 수 없는 completedAction: ${stepResult.completedAction}`);
  }

  state.phaseResults[phase] = phaseResult;
  const updatedProject = await updateExecutionState(projectId, state);

  return {
    project: updatedProject,
    nextStep: getNextExecutionStep(updatedProject),
  };
}

/**
 * 실행을 초기화하거나 재개한다.
 * @param {string} projectId - 프로젝트 ID
 * @param {object} options - 옵션
 * @param {'interactive'|'auto'} [options.mode='interactive'] - 실행 모드
 * @param {boolean} [options.resume=false] - 재개 여부
 * @returns {Promise<{project: object, nextStep: object, resumed: boolean}>}
 */
export async function initExecution(projectId, options = {}) {
  const { mode = 'interactive', resume = false } = options;

  const project = await getProject(projectId);
  if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${projectId}`);

  const hasExistingState = project.executionState && isValidExecutionState(project.executionState);

  if (hasExistingState && resume) {
    // 재개: 기존 상태 유지, paused면 executing으로 복원
    const state = { ...project.executionState };
    if (state.status === 'paused') {
      state.status = 'executing';
    }
    const updatedProject = await updateExecutionState(projectId, state);
    return {
      project: updatedProject,
      nextStep: getNextExecutionStep(updatedProject),
      resumed: true,
    };
  }

  if (resume && !hasExistingState && project.executionState) {
    throw new Error('기존 실행 상태가 손상되었습니다. resume=false로 재시작하세요.');
  }

  // 새 실행 초기화
  const initialState = createInitialExecutionState(mode);
  const updatedProject = await updateExecutionState(projectId, initialState);

  return {
    project: updatedProject,
    nextStep: getNextExecutionStep(updatedProject),
    resumed: false,
  };
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
  const percentage = state.status === 'completed'
    ? 100
    : totalPhases > 0
      ? Math.round((completedCount / totalPhases) * 100)
      : 0;

  const stepLabels = {
    'execute-tasks': '태스크 실행',
    'materialize': '코드 구체화',
    'review': '크로스 리뷰',
    'quality-gate': '품질 게이트',
    'fix': '수정',
    'commit': '커밋',
    'build-context': '컨텍스트 생성',
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
