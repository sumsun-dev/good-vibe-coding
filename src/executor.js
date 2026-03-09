/**
 * executor — 실행 루프 드라이버
 * execution-loop.js 상태 머신 + LLM 호출을 연결하여 실행 자동 루프를 구현한다.
 * 현재 Claude Code 에이전트가 commands/execute.md를 읽고 수동으로 하던 전체 루프를 자동화.
 */

import {
  getNextExecutionStep,
  computeStateTransition,
  createInitialExecutionState,
} from '../scripts/lib/engine/execution-loop.js';
import {
  selectReviewers,
  buildTaskReviewPrompt,
  parseTaskReview,
  checkQualityGate,
  buildRevisionPrompt,
} from '../scripts/lib/engine/review-engine.js';
import {
  resolveReviewAssignments,
  executeCrossModelReviews,
} from '../scripts/lib/engine/cross-model-strategy.js';
import { callLLM } from '../scripts/lib/llm/llm-provider.js';
import { randomBytes } from 'crypto';
import { DEFAULTS } from './defaults.js';

export class Executor {
  /**
   * @param {object} options
   * @param {string} options.provider - LLM 프로바이더 ID
   * @param {string} options.model - 모델 이름
   * @param {object} options.storage - 스토리지 인터페이스
   * @param {object} [options.hooks] - 이벤트 훅
   */
  constructor({
    provider,
    model,
    storage,
    hooks = {},
    maxSteps,
    enableCrossModel = false,
    providerConfig = null,
  }) {
    this.provider = provider;
    this.model = model;
    this.storage = storage;
    this.hooks = hooks;
    this._maxSteps = maxSteps || DEFAULTS.maxExecutionSteps;
    this.enableCrossModel = enableCrossModel;
    this.providerConfig = providerConfig;
  }

  /**
   * 실행 자동 루프. action이 complete가 될 때까지 반복.
   * @param {object} plan - discuss() 결과 또는 projectId를 포함한 실행 계획
   * @returns {Promise<{ status: string, projectId: string, journal: Array }>}
   */
  async run(plan) {
    const projectId = plan.projectId || (await this._initProject(plan));
    const journal = [];
    let stepCount = 0;
    let lastActionKey = null;
    let repeatCount = 0;

    while (stepCount++ < this._maxSteps) {
      const project = await this.storage.read(projectId);
      const step = getNextExecutionStep(project);

      if (step.action === 'complete' || step.action === 'already-completed') {
        return { status: 'completed', projectId, journal };
      }

      if (step.action === 'not-started') {
        return { status: 'not-started', projectId, journal };
      }

      if (step.action === 'paused') {
        return { status: 'paused', projectId, journal };
      }

      // 동일 상태 반복 감지 (무한 루프 방지)
      const actionKey = `${step.action}:${step.phase}`;
      if (actionKey === lastActionKey) {
        repeatCount++;
        if (repeatCount >= 3) {
          return { status: 'stuck', projectId, journal };
        }
      } else {
        repeatCount = 0;
      }
      lastActionKey = actionKey;

      const stepResult = await this._handleStep(step, project);

      // 순수 상태 전이 (I/O 없음) → 스토리지에 직접 반영
      const updatedProject = computeStateTransition(project, stepResult);
      await this.storage.write(projectId, updatedProject);
      journal.push({ action: step.action, phase: step.phase, result: stepResult });
    }

    return { status: 'max-steps-exceeded', projectId, journal };
  }

  /**
   * step의 action에 따라 적절한 핸들링을 수행한다.
   * @param {object} step - getNextExecutionStep 결과
   * @param {object} project - 현재 프로젝트 상태
   * @returns {Promise<object>} stepResult
   */
  async _handleStep(step, project) {
    switch (step.action) {
      case 'execute-tasks':
        return this._executeTasks(step);

      case 'materialize':
        return { completedAction: 'materialize' };

      case 'review':
        return this._review(step, project);

      case 'quality-gate':
        return this._qualityGate(step, project);

      case 'fix':
        return this._fix(step, project);

      case 'escalate': {
        const decision = await (this.hooks.onEscalation?.(step.context) ?? 'abort');
        return { completedAction: 'escalation-response', escalationDecision: decision };
      }

      case 'commit':
        await this.hooks.onCommit?.(step);
        return { completedAction: 'commit' };

      case 'build-context':
        await this.hooks.onPhaseComplete?.(step.phase, step.context);
        return { completedAction: 'build-context' };

      case 'confirm-next-phase': {
        const confirmResult = await (this.hooks.onConfirmPhase?.(step) ?? true);
        if (confirmResult === false) {
          return { completedAction: 'escalation-response', escalationDecision: 'abort' };
        }
        // confirmResult가 객체이면 phaseGuidance를 포함할 수 있음
        const phaseGuidance =
          typeof confirmResult === 'object' ? confirmResult.phaseGuidance : undefined;
        return { completedAction: 'build-context', phaseGuidance };
      }

      case 'review-intervention': {
        const intervention = await (this.hooks.onReviewIntervention?.(step) ?? {
          decision: 'proceed',
        });
        return {
          completedAction: 'review-intervention',
          ...(intervention.decision === 'revise'
            ? { revisionGuidance: intervention.revisionGuidance }
            : {}),
        };
      }

      default:
        return { completedAction: step.action };
    }
  }

  /**
   * 태스크를 병렬로 실행한다.
   */
  async _executeTasks(step) {
    const tasks = step.tasks || [];
    const taskResults = await Promise.all(
      tasks.map(async (task) => {
        const prompt = this._buildTaskPrompt(task, step.phase);
        const response = await callLLM(this.provider, prompt, { model: this.model });
        await this.hooks.onAgentCall?.(task.assignee, response);
        return { taskId: task.id, output: response.text };
      }),
    );
    return { completedAction: 'execute-tasks', taskResults };
  }

  /**
   * 리뷰를 수행하고 LLM 응답을 파싱한다.
   */
  async _review(step, project) {
    if (this.enableCrossModel && this.providerConfig) {
      return this._crossModelReview(step, project);
    }

    const team = project.team || [];
    const tasks = step.tasks || [];
    const phaseResults = project.executionState?.phaseResults?.[step.phase] || {};
    const allReviews = [];
    const taskOutputMap = new Map(
      (phaseResults.taskResults || []).map((r) => [r.taskId, r.output]),
    );

    for (const task of tasks) {
      const reviewers = selectReviewers(task, team);
      const taskOutput = taskOutputMap.get(task.id) || '';

      const reviews = await Promise.all(
        reviewers.map(async (r) => {
          const prompt = buildTaskReviewPrompt(r, task, taskOutput);
          const response = await callLLM(this.provider, prompt, { model: this.model });
          const parsed = parseTaskReview(response.text);
          return { reviewerId: r.roleId, text: response.text, ...parsed };
        }),
      );
      allReviews.push(...reviews);
    }

    return { completedAction: 'review', reviews: allReviews };
  }

  /**
   * 크로스 모델 리뷰를 수행한다.
   * 리뷰어별로 다른 프로바이더를 할당하여 실행.
   */
  async _crossModelReview(step, project) {
    const team = project.team || [];
    const tasks = step.tasks || [];
    const phaseResults = project.executionState?.phaseResults?.[step.phase] || {};
    const allReviews = [];
    const taskOutputMap = new Map(
      (phaseResults.taskResults || []).map((r) => [r.taskId, r.output]),
    );

    for (const task of tasks) {
      const reviewers = selectReviewers(task, team);
      const taskOutput = taskOutputMap.get(task.id) || '';
      const assignments = await resolveReviewAssignments(reviewers, this.providerConfig);
      const results = await executeCrossModelReviews(assignments, task, taskOutput);
      allReviews.push(
        ...results.map((r) => ({
          reviewerId: r.reviewer.roleId,
          provider: r.provider,
          ...r.review,
        })),
      );
    }

    return { completedAction: 'review', reviews: allReviews };
  }

  /**
   * 품질 게이트를 확인한다.
   */
  async _qualityGate(step, project) {
    const phaseResults = project.executionState?.phaseResults?.[step.phase] || {};
    const reviews = phaseResults.reviews || [];
    const gate = checkQualityGate(reviews);
    return {
      completedAction: 'quality-gate',
      qualityGateResult: {
        ...gate,
        issues: gate.criticalCount > 0 ? reviews.flatMap((r) => r.issues || []) : [],
      },
    };
  }

  /**
   * 수정을 수행한다.
   */
  async _fix(step, project) {
    const state = project.executionState || {};
    const phaseResults = state.phaseResults?.[step.phase] || {};
    const tasks = step.tasks || [];
    const reviews = phaseResults.reviews || [];
    const failureContext = state.failureContext;

    const teamMap = new Map((project.team || []).map((m) => [m.roleId, m]));
    const taskResults = await Promise.all(
      tasks.map(async (task) => {
        const implementer = teamMap.get(task.assignee) || {};
        const prompt = buildRevisionPrompt(task, implementer, reviews, failureContext);
        if (!prompt) return { taskId: task.id, output: '' };
        const response = await callLLM(this.provider, prompt, { model: this.model });
        return { taskId: task.id, output: response.text };
      }),
    );

    return { completedAction: 'fix', taskResults };
  }

  /**
   * 태스크 실행 프롬프트를 빌드한다.
   */
  _buildTaskPrompt(task, phase) {
    return `Phase ${phase}: 태스크 "${task.title || task.id}" 를 실행하세요.\n\n설명: ${task.description || '(설명 없음)'}\n담당자: ${task.assignee}`;
  }

  /**
   * 프로젝트를 초기화하고 실행 상태를 설정한다.
   */
  async _initProject(plan) {
    const projectId = `sdk-${Date.now()}-${randomBytes(3).toString('hex')}`;
    const project = {
      id: projectId,
      name: plan.document ? 'SDK Project' : 'Unnamed',
      type: 'custom',
      status: 'executing',
      team: plan.team || [],
      tasks: plan.tasks || [],
      discussion: { planDocument: plan.document || '', rounds: [] },
      executionState: createInitialExecutionState('auto'),
    };
    await this.storage.write(projectId, project);
    return projectId;
  }

  /**
   * 스텝 이터레이터 (수동 모드). 각 스텝을 yield하여 외부에서 제어 가능.
   * @param {object} plan - discuss() 결과
   * @yields {{ action: string, phase: number, proceed: Function, decide: Function }}
   */
  async *steps(plan) {
    const projectId = plan.projectId || (await this._initProject(plan));
    let stepCount = 0;

    while (stepCount++ < this._maxSteps) {
      const project = await this.storage.read(projectId);
      const step = getNextExecutionStep(project);

      if (step.action === 'complete' || step.action === 'already-completed') return;
      if (step.action === 'not-started' || step.action === 'paused') return;

      yield {
        ...step,
        proceed: async () => {
          const current = await this.storage.read(projectId);
          const result = await this._handleStep(step, current);
          const updatedProject = computeStateTransition(current, result);
          await this.storage.write(projectId, updatedProject);
        },
        decide: async (decision) => {
          const current = await this.storage.read(projectId);
          const result = { completedAction: 'escalation-response', escalationDecision: decision };
          const updatedProject = computeStateTransition(current, result);
          await this.storage.write(projectId, updatedProject);
        },
      };
    }
  }
}
