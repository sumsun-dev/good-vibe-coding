/**
 * mode-dispatcher — 활성 프로젝트의 mode/status에 따라 적절한 흐름으로 분기.
 *
 * 1차 PR scope: plan-only (planning → approved)만 구현.
 * plan-execute / quick-build는 후속 PR.
 */

import { inputError } from '../core/validators.js';
import { runPlanOnly } from './plan-only-runner.js';

/**
 * 활성 프로젝트(planning 상태)를 받아 mode별 흐름으로 디스패치한다.
 * 호출 측은 project.status === 'planning'을 사전 검증해서 보내야 한다.
 *
 * @param {object} project - 활성 프로젝트 객체
 * @param {object} [opts]
 * @param {boolean} [opts.useLLM] - 실제 LLM 호출 여부. false면 placeholder
 * @param {Function} [opts.callLLM] - useLLM=true일 때 사용할 LLM 함수 (callLLMWithFallback 등)
 * @param {Function} [opts.journal] - 진행 이벤트 콜백
 * @param {number} [opts.maxRounds] - plan-only 최대 라운드 (기본 config.convergence.maxRounds)
 * @returns {Promise<{finalState: string, rounds: number, converged: boolean, planDocument?: string}>}
 */
export async function runActiveProjectFlow(project, opts = {}) {
  if (!project || project.status !== 'planning') {
    throw inputError(
      `runActiveProjectFlow는 status=planning만 처리합니다 (received: ${project?.status})`,
    );
  }

  switch (project.mode) {
    case 'plan-only':
      return runPlanOnly(project, opts);
    case 'plan-execute':
      throw inputError('plan-execute 모드는 후속 PR에서 구현 예정입니다');
    case 'quick-build':
      throw inputError('quick-build 모드는 후속 PR에서 구현 예정입니다');
    default:
      throw inputError(`알 수 없는 mode: ${project.mode}`);
  }
}
