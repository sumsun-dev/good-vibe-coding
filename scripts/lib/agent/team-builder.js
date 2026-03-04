import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { getDefaultsForComplexity } from './complexity-analyzer.js';
import { LazyCache } from '../core/cache.js';
import { pluginRoot } from '../core/app-paths.js';

const CATALOG_PATH = resolve(pluginRoot(), 'presets', 'team-roles', 'catalog.json');
const PROJECT_TYPES_PATH = resolve(pluginRoot(), 'presets', 'project-types.json');
const PERSONALITIES_PATH = resolve(pluginRoot(), 'presets', 'team-personalities.json');

const catalogCache = new LazyCache(async () => JSON.parse(await readFile(CATALOG_PATH, 'utf-8')));
const projectTypesCache = new LazyCache(async () =>
  JSON.parse(await readFile(PROJECT_TYPES_PATH, 'utf-8')),
);
const personalitiesCache = new LazyCache(async () =>
  JSON.parse(await readFile(PERSONALITIES_PATH, 'utf-8')),
);

/**
 * 캐시를 초기화한다 (테스트용).
 */
export function clearCaches() {
  catalogCache.clear();
  projectTypesCache.clear();
  personalitiesCache.clear();
}

/**
 * 역할 카탈로그를 로딩한다 (캐싱).
 * @returns {Promise<object>} 카탈로그 데이터
 */
export async function loadRoleCatalog() {
  return catalogCache.get();
}

/**
 * 프로젝트 타입 목록을 로딩한다 (캐싱).
 * @returns {Promise<object>} 프로젝트 타입 데이터
 */
export async function loadProjectTypes() {
  return projectTypesCache.get();
}

/**
 * 팀 페르소나를 로딩한다 (캐싱).
 * @returns {Promise<object>} 페르소나 데이터
 */
async function loadTeamPersonalities() {
  return personalitiesCache.get();
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
 * @param {object} [options={}] - 빌드 옵션
 * @param {string} [options.complexity] - 복잡도 ('simple' | 'medium' | 'complex')
 * @returns {Promise<Array<object>>} 팀원 배열
 */
export async function buildTeam(roleIds, personalityChoices = {}, options = {}) {
  const catalog = await loadRoleCatalog();
  const personalities = await loadTeamPersonalities();

  return roleIds
    .filter((id) => catalog.roles[id])
    .map((id) => {
      const role = catalog.roles[id];
      const persona = personalities[id];
      const model = resolveModel(role, options.complexity);
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
          model,
          skills: role.skills,
          tools: role.defaultTools,
          reviewDomains: role.reviewDomains,
          workDomains: role.workDomains,
        };
      } else {
        const chosenId = personalityChoices[id] || persona.default;
        const variant = persona.variants.find((v) => v.id === chosenId) || persona.variants[0];
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
          model,
          skills: role.skills,
          tools: role.defaultTools,
          reviewDomains: role.reviewDomains,
          workDomains: role.workDomains,
        };
      }

      return member;
    });
}

/**
 * 역할의 카테고리와 복잡도에 따라 적절한 모델을 결정한다.
 * @param {object} role - 카탈로그 역할 정보 (role.model, role.category)
 * @param {string} [complexity] - 복잡도 ('simple' | 'medium' | 'complex')
 * @param {string} [taskType] - 태스크 유형 (예: 'architecture-review')
 * @returns {string} 모델 이름
 */
export function resolveModel(role, complexity, taskType) {
  if (!complexity) return role.model;

  const defaults = getDefaultsForComplexity(complexity);
  const modelTiers = defaults.modelTiers;
  if (!modelTiers) return role.model;

  const category = role.category || 'engineering';
  let model = modelTiers[category] || role.model;

  // architecture-review + complex → opus 업그레이드
  if (taskType === 'architecture-review' && complexity === 'complex') {
    model = 'opus';
  }

  return model;
}

/**
 * 팀 요약 문자열을 생성한다.
 * @param {Array<object>} team - 팀원 배열
 * @returns {string} 팀 요약 (표시용)
 */
export function getTeamSummary(team) {
  if (!team || team.length === 0) return '';
  return team
    .map((m) => `**${m.displayName}** (${m.role}) — "${m.greeting}"`)
    .join('\n');
}

/**
 * catalog 역할과 동적 역할을 병합하여 팀을 빌드한다.
 * @param {string[]} roleIds - catalog 역할 ID 배열
 * @param {Array<object>} dynamicRoles - 동적 역할 객체 배열
 * @param {object} [options={}] - 빌드 옵션
 * @returns {Promise<Array<object>>} 팀원 배열
 */
export async function buildTeamWithDynamic(roleIds, dynamicRoles = [], options = {}) {
  const catalogMembers = await buildTeam(roleIds, {}, options);

  const dynamicMembers = dynamicRoles.map((role) => ({
    roleId: role.roleId,
    personalityVariant: 'dynamic',
    displayName: role.displayName,
    emoji: '',
    role: role.displayName,
    trait: role.description || '',
    description: role.description || '',
    speakingStyle: '',
    greeting: '',
    model: role.model || 'sonnet',
    skills: role.skills || [],
    tools: [],
    reviewDomains: role.reviewDomains || [],
    workDomains: role.workDomains || [],
    dynamic: true,
    discussionPriority: role.discussionPriority || 5,
  }));

  return [...catalogMembers, ...dynamicMembers];
}

// 역할 우선순위 — 낮을수록 core에 우선 배치
const ROLE_PRIORITY = {
  cto: 0,
  po: 1,
  backend: 2,
  frontend: 3,
  fullstack: 4,
  qa: 5,
  security: 6,
  uiux: 7,
  devops: 8,
  data: 9,
  'tech-writer': 10,
  'market-researcher': 11,
  'business-researcher': 12,
  'tech-researcher': 13,
  'design-researcher': 14,
};

/**
 * 프로젝트 타입 + 복잡도를 결합하여 최적 팀을 생성한다.
 * Rule 1: fullstack + frontend + backend 공존 시 fullstack 제거
 * Rule 2: teamSize.max 초과 시 우선순위 기반으로 overflow → optional로 이동
 * @param {string} projectType - 프로젝트 타입
 * @param {string} complexity - 복잡도 ('simple' | 'medium' | 'complex')
 * @returns {Promise<{roles: string[], optional: string[]}>}
 */
export async function getOptimizedTeam(projectType, complexity, codebaseInfo = null) {
  const typeRec = await recommendTeam(projectType);
  const defaults = getDefaultsForComplexity(complexity);
  const baseRoles = new Set([...typeRec.recommended, ...defaults.suggestedRoles]);

  // codebaseInfo에서 추천된 역할을 병합
  if (codebaseInfo && Array.isArray(codebaseInfo.suggestedRoles)) {
    for (const role of codebaseInfo.suggestedRoles) baseRoles.add(role);
  }

  // Rule 1: fullstack 중복 제거
  if (baseRoles.has('fullstack') && baseRoles.has('frontend') && baseRoles.has('backend')) {
    baseRoles.delete('fullstack');
  }

  // 우선순위 정렬 (낮을수록 core 우선)
  const sorted = [...baseRoles].sort((a, b) => (ROLE_PRIORITY[a] ?? 99) - (ROLE_PRIORITY[b] ?? 99));

  // Rule 2: max size 제한
  const coreRoles = sorted.slice(0, defaults.teamSize.max);
  const optionalSet = new Set([...typeRec.optional, ...sorted.slice(defaults.teamSize.max)]);
  for (const r of coreRoles) optionalSet.delete(r);

  return { roles: coreRoles, optional: [...optionalSet] };
}
