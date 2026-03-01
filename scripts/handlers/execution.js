/**
 * handlers/execution — 실행 루프 + 실행 계획 커맨드
 */
import { readStdin, output, parseArgs } from '../cli-utils.js';
import { getProject } from '../lib/project-manager.js';
import { notFoundError } from '../lib/validators.js';
import {
  initExecution, getNextExecutionStep, advanceExecution, getExecutionSummary,
} from '../lib/execution-loop.js';
import {
  buildTaskDistributionPrompt, buildExecutionPrompt, buildExecutionPlan,
  buildExecutionPlanWithReviews,
} from '../lib/task-distributor.js';

const [,, , ...args] = process.argv;

export const commands = {
  'init-execution': async () => {
    const data = await readStdin();
    const result = await initExecution(data.id, { mode: data.mode, resume: data.resume });
    output(result);
  },

  'next-step': async () => {
    const opts = parseArgs(args);
    const project = await getProject(opts.id);
    if (!project) throw notFoundError(`프로젝트를 찾을 수 없습니다: ${opts.id}`);
    output(getNextExecutionStep(project));
  },

  'advance-execution': async () => {
    const data = await readStdin();
    const result = await advanceExecution(data.id, data.stepResult);
    output(result);
  },

  'execution-summary': async () => {
    const opts = parseArgs(args);
    const project = await getProject(opts.id);
    if (!project) throw notFoundError(`프로젝트를 찾을 수 없습니다: ${opts.id}`);
    output(getExecutionSummary(project));
  },

  'task-distribution-prompt': async () => {
    const opts = parseArgs(args);
    const project = await getProject(opts.id);
    if (!project) throw notFoundError(`프로젝트를 찾을 수 없습니다: ${opts.id}`);
    const prompt = buildTaskDistributionPrompt(project, project.discussion.planDocument);
    output({ prompt });
  },

  'execution-prompt': async () => {
    const data = await readStdin();
    const prompt = buildExecutionPrompt(data.task, data.teamMember, data.context || {});
    output({ prompt });
  },

  'execution-plan': async () => {
    const data = await readStdin();
    const plan = buildExecutionPlan(data.tasks, data.team);
    output(plan);
  },

  'execution-plan-with-reviews': async () => {
    const data = await readStdin();
    const plan = buildExecutionPlanWithReviews(data.tasks, data.team);
    output(plan);
  },
};
