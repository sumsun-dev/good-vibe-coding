import { readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const PRESETS_DIR = resolve(PROJECT_ROOT, 'presets');

/**
 * 프리셋 JSON 파일을 로딩한다.
 * @param {string} category - 카테고리 (roles, stacks, workflows)
 * @param {string} name - 프리셋 이름 (확장자 제외)
 * @returns {Promise<object>} 프리셋 객체
 */
export async function loadPreset(category, name) {
  const filePath = resolve(PRESETS_DIR, category, `${name}.json`);
  const content = await readFile(filePath, 'utf-8');
  const preset = JSON.parse(content);
  validatePreset(preset, category);
  return preset;
}

/**
 * 프리셋 유효성을 검증한다.
 * @param {object} preset - 프리셋 객체
 * @param {string} category - 카테고리
 */
function validatePreset(preset, category) {
  if (!preset.name || typeof preset.name !== 'string') {
    throw new Error('프리셋에 name 필드가 필요합니다');
  }
  if (!preset.displayName || typeof preset.displayName !== 'string') {
    throw new Error('프리셋에 displayName 필드가 필요합니다');
  }
  if (category === 'roles' && !preset.category) {
    throw new Error('역할 프리셋에 category 필드가 필요합니다');
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
  const { readdir } = await import('fs/promises');
  const dirPath = resolve(PRESETS_DIR, category);
  try {
    const files = await readdir(dirPath);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  } catch {
    return [];
  }
}

export { PRESETS_DIR };
