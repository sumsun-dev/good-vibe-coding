import { describe, it, expect } from 'vitest';
import { GoodVibe, MemoryStorage } from '../../src/index.js';

// --- buildTeam ---

describe('GoodVibe.buildTeam (통합)', () => {
  it('quick-build 플로우: simple 복잡도로 팀을 구성한다', async () => {
    const gv = new GoodVibe({ provider: 'claude', storage: 'memory' });
    const team = await gv.buildTeam('텔레그램 날씨 봇', { complexity: 'simple' });

    expect(team.mode).toBe('quick-build');
    expect(team.idea).toBe('텔레그램 날씨 봇');
    expect(team.agents.length).toBeGreaterThanOrEqual(2);
    expect(team.complexity.level).toBe('simple');
    expect(team.complexity.teamSize).toBeDefined();
    expect(team.complexity.discussionRounds).toBe(0);
  });

  it('plan-execute 플로우: medium 복잡도로 팀을 구성한다', async () => {
    const gv = new GoodVibe({ provider: 'claude', storage: 'memory' });
    const team = await gv.buildTeam('프로젝트 관리 웹앱', { complexity: 'medium' });

    expect(team.mode).toBe('plan-execute');
    expect(team.complexity.level).toBe('medium');
    expect(team.agents.length).toBeGreaterThanOrEqual(3);
    expect(team.complexity.discussionRounds).toBe(1);
  });

  it('plan-only 플로우: complex 복잡도로 팀을 구성한다', async () => {
    const gv = new GoodVibe({ provider: 'claude', storage: 'memory' });
    const team = await gv.buildTeam('마이크로서비스 SaaS 플랫폼', {
      complexity: 'complex',
      projectType: 'api-server',
    });

    expect(team.mode).toBe('plan-only');
    expect(team.complexity.level).toBe('complex');
    expect(team.agents.length).toBeGreaterThanOrEqual(5);
    expect(team.complexity.discussionRounds).toBe(3);
    expect(team.type).toBe('api-server');
  });

  it('빈 idea는 에러를 던진다', async () => {
    const gv = new GoodVibe();
    await expect(gv.buildTeam('')).rejects.toThrow('idea');
    await expect(gv.buildTeam(null)).rejects.toThrow('idea');
  });

  it('팀 에이전트에 roleId와 displayName이 있다', async () => {
    const gv = new GoodVibe({ storage: 'memory' });
    const team = await gv.buildTeam('CLI 도구', { complexity: 'simple' });

    for (const agent of team.agents) {
      expect(agent.roleId).toBeTruthy();
      expect(agent.displayName).toBeTruthy();
    }
  });
});

// --- MemoryStorage ---

describe('MemoryStorage (통합)', () => {
  it('read/write 격리를 보장한다', async () => {
    const store = new MemoryStorage();
    const data = { name: 'test', tasks: [{ id: 1 }] };
    await store.write('p1', data);

    const read = await store.read('p1');
    expect(read.name).toBe('test');

    // 원본 수정해도 읽기 결과 불변
    data.name = 'mutated';
    const read2 = await store.read('p1');
    expect(read2.name).toBe('test');
  });

  it('없는 ID는 null을 반환한다', async () => {
    const store = new MemoryStorage();
    expect(await store.read('nonexistent')).toBeNull();
  });

  it('list는 모든 항목을 반환한다', async () => {
    const store = new MemoryStorage();
    await store.write('a', { name: 'A' });
    await store.write('b', { name: 'B' });

    const items = await store.list();
    expect(items).toHaveLength(2);
  });
});

// --- report ---

describe('GoodVibe.report (통합)', () => {
  it('실행 결과를 마크다운 보고서로 생성한다', () => {
    const gv = new GoodVibe();
    const report = gv.report({
      status: 'completed',
      team: [{ roleId: 'cto', displayName: '민준' }],
      tasks: [{ id: 'task-1', title: '구현', phase: 1 }],
    });

    expect(typeof report).toBe('string');
    expect(report.length).toBeGreaterThan(0);
  });
});
