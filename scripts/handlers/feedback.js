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
    const suggestions = parseImprovementSuggestions(data.analysisText || '');
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
    if (!data.baseMd && data.baseMd !== '') throw inputError('baseMd가 필요합니다');
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
};
