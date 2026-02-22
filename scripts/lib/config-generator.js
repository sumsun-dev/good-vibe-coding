import { loadPreset, mergePresets } from './preset-loader.js';
import { buildAgentTeam } from './personality-builder.js';
import { extractAllInstructions } from './agent-instruction-extractor.js';
import { renderTemplate } from './template-engine.js';
import { safeWriteFile, writeFiles } from './file-writer.js';
import { resolve } from 'path';
import { homedir } from 'os';

const CLAUDE_DIR = resolve(homedir(), '.claude');

/**
 * 사용자 선택으로부터 전체 설정 파일을 생성한다.
 * @param {object} choices - 사용자 선택
 * @param {string} choices.role - 역할 (developer, pm, designer, researcher, content-creator, student)
 * @param {string[]} [choices.tasks] - 선택한 업무
 * @param {string} [choices.stack] - 기술 스택 (개발자용)
 * @param {string} [choices.workflowStyle] - 워크플로우 스타일
 * @param {object} [choices.options] - 추가 옵션
 * @param {string} [choices.targetDir] - 설정 생성 디렉토리 (기본: ~/.claude)
 * @returns {Promise<object>} 생성 결과
 */
export async function generateConfig(choices) {
  const targetDir = choices.targetDir || CLAUDE_DIR;
  const rolePreset = await loadPreset('roles', choices.role);

  let stackPreset = null;
  if (choices.stack) {
    try {
      stackPreset = await loadPreset('stacks', choices.stack);
    } catch {
      // 스택 프리셋이 없으면 무시
    }
  }

  const merged = mergePresets(rolePreset, stackPreset);
  const files = await buildConfigFiles(merged, rolePreset, stackPreset, choices, targetDir);

  return {
    role: rolePreset.displayName,
    filesGenerated: files.map(f => f.path),
    preset: merged,
  };
}

/**
 * 병합된 프리셋으로부터 설정 파일 목록을 빌드한다.
 * @param {object} merged - 병합된 프리셋
 * @param {object} rolePreset - 역할 프리셋 원본
 * @param {object|null} stackPreset - 스택 프리셋
 * @param {object} choices - 사용자 선택
 * @param {string} targetDir - 대상 디렉토리
 * @returns {Promise<Array<{path: string, content: string}>>}
 */
async function buildConfigFiles(merged, rolePreset, stackPreset, choices, targetDir) {
  const team = await buildAgentTeam(merged.agents, choices.personalities || {});
  const instructions = await extractAllInstructions(merged.agents);
  const orchestration = buildOrchestrationData(rolePreset.orchestration, team);

  const templateData = {
    roleName: rolePreset.displayName,
    roleDescription: rolePreset.roleDescription || rolePreset.description,
    role: rolePreset.name,
    language: 'korean',
    workflow: rolePreset.workflowSteps || [],
    skills: merged.skills,
    agents: merged.agents.map(a => ({ name: a.template, model: a.config?.model || 'sonnet' })),
    team,
    orchestration,
    commands: merged.commands,
    tasks: choices.tasks || [],
    options: choices.options || {},
    stackName: stackPreset?.displayName || null,
    stackRules: merged.stackRules || [],
  };

  const files = [];

  // CLAUDE.md
  const claudeMd = await renderTemplate('claude-md.hbs', templateData);
  files.push({ path: resolve(targetDir, 'CLAUDE.md'), content: claudeMd });

  // rules/core.md
  const coreRules = await renderTemplate('rules/core.md.hbs', templateData);
  files.push({ path: resolve(targetDir, 'rules', 'core.md'), content: coreRules });

  // agents/*.md
  for (const member of team) {
    const tools = getAgentTools(merged.agents, member.agentName);
    const agentContent = await renderTemplate('agent.md.hbs', {
      ...member,
      tools,
      instructions: instructions[member.agentName] || '',
    });
    files.push({
      path: resolve(targetDir, 'agents', `${member.agentName}.md`),
      content: agentContent,
    });
  }

  return files;
}

/**
 * orchestration 데이터에 팀원 persona 정보를 병합한다.
 * @param {object|undefined} orchestration - rolePreset의 orchestration 필드
 * @param {Array<object>} team - 빌드된 팀원 배열
 * @returns {object} 렌더링용 orchestration 데이터
 */
function buildOrchestrationData(orchestration, team) {
  if (!orchestration || !orchestration.enabled) {
    return { enabled: false, steps: [] };
  }

  const teamMap = {};
  for (const member of team) {
    teamMap[member.agentName] = member;
  }

  const steps = orchestration.steps.map(step => {
    const member = teamMap[step.agent];
    return {
      ...step,
      agentDisplayName: member?.displayName || step.agent,
      agentRole: member?.role || step.agent,
      agentEmoji: member?.emoji || '🤖',
    };
  });

  return { enabled: true, steps };
}

/**
 * 에이전트의 tools 설정을 조회한다.
 * @param {Array<{template: string, config: object}>} agents - 프리셋 에이전트 배열
 * @param {string} agentName - 에이전트 이름
 * @returns {string[]} tools 배열
 */
function getAgentTools(agents, agentName) {
  const agent = agents.find(a => a.template === agentName);
  return agent?.config?.tools || ['Read', 'Grep', 'Glob'];
}

/**
 * 설정 파일들을 디스크에 쓴다.
 * @param {object} choices - 사용자 선택 (generateConfig와 동일)
 * @param {object} options - 쓰기 옵션
 * @param {boolean} options.overwrite - 덮어쓰기 (기본: false)
 * @param {boolean} options.backup - 백업 (기본: true)
 * @returns {Promise<object>} 생성 결과 + 파일 쓰기 결과
 */
export async function generateAndWriteConfig(choices, options = {}) {
  const targetDir = choices.targetDir || CLAUDE_DIR;
  const rolePreset = await loadPreset('roles', choices.role);

  let stackPreset = null;
  if (choices.stack) {
    try {
      stackPreset = await loadPreset('stacks', choices.stack);
    } catch {
      // 스택 프리셋이 없으면 무시
    }
  }

  const merged = mergePresets(rolePreset, stackPreset);
  const team = await buildAgentTeam(merged.agents, choices.personalities || {});
  const instructions = await extractAllInstructions(merged.agents);
  const orchestration = buildOrchestrationData(rolePreset.orchestration, team);

  const templateData = {
    roleName: rolePreset.displayName,
    roleDescription: rolePreset.roleDescription || rolePreset.description,
    role: rolePreset.name,
    language: 'korean',
    workflow: rolePreset.workflowSteps || [],
    skills: merged.skills,
    agents: merged.agents.map(a => ({ name: a.template, model: a.config?.model || 'sonnet' })),
    team,
    orchestration,
    commands: merged.commands,
    stackName: stackPreset?.displayName || null,
    stackRules: merged.stackRules || [],
  };

  const claudeMd = await renderTemplate('claude-md.hbs', templateData);
  const coreRules = await renderTemplate('rules/core.md.hbs', templateData);

  const filesToWrite = [
    { path: resolve(targetDir, 'CLAUDE.md'), content: claudeMd },
    { path: resolve(targetDir, 'rules', 'core.md'), content: coreRules },
  ];

  // agents/*.md
  for (const member of team) {
    const tools = getAgentTools(merged.agents, member.agentName);
    const agentContent = await renderTemplate('agent.md.hbs', {
      ...member,
      tools,
      instructions: instructions[member.agentName] || '',
    });
    filesToWrite.push({
      path: resolve(targetDir, 'agents', `${member.agentName}.md`),
      content: agentContent,
    });
  }

  const results = await writeFiles(
    filesToWrite,
    { overwrite: options.overwrite ?? false, backup: options.backup ?? true }
  );

  return {
    role: rolePreset.displayName,
    results,
  };
}

export { CLAUDE_DIR };
