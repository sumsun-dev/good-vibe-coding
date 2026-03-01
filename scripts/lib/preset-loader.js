import { resolve } from 'path';
import { requireString, assertWithinRoot } from './validators.js';
import { readJsonFile } from './file-writer.js';
import { pluginRoot } from './app-paths.js';

const PRESETS_DIR = resolve(pluginRoot(), 'presets');

/**
 * 프리셋 JSON 파일을 로딩한다.
 * @param {string} category - 카테고리 (roles, stacks, workflows)
 * @param {string} name - 프리셋 이름 (확장자 제외)
 * @returns {Promise<object>} 프리셋 객체
 */
export async function loadPreset(category, name) {
  const filePath = resolve(PRESETS_DIR, category, `${name}.json`);
  assertWithinRoot(filePath, PRESETS_DIR, 'preset path');
  const preset = await readJsonFile(filePath);
  if (!preset) {
    const { inputError } = await import('./validators.js');
    throw inputError(`프리셋을 찾을 수 없습니다: ${category}/${name}`);
  }
  validatePreset(preset, category);
  return preset;
}

/**
 * 프리셋 유효성을 검증한다.
 * @param {object} preset - 프리셋 객체
 * @param {string} category - 카테고리
 */
function validatePreset(preset, category) {
  requireString(preset.name, '프리셋 name');
  requireString(preset.displayName, '프리셋 displayName');
  if (category === 'roles') {
    requireString(preset.category, '역할 프리셋 category');
  }
}

/**
 * 여러 프리셋을 병합한다. 나중 프리셋이 우선.
 * @param {...object} presets - 병합할 프리셋 배열
 * @returns {object} 병합된 프리셋
 */
export function mergePresets(...presets) {
  const result = {
    agents: [],
    skills: [],
    commands: [],
    rules: {},
    hooks: {},
    guides: [],
    claudeMd: {},
    stackRules: [],
  };

  for (const preset of presets) {
    if (!preset) continue;

    if (preset.agents) {
      result.agents = [...result.agents, ...preset.agents];
    }
    if (preset.skills) {
      result.skills = [...new Set([...result.skills, ...preset.skills])];
    }
    if (preset.commands) {
      result.commands = [...new Set([...result.commands, ...preset.commands])];
    }
    if (preset.rules) {
      result.rules = { ...result.rules, ...preset.rules };
    }
    if (preset.hooks) {
      result.hooks = { ...result.hooks, ...preset.hooks };
    }
    if (preset.guides) {
      result.guides = [...new Set([...result.guides, ...preset.guides])];
    }
    if (preset.claudeMd) {
      result.claudeMd = { ...result.claudeMd, ...preset.claudeMd };
    }
    if (preset.stackRules) {
      result.stackRules = [...result.stackRules, ...preset.stackRules];
    }
    if (preset.workflow) {
      result.workflow = preset.workflow;
    }
    if (preset.name) {
      result.name = preset.name;
    }
    if (preset.displayName) {
      result.displayName = preset.displayName;
    }
    if (preset.description) {
      result.description = preset.description;
    }
  }

  return result;
}

/**
 * 사용 가능한 프리셋 목록을 반환한다.
 * @param {string} category - 카테고리 (roles, stacks, workflows)
 * @returns {Promise<string[]>} 프리셋 이름 목록
 */
export async function listPresets(category) {
  const { listFilesByExtension } = await import('./file-writer.js');
  const dirPath = resolve(PRESETS_DIR, category);
  const files = await listFilesByExtension(dirPath, '.json');
  return files.map(f => f.replace('.json', ''));
}

export { PRESETS_DIR, validatePreset };
