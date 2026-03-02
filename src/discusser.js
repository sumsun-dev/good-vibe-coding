/**
 * discusser — 토론 루프 드라이버
 * orchestrator.js의 프롬프트 빌더 + llm-provider.js의 LLM 호출을 연결하여
 * 토론 자동 루프를 구현한다.
 */

import {
  groupAgentsForParallelDispatch,
  buildAgentAnalysisPrompt,
  buildSynthesisPrompt,
  buildReviewPrompt,
  checkConvergence,
  parseReviewOutput,
} from '../scripts/lib/engine/orchestrator.js';
import { callLLM } from '../scripts/lib/llm/llm-provider.js';
import { DEFAULTS } from './defaults.js';

export class Discusser {
  /**
   * @param {object} options
   * @param {string} options.provider - LLM 프로바이더 ID
   * @param {string} options.model - 모델 이름
   * @param {object} options.storage - 스토리지 인터페이스
   * @param {object} [options.hooks] - 이벤트 훅
   */
  constructor({ provider, model, storage, hooks = {} }) {
    this.provider = provider;
    this.model = model;
    this.storage = storage;
    this.hooks = hooks;
  }

  /**
   * 토론 자동 루프를 실행한다.
   * tier별 순차 → tier 내부 병렬 → 종합 → 리뷰 → 수렴까지 반복.
   * @param {object} team - buildTeam() 결과 ({ agents, idea, complexity, ... })
   * @returns {Promise<{ document: string, rounds: number, convergence: object }>}
   */
  async run(team) {
    const maxRounds = team.complexity?.discussionRounds || DEFAULTS.maxDiscussionRounds;
    const agents = team.agents || [];
    const project = { name: team.idea, type: team.type || 'custom', description: team.idea };
    let lastPlan = null;
    let lastConvergence = null;

    for (let round = 1; round <= maxRounds; round++) {
      // 1) Tier별 순차, tier 내부 병렬 — 에이전트 분석
      const tiers = groupAgentsForParallelDispatch(agents);
      const analyses = [];

      for (const tier of tiers) {
        const tierResults = await Promise.all(
          tier.map(async (member) => {
            const prompt = buildAgentAnalysisPrompt(
              project,
              member,
              { round, previousSynthesis: lastPlan, peerOutputs: analyses },
            );
            const response = await this._call(member.roleId, prompt);
            return {
              roleId: member.roleId,
              role: member.role,
              emoji: member.emoji,
              analysis: response.text,
            };
          }),
        );
        analyses.push(...tierResults);
      }

      // 2) 종합 — 기획서 생성
      const synthesisPrompt = buildSynthesisPrompt(project, analyses, round);
      const planResponse = await this._call('synthesis', synthesisPrompt);
      lastPlan = planResponse.text;

      // 3) 전원 리뷰 (병렬)
      const reviews = await Promise.all(
        agents.map(async (member) => {
          const prompt = buildReviewPrompt(member, lastPlan, round);
          const response = await this._call(member.roleId, prompt);
          return response.text;
        }),
      );

      // 4) 수렴 체크
      const parsed = reviews.map((r) => parseReviewOutput(r));
      const convergence = checkConvergence(parsed);
      lastConvergence = convergence;
      await this.hooks.onRoundComplete?.(round, convergence);

      if (convergence.converged) {
        return { document: lastPlan, rounds: round, convergence };
      }
    }

    return {
      document: lastPlan,
      rounds: maxRounds,
      convergence: { ...lastConvergence, converged: false, reason: 'max-rounds' },
    };
  }

  /**
   * LLM을 호출하고 훅을 실행한다.
   * @param {string} roleId - 역할 ID
   * @param {string} prompt - 프롬프트
   * @returns {Promise<{ text: string, provider: string, model: string, tokenCount: number }>}
   */
  async _call(roleId, prompt) {
    const response = await callLLM(this.provider, prompt, { model: this.model });
    await this.hooks.onAgentCall?.(roleId, response);
    return response;
  }
}
