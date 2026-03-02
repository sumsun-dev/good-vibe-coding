/**
 * handlers/review — 크로스 리뷰 + 품질 게이트 커맨드
 */
import { readStdin, output } from '../cli-utils.js';
import {
  selectReviewers, buildTaskReviewPrompt,
  checkQualityGate, buildRevisionPrompt, checkEnhancedQualityGate,
} from '../lib/review-engine.js';
import { verifyExecution } from '../lib/execution-verifier.js';
import {
  detectRedundantAgents, recommendOptimalTeam, buildOptimizationReport,
} from '../lib/agent-optimizer.js';
import { getProject } from '../lib/project-manager.js';

export const commands = {
  'select-reviewers': async () => {
    const data = await readStdin();
    const reviewers = selectReviewers(data.task, data.team);
    output({ reviewers });
  },

  'task-review-prompt': async () => {
    const data = await readStdin();
    const prompt = buildTaskReviewPrompt(data.reviewer, data.task, data.taskOutput);
    output({ prompt });
  },

  'check-quality-gate': async () => {
    const data = await readStdin();
    const result = checkQualityGate(data.reviews);
    output(result);
  },

  'enhanced-quality-gate': async () => {
    const data = await readStdin();
    const result = checkEnhancedQualityGate(data.reviews, data.executionResult);
    output(result);
  },

  'revision-prompt': async () => {
    const data = await readStdin();
    const prompt = buildRevisionPrompt(data.task, data.implementer, data.reviews, data.failureContext || null);
    output({ prompt });
  },

  'verify-execution': async () => {
    const data = await readStdin();
    const result = await verifyExecution(data.taskOutput, data.task);
    output(result);
  },

  'analyze-efficiency': async () => {
    const data = await readStdin();
    const agentOutputs = data.agentOutputs || [];
    let roleContributions = data.roleContributions || [];
    const teamSize = data.teamSize;

    // roleContributions가 비어있고 프로젝트 ID가 있으면 자동 로드
    if (roleContributions.length === 0 && data.id) {
      const project = await getProject(data.id);
      if (project && project.contributions) {
        roleContributions = Object.entries(project.contributions).map(([roleId, c]) => ({
          roleId,
          contributionScore: c.reviewCount > 0 ? c.totalScore / c.reviewCount : 0,
        }));
      }
    }

    const redundancies = detectRedundantAgents(agentOutputs);
    const recommendations = recommendOptimalTeam(agentOutputs, roleContributions, teamSize);
    const report = buildOptimizationReport(recommendations);
    output({ redundancies, recommendations, report });
  },
};
