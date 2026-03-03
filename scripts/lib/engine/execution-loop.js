/**
 * execution-loop — 실행 루프 I/O 허브
 *
 * I/O 함수(advanceExecution, initExecution)를 제공하고,
 * state-machine.js와 execution-utils.js의 순수 함수를 re-export한다.
 *
 * 모든 기존 import를 유지하기 위한 하위 호환 레이어.
 */

import {
  getProject,
  getProjectDir,
  updateExecutionState,
  recordMetrics,
  recordContributions,
  addPullRequest,
} from '../project/project-manager.js';
import { config } from '../core/config.js';
import { inputError, notFoundError } from '../core/validators.js';
import { finalizeWithPR } from '../project/pr-manager.js';

// Re-export: state-machine.js
export {
  PHASE_TRANSITIONS,
  isValidTransition,
  createInitialExecutionState,
  isValidExecutionState,
  getNextExecutionStep,
  computeStateTransition,
} from './state-machine.js';

// Re-export: execution-utils.js
export {
  categorizeFailure,
  buildFailureContext,
  extractContributions,
  getTotalPhases,
  getTasksForPhase,
  getExecutionSummary,
  isStaleExecution,
} from './execution-utils.js';

// Internal imports for I/O functions
import { getNextExecutionStep, computeStateTransition, createInitialExecutionState, isValidExecutionState } from './state-machine.js';
import { extractContributions, getTasksForPhase } from './execution-utils.js';

/**
 * 실행 상태를 전이시키고 영속화한다.
 * @param {string} projectId - 프로젝트 ID
 * @param {object} stepResult - 완료된 단계 결과
 * @returns {Promise<{project: object, nextStep: object}>}
 */
export async function advanceExecution(projectId, stepResult) {
  const project = await getProject(projectId);
  if (!project) throw notFoundError(`프로젝트를 찾을 수 없습니다: ${projectId}`);

  const updatedProject = computeStateTransition(project, stepResult);
  await updateExecutionState(projectId, updatedProject.executionState);

  // 자동 수집: fire-and-forget (실패해도 메인 로직 미영향)
  const phase = project.executionState.currentPhase;
  if (stepResult.completedAction === 'build-context') {
    const phaseTasks = getTasksForPhase(project, phase);
    recordMetrics(projectId, {
      type: 'phase-completion',
      phase,
      fixAttempts: updatedProject.executionState.fixAttempt,
      taskCount: phaseTasks.length,
    }).catch((err) => { process.stderr.write(`[gvc] metrics error: ${err.message}\n`); });
  }
  if (stepResult.completedAction === 'review' && stepResult.reviews) {
    const contributions = extractContributions(stepResult.reviews);
    if (contributions.length > 0) {
      recordContributions(projectId, contributions).catch((err) => { process.stderr.write(`[gvc] contributions error: ${err.message}\n`); });
    }
  }

  // 실행 완료 시 PR 자동 생성 (fire-and-forget)
  if (updatedProject.executionState.status === 'completed' && config.github.enabled) {
    const projectDir = getProjectDir(projectId);
    finalizeWithPR(projectDir, {
      project: updatedProject,
      executionState: updatedProject.executionState,
      githubConfig: config.github,
    })
      .then((result) => {
        if (result.pr && result.pr.url) {
          return addPullRequest(projectId, {
            url: result.pr.url,
            branchName: updatedProject.executionState.branchName,
          });
        }
      })
      .catch((err) => { process.stderr.write(`[gvc] PR creation error: ${err.message}\n`); });
  }

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
  if (!project) throw notFoundError(`프로젝트를 찾을 수 없습니다: ${projectId}`);

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
    throw inputError('기존 실행 상태가 손상되었습니다. resume=false로 재시작하세요.');
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
