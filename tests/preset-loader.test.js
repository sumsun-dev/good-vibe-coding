import { describe, it, expect } from 'vitest';
import { loadPreset, mergePresets, listPresets } from '../scripts/lib/preset-loader.js';

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

    it('null 프리셋을 무시한다', () => {
      const a = { skills: ['a'], agents: [] };
      const result = mergePresets(a, null, undefined);
      expect(result.skills).toEqual(['a']);
    });

    it('빈 프리셋을 병합해도 에러 없다', () => {
      const result = mergePresets({}, {});
      expect(result.agents).toEqual([]);
      expect(result.skills).toEqual([]);
    });
  });

  describe('listPresets', () => {
    it('roles 카테고리의 프리셋을 나열한다', async () => {
      const names = await listPresets('roles');
      expect(names).toContain('developer');
      expect(names).toContain('pm');
    });

    it('존재하지 않는 카테고리는 빈 배열을 반환한다', async () => {
      const names = await listPresets('nonexistent');
      expect(names).toEqual([]);
    });
  });
});
