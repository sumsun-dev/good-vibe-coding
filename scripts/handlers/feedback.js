/**
 * handlers/feedback — 에이전트 피드백 + 오버라이드 커맨드
 */
import { readStdin, output, outputOk, parseArgs } from '../cli-utils.js';
import { inputError, requireArray, requireFields } from '../lib/core/validators.js';
import { withProject } from '../lib/project/handler-helpers.js';
import {
  extractAgentPerformance,
  buildImprovementPrompt,
  parseImprovementSuggestions,
  saveAgentOverride,
  loadAgentOverride,
  listAgentOverrides,
  mergeAgentWithOverride,
  saveProjectOverride,
  loadProjectOverride,
  listProjectOverrides,
  mergeAgentWithOverrides,
} from '../lib/agent/agent-feedback.js';
import {
  analyzeMessagePatterns,
  generateMessageAnalysisSection,
} from '../lib/engine/message-analyzer.js';
import {
  processProjectCompletion,
  formatCompletionSummary,
} from '../lib/agent/project-completion-handler.js';
import { listActiveCandidates } from '../lib/agent/agent-shadow-mode.js';

const [, , , ...args] = process.argv;

export const commands = {
  'extract-performance': async () => {
    const opts = parseArgs(args);
    await withProject(opts.id, (project) => output(extractAgentPerformance(project)));
  },

  'improvement-prompt': async () => {
    const data = await readStdin();
    requireFields(data, ['roleId']);
    const prompt = buildImprovementPrompt(data.roleId, data.performance || {}, data.agentMd || '');
    output({ prompt });
  },

  'parse-suggestions': async () => {
    const data = await readStdin();
    requireFields(data, ['analysisText']);
    const suggestions = parseImprovementSuggestions(data.analysisText);
    output(suggestions);
  },

  'save-agent-override': async () => {
    const data = await readStdin();
    requireFields(data, ['roleId', 'content']);
    await saveAgentOverride(data.roleId, data.content);
    outputOk({ roleId: data.roleId });
  },

  'load-agent-override': async () => {
    const opts = parseArgs(args);
    if (!opts.role) throw inputError('--role 옵션이 필요합니다');
    const content = await loadAgentOverride(opts.role);
    output({ roleId: opts.role, content });
  },

  'list-agent-overrides': async () => {
    const overrides = await listAgentOverrides();
    output(overrides);
  },

  'merge-agent-override': async () => {
    const data = await readStdin();
    requireFields(data, ['baseMd', 'overrideMd']);
    const merged = mergeAgentWithOverride(data.baseMd, data.overrideMd);
    output({ merged });
  },

  'save-project-override': async () => {
    const data = await readStdin();
    requireFields(data, ['projectDir', 'roleId', 'content']);
    await saveProjectOverride(data.projectDir, data.roleId, data.content);
    outputOk();
  },

  'load-project-override': async () => {
    const data = await readStdin();
    requireFields(data, ['projectDir', 'roleId']);
    const content = await loadProjectOverride(data.projectDir, data.roleId);
    output({ content });
  },

  'list-project-overrides': async () => {
    const data = await readStdin();
    requireFields(data, ['projectDir']);
    const overrides = await listProjectOverrides(data.projectDir);
    output(overrides);
  },

  'merge-all-overrides': async () => {
    const data = await readStdin();
    requireFields(data, ['baseMd']);
    if (data.overrides !== undefined && data.overrides !== null) {
      requireArray(data.overrides, 'overrides');
    }
    const overrides = data.overrides || [];
    const result = mergeAgentWithOverrides(data.baseMd, overrides);
    output({ result });
  },

  'analyze-messages': async () => {
    const opts = parseArgs(args);
    await withProject(opts.id, (project) => {
      const stats = project.messageStats;
      if (!stats) {
        output({ hasData: false, section: '' });
        return;
      }
      const analysis = analyzeMessagePatterns(stats);
      const section = generateMessageAnalysisSection(analysis);
      output({ ...analysis, section });
    });
  },

  // 자가발전: 프로젝트 완료 시 모든 candidate를 평가하고 promote/discard 자동 실행.
  // --id={projectId} 필수. stdin으로 옵션 전달 가능: { autoApply, minProjects, weights }.
  'evaluate-completion': async () => {
    const opts = parseArgs(args);
    const stdinOpts = (await readStdin()) || {};
    await withProject(opts.id, async (project) => {
      const summary = await processProjectCompletion(project, {
        autoApply: stdinOpts.autoApply !== false,
        minProjects: stdinOpts.minProjects,
        weights: stdinOpts.weights,
      });
      output(summary);
    });
  },

  // CompletionSummary를 CEO 노출용 마크다운으로 변환. stdin: { summary }.
  'format-completion-summary': async () => {
    const data = await readStdin();
    requireFields(data, ['summary']);
    const markdown = formatCompletionSummary(data.summary);
    output({ markdown });
  },

  // 활성 candidate 목록 — /gv:status에서 학습 진행 상황 노출용.
  'list-shadow-candidates': async () => {
    const candidates = await listActiveCandidates();
    output(candidates);
  },
};
