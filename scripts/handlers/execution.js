/**
 * handlers/execution — 실행 루프 + 실행 계획 + 메시지 커맨드
 */
import { readStdin, output, parseArgs } from '../cli-utils.js';
import { requireFields, inputError } from '../lib/core/validators.js';
import { withProject } from '../lib/project/handler-helpers.js';
import { FileMessageBus } from '../lib/core/message-bus.js';
import { config } from '../lib/core/config.js';
import { getProjectDir } from '../lib/project/project-manager.js';
import {
  initExecution,
  getNextExecutionStep,
  advanceExecution,
  getExecutionSummary,
} from '../lib/engine/execution-loop.js';
import {
  buildTaskDistributionPrompt,
  buildExecutionPrompt,
  buildExecutionPlan,
  buildExecutionPlanWithReviews,
} from '../lib/engine/task-distributor.js';

const [, , , ...args] = process.argv;

export const commands = {
  'init-execution': async () => {
    const data = await readStdin();
    requireFields(data, ['id']);
    const result = await initExecution(data.id, { mode: data.mode, resume: data.resume });
    output(result);
  },

  'next-step': async () => {
    const opts = parseArgs(args);
    await withProject(opts.id, (project) => output(getNextExecutionStep(project)));
  },

  'advance-execution': async () => {
    const data = await readStdin();
    requireFields(data, ['id', 'stepResult']);
    const result = await advanceExecution(data.id, data.stepResult);
    output(result);
  },

  'execution-summary': async () => {
    const opts = parseArgs(args);
    await withProject(opts.id, (project) => output(getExecutionSummary(project)));
  },

  'task-distribution-prompt': async () => {
    const opts = parseArgs(args);
    await withProject(opts.id, (project) => {
      const prompt = buildTaskDistributionPrompt(project, project.discussion.planDocument);
      output({ prompt });
    });
  },

  'execution-prompt': async () => {
    const data = await readStdin();
    requireFields(data, ['task', 'teamMember']);
    const prompt = buildExecutionPrompt(data.task, data.teamMember, data.context || {});
    output({ prompt });
  },

  'execution-plan': async () => {
    const data = await readStdin();
    requireFields(data, ['tasks', 'team']);
    const plan = buildExecutionPlan(data.tasks, data.team);
    output(plan);
  },

  'execution-plan-with-reviews': async () => {
    const data = await readStdin();
    requireFields(data, ['tasks', 'team']);
    const plan = buildExecutionPlanWithReviews(data.tasks, data.team);
    output(plan);
  },

  'get-failure-context': async () => {
    const opts = parseArgs(args);
    await withProject(opts.id, (project) => {
      const state = project.executionState;
      output({
        status: state ? state.status : 'idle',
        phase: state ? state.currentPhase : null,
        fixAttempt: state ? state.fixAttempt : 0,
        failureContext: state ? state.failureContext || null : null,
        failureHistory: state ? state.failureHistory || [] : [],
        pendingEscalation: state ? state.pendingEscalation || null : null,
      });
    });
  },

  'handle-escalation': async () => {
    const data = await readStdin();
    requireFields(data, ['id', 'decision']);
    const validDecisions = ['continue', 'skip', 'abort'];
    if (!validDecisions.includes(data.decision)) {
      throw inputError(
        `유효하지 않은 결정: ${data.decision}. 가능한 값: ${validDecisions.join(', ')}`,
      );
    }
    const result = await advanceExecution(data.id, {
      completedAction: 'escalation-response',
      escalationDecision: data.decision,
      ceoGuidance: data.ceoGuidance || undefined,
    });
    output(result);
  },

  'confirm-phase': async () => {
    const data = await readStdin();
    requireFields(data, ['id']);
    const result = await advanceExecution(data.id, {
      completedAction: 'build-context',
      phaseGuidance: data.phaseGuidance || undefined,
    });
    output(result);
  },

  'handle-review-intervention': async () => {
    const data = await readStdin();
    requireFields(data, ['id', 'decision']);
    const validDecisions = ['proceed', 'revise'];
    if (!validDecisions.includes(data.decision)) {
      throw inputError(
        `유효하지 않은 결정: ${data.decision}. 가능한 값: ${validDecisions.join(', ')}`,
      );
    }
    const result = await advanceExecution(data.id, {
      completedAction: 'review-intervention',
      ...(data.decision === 'revise' ? { revisionGuidance: data.revisionGuidance } : {}),
    });
    output(result);
  },

  'send-message': async () => {
    const data = await readStdin();
    requireFields(data, ['projectId', 'from', 'to', 'type', 'content']);
    if (!config.messaging.enabled) {
      throw inputError('메시징이 비활성화되어 있습니다 (config.messaging.enabled = false)');
    }
    const projectDir = getProjectDir(data.projectId);
    const bus = new FileMessageBus({ baseDir: `${projectDir}/messages` });
    const message = await bus.send(data.from, data.to, {
      type: data.type,
      content: data.content,
      threadId: data.threadId || undefined,
    });
    output(message);
  },

  'get-messages': async () => {
    const data = await readStdin();
    requireFields(data, ['projectId', 'agentId']);
    if (!config.messaging.enabled) {
      throw inputError('메시징이 비활성화되어 있습니다 (config.messaging.enabled = false)');
    }
    const projectDir = getProjectDir(data.projectId);
    const bus = new FileMessageBus({ baseDir: `${projectDir}/messages` });
    const messages = await bus.receive(data.agentId, {
      includeRead: data.includeRead || false,
    });
    output(messages);
  },
};
