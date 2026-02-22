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
import { addFeedback, setFeedbackDir } from '../scripts/lib/feedback-manager.js';

const TMP_GROWTH_DIR = resolve('.tmp-test-team-growth');

beforeEach(async () => {
  clearCaches();
  await mkdir(TMP_GROWTH_DIR, { recursive: true });
  setFeedbackDir(TMP_GROWTH_DIR);
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

  it('존재하지 않는 페르소나 variant는 첫 번째로 fallback한다', async () => {
    const team = await buildTeam(['cto'], { cto: 'nonexistent-variant' });
    expect(team[0].personalityVariant).toBe('visionary');
  });

  it('모든 11개 역할을 빌드할 수 있다', async () => {
    const allRoles = ['cto', 'po', 'fullstack', 'frontend', 'backend', 'qa', 'uiux', 'devops', 'data', 'security', 'tech-writer'];
    const team = await buildTeam(allRoles);
    expect(team.length).toBe(11);
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

describe('buildTeam with growth', () => {
  it('withGrowth 옵션으로 growthContext를 병합한다', async () => {
    await addFeedback('proj-1', 'cto', 5, '훌륭한 아키텍처 설계');
    await addFeedback('proj-2', 'cto', 4, '좋은 기술 의사결정');

    const team = await buildTeam(['cto', 'backend'], {}, { withGrowth: true });
    expect(team[0].growthContext).toBeTruthy();
    expect(team[0].growthContext).toContain('성장 이력');
    expect(team[1].growthContext).toBeTruthy();
  });

  it('withGrowth 없으면 growthContext가 없다', async () => {
    const team = await buildTeam(['cto', 'backend']);
    expect(team[0].growthContext).toBeUndefined();
  });

  it('기존 호환: 2번째 인자만 전달해도 동작', async () => {
    const team = await buildTeam(['cto'], { cto: 'pragmatic' });
    expect(team[0].personalityVariant).toBe('pragmatic');
    expect(team[0].growthContext).toBeUndefined();
  });
});
