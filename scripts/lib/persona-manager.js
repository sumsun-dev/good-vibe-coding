import { readFile, writeFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ensureDir, fileExists } from './file-writer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');
const CATALOG_PATH = resolve(PROJECT_ROOT, 'presets', 'team-roles', 'catalog.json');
const PERSONALITIES_PATH = resolve(PROJECT_ROOT, 'presets', 'team-personalities.json');

const DEFAULT_CUSTOM_DIR = resolve(
  process.env.HOME || process.env.USERPROFILE,
  '.claude', 'good-vibe', 'custom-personas',
);
let customDir = DEFAULT_CUSTOM_DIR;

const VALID_MODELS = ['sonnet', 'haiku', 'opus'];

// =============================================================================
// 디렉토리 설정
// =============================================================================

/**
 * 커스텀 페르소나 디렉토리를 설정한다 (테스트용).
 * @param {string} dir - 디렉토리 경로
 */
export function setCustomPersonaDir(dir) {
  customDir = dir;
}

// =============================================================================
// 파일 경로
// =============================================================================

function customRolesPath() {
  return resolve(customDir, 'custom-roles.json');
}

function customPersonalitiesPath() {
  return resolve(customDir, 'custom-personalities.json');
}

function overridesPath() {
  return resolve(customDir, 'overrides.json');
}

// =============================================================================
// 파일 I/O
// =============================================================================

async function loadJsonSafe(path, defaultValue) {
  if (!(await fileExists(path))) return defaultValue;
  const content = await readFile(path, 'utf-8');
  return JSON.parse(content);
}

async function saveJson(path, data) {
  await ensureDir(dirname(path));
  await writeFile(path, JSON.stringify(data, null, 2), 'utf-8');
}

// =============================================================================
// 내장 데이터 로딩
// =============================================================================

async function loadBuiltinCatalog() {
  const content = await readFile(CATALOG_PATH, 'utf-8');
  return JSON.parse(content);
}

async function loadBuiltinPersonalities() {
  const content = await readFile(PERSONALITIES_PATH, 'utf-8');
  return JSON.parse(content);
}

function getBuiltinRoleIds(catalog) {
  return Object.keys(catalog.roles);
}

// =============================================================================
// 유효성 검증
// =============================================================================

/**
 * 역할 데이터를 검증한다.
 * @param {object} data - 역할 데이터
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateRoleData(data) {
  const errors = [];
  if (!data.id || typeof data.id !== 'string' || data.id.trim() === '') {
    errors.push('id는 비어있지 않은 문자열이어야 합니다');
  }
  if (!data.displayName || typeof data.displayName !== 'string') {
    errors.push('displayName은 필수 문자열입니다');
  }
  if (!data.emoji || typeof data.emoji !== 'string') {
    errors.push('emoji는 필수 문자열입니다');
  }
  if (!data.category || typeof data.category !== 'string') {
    errors.push('category는 필수 문자열입니다');
  }
  if (!data.description || typeof data.description !== 'string') {
    errors.push('description은 필수 문자열입니다');
  }
  if (!Array.isArray(data.defaultTools)) {
    errors.push('defaultTools는 배열이어야 합니다');
  }
  if (!data.model || !VALID_MODELS.includes(data.model)) {
    errors.push(`model은 ${VALID_MODELS.join(', ')} 중 하나여야 합니다`);
  }
  if (typeof data.discussionPriority !== 'number') {
    errors.push('discussionPriority는 숫자여야 합니다');
  }
  if (!Array.isArray(data.skills)) {
    errors.push('skills는 배열이어야 합니다');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * variant 데이터를 검증한다.
 * @param {object} data - variant 데이터
 * @returns {{valid: boolean, errors: string[]}}
 */
export function validateVariantData(data) {
  const errors = [];
  if (!data.id || typeof data.id !== 'string' || data.id.trim() === '') {
    errors.push('id는 비어있지 않은 문자열이어야 합니다');
  }
  if (!data.name || typeof data.name !== 'string') {
    errors.push('name은 필수 문자열입니다');
  }
  if (!data.emoji || typeof data.emoji !== 'string') {
    errors.push('emoji는 필수 문자열입니다');
  }
  if (!data.defaultName || typeof data.defaultName !== 'string') {
    errors.push('defaultName은 필수 문자열입니다');
  }
  if (!data.trait || typeof data.trait !== 'string') {
    errors.push('trait는 필수 문자열입니다');
  }
  if (!data.description || typeof data.description !== 'string') {
    errors.push('description은 필수 문자열입니다');
  }
  if (!data.speakingStyle || typeof data.speakingStyle !== 'string') {
    errors.push('speakingStyle은 필수 문자열입니다');
  }
  if (!data.greeting || typeof data.greeting !== 'string') {
    errors.push('greeting은 필수 문자열입니다');
  }
  return { valid: errors.length === 0, errors };
}

// =============================================================================
// CRUD: 커스텀 역할
// =============================================================================

/**
 * 새 커스텀 역할을 생성한다.
 * @param {object} roleData - 역할 데이터
 * @returns {Promise<object>} 생성된 역할
 */
export async function createCustomRole(roleData) {
  const validation = validateRoleData(roleData);
  if (!validation.valid) {
    throw new Error(`유효성 검증 실패: ${validation.errors.join(', ')}`);
  }

  const builtinCatalog = await loadBuiltinCatalog();
  const builtinIds = getBuiltinRoleIds(builtinCatalog);
  if (builtinIds.includes(roleData.id)) {
    throw new Error(`내장 역할 ID와 충돌합니다: ${roleData.id}`);
  }

  const rolesData = await loadJsonSafe(customRolesPath(), { version: '1.0.0', roles: {} });
  if (rolesData.roles[roleData.id]) {
    throw new Error(`이미 존재하는 커스텀 역할입니다: ${roleData.id}`);
  }

  const role = { ...roleData, isCustom: true };
  rolesData.roles[roleData.id] = role;
  await saveJson(customRolesPath(), rolesData);
  return role;
}

/**
 * 단일 커스텀 역할을 조회한다.
 * @param {string} roleId - 역할 ID
 * @returns {Promise<object|null>}
 */
export async function getCustomRole(roleId) {
  const rolesData = await loadJsonSafe(customRolesPath(), { version: '1.0.0', roles: {} });
  return rolesData.roles[roleId] || null;
}

/**
 * 전체 커스텀 역할 목록을 반환한다.
 * @returns {Promise<object[]>}
 */
export async function listCustomRoles() {
  const rolesData = await loadJsonSafe(customRolesPath(), { version: '1.0.0', roles: {} });
  return Object.values(rolesData.roles);
}

/**
 * 커스텀 역할을 수정한다.
 * @param {string} roleId - 역할 ID
 * @param {object} patch - 수정할 필드
 * @returns {Promise<object>} 수정된 역할
 */
export async function updateCustomRole(roleId, patch) {
  const rolesData = await loadJsonSafe(customRolesPath(), { version: '1.0.0', roles: {} });
  if (!rolesData.roles[roleId]) {
    throw new Error(`존재하지 않는 커스텀 역할입니다: ${roleId}`);
  }

  const { id: _ignoreId, ...safePatch } = patch;
  rolesData.roles[roleId] = { ...rolesData.roles[roleId], ...safePatch, id: roleId };
  await saveJson(customRolesPath(), rolesData);
  return rolesData.roles[roleId];
}

/**
 * 커스텀 역할과 연관 페르소나를 삭제한다.
 * @param {string} roleId - 역할 ID
 */
export async function deleteCustomRole(roleId) {
  const rolesData = await loadJsonSafe(customRolesPath(), { version: '1.0.0', roles: {} });
  if (!rolesData.roles[roleId]) {
    throw new Error(`존재하지 않는 커스텀 역할입니다: ${roleId}`);
  }

  delete rolesData.roles[roleId];
  await saveJson(customRolesPath(), rolesData);

  const personalitiesData = await loadJsonSafe(customPersonalitiesPath(), {});
  if (personalitiesData[roleId]) {
    delete personalitiesData[roleId];
    await saveJson(customPersonalitiesPath(), personalitiesData);
  }
}

// =============================================================================
// CRUD: 커스텀 variant
// =============================================================================

/**
 * 역할에 커스텀 variant를 추가한다.
 * @param {string} roleId - 역할 ID
 * @param {object} variant - variant 데이터
 * @returns {Promise<object>} 추가된 variant
 */
export async function addCustomVariant(roleId, variant) {
  const validation = validateVariantData(variant);
  if (!validation.valid) {
    throw new Error(`유효성 검증 실패: ${validation.errors.join(', ')}`);
  }

  const personalitiesData = await loadJsonSafe(customPersonalitiesPath(), {});

  if (personalitiesData[roleId]) {
    const existing = personalitiesData[roleId].variants.find(v => v.id === variant.id);
    if (existing) {
      throw new Error(`이미 존재하는 variant입니다: ${variant.id}`);
    }
    personalitiesData[roleId].variants.push(variant);
  } else {
    const builtinCatalog = await loadBuiltinCatalog();
    const isBuiltin = !!builtinCatalog.roles[roleId];
    const builtinPersonalities = await loadBuiltinPersonalities();
    const roleName = isBuiltin
      ? builtinPersonalities[roleId]?.role || builtinCatalog.roles[roleId].displayName
      : (await getCustomRole(roleId))?.displayName || roleId;

    personalitiesData[roleId] = {
      role: roleName,
      variants: [variant],
      default: isBuiltin ? null : variant.id,
    };
  }

  await saveJson(customPersonalitiesPath(), personalitiesData);
  return variant;
}

/**
 * 역할의 커스텀 variant 목록을 반환한다.
 * @param {string} roleId - 역할 ID
 * @returns {Promise<object[]>}
 */
export async function getCustomVariants(roleId) {
  const personalitiesData = await loadJsonSafe(customPersonalitiesPath(), {});
  if (!personalitiesData[roleId]) return [];
  return personalitiesData[roleId].variants;
}

/**
 * 커스텀 variant를 수정한다.
 * @param {string} roleId - 역할 ID
 * @param {string} variantId - variant ID
 * @param {object} patch - 수정할 필드
 * @returns {Promise<object>} 수정된 variant
 */
export async function updateCustomVariant(roleId, variantId, patch) {
  const personalitiesData = await loadJsonSafe(customPersonalitiesPath(), {});
  if (!personalitiesData[roleId]) {
    throw new Error(`존재하지 않는 역할입니다: ${roleId}`);
  }

  const idx = personalitiesData[roleId].variants.findIndex(v => v.id === variantId);
  if (idx === -1) {
    throw new Error(`존재하지 않는 variant입니다: ${variantId}`);
  }

  const { id: _ignoreId, ...safePatch } = patch;
  personalitiesData[roleId].variants[idx] = {
    ...personalitiesData[roleId].variants[idx],
    ...safePatch,
    id: variantId,
  };
  await saveJson(customPersonalitiesPath(), personalitiesData);
  return personalitiesData[roleId].variants[idx];
}

/**
 * 커스텀 variant를 삭제한다.
 * @param {string} roleId - 역할 ID
 * @param {string} variantId - variant ID
 */
export async function deleteCustomVariant(roleId, variantId) {
  const personalitiesData = await loadJsonSafe(customPersonalitiesPath(), {});
  if (!personalitiesData[roleId]) {
    throw new Error(`존재하지 않는 역할입니다: ${roleId}`);
  }

  const idx = personalitiesData[roleId].variants.findIndex(v => v.id === variantId);
  if (idx === -1) {
    throw new Error(`존재하지 않는 variant입니다: ${variantId}`);
  }

  personalitiesData[roleId].variants.splice(idx, 1);

  if (personalitiesData[roleId].variants.length === 0) {
    delete personalitiesData[roleId];
  }

  await saveJson(customPersonalitiesPath(), personalitiesData);
}

// =============================================================================
// CRUD: 오버라이드
// =============================================================================

/**
 * 내장 variant에 오버라이드를 설정한다.
 * @param {string} roleId - 역할 ID
 * @param {string} variantId - variant ID
 * @param {object} patch - 오버라이드할 필드
 */
export async function setOverride(roleId, variantId, patch) {
  const overridesData = await loadJsonSafe(overridesPath(), { version: '1.0.0', overrides: {} });
  if (!overridesData.overrides[roleId]) {
    overridesData.overrides[roleId] = {};
  }
  overridesData.overrides[roleId][variantId] = {
    ...(overridesData.overrides[roleId][variantId] || {}),
    ...patch,
  };
  await saveJson(overridesPath(), overridesData);
}

/**
 * 전체 오버라이드를 반환한다.
 * @returns {Promise<object>}
 */
export async function getOverrides() {
  const overridesData = await loadJsonSafe(overridesPath(), { version: '1.0.0', overrides: {} });
  return overridesData.overrides;
}

/**
 * 오버라이드를 제거한다.
 * @param {string} roleId - 역할 ID
 * @param {string} variantId - variant ID
 */
export async function removeOverride(roleId, variantId) {
  const overridesData = await loadJsonSafe(overridesPath(), { version: '1.0.0', overrides: {} });
  if (overridesData.overrides[roleId]) {
    delete overridesData.overrides[roleId][variantId];
    if (Object.keys(overridesData.overrides[roleId]).length === 0) {
      delete overridesData.overrides[roleId];
    }
    await saveJson(overridesPath(), overridesData);
  }
}

// =============================================================================
// Merge 로직
// =============================================================================

/**
 * 내장 + 커스텀 역할을 통합한 카탈로그를 반환한다.
 * @returns {Promise<object>}
 */
export async function getMergedRoleCatalog() {
  const builtinCatalog = await loadBuiltinCatalog();
  const customRolesData = await loadJsonSafe(customRolesPath(), { version: '1.0.0', roles: {} });

  return {
    ...builtinCatalog,
    roles: {
      ...builtinCatalog.roles,
      ...customRolesData.roles,
    },
  };
}

/**
 * 내장 + 오버라이드 + 커스텀 variant를 통합한 페르소나를 반환한다.
 * @returns {Promise<object>}
 */
export async function getMergedPersonalities() {
  const builtinPersonalities = await loadBuiltinPersonalities();
  const overridesData = await getOverrides();
  const customPersonalitiesData = await loadJsonSafe(customPersonalitiesPath(), {});

  const merged = {};

  for (const [roleId, persona] of Object.entries(builtinPersonalities)) {
    merged[roleId] = {
      ...persona,
      variants: persona.variants.map(v => {
        const override = overridesData[roleId]?.[v.id];
        return override ? { ...v, ...override, id: v.id } : { ...v };
      }),
    };
  }

  for (const [roleId, customPersona] of Object.entries(customPersonalitiesData)) {
    if (merged[roleId]) {
      for (const variant of customPersona.variants) {
        merged[roleId].variants.push({ ...variant });
      }
    } else {
      merged[roleId] = {
        role: customPersona.role,
        variants: customPersona.variants.map(v => ({ ...v })),
        default: customPersona.default,
      };
    }
  }

  return merged;
}

/**
 * 특정 역할의 전체 variant (merged)를 반환한다.
 * @param {string} roleId - 역할 ID
 * @returns {Promise<object[]>}
 */
export async function getAvailableVariants(roleId) {
  const personalities = await getMergedPersonalities();
  if (!personalities[roleId]) return [];
  return personalities[roleId].variants;
}
