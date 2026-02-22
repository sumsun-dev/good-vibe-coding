import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadRoleCatalog,
  loadProjectTypes,
  recommendTeam,
  buildTeam,
  getTeamSummary,
  clearCaches,
} from '../scripts/lib/team-builder.js';

beforeEach(() => {
  clearCaches();
});

describe('loadRoleCatalog', () => {
  it('카탈로그를 로딩한다', async () => {
    const catalog = await loadRoleCatalog();
    expect(catalog).toBeDefined();
    expect(catalog.version).toBe('1.0.0');
    expect(catalog.roles).toBeDefined();
  });

  it('11개 역할이 존재한다', async () => {
    const catalog = await loadRoleCatalog();
    expect(Object.keys(catalog.roles).length).toBe(11);
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
