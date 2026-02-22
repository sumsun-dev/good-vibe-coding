import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, readFile } from 'fs/promises';
import { resolve } from 'path';
import {
  setCustomPersonaDir,
  validateRoleData,
  validateVariantData,
  createCustomRole,
  getCustomRole,
  listCustomRoles,
  updateCustomRole,
  deleteCustomRole,
  addCustomVariant,
  getCustomVariants,
  updateCustomVariant,
  deleteCustomVariant,
  setOverride,
  getOverrides,
  removeOverride,
  getMergedRoleCatalog,
  getMergedPersonalities,
  getAvailableVariants,
} from '../scripts/lib/persona-manager.js';
import { clearCaches } from '../scripts/lib/team-builder.js';

const TMP_DIR = resolve('.tmp-test-persona');

beforeEach(async () => {
  await mkdir(TMP_DIR, { recursive: true });
  setCustomPersonaDir(TMP_DIR);
  clearCaches();
});

afterEach(async () => {
  await rm(TMP_DIR, { recursive: true, force: true });
});

// =============================================================================
// Step 1: 유효성 검증 + 파일 I/O
// =============================================================================

describe('validateRoleData', () => {
  it('유효한 역할 데이터를 통과시킨다', () => {
    const result = validateRoleData({
      id: 'ai-engineer',
      displayName: 'AI Engineer',
      emoji: '🤖',
      category: 'engineering',
      description: 'LLM 프롬프트 엔지니어링',
      defaultTools: ['Read', 'Grep'],
      model: 'sonnet',
      discussionPriority: 5,
      skills: ['prompt-engineering'],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('필수 필드가 없으면 실패한다', () => {
    const result = validateRoleData({ id: 'test' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('displayName'))).toBe(true);
  });

  it('id가 빈 문자열이면 실패한다', () => {
    const result = validateRoleData({
      id: '',
      displayName: 'Test',
      emoji: '🎯',
      category: 'engineering',
      description: 'desc',
      defaultTools: [],
      model: 'sonnet',
      discussionPriority: 1,
      skills: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('id'))).toBe(true);
  });

  it('model이 유효하지 않으면 실패한다', () => {
    const result = validateRoleData({
      id: 'test',
      displayName: 'Test',
      emoji: '🎯',
      category: 'engineering',
      description: 'desc',
      defaultTools: [],
      model: 'invalid-model',
      discussionPriority: 1,
      skills: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('model'))).toBe(true);
  });

  it('skills가 배열이 아니면 실패한다', () => {
    const result = validateRoleData({
      id: 'test',
      displayName: 'Test',
      emoji: '🎯',
      category: 'engineering',
      description: 'desc',
      defaultTools: [],
      model: 'sonnet',
      discussionPriority: 1,
      skills: 'not-array',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('skills'))).toBe(true);
  });
});

describe('validateVariantData', () => {
  it('유효한 variant 데이터를 통과시킨다', () => {
    const result = validateVariantData({
      id: 'creative-ai',
      name: '창의적 AI 빌더',
      emoji: '🤖',
      defaultName: '재현',
      trait: '창의적이고 실험적인',
      description: 'AI 파이프라인을 창의적으로 구축',
      speakingStyle: '자유롭고 실험적인 스타일',
      greeting: 'AI로 새로운 걸 만들어봅시다!',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('필수 필드가 없으면 실패한다', () => {
    const result = validateVariantData({ id: 'test' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.includes('name'))).toBe(true);
  });

  it('id가 빈 문자열이면 실패한다', () => {
    const result = validateVariantData({
      id: '',
      name: 'Test',
      emoji: '🎯',
      defaultName: 'Name',
      trait: 'trait',
      description: 'desc',
      speakingStyle: 'style',
      greeting: 'hi',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('id'))).toBe(true);
  });
});

describe('setCustomPersonaDir', () => {
  it('디렉토리가 없어도 파일 저장 시 자동 생성된다', async () => {
    const nestedDir = resolve(TMP_DIR, 'nested', 'deep');
    setCustomPersonaDir(nestedDir);
    await createCustomRole({
      id: 'test-role',
      displayName: 'Test',
      emoji: '🎯',
      category: 'engineering',
      description: 'desc',
      defaultTools: [],
      model: 'sonnet',
      discussionPriority: 1,
      skills: [],
    });
    const role = await getCustomRole('test-role');
    expect(role).toBeDefined();
    expect(role.id).toBe('test-role');
  });
});

// =============================================================================
// Step 2: CRUD 함수
// =============================================================================

const validRole = {
  id: 'ai-engineer',
  displayName: 'AI Engineer',
  emoji: '🤖',
  category: 'engineering',
  description: 'LLM 프롬프트 엔지니어링, AI 파이프라인 구축',
  defaultTools: ['Read', 'Grep', 'Glob', 'Bash', 'Edit', 'Write'],
  model: 'sonnet',
  discussionPriority: 5,
  skills: ['prompt-engineering', 'llm', 'rag'],
};

const validVariant = {
  id: 'creative-ai',
  name: '창의적 AI 빌더',
  emoji: '🤖',
  defaultName: '재현',
  trait: '창의적이고 실험적인',
  description: 'AI 파이프라인을 창의적으로 구축합니다',
  speakingStyle: '자유롭고 실험적인 스타일',
  greeting: 'AI로 새로운 걸 만들어봅시다!',
};

describe('createCustomRole', () => {
  it('새 역할을 생성한다', async () => {
    const role = await createCustomRole(validRole);
    expect(role.id).toBe('ai-engineer');
    expect(role.isCustom).toBe(true);
  });

  it('내장 역할 ID와 충돌하면 에러를 던진다', async () => {
    await expect(createCustomRole({ ...validRole, id: 'cto' }))
      .rejects.toThrow('내장 역할');
  });

  it('중복 커스텀 ID면 에러를 던진다', async () => {
    await createCustomRole(validRole);
    await expect(createCustomRole(validRole))
      .rejects.toThrow('이미 존재');
  });

  it('유효성 검증 실패 시 에러를 던진다', async () => {
    await expect(createCustomRole({ id: 'bad' }))
      .rejects.toThrow('유효성 검증');
  });
});

describe('getCustomRole / listCustomRoles', () => {
  it('단일 역할을 조회한다', async () => {
    await createCustomRole(validRole);
    const role = await getCustomRole('ai-engineer');
    expect(role.displayName).toBe('AI Engineer');
  });

  it('존재하지 않는 역할은 null을 반환한다', async () => {
    const role = await getCustomRole('nonexistent');
    expect(role).toBeNull();
  });

  it('전체 목록을 조회한다', async () => {
    await createCustomRole(validRole);
    await createCustomRole({ ...validRole, id: 'ml-engineer', displayName: 'ML Engineer' });
    const list = await listCustomRoles();
    expect(list.length).toBe(2);
  });

  it('커스텀 역할이 없으면 빈 배열을 반환한다', async () => {
    const list = await listCustomRoles();
    expect(list).toEqual([]);
  });
});

describe('updateCustomRole', () => {
  it('역할 필드를 수정한다', async () => {
    await createCustomRole(validRole);
    const updated = await updateCustomRole('ai-engineer', { description: '수정됨' });
    expect(updated.description).toBe('수정됨');
    expect(updated.displayName).toBe('AI Engineer');
  });

  it('존재하지 않는 역할은 에러를 던진다', async () => {
    await expect(updateCustomRole('nonexistent', { description: 'x' }))
      .rejects.toThrow('존재하지 않');
  });

  it('id 변경은 무시한다', async () => {
    await createCustomRole(validRole);
    const updated = await updateCustomRole('ai-engineer', { id: 'changed' });
    expect(updated.id).toBe('ai-engineer');
  });
});

describe('deleteCustomRole', () => {
  it('역할과 연관 페르소나를 삭제한다', async () => {
    await createCustomRole(validRole);
    await addCustomVariant('ai-engineer', validVariant);
    await deleteCustomRole('ai-engineer');
    const role = await getCustomRole('ai-engineer');
    expect(role).toBeNull();
    const variants = await getCustomVariants('ai-engineer');
    expect(variants).toEqual([]);
  });

  it('존재하지 않는 역할은 에러를 던진다', async () => {
    await expect(deleteCustomRole('nonexistent'))
      .rejects.toThrow('존재하지 않');
  });
});

describe('addCustomVariant / getCustomVariants', () => {
  it('커스텀 역할에 variant를 추가한다', async () => {
    await createCustomRole(validRole);
    const variant = await addCustomVariant('ai-engineer', validVariant);
    expect(variant.id).toBe('creative-ai');
  });

  it('내장 역할에도 variant를 추가할 수 있다', async () => {
    const variant = await addCustomVariant('cto', {
      ...validVariant,
      id: 'startup-cto',
      name: '스타트업 CTO',
    });
    expect(variant.id).toBe('startup-cto');
  });

  it('중복 variant ID면 에러를 던진다', async () => {
    await createCustomRole(validRole);
    await addCustomVariant('ai-engineer', validVariant);
    await expect(addCustomVariant('ai-engineer', validVariant))
      .rejects.toThrow('이미 존재');
  });

  it('역할의 커스텀 variant 목록을 조회한다', async () => {
    await createCustomRole(validRole);
    await addCustomVariant('ai-engineer', validVariant);
    await addCustomVariant('ai-engineer', { ...validVariant, id: 'systematic-ai', name: '체계적 AI 빌더' });
    const variants = await getCustomVariants('ai-engineer');
    expect(variants.length).toBe(2);
  });

  it('variant가 없으면 빈 배열을 반환한다', async () => {
    const variants = await getCustomVariants('nonexistent');
    expect(variants).toEqual([]);
  });

  it('유효성 검증 실패 시 에러를 던진다', async () => {
    await createCustomRole(validRole);
    await expect(addCustomVariant('ai-engineer', { id: 'bad' }))
      .rejects.toThrow('유효성 검증');
  });
});

describe('updateCustomVariant', () => {
  it('variant 필드를 수정한다', async () => {
    await createCustomRole(validRole);
    await addCustomVariant('ai-engineer', validVariant);
    const updated = await updateCustomVariant('ai-engineer', 'creative-ai', { trait: '수정된 trait' });
    expect(updated.trait).toBe('수정된 trait');
    expect(updated.name).toBe('창의적 AI 빌더');
  });

  it('존재하지 않는 variant는 에러를 던진다', async () => {
    await createCustomRole(validRole);
    await expect(updateCustomVariant('ai-engineer', 'nonexistent', { trait: 'x' }))
      .rejects.toThrow('존재하지 않');
  });
});

describe('deleteCustomVariant', () => {
  it('variant를 삭제한다', async () => {
    await createCustomRole(validRole);
    await addCustomVariant('ai-engineer', validVariant);
    await deleteCustomVariant('ai-engineer', 'creative-ai');
    const variants = await getCustomVariants('ai-engineer');
    expect(variants).toEqual([]);
  });

  it('존재하지 않는 variant는 에러를 던진다', async () => {
    await expect(deleteCustomVariant('ai-engineer', 'nonexistent'))
      .rejects.toThrow('존재하지 않');
  });
});

describe('setOverride / getOverrides / removeOverride', () => {
  it('내장 variant에 오버라이드를 설정한다', async () => {
    await setOverride('cto', 'visionary', { trait: '전략적이지만 실행력도 갖춘' });
    const overrides = await getOverrides();
    expect(overrides.cto.visionary.trait).toBe('전략적이지만 실행력도 갖춘');
  });

  it('여러 필드를 오버라이드할 수 있다', async () => {
    await setOverride('cto', 'visionary', { trait: '수정됨', greeting: '새 인사' });
    const overrides = await getOverrides();
    expect(overrides.cto.visionary.trait).toBe('수정됨');
    expect(overrides.cto.visionary.greeting).toBe('새 인사');
  });

  it('오버라이드를 제거한다', async () => {
    await setOverride('cto', 'visionary', { trait: '수정됨' });
    await removeOverride('cto', 'visionary');
    const overrides = await getOverrides();
    expect(overrides.cto).toBeUndefined();
  });

  it('오버라이드가 없으면 빈 객체를 반환한다', async () => {
    const overrides = await getOverrides();
    expect(overrides).toEqual({});
  });

  it('존재하지 않는 오버라이드 제거도 안전하다', async () => {
    await expect(removeOverride('cto', 'visionary')).resolves.not.toThrow();
  });
});

// =============================================================================
// Step 3: Merge 로직
// =============================================================================

describe('getMergedRoleCatalog', () => {
  it('커스텀 역할이 없으면 내장 카탈로그를 그대로 반환한다', async () => {
    const catalog = await getMergedRoleCatalog();
    expect(catalog.roles.cto).toBeDefined();
    expect(Object.keys(catalog.roles).length).toBe(11);
  });

  it('커스텀 역할이 추가된 merged 카탈로그를 반환한다', async () => {
    await createCustomRole(validRole);
    const catalog = await getMergedRoleCatalog();
    expect(catalog.roles['ai-engineer']).toBeDefined();
    expect(catalog.roles['ai-engineer'].isCustom).toBe(true);
    expect(Object.keys(catalog.roles).length).toBe(12);
  });

  it('내장 역할은 변경되지 않는다', async () => {
    await createCustomRole(validRole);
    const catalog = await getMergedRoleCatalog();
    expect(catalog.roles.cto.displayName).toBe('CTO');
    expect(catalog.roles.cto.isCustom).toBeUndefined();
  });
});

describe('getMergedPersonalities', () => {
  it('커스텀이 없으면 내장 페르소나를 그대로 반환한다', async () => {
    const personalities = await getMergedPersonalities();
    expect(personalities.cto).toBeDefined();
    expect(personalities.cto.variants.length).toBe(2);
  });

  it('오버라이드가 내장 variant에 적용된다', async () => {
    await setOverride('cto', 'visionary', { trait: '수정된 trait' });
    const personalities = await getMergedPersonalities();
    expect(personalities.cto.variants[0].trait).toBe('수정된 trait');
    expect(personalities.cto.variants[0].name).toBe('비전가');
  });

  it('내장 역할에 커스텀 variant가 추가된다', async () => {
    await addCustomVariant('cto', { ...validVariant, id: 'startup-cto', name: '스타트업 CTO' });
    const personalities = await getMergedPersonalities();
    expect(personalities.cto.variants.length).toBe(3);
    const startupCto = personalities.cto.variants.find(v => v.id === 'startup-cto');
    expect(startupCto).toBeDefined();
    expect(startupCto.name).toBe('스타트업 CTO');
  });

  it('새 커스텀 역할의 페르소나가 추가된다', async () => {
    await createCustomRole(validRole);
    await addCustomVariant('ai-engineer', validVariant);
    const personalities = await getMergedPersonalities();
    expect(personalities['ai-engineer']).toBeDefined();
    expect(personalities['ai-engineer'].variants.length).toBe(1);
    expect(personalities['ai-engineer'].default).toBe('creative-ai');
  });

  it('커스텀 역할에 default가 null이면 내장 default를 유지한다', async () => {
    await addCustomVariant('cto', { ...validVariant, id: 'startup-cto', name: '스타트업 CTO' });
    const personalities = await getMergedPersonalities();
    expect(personalities.cto.default).toBe('visionary');
  });

  it('오버라이드 + 커스텀 variant 동시 적용', async () => {
    await setOverride('cto', 'visionary', { trait: '수정됨' });
    await addCustomVariant('cto', { ...validVariant, id: 'startup-cto', name: '스타트업 CTO' });
    const personalities = await getMergedPersonalities();
    expect(personalities.cto.variants.length).toBe(3);
    expect(personalities.cto.variants[0].trait).toBe('수정됨');
  });
});

describe('getAvailableVariants', () => {
  it('내장 역할의 모든 variant를 반환한다', async () => {
    const variants = await getAvailableVariants('cto');
    expect(variants.length).toBe(2);
    expect(variants[0].id).toBe('visionary');
    expect(variants[1].id).toBe('pragmatic');
  });

  it('커스텀 variant가 포함된다', async () => {
    await addCustomVariant('cto', { ...validVariant, id: 'startup-cto', name: '스타트업 CTO' });
    const variants = await getAvailableVariants('cto');
    expect(variants.length).toBe(3);
  });

  it('존재하지 않는 역할은 빈 배열을 반환한다', async () => {
    const variants = await getAvailableVariants('nonexistent');
    expect(variants).toEqual([]);
  });

  it('커스텀 역할의 variant를 반환한다', async () => {
    await createCustomRole(validRole);
    await addCustomVariant('ai-engineer', validVariant);
    const variants = await getAvailableVariants('ai-engineer');
    expect(variants.length).toBe(1);
    expect(variants[0].id).toBe('creative-ai');
  });
});
