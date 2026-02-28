/**
 * handlers/discussion — 토론 프롬프트 생성 + 오케스트레이션 커맨드
 */
import { readStdin, output, parseArgs } from '../cli-utils.js';
import { getProject } from '../lib/project-manager.js';
import {
  buildDiscussionPrompt, buildPlanDocument, buildSingleAgentDiscussionPrompt,
} from '../lib/discussion-engine.js';
import {
  buildAgentAnalysisPrompt, buildSynthesisPrompt, buildReviewPrompt,
  checkConvergence, groupAgentsForParallelDispatch,
} from '../lib/orchestrator.js';
import {
  buildDiscussionDispatchPlan, buildExecutionDispatchPlan,
} from '../lib/dispatch-plan-generator.js';

const [,, , ...args] = process.argv;

export const commands = {
  'discussion-prompt': async () => {
    const opts = parseArgs(args);
    const project = await getProject(opts.id);
    if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${opts.id}`);
    const prompt = buildDiscussionPrompt(project, project.team, parseInt(opts.round || '1'));
    output({ prompt });
  },

  'plan-document': async () => {
    const data = await readStdin();
    const doc = buildPlanDocument(data.project, data.discussions || []);
    output({ planDocument: doc });
  },

  'single-agent-discussion-prompt': async () => {
    const data = await readStdin();
    const prompt = buildSingleAgentDiscussionPrompt(data.project, data.teamMember, data.context || {});
    output({ prompt });
  },

  'agent-analysis-prompt': async () => {
    const data = await readStdin();
    const prompt = buildAgentAnalysisPrompt(data.project, data.teamMember, data.context || {});
    output({ prompt });
  },

  'synthesis-prompt': async () => {
    const data = await readStdin();
    const prompt = buildSynthesisPrompt(data.project, data.agentOutputs, data.round || 1);
    output({ prompt });
  },

  'review-prompt': async () => {
    const data = await readStdin();
    const prompt = buildReviewPrompt(data.teamMember, data.synthesizedPlan, data.round || 1);
    output({ prompt });
  },

  'check-convergence': async () => {
    const data = await readStdin();
    const result = checkConvergence(data.reviews);
    output(result);
  },

  'group-agents': async () => {
    const data = await readStdin();
    const tiers = groupAgentsForParallelDispatch(data.team);
    output({ tiers });
  },

  'discussion-dispatch-plan': async () => {
    const data = await readStdin();
    const project = data.project || (data.id ? await getProject(data.id) : null);
    if (!project) throw new Error('프로젝트 정보가 필요합니다');
    const plan = buildDiscussionDispatchPlan(project, data.team || project.team, data.context || {});
    output(plan);
  },

  'execution-dispatch-plan': async () => {
    const data = await readStdin();
    const project = data.project || (data.id ? await getProject(data.id) : null);
    if (!project) throw new Error('프로젝트 정보가 필요합니다');
    const plan = buildExecutionDispatchPlan(project, data.tasks || project.tasks, data.team || project.team, data.context || {});
    output(plan);
  },
};
