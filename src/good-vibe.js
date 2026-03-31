/**
 * good-vibe — 메인 SDK 클래스
 * 6개 슬래시 커맨드 플로우를 프로그래밍 API로 노출한다.
 */

import { getDefaultsForComplexity } from '../scripts/lib/agent/complexity-analyzer.js';
import { buildTeam, getOptimizedTeam } from '../scripts/lib/agent/team-builder.js';
import { generateReport } from '../scripts/lib/output/report-generator.js';
import { inputError } from '../scripts/lib/core/validators.js';
import { Discusser } from './discusser.js';
import { Executor } from './executor.js';
import { resolveStorage } from './storage.js';
import { DEFAULT_MODELS } from './defaults.js';

export class GoodVibe {
  /**
   * @param {object} options
   * @param {'claude'|'openai'|'gemini'} [options.provider='claude'] - LLM 프로바이더
   * @param {string} [options.model] - 모델 이름 (기본: 프로바이더별 기본값)
   * @param {string|object} [options.storage='memory'] - 스토리지 경로/객체/'memory'
   */
  constructor({ provider = 'claude', model, storage = 'memory', ...options } = {}) {
    this.provider = provider;
    this.model = model || DEFAULT_MODELS[provider] || DEFAULT_MODELS.claude;
    this.storage = resolveStorage(storage);
    this.options = options;
  }

  /**
   * /new — 복잡도 분석 + 팀 추천 + 빌드 (로컬 계산, LLM 미사용).
   * @param {string} idea - 프로젝트 아이디어 설명
   * @param {object} [options] - { projectType, complexity, personalityChoices }
   * @returns {Promise<{ mode: string, agents: Array, complexity: object, idea: string }>}
   */
  async buildTeam(idea, options = {}) {
    if (!idea || typeof idea !== 'string' || idea.trim() === '') {
      throw inputError(
        'idea는 비어있지 않은 문자열이어야 합니다',
        "buildTeam('프로젝트 설명')처럼 프로젝트를 설명하는 문자열을 전달하세요",
      );
    }
    const projectType = options.projectType || 'custom';
    const complexity = options.complexity || 'medium';

    const defaults = getDefaultsForComplexity(complexity);
    const { roles, optional } = await getOptimizedTeam(projectType, complexity);
    const agents = await buildTeam(roles, options.personalityChoices || {}, { complexity });

    const modeMap = { simple: 'quick-build', medium: 'plan-execute', complex: 'plan-only' };

    return {
      mode: modeMap[complexity] || 'plan-execute',
      agents,
      optional,
      complexity: { level: complexity, ...defaults },
      idea,
      type: projectType,
    };
  }

  /**
   * /discuss — 토론 자동 루프 (LLM 호출: tier별 병렬 → 종합 → 수렴까지 반복).
   * @param {object} team - buildTeam() 결과
   * @param {object} [hooks] - { onRoundComplete, onAgentCall }
   * @returns {Promise<{ document: string, rounds: number, convergence: object }>}
   */
  async discuss(team, hooks = {}) {
    if (!team || typeof team !== 'object') {
      throw inputError(
        'team 객체가 필요합니다',
        'buildTeam()의 반환값을 그대로 전달하세요: gv.discuss(await gv.buildTeam(idea))',
      );
    }
    if (!Array.isArray(team.agents) || team.agents.length === 0) {
      throw inputError(
        'team.agents 배열이 비어있습니다',
        'buildTeam()의 반환값을 그대로 전달하세요: const team = await gv.buildTeam(idea); gv.discuss(team)',
      );
    }
    const discusser = new Discusser({
      provider: this.provider,
      model: this.model,
      storage: this.storage,
      hooks,
    });
    return discusser.run(team);
  }

  /**
   * /execute — 실행 자동 루프 (LLM 호출: 태스크 → 리뷰 → 품질 게이트 → 수정 루프).
   * @param {object} plan - discuss() 결과 또는 실행 계획
   * @param {object} [hooks] - { onEscalation, onPhaseComplete, onAgentCall, onCommit, onConfirmPhase }
   * @returns {Promise<{ status: string, projectId: string, journal: Array }>}
   */
  async execute(plan, hooks = {}) {
    if (!plan || typeof plan !== 'object') {
      throw inputError(
        'plan 객체가 필요합니다',
        'execute()에는 { document, team, tasks } 형태의 객체를 전달하세요. discuss() 결과만으로는 부족합니다',
      );
    }
    const executor = new Executor({
      provider: this.provider,
      model: this.model,
      storage: this.storage,
      hooks,
    });
    return executor.run(plan);
  }

  /**
   * /execute (수동 모드) — 스텝 이터레이터.
   * @param {object} plan - discuss() 결과
   * @yields {{ action: string, phase: number, proceed: Function, decide: Function }}
   */
  async *executeSteps(plan) {
    const executor = new Executor({
      provider: this.provider,
      model: this.model,
      storage: this.storage,
    });
    yield* executor.steps(plan);
  }

  /**
   * /report — 보고서 생성 (포매팅, LLM 미사용).
   * @param {object} result - execute() 결과 또는 프로젝트 데이터
   * @returns {string} 마크다운 보고서
   */
  report(result) {
    if (!result || typeof result !== 'object') {
      throw inputError(
        'report에 전달할 결과 객체가 필요합니다',
        'execute()의 반환값을 전달하세요: const result = await gv.execute(plan); gv.report(result)',
      );
    }
    // result가 프로젝트 형태가 아니면 최소 구조를 만들어줌
    const project = result.name
      ? result
      : {
          name: 'SDK Project',
          type: 'custom',
          mode: 'plan-execute',
          status: result.status || 'completed',
          team: result.team || [],
          tasks: result.tasks || [],
          discussion: result.discussion || { planDocument: '', rounds: [] },
          metrics: result.metrics || null,
        };
    return generateReport(project);
  }
}
