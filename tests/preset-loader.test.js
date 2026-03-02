import { describe, it, expect } from 'vitest';
import { loadPreset, mergePresets, listPresets, validatePreset } from '../scripts/lib/preset-loader.js';

describe('preset-loader', () => {
  describe('loadPreset', () => {
    it('developer 프리셋을 로딩한다', async () => {
      const preset = await loadPreset('roles', 'developer');
      expect(preset.name).toBe('developer');
      expect(preset.displayName).toBe('개발자');
      expect(preset.category).toBe('role');
      expect(preset.agents).toBeInstanceOf(Array);
      expect(preset.skills).toBeInstanceOf(Array);
    });

    it('pm 프리셋을 로딩한다', async () => {
      const preset = await loadPreset('roles', 'pm');
      expect(preset.name).toBe('pm');
      expect(preset.displayName).toBe('PM / 기획자');
    });

    it('designer 프리셋을 로딩한다', async () => {
      const preset = await loadPreset('roles', 'designer');
      expect(preset.name).toBe('designer');
      expect(preset.displayName).toBe('디자이너');
      expect(preset.category).toBe('role');
      expect(preset.agents).toBeInstanceOf(Array);
    });

    it('researcher 프리셋을 로딩한다', async () => {
      const preset = await loadPreset('roles', 'researcher');
      expect(preset.name).toBe('researcher');
      expect(preset.displayName).toBe('리서처 / 분석가');
    });

    it('content-creator 프리셋을 로딩한다', async () => {
      const preset = await loadPreset('roles', 'content-creator');
      expect(preset.name).toBe('content-creator');
      expect(preset.displayName).toBe('콘텐츠 크리에이터');
    });

    it('student 프리셋을 로딩한다', async () => {
      const preset = await loadPreset('roles', 'student');
      expect(preset.name).toBe('student');
      expect(preset.displayName).toBe('학생 / 입문자');
    });

    it('nextjs-supabase 스택 프리셋을 로딩한다', async () => {
      const preset = await loadPreset('stacks', 'nextjs-supabase');
      expect(preset.name).toBe('nextjs-supabase');
      expect(preset.displayName).toBe('Next.js + Supabase');
      expect(preset.category).toBe('stack');
      expect(preset.stackRules).toBeInstanceOf(Array);
      expect(preset.stackRules.length).toBeGreaterThan(0);
    });

    it('react-node 스택 프리셋을 로딩한다', async () => {
      const preset = await loadPreset('stacks', 'react-node');
      expect(preset.name).toBe('react-node');
      expect(preset.displayName).toBe('React + Node.js');
      expect(preset.category).toBe('stack');
      expect(preset.stackRules).toBeInstanceOf(Array);
      expect(preset.stackRules.length).toBeGreaterThan(0);
    });

    it('존재하지 않는 프리셋은 에러를 발생시킨다', async () => {
      await expect(loadPreset('roles', 'nonexistent')).rejects.toThrow();
    });
  });

  describe('mergePresets', () => {
    it('두 프리셋을 병합한다', () => {
      const a = {
        name: 'base',
        displayName: 'Base',
        agents: [{ template: 'agent-a', config: {} }],
        skills: ['skill-a'],
        commands: ['cmd-a'],
        rules: { core: true },
        hooks: { hook_a: true },
        guides: ['common'],
        claudeMd: { language: 'korean' },
      };
      const b = {
        name: 'overlay',
        displayName: 'Overlay',
        agents: [{ template: 'agent-b', config: {} }],
        skills: ['skill-b', 'skill-a'],
        commands: ['cmd-b'],
        rules: { extra: true },
        hooks: { hook_b: true },
        guides: ['developer'],
        workflow: 'dev-tdd',
      };

      const result = mergePresets(a, b);

      expect(result.name).toBe('overlay');
      expect(result.agents).toHaveLength(2);
      expect(result.skills).toEqual(['skill-a', 'skill-b']);
      expect(result.commands).toEqual(['cmd-a', 'cmd-b']);
      expect(result.rules).toEqual({ core: true, extra: true });
      expect(result.hooks).toEqual({ hook_a: true, hook_b: true });
      expect(result.guides).toEqual(['common', 'developer']);
      expect(result.workflow).toBe('dev-tdd');
    });

    it('stackRules를 병합한다', () => {
      const rolePreset = {
        name: 'developer',
        displayName: '개발자',
        agents: [],
        skills: ['tdd'],
      };
      const stackPreset = {
        name: 'nextjs-supabase',
        displayName: 'Next.js + Supabase',
        agents: [],
        stackRules: [
          'Next.js App Router 사용',
          'Supabase RLS 정책 필수',
        ],
      };

      const result = mergePresets(rolePreset, stackPreset);

      expect(result.stackRules).toEqual([
        'Next.js App Router 사용',
        'Supabase RLS 정책 필수',
      ]);
      expect(result.skills).toEqual(['tdd']);
    });

    it('stackRules가 없는 프리셋 병합 시 빈 배열을 유지한다', () => {
      const a = { agents: [], skills: [] };
      const result = mergePresets(a);
      expect(result.stackRules).toEqual([]);
    });

    it('null 프리셋을 무시한다', () => {
      const a = { skills: ['a'], agents: [] };
      const result = mergePresets(a, null, undefined);
      expect(result.skills).toEqual(['a']);
    });

    it('빈 프리셋을 병합해도 에러 없다', () => {
      const result = mergePresets({}, {});
      expect(result.agents).toEqual([]);
      expect(result.skills).toEqual([]);
      expect(result.stackRules).toEqual([]);
    });
  });

  describe('listPresets', () => {
    it('roles 카테고리의 프리셋을 나열한다', async () => {
      const names = await listPresets('roles');
      expect(names).toContain('developer');
      expect(names).toContain('pm');
      expect(names).toContain('designer');
      expect(names).toContain('researcher');
      expect(names).toContain('content-creator');
      expect(names).toContain('student');
    });

    it('stacks 카테고리의 프리셋을 나열한다', async () => {
      const names = await listPresets('stacks');
      expect(names).toContain('nextjs-supabase');
      expect(names).toContain('react-node');
    });

    it('존재하지 않는 카테고리는 빈 배열을 반환한다', async () => {
      const names = await listPresets('nonexistent');
      expect(names).toEqual([]);
    });
  });

  describe('validatePreset', () => {
    it('name이 누락되면 에러를 발생시킨다', () => {
      expect(() => validatePreset({ displayName: 'Test' }, 'stacks')).toThrow('프리셋 name');
    });

    it('displayName이 누락되면 에러를 발생시킨다', () => {
      expect(() => validatePreset({ name: 'test' }, 'stacks')).toThrow('프리셋 displayName');
    });

    it('roles 카테고리에서 category가 누락되면 에러를 발생시킨다', () => {
      expect(() => validatePreset({ name: 'test', displayName: 'Test' }, 'roles')).toThrow('역할 프리셋 category');
    });

    it('stacks 카테고리는 stackRules가 필수이다', () => {
      expect(() => validatePreset({ name: 'test', displayName: 'Test' }, 'stacks')).toThrow('stackRules');
      expect(() => validatePreset({ name: 'test', displayName: 'Test', stackRules: [] }, 'stacks')).not.toThrow();
    });
  });
});
