/**
 * dispatch-plan-generator — 구조화된 JSON 디스패치 계획 생성
 *
 * 프롬프트 생성(orchestrator 등)과 커맨드 레이어(cli.js) 사이의 브릿지.
 * 토론/실행에 필요한 모든 정보를 하나의 JSON 계획으로 구조화한다.
 */

import {
  buildAgentAnalysisPrompt,
  buildSynthesisPrompt,
  buildReviewPrompt,
  groupAgentsForParallelDispatch,
} from './orchestrator.js';
import {
  buildExecutionPlanWithReviews,
  buildExecutionPrompt,
  buildTddExecutionPrompt,
  isCodeTask,
} from './task-distributor.js';
import { selectReviewers, buildTaskReviewPrompt } from './review-engine.js';
import { config } from '../core/config.js';

/**
 * 토론 디스패치 계획을 생성한다.
 * 멀티에이전트 토론의 전체 구조를 JSON으로 표현한다.
 *
 * @param {object} project - 프로젝트 정보
 * @param {Array<object>} team - 팀원 배열
 * @param {object} [context={}] - 추가 컨텍스트
 * @param {number} [context.round] - 현재 라운드 (기본 1)
 * @param {string} [context.previousSynthesis] - 이전 종합 결과
 * @param {number} [context.maxRounds] - 최대 라운드 수 (기본 3)
 * @returns {object} 구조화된 토론 디스패치 계획
 */
export function buildDiscussionDispatchPlan(project, team, context = {}) {
  if (!project || !team || team.length === 0) {
    return {
      type: 'discussion',
      project: null,
      tiers: [],
      synthesisPrompt: '',
      convergenceConfig: {
        threshold: config.convergence.threshold,
        maxRounds: config.convergence.maxRounds,
      },
    };
  }

  const round = context.round || 1;
  const maxRounds = context.maxRounds || config.convergence.maxRounds;

  const tiers = groupAgentsForParallelDispatch(team);

  const tieredAgents = tiers.map((tierMembers, idx) => ({
    tier: idx + 1,
    agents: tierMembers.map((member) => ({
      roleId: member.roleId,
      displayName: member.displayName,
      emoji: member.emoji,
      model: member.model,
      // prompt는 { system, user } 객체 — 캐싱 가능한 system + 동적 user
      prompt: buildAgentAnalysisPrompt(project, member, {
        round,
        previousSynthesis: context.previousSynthesis,
        feedbackForMe: context.feedbackForMe?.[member.roleId],
      }),
    })),
  }));

  const synthesisPrompt = buildSynthesisPrompt(
    project,
    team.map((m) => ({
      roleId: m.roleId,
      role: m.role,
      emoji: m.emoji,
      analysis: `{{${m.roleId}_output}}`,
    })),
    round,
  );

  const reviewPrompts = team.map((member) => ({
    roleId: member.roleId,
    displayName: member.displayName,
    emoji: member.emoji,
    // prompt는 { system, user } 객체
    prompt: buildReviewPrompt(member, '{{synthesized_plan}}', round),
  }));

  return {
    type: 'discussion',
    project: { id: project.id, name: project.name, type: project.type },
    round,
    tiers: tieredAgents,
    synthesisPrompt,
    reviewPrompts,
    convergenceConfig: {
      threshold: config.convergence.threshold,
      maxRounds,
    },
  };
}

/**
 * 실행 디스패치 계획을 생성한다.
 * 태스크 실행 + 리뷰의 전체 구조를 JSON으로 표현한다.
 *
 * @param {object} project - 프로젝트 정보
 * @param {Array<object>} tasks - 태스크 배열
 * @param {Array<object>} team - 팀원 배열
 * @param {object} [context={}] - 추가 컨텍스트
 * @param {string} [context.planExcerpt] - 기획 결정사항
 * @param {string} [context.testFramework] - 테스트 프레임워크
 * @returns {object} 구조화된 실행 디스패치 계획
 */
export function buildExecutionDispatchPlan(project, tasks, team, context = {}) {
  if (!project || !tasks || tasks.length === 0 || !team || team.length === 0) {
    return {
      type: 'execution',
      project: null,
      phases: [],
      reviewConfig: {
        minReviewers: config.review.minReviewers,
        maxRevisionRounds: config.review.maxRevisionRounds,
      },
    };
  }

  const executionPlan = buildExecutionPlanWithReviews(tasks, team);
  const teamMap = Object.fromEntries(team.map((m) => [m.roleId, m]));

  const phases = executionPlan.phases.map((phase) => {
    if (phase.type === 'execute') {
      return {
        type: 'execute',
        phase: phase.phase,
        tasks: phase.tasks.map((task) => {
          const member = teamMap[task.assignee];
          const codeTask = isCodeTask(task);

          let prompt;
          if (codeTask && member) {
            prompt = buildTddExecutionPrompt(task, member, {
              projectType: project.type,
              testFramework: context.testFramework,
              planExcerpt: context.planExcerpt,
            });
          } else if (member) {
            prompt = buildExecutionPrompt(task, member, {
              planExcerpt: context.planExcerpt,
            });
          } else {
            prompt = null;
          }

          return {
            id: task.id,
            title: task.title,
            assignee: task.assignee,
            isCodeTask: codeTask,
            model: member?.model || 'sonnet',
            prompt,
          };
        }),
      };
    }

    // review phase
    return {
      type: 'review',
      phase: phase.phase,
      tasks: phase.tasks.map((task) => {
        const reviewers = selectReviewers(task, team);
        return {
          id: task.id,
          title: task.title,
          assignee: task.assignee,
          reviewers: reviewers.map((r) => ({
            roleId: r.roleId,
            displayName: r.displayName,
            emoji: r.emoji,
            model: r.model || 'sonnet',
            // prompt는 { system, user } 객체
            prompt: buildTaskReviewPrompt(r, task, `{{${task.id}_output}}`),
          })),
        };
      }),
    };
  });

  return {
    type: 'execution',
    project: { id: project.id, name: project.name, type: project.type },
    phases,
    dependencies: executionPlan.dependencies,
    reviewConfig: {
      minReviewers: config.review.minReviewers,
      maxRevisionRounds: config.review.maxRevisionRounds,
    },
  };
}
