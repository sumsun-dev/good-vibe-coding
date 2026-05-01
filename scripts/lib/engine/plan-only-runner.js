/**
 * plan-only-runner — plan-only 모드 활성 프로젝트의 다라운드 토론 오케스트레이션.
 *
 * 흐름: (팀 미구성 시) team build → 라운드별 [tier 병렬 분석 → synthesis → review →
 *      convergence] → 수렴 시 planDocument 저장 + status: approved.
 * 미수렴 시 maxRounds 도달까지 반복 후 finalState=maxRounds 반환 (status는 planning 유지).
 *
 * useLLM=false: placeholder 모드 — LLM 호출 없이 즉시 수렴 (CI/테스트용).
 * useLLM=true: callLLM 함수 주입 필수 (callLLMWithFallback 권장).
 */

import { config } from '../core/config.js';
import { inputError } from '../core/validators.js';
import {
  setProjectTeam,
  setProjectPlan,
  updateProjectStatus,
  addDiscussionRound,
} from '../project/project-manager.js';
import { getOptimizedTeam, buildTeam } from '../agent/team-builder.js';
import {
  buildAgentAnalysisPrompt,
  buildSynthesisPrompt,
  buildReviewPrompt,
  parseReviewOutput,
  checkConvergence,
  groupAgentsForParallelDispatch,
  selectDiscussionReviewers,
} from './orchestrator.js';

const DEFAULT_PROVIDER = 'claude';

async function ensureTeam(project) {
  if (Array.isArray(project.team) && project.team.length > 0) return project.team;
  const optimized = await getOptimizedTeam(project.type, 'complex');
  const team = await buildTeam(optimized.roles);
  if (!Array.isArray(team) || team.length === 0) {
    throw inputError(`프로젝트 타입 "${project.type}"에 대한 팀을 구성할 수 없습니다`);
  }
  await setProjectTeam(project.id, team);
  return team;
}

async function callOrPlaceholder({ useLLM, callLLM }, prompt, options, placeholderText) {
  if (!useLLM) return placeholderText;
  const isObj = prompt && typeof prompt === 'object';
  const userText = isObj ? prompt.user : prompt;
  const systemText = isObj ? prompt.system : undefined;
  const result = await callLLM(DEFAULT_PROVIDER, userText, {
    systemMessage: systemText,
    model: options.model,
  });
  return result.text;
}

async function runAgentAnalysis(project, team, round, previousSynthesis, ctx) {
  const tiers = groupAgentsForParallelDispatch(team);
  const agentOutputs = [];

  for (const tier of tiers) {
    const tierResults = await Promise.all(
      tier.map(async (member) => {
        const prompt = buildAgentAnalysisPrompt(project, member, { round, previousSynthesis });
        const text = await callOrPlaceholder(
          ctx,
          prompt,
          { model: member.model },
          `[placeholder analysis ${member.roleId} round ${round}]`,
        );
        return {
          roleId: member.roleId,
          role: member.role || member.roleId,
          analysis: text,
        };
      }),
    );
    agentOutputs.push(...tierResults);
  }

  return agentOutputs;
}

async function runSynthesis(project, agentOutputs, round, ctx) {
  const prompt = buildSynthesisPrompt(project, agentOutputs, round);
  return callOrPlaceholder(
    ctx,
    prompt,
    { model: 'haiku' },
    `## [placeholder synthesis round ${round}]\n프로젝트: ${project.name}`,
  );
}

async function runReviews(team, synthesis, round, ctx) {
  const reviewers = selectDiscussionReviewers(team, config.discussion.maxReviewers || 3);
  const placeholderReview = JSON.stringify({
    approved: true,
    feedback: '[placeholder]',
    issues: [],
  });

  return Promise.all(
    reviewers.map(async (reviewer) => {
      const prompt = buildReviewPrompt(reviewer, synthesis, round);
      const text = await callOrPlaceholder(
        ctx,
        prompt,
        { model: reviewer.model },
        placeholderReview,
      );
      return parseReviewOutput(text);
    }),
  );
}

/**
 * plan-only 다라운드 토론을 실행한다.
 *
 * @param {object} project - 활성 프로젝트 (status=planning, mode=plan-only 가정)
 * @param {object} [opts]
 * @param {boolean} [opts.useLLM=false] - 실제 LLM 호출 여부
 * @param {Function} [opts.callLLM] - useLLM=true일 때 필수. (provider, prompt, options) → {text, model, ...}
 * @param {number} [opts.maxRounds] - 기본 config.convergence.maxRounds
 * @returns {Promise<{finalState: 'approved'|'maxRounds', rounds: number, converged: boolean, planDocument?: string}>}
 */
export async function runPlanOnly(project, opts = {}) {
  const useLLM = opts.useLLM === true;
  const callLLM = opts.callLLM;
  if (useLLM && typeof callLLM !== 'function') {
    throw inputError('useLLM=true이면 callLLM 함수를 주입해야 합니다');
  }

  const maxRounds = opts.maxRounds || config.convergence.maxRounds || 3;
  const team = await ensureTeam(project);
  const ctx = { useLLM, callLLM };

  let round = 0;
  let previousSynthesis = '';
  let lastSynthesis = '';
  let convergedResult = null;

  while (round < maxRounds) {
    round += 1;
    const agentOutputs = await runAgentAnalysis(project, team, round, previousSynthesis, ctx);
    const synthesis = await runSynthesis(project, agentOutputs, round, ctx);
    const reviews = await runReviews(team, synthesis, round, ctx);
    const converged = checkConvergence(reviews);

    await addDiscussionRound(project.id, {
      round,
      agentOutputs,
      synthesis,
      reviews,
      converged: converged.converged,
    });

    lastSynthesis = synthesis;
    previousSynthesis = synthesis;
    if (converged.converged) {
      convergedResult = converged;
      break;
    }
  }

  if (convergedResult) {
    await setProjectPlan(project.id, lastSynthesis);
    await updateProjectStatus(project.id, 'approved');
    return {
      finalState: 'approved',
      rounds: round,
      converged: true,
      planDocument: lastSynthesis,
    };
  }

  return {
    finalState: 'maxRounds',
    rounds: round,
    converged: false,
  };
}
