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
import { config } from '../scripts/lib/core/config.js';
import { DEFAULTS } from './defaults.js';

export class Discusser {
  /**
   * @param {object} options
   * @param {string} options.provider - LLM 프로바이더 ID
   * @param {string} options.model - 모델 이름
   * @param {object} options.storage - 스토리지 인터페이스
   * @param {object} [options.hooks] - 이벤트 훅
   * @param {boolean} [options.parallelTiers] - Tier 간 병렬 실행 여부 (기본: config.discussion.parallelTiers)
   */
  constructor({ provider, model, storage, hooks = {}, parallelTiers }) {
    this.provider = provider;
    this.model = model;
    this.storage = storage;
    this.hooks = hooks;
    this.parallelTiers = parallelTiers ?? config.discussion.parallelTiers;
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
    let feedbackByRole = {};

    for (let round = 1; round <= maxRounds; round++) {
      // 1) 에이전트 분석 — parallelTiers 설정에 따라 전체 병렬 또는 Tier별 순차
      const tiers = groupAgentsForParallelDispatch(agents);
      const parallelTiers = this.parallelTiers;
      const analyses = [];

      if (parallelTiers) {
        // 전체 에이전트 병렬 실행 (Tier 간 순차 불필요 — priorTierOutputs 미사용)
        const allAgents = tiers.flat();
        const allResults = await Promise.all(
          allAgents.map(async (member) => {
            const prompt = buildAgentAnalysisPrompt(project, member, {
              round,
              previousSynthesis: lastPlan,
              feedbackForMe: feedbackByRole[member.roleId],
            });
            const response = await this._call(member.roleId, prompt);
            return {
              roleId: member.roleId,
              role: member.role,
              emoji: member.emoji,
              analysis: response.text,
            };
          }),
        );
        analyses.push(...allResults);
      } else {
        // 기존 Tier별 순차 실행 (fallback)
        for (const tier of tiers) {
          const tierResults = await Promise.all(
            tier.map(async (member) => {
              const prompt = buildAgentAnalysisPrompt(project, member, {
                round,
                previousSynthesis: lastPlan,
                peerOutputs: analyses,
                feedbackForMe: feedbackByRole[member.roleId],
              });
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
          return { roleId: member.roleId, text: response.text };
        }),
      );

      // 4) 수렴 체크
      const parsed = reviews.map((r) => parseReviewOutput(r.text));
      const convergence = checkConvergence(parsed);
      lastConvergence = convergence;

      // 5) 비승인 에이전트의 피드백을 역할별로 수집 → 다음 라운드에 주입
      feedbackByRole = {};
      parsed.forEach((review, idx) => {
        if (!review.approved && review.feedback) {
          const roleId = reviews[idx].roleId;
          feedbackByRole[roleId] = review.feedback;
        }
      });
      await this.hooks.onRoundComplete?.(round, convergence);

      if (convergence.converged) {
        const result = { document: lastPlan, rounds: round, convergence };
        await this._persist(team, result);
        return result;
      }
    }

    const result = {
      document: lastPlan,
      rounds: maxRounds,
      convergence: { ...lastConvergence, converged: false, reason: 'max-rounds' },
    };
    await this._persist(team, result);
    return result;
  }

  /**
   * 토론 결과를 스토리지에 저장한다 (있을 경우).
   */
  async _persist(team, result) {
    if (!this.storage || typeof this.storage.write !== 'function') return;
    if (!team.projectId) return;
    try {
      const existing = await this.storage.read(team.projectId);
      if (existing) {
        await this.storage.write(team.projectId, {
          ...existing,
          discussion: {
            planDocument: result.document,
            rounds: result.rounds,
            convergence: result.convergence,
          },
        });
      }
    } catch (err) {
      // 저장 실패 로그 (토론 결과는 반환값으로 전달되므로 비차단)
      this.hooks.onError?.('persist-failed', err);
    }
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
