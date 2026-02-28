/**
 * handlers/feedback — 에이전트 피드백 + 오버라이드 커맨드
 */
import { readStdin, output, outputOk, parseArgs } from '../cli-utils.js';
import { getProject } from '../lib/project-manager.js';
import {
  extractAgentPerformance, buildImprovementPrompt, parseImprovementSuggestions,
  saveAgentOverride, loadAgentOverride, listAgentOverrides, mergeAgentWithOverride,
  saveProjectOverride, loadProjectOverride, listProjectOverrides, mergeAgentWithOverrides,
} from '../lib/agent-feedback.js';

const [,, , ...args] = process.argv;

export const commands = {
  'extract-performance': async () => {
    const opts = parseArgs(args);
    const project = await getProject(opts.id);
    if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${opts.id}`);
    const performances = extractAgentPerformance(project);
    output(performances);
  },

  'improvement-prompt': async () => {
    const data = await readStdin();
    if (!data.roleId) throw new Error('roleId 필드가 필요합니다');
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
    if (!data.roleId) throw new Error('roleId 필드가 필요합니다');
    if (!data.content) throw new Error('content 필드가 필요합니다');
    await saveAgentOverride(data.roleId, data.content);
    outputOk({ roleId: data.roleId });
  },

  'load-agent-override': async () => {
    const opts = parseArgs(args);
    if (!opts.role) throw new Error('--role 옵션이 필요합니다');
    const content = await loadAgentOverride(opts.role);
    output({ roleId: opts.role, content });
  },

  'list-agent-overrides': async () => {
    const overrides = await listAgentOverrides();
    output(overrides);
  },

  'merge-agent-override': async () => {
    const data = await readStdin();
    const merged = mergeAgentWithOverride(data.baseMd, data.overrideMd);
    output({ merged });
  },

  'save-project-override': async () => {
    const data = await readStdin();
    if (!data.projectDir) throw new Error('projectDir가 필요합니다');
    if (!data.roleId) throw new Error('roleId가 필요합니다');
    if (!data.content) throw new Error('content가 필요합니다');
    await saveProjectOverride(data.projectDir, data.roleId, data.content);
    outputOk();
  },

  'load-project-override': async () => {
    const data = await readStdin();
    if (!data.projectDir) throw new Error('projectDir가 필요합니다');
    if (!data.roleId) throw new Error('roleId가 필요합니다');
    const content = await loadProjectOverride(data.projectDir, data.roleId);
    output({ content });
  },

  'list-project-overrides': async () => {
    const data = await readStdin();
    if (!data.projectDir) throw new Error('projectDir가 필요합니다');
    const overrides = await listProjectOverrides(data.projectDir);
    output(overrides);
  },

  'merge-all-overrides': async () => {
    const data = await readStdin();
    if (!data.baseMd && data.baseMd !== '') throw new Error('baseMd가 필요합니다');
    const overrides = data.overrides || [];
    const result = mergeAgentWithOverrides(data.baseMd, overrides);
    output({ result });
  },
};
