import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadPersonalities,
  buildAgentTeam,
  getPersonalityVariants,
  clearCache,
} from '../scripts/lib/personality-builder.js';

describe('personality-builder', () => {
  beforeEach(() => {
    clearCache();
  });

  describe('loadPersonalities', () => {
    it('personalities.json을 로드한다', async () => {
      const data = await loadPersonalities();
      expect(data).toBeDefined();
      expect(typeof data).toBe('object');
    });

    it('8개 에이전트 페르소나를 포함한다', async () => {
      const data = await loadPersonalities();
      const keys = Object.keys(data);
      expect(keys.length).toBe(8);
      expect(keys).toContain('code-reviewer-kr');
      expect(keys).toContain('tdd-coach-kr');
      expect(keys).toContain('mentor-kr');
    });

    it('각 에이전트에 role, variants, default가 있다', async () => {
      const data = await loadPersonalities();
      for (const [, persona] of Object.entries(data)) {
        expect(persona.role).toBeDefined();
        expect(persona.variants).toBeInstanceOf(Array);
        expect(persona.variants.length).toBe(2);
        expect(persona.default).toBeDefined();
      }
    });

    it('각 variant에 필수 필드가 있다', async () => {
      const data = await loadPersonalities();
      const requiredFields = ['id', 'name', 'emoji', 'defaultName', 'trait', 'description', 'speakingStyle', 'greeting'];
      for (const [, persona] of Object.entries(data)) {
        for (const variant of persona.variants) {
          for (const field of requiredFields) {
            expect(variant[field], `${variant.id}의 ${field} 누락`).toBeDefined();
          }
        }
      }
    });

    it('두 번 호출하면 캐싱된 결과를 반환한다', async () => {
      const first = await loadPersonalities();
      const second = await loadPersonalities();
      expect(first).toBe(second);
    });
  });

  describe('buildAgentTeam', () => {
    const devAgents = [
      { template: 'code-reviewer-kr', config: { model: 'sonnet' } },
      { template: 'tdd-coach-kr', config: { model: 'haiku' } },
    ];

    it('사용자 선택 없이 기본값으로 팀을 빌드한다', async () => {
      const team = await buildAgentTeam(devAgents);
      expect(team).toHaveLength(2);

      const reviewer = team[0];
      expect(reviewer.agentName).toBe('code-reviewer-kr');
      expect(reviewer.role).toBe('코드 리뷰어');
      expect(reviewer.displayName).toBe('준영');
      expect(reviewer.emoji).toBe('🔍');
      expect(reviewer.model).toBe('sonnet');
    });

    it('사용자가 variant를 선택하면 해당 페르소나를 적용한다', async () => {
      const team = await buildAgentTeam(devAgents, {
        'code-reviewer-kr': 'friendly',
      });

      const reviewer = team[0];
      expect(reviewer.displayName).toBe('서준');
      expect(reviewer.emoji).toBe('🤝');
    });

    it('personalities.json에 없는 에이전트는 기본 정보로 fallback한다', async () => {
      const agents = [
        { template: 'unknown-agent', config: { model: 'haiku' } },
      ];
      const team = await buildAgentTeam(agents);
      expect(team).toHaveLength(1);
      expect(team[0].emoji).toBe('🤖');
      expect(team[0].displayName).toBe('unknown-agent');
      expect(team[0].model).toBe('haiku');
    });

    it('config.model이 없으면 sonnet을 기본값으로 사용한다', async () => {
      const agents = [{ template: 'code-reviewer-kr' }];
      const team = await buildAgentTeam(agents);
      expect(team[0].model).toBe('sonnet');
    });

    it('존재하지 않는 variant id를 선택하면 첫 번째 variant로 fallback한다', async () => {
      const team = await buildAgentTeam(devAgents, {
        'code-reviewer-kr': 'nonexistent-variant',
      });

      const reviewer = team[0];
      expect(reviewer.displayName).toBe('준영');
      expect(reviewer.emoji).toBe('🔍');
    });
  });

  describe('getPersonalityVariants', () => {
    it('에이전트의 변형 목록을 반환한다', async () => {
      const result = await getPersonalityVariants('code-reviewer-kr');
      expect(result).not.toBeNull();
      expect(result.role).toBe('코드 리뷰어');
      expect(result.variants).toHaveLength(2);
      expect(result.default).toBe('meticulous');
    });

    it('variant에 id, name, emoji, description이 포함된다', async () => {
      const result = await getPersonalityVariants('tdd-coach-kr');
      const variant = result.variants[0];
      expect(variant.id).toBeDefined();
      expect(variant.name).toBeDefined();
      expect(variant.emoji).toBeDefined();
      expect(variant.description).toBeDefined();
    });

    it('존재하지 않는 에이전트는 null을 반환한다', async () => {
      const result = await getPersonalityVariants('nonexistent-agent');
      expect(result).toBeNull();
    });
  });
});
