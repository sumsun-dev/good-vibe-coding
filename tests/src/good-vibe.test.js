import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock LLM provider before importing
vi.mock('../../scripts/lib/llm/llm-provider.js', () => ({
  callLLM: vi.fn(),
}));

// Mock auth-manager to avoid file system access
vi.mock('../../scripts/lib/llm/auth-manager.js', () => ({
  loadAuth: vi.fn().mockResolvedValue({ apiKey: 'test-key' }),
}));

import { GoodVibe } from '../../src/good-vibe.js';
import { MemoryStorage } from '../../src/storage.js';

describe('GoodVibe', () => {
  let gv;

  beforeEach(() => {
    vi.clearAllMocks();
    gv = new GoodVibe({ provider: 'claude', storage: 'memory' });
  });

  describe('constructor', () => {
    it('기본값으로 생성할 수 있다', () => {
      const instance = new GoodVibe();
      expect(instance.provider).toBe('claude');
      expect(instance.model).toBe('claude-sonnet-4-6');
      expect(instance.storage).toBeInstanceOf(MemoryStorage);
    });

    it('프로바이더별 기본 모델을 사용한다', () => {
      const openai = new GoodVibe({ provider: 'openai' });
      expect(openai.model).toBe('gpt-4o');

      const gemini = new GoodVibe({ provider: 'gemini' });
      expect(gemini.model).toBe('gemini-2.0-flash');
    });

    it('커스텀 모델을 지정할 수 있다', () => {
      const custom = new GoodVibe({ provider: 'claude', model: 'claude-opus-4-6' });
      expect(custom.model).toBe('claude-opus-4-6');
    });
  });

  describe('buildTeam', () => {
    it('아이디어로 팀을 빌드한다 (로컬 계산)', async () => {
      const result = await gv.buildTeam('날씨 알림 텔레그램 봇', {
        projectType: 'custom',
        complexity: 'simple',
      });

      expect(result.idea).toBe('날씨 알림 텔레그램 봇');
      expect(result.mode).toBe('quick-build');
      expect(result.agents).toBeDefined();
      expect(Array.isArray(result.agents)).toBe(true);
      expect(result.complexity.level).toBe('simple');
    });

    it('medium 복잡도는 plan-execute 모드를 추천한다', async () => {
      const result = await gv.buildTeam('블로그 플랫폼', {
        complexity: 'medium',
      });
      expect(result.mode).toBe('plan-execute');
    });

    it('complex 복잡도는 plan-only 모드를 추천한다', async () => {
      const result = await gv.buildTeam('마켓플레이스', {
        complexity: 'complex',
      });
      expect(result.mode).toBe('plan-only');
    });
  });

  describe('buildTeam 입력 검증', () => {
    it('빈 문자열은 에러를 던진다', async () => {
      await expect(gv.buildTeam('')).rejects.toThrow('idea는 비어있지 않은 문자열이어야 합니다');
    });

    it('null은 에러를 던진다', async () => {
      await expect(gv.buildTeam(null)).rejects.toThrow('idea는 비어있지 않은 문자열이어야 합니다');
    });

    it('공백만 있는 문자열은 에러를 던진다', async () => {
      await expect(gv.buildTeam('   ')).rejects.toThrow('idea는 비어있지 않은 문자열이어야 합니다');
    });
  });

  describe('discuss 입력 검증', () => {
    it('null team은 에러를 던진다', async () => {
      await expect(gv.discuss(null)).rejects.toThrow('team 객체가 필요합니다');
    });

    it('빈 agents 배열은 에러를 던진다', async () => {
      await expect(gv.discuss({ agents: [] })).rejects.toThrow('team.agents 배열이 비어있습니다');
    });
  });

  describe('execute 입력 검증', () => {
    it('null plan은 에러를 던진다', async () => {
      await expect(gv.execute(null)).rejects.toThrow('plan 객체가 필요합니다');
    });
  });

  describe('report', () => {
    it('프로젝트 데이터로 보고서를 생성한다', () => {
      const project = {
        name: 'Test Project',
        type: 'custom',
        mode: 'plan-execute',
        status: 'completed',
        team: [{ roleId: 'cto', emoji: '🧑‍💻', displayName: 'CTO', role: 'CTO' }],
        tasks: [{ id: '1', title: 'Task 1', assignee: 'cto', status: 'completed' }],
        discussion: { planDocument: '# Plan', rounds: [] },
      };

      const report = gv.report(project);
      expect(typeof report).toBe('string');
      expect(report).toContain('Test Project');
      expect(report).toContain('CTO');
    });

    it('최소 결과 객체로도 보고서를 생성한다', () => {
      const report = gv.report({ status: 'completed' });
      expect(typeof report).toBe('string');
      expect(report).toContain('SDK Project');
    });
  });
});
