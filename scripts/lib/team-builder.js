import { readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getGrowthProfiles, buildGrowthContext } from './growth-manager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const CATALOG_PATH = resolve(PROJECT_ROOT, 'presets', 'team-roles', 'catalog.json');
const PROJECT_TYPES_PATH = resolve(PROJECT_ROOT, 'presets', 'project-types.json');
const PERSONALITIES_PATH = resolve(PROJECT_ROOT, 'presets', 'team-personalities.json');

let cachedCatalog = null;
let cachedProjectTypes = null;
let cachedPersonalities = null;

/**
 * 캐시를 초기화한다 (테스트용).
 */
export function clearCaches() {
  cachedCatalog = null;
  cachedProjectTypes = null;
  cachedPersonalities = null;
}

/**
 * 역할 카탈로그를 로딩한다 (캐싱).
 * @returns {Promise<object>} 카탈로그 데이터
 */
export async function loadRoleCatalog() {
  if (cachedCatalog) return cachedCatalog;
  const content = await readFile(CATALOG_PATH, 'utf-8');
  cachedCatalog = JSON.parse(content);
  return cachedCatalog;
}

/**
 * 프로젝트 타입 목록을 로딩한다 (캐싱).
 * @returns {Promise<object>} 프로젝트 타입 데이터
 */
export async function loadProjectTypes() {
  if (cachedProjectTypes) return cachedProjectTypes;
  const content = await readFile(PROJECT_TYPES_PATH, 'utf-8');
  cachedProjectTypes = JSON.parse(content);
  return cachedProjectTypes;
}

/**
 * 팀 페르소나를 로딩한다 (캐싱).
 * @returns {Promise<object>} 페르소나 데이터
 */
async function loadTeamPersonalities() {
  if (cachedPersonalities) return cachedPersonalities;
  const content = await readFile(PERSONALITIES_PATH, 'utf-8');
  cachedPersonalities = JSON.parse(content);
  return cachedPersonalities;
}

/**
 * 프로젝트 타입에 따른 팀을 추천한다.
 * @param {string} projectType - 프로젝트 타입
 * @returns {Promise<{recommended: string[], optional: string[]}>} 추천/선택 역할
 */
export async function recommendTeam(projectType) {
  const types = await loadProjectTypes();
  const typeConfig = types.types[projectType] || types.types['custom'];
  return {
    recommended: typeConfig.recommendedTeam,
    optional: typeConfig.optionalRoles || [],
  };
}

/**
 * 역할 ID 배열과 페르소나 선택으로 팀을 빌드한다.
 * @param {string[]} roleIds - 역할 ID 배열
 * @param {object} personalityChoices - 역할별 페르소나 선택 (roleId → variant id)
 * @param {object} options - 옵션
 * @param {boolean} options.withGrowth - true이면 성장 컨텍스트를 병합
 * @returns {Promise<Array<object>>} 팀원 배열
 */
export async function buildTeam(roleIds, personalityChoices = {}, options = {}) {
  const catalog = await loadRoleCatalog();
  const personalities = await loadTeamPersonalities();

  let growthProfiles = null;
  if (options.withGrowth) {
    growthProfiles = await getGrowthProfiles(roleIds);
  }

  return roleIds
    .filter(id => catalog.roles[id])
    .map(id => {
      const role = catalog.roles[id];
      const persona = personalities[id];
      let member;
      if (!persona) {
        member = {
          roleId: id,
          personalityVariant: 'default',
          displayName: role.displayName,
          emoji: role.emoji,
          role: role.displayName,
          trait: '',
          description: role.description,
          speakingStyle: '',
          greeting: '',
          model: role.model,
          skills: role.skills,
          tools: role.defaultTools,
        };
      } else {
        const chosenId = personalityChoices[id] || persona.default;
        const variant = persona.variants.find(v => v.id === chosenId) || persona.variants[0];
        member = {
          roleId: id,
          personalityVariant: variant.id,
          displayName: variant.defaultName,
          emoji: variant.emoji,
          role: role.displayName,
          trait: variant.trait,
          description: variant.description,
          speakingStyle: variant.speakingStyle,
          greeting: variant.greeting,
          model: role.model,
          skills: role.skills,
          tools: role.defaultTools,
        };
      }

      if (growthProfiles && growthProfiles.has(id)) {
        member.growthContext = buildGrowthContext(growthProfiles.get(id));
      }

      return member;
    });
}

/**
 * 팀 요약 문자열을 생성한다.
 * @param {Array<object>} team - 팀원 배열
 * @returns {string} 팀 요약 (표시용)
 */
export function getTeamSummary(team) {
  if (!team || team.length === 0) return '';
  return team
    .map(m => `${m.emoji} **${m.displayName}** (${m.role}) — "${m.greeting}"`)
    .join('\n');
}
