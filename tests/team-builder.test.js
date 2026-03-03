import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadRoleCatalog,
  loadProjectTypes,
  recommendTeam,
  buildTeam,
  getTeamSummary,
  getOptimizedTeam,
  resolveModel,
  clearCaches,
} from '../scripts/lib/agent/team-builder.js';

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

  it('12개 타입이 존재한다', async () => {
    const types = await loadProjectTypes();
    expect(Object.keys(types.types).length).toBe(12);
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

  it('library에 cto+backend+qa를 추천한다 (tech-writer는 optional)', async () => {
    const result = await recommendTeam('library');
    expect(result.recommended).toEqual(['cto', 'backend', 'qa']);
    expect(result.recommended).not.toContain('tech-writer');
    expect(result.optional).toContain('tech-writer');
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
    const allRoles = [
      'cto',
      'po',
      'fullstack',
      'frontend',
      'backend',
      'qa',
      'uiux',
      'devops',
      'data',
      'security',
      'tech-writer',
      'market-researcher',
      'business-researcher',
      'tech-researcher',
      'design-researcher',
    ];
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

describe('getOptimizedTeam', () => {
  it('web-app + medium → fullstack 제거, frontend+backend 유지', async () => {
    const result = await getOptimizedTeam('web-app', 'medium');
    expect(result.roles).not.toContain('fullstack');
    expect(result.roles).toContain('frontend');
    expect(result.roles).toContain('backend');
    expect(result.roles).toContain('cto');
    expect(result.roles).toContain('qa');
  });

  it('mobile-app + simple → fullstack 유지, qa도 core에 포함', async () => {
    const result = await getOptimizedTeam('mobile-app', 'simple');
    expect(result.roles).toContain('fullstack');
    // 우선순위 기반: cto(0) > fullstack(4) > qa(5) — uiux(7)보다 qa가 core
    expect(result.roles).toContain('qa');
    expect(result.roles.length).toBeLessThanOrEqual(3);
    expect(result.optional).toContain('uiux');
  });

  it('우선순위 순서대로 core에 배치된다', async () => {
    const result = await getOptimizedTeam('web-app', 'complex');
    // cto(0) < po(1) < backend(2) < frontend(3) < qa(5) < security(6)
    const ctoIdx = result.roles.indexOf('cto');
    const qaIdx = result.roles.indexOf('qa');
    expect(ctoIdx).toBeLessThan(qaIdx);
    expect(ctoIdx).toBe(0);
  });

  it('max size를 초과하지 않는다', async () => {
    const result = await getOptimizedTeam('web-app', 'simple');
    expect(result.roles.length).toBeLessThanOrEqual(3);
  });

  it('overflow된 역할이 optional에 포함된다', async () => {
    const result = await getOptimizedTeam('web-app', 'simple');
    // max 3인데 union이 3 초과 → 나머지는 optional
    for (const r of result.optional) {
      expect(result.roles).not.toContain(r);
    }
  });
});

// --- resolveModel ---

describe('resolveModel', () => {
  it('complexity가 없으면 role.model을 그대로 반환한다', () => {
    const role = { model: 'sonnet', category: 'engineering' };
    expect(resolveModel(role)).toBe('sonnet');
  });

  it('simple + leadership → sonnet', () => {
    const role = { model: 'sonnet', category: 'leadership' };
    expect(resolveModel(role, 'simple')).toBe('sonnet');
  });

  it('simple + design → haiku', () => {
    const role = { model: 'sonnet', category: 'design' };
    expect(resolveModel(role, 'simple')).toBe('haiku');
  });

  it('complex + leadership → opus', () => {
    const role = { model: 'sonnet', category: 'leadership' };
    expect(resolveModel(role, 'complex')).toBe('opus');
  });

  it('complex + engineering → sonnet', () => {
    const role = { model: 'sonnet', category: 'engineering' };
    expect(resolveModel(role, 'complex')).toBe('sonnet');
  });

  it('medium + support → haiku', () => {
    const role = { model: 'sonnet', category: 'support' };
    expect(resolveModel(role, 'medium')).toBe('haiku');
  });

  it('architecture-review + complex → opus 업그레이드', () => {
    const role = { model: 'sonnet', category: 'engineering' };
    expect(resolveModel(role, 'complex', 'architecture-review')).toBe('opus');
  });

  it('architecture-review + simple → sonnet (업그레이드 없음)', () => {
    const role = { model: 'sonnet', category: 'engineering' };
    expect(resolveModel(role, 'simple', 'architecture-review')).toBe('sonnet');
  });
});

// --- resolveModel 엣지케이스 ---

describe('resolveModel — 엣지케이스', () => {
  it('category가 없으면 engineering 기본값을 사용한다', () => {
    const role = { model: 'haiku' };
    const result = resolveModel(role, 'simple');
    expect(result).toBe('sonnet');
  });

  it('modelTiers에 없는 category면 role.model로 fallback', () => {
    const role = { model: 'opus', category: 'exotic-unknown' };
    const result = resolveModel(role, 'simple');
    expect(result).toBe('opus');
  });
});

// --- getTeamSummary null/undefined 가드 ---

describe('getTeamSummary — null/undefined', () => {
  it('null을 전달하면 빈 문자열을 반환한다', () => {
    expect(getTeamSummary(null)).toBe('');
  });

  it('undefined를 전달하면 빈 문자열을 반환한다', () => {
    expect(getTeamSummary(undefined)).toBe('');
  });
});

// --- buildTeam with complexity ---

describe('buildTeam with complexity', () => {
  it('complexity 옵션으로 모델을 조정한다', async () => {
    const team = await buildTeam(['cto'], {}, { complexity: 'complex' });
    // CTO category: leadership, complex → opus
    expect(team[0].model).toBe('opus');
  });

  it('complexity 없이 호출하면 카탈로그 기본 모델을 사용한다', async () => {
    const team = await buildTeam(['cto']);
    expect(team[0].model).toBeTruthy();
  });

  it('simple complexity에서 support 카테고리는 haiku를 사용한다', async () => {
    // tech-writer는 support 카테고리
    const team = await buildTeam(['tech-writer'], {}, { complexity: 'simple' });
    expect(team[0].model).toBe('haiku');
  });
});
