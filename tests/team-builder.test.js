import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'fs/promises';
import { resolve } from 'path';
import {
  loadRoleCatalog,
  loadProjectTypes,
  recommendTeam,
  buildTeam,
  getTeamSummary,
  clearCaches,
} from '../scripts/lib/team-builder.js';
import { setCustomPersonaDir, createCustomRole, addCustomVariant, setOverride } from '../scripts/lib/persona-manager.js';

const TMP_GROWTH_DIR = resolve('.tmp-test-team-growth');

beforeEach(async () => {
  clearCaches();
  await mkdir(TMP_GROWTH_DIR, { recursive: true });
  setCustomPersonaDir(TMP_GROWTH_DIR);
});

afterEach(async () => {
  await rm(TMP_GROWTH_DIR, { recursive: true, force: true });
});

describe('loadRoleCatalog', () => {
  it('카탈로그를 로딩한다', async () => {
    const catalog = await loadRoleCatalog();
    expect(catalog).toBeDefined();
    expect(catalog.version).toBe('1.0.0');
    expect(catalog.roles).toBeDefined();
  });

  it('15개 역할이 존재한다', async () => {
    const catalog = await loadRoleCatalog();
    expect(Object.keys(catalog.roles).length).toBe(15);
  });

  it('각 역할에 필수 필드가 있다', async () => {
    const catalog = await loadRoleCatalog();
    for (const role of Object.values(catalog.roles)) {
      expect(role.id).toBeTruthy();
      expect(role.displayName).toBeTruthy();
      expect(role.emoji).toBeTruthy();
      expect(role.category).toBeTruthy();
      expect(role.skills).toBeDefined();
      expect(Array.isArray(role.defaultTools)).toBe(true);
    }
  });
});

describe('loadProjectTypes', () => {
  it('프로젝트 타입을 로딩한다', async () => {
    const types = await loadProjectTypes();
    expect(types).toBeDefined();
    expect(types.version).toBe('1.0.0');
  });

  it('9개 타입이 존재한다', async () => {
    const types = await loadProjectTypes();
    expect(Object.keys(types.types).length).toBe(9);
  });
});

describe('recommendTeam', () => {
  it('web-app에 cto+fullstack+qa를 추천한다', async () => {
    const result = await recommendTeam('web-app');
    expect(result.recommended).toEqual(['cto', 'fullstack', 'qa']);
    expect(result.optional).toContain('uiux');
  });

  it('telegram-bot에 cto+backend+qa를 추천한다', async () => {
    const result = await recommendTeam('telegram-bot');
    expect(result.recommended).toEqual(['cto', 'backend', 'qa']);
  });

  it('존재하지 않는 타입은 custom으로 fallback', async () => {
    const result = await recommendTeam('nonexistent');
    expect(result.recommended).toEqual(['cto']);
  });
});

describe('buildTeam', () => {
  it('정상적으로 팀을 빌드한다', async () => {
    const team = await buildTeam(['cto', 'backend']);
    expect(team.length).toBe(2);
    expect(team[0].roleId).toBe('cto');
    expect(team[0].displayName).toBeTruthy();
    expect(team[0].emoji).toBeTruthy();
  });

  it('페르소나 선택을 반영한다', async () => {
    const team = await buildTeam(['cto'], { cto: 'pragmatic' });
    expect(team[0].personalityVariant).toBe('pragmatic');
    expect(team[0].displayName).toBe('서준');
  });

  it('기본 페르소나로 fallback한다', async () => {
    const team = await buildTeam(['cto']);
    expect(team[0].personalityVariant).toBe('visionary');
    expect(team[0].displayName).toBe('민준');
  });

  it('존재하지 않는 역할은 건너뛴다', async () => {
    const team = await buildTeam(['cto', 'nonexistent']);
    expect(team.length).toBe(1);
  });

  it('존재하지 않는 페르소나 variant는 첫 번째로 fallback한다', async () => {
    const team = await buildTeam(['cto'], { cto: 'nonexistent-variant' });
    expect(team[0].personalityVariant).toBe('visionary');
  });

  it('모든 15개 역할을 빌드할 수 있다', async () => {
    const allRoles = ['cto', 'po', 'fullstack', 'frontend', 'backend', 'qa', 'uiux', 'devops', 'data', 'security', 'tech-writer', 'market-researcher', 'business-researcher', 'tech-researcher', 'design-researcher'];
    const team = await buildTeam(allRoles);
    expect(team.length).toBe(15);
    for (const member of team) {
      expect(member.roleId).toBeTruthy();
      expect(member.displayName).toBeTruthy();
      expect(member.emoji).toBeTruthy();
      expect(member.role).toBeTruthy();
      expect(member.model).toBeTruthy();
      expect(Array.isArray(member.skills)).toBe(true);
      expect(Array.isArray(member.tools)).toBe(true);
    }
  });
});

describe('getTeamSummary', () => {
  it('팀 요약 문자열을 생성한다', async () => {
    const team = await buildTeam(['cto', 'backend']);
    const summary = getTeamSummary(team);
    expect(summary).toContain('CTO');
    expect(summary).toContain('Backend Developer');
  });

  it('빈 팀은 빈 문자열을 반환한다', () => {
    const summary = getTeamSummary([]);
    expect(summary).toBe('');
  });
});

describe('buildTeam with custom personas', () => {
  it('커스텀 역할로 팀을 빌드할 수 있다', async () => {
    await createCustomRole({
      id: 'ai-engineer',
      displayName: 'AI Engineer',
      emoji: '🤖',
      category: 'engineering',
      description: 'AI 파이프라인 구축',
      defaultTools: ['Read', 'Grep'],
      model: 'sonnet',
      discussionPriority: 5,
      skills: ['llm'],
    });
    await addCustomVariant('ai-engineer', {
      id: 'creative-ai',
      name: '창의적 AI 빌더',
      emoji: '🤖',
      defaultName: '재현',
      trait: '창의적인',
      description: 'AI 파이프라인을 창의적으로 구축',
      speakingStyle: '실험적 스타일',
      greeting: 'AI로 만들어봅시다!',
    });
    clearCaches();
    const team = await buildTeam(['cto', 'ai-engineer']);
    expect(team.length).toBe(2);
    expect(team[1].roleId).toBe('ai-engineer');
    expect(team[1].displayName).toBe('재현');
    expect(team[1].trait).toBe('창의적인');
  });

  it('오버라이드된 내장 페르소나로 팀을 빌드한다', async () => {
    await setOverride('cto', 'visionary', { trait: '수정된 CTO trait' });
    clearCaches();
    const team = await buildTeam(['cto']);
    expect(team[0].trait).toBe('수정된 CTO trait');
    expect(team[0].displayName).toBe('민준');
  });

  it('내장 역할에 추가된 커스텀 variant를 선택할 수 있다', async () => {
    await addCustomVariant('cto', {
      id: 'startup-cto',
      name: '스타트업 CTO',
      emoji: '🏗️',
      defaultName: '태호',
      trait: '빠른 실행력의',
      description: '스타트업 환경에서 빠르게 결정',
      speakingStyle: '간결하고 빠른 스타일',
      greeting: '빠르게 갑시다!',
    });
    clearCaches();
    const team = await buildTeam(['cto'], { cto: 'startup-cto' });
    expect(team[0].personalityVariant).toBe('startup-cto');
    expect(team[0].displayName).toBe('태호');
  });

  it('기존 15개 역할 카운트는 커스텀 추가 후에도 내장+커스텀 합산', async () => {
    await createCustomRole({
      id: 'ai-engineer',
      displayName: 'AI Engineer',
      emoji: '🤖',
      category: 'engineering',
      description: 'AI',
      defaultTools: ['Read'],
      model: 'sonnet',
      discussionPriority: 5,
      skills: ['llm'],
    });
    clearCaches();
    const catalog = await loadRoleCatalog();
    expect(Object.keys(catalog.roles).length).toBe(16);
    expect(catalog.roles['ai-engineer'].isCustom).toBe(true);
    expect(catalog.roles.cto.isCustom).toBeUndefined();
  });

  it('커스텀 페르소나 없으면 기존과 동일하게 동작 (fallback)', async () => {
    const catalog = await loadRoleCatalog();
    expect(Object.keys(catalog.roles).length).toBe(15);
    const team = await buildTeam(['cto']);
    expect(team[0].personalityVariant).toBe('visionary');
  });
});

