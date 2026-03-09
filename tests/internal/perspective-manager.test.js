import { describe, it, expect } from 'vitest';
import {
  PERSPECTIVES,
  getCurrentPerspective,
  getPerspectiveAnalysisFiles,
  buildPerspectiveContext,
} from '../../internal/lib/perspective-manager.js';

describe('perspective-manager', () => {
  describe('PERSPECTIVES', () => {
    it('8가지 관점이 정의되어 있어야 한다', () => {
      expect(PERSPECTIVES).toHaveLength(8);
    });

    it('각 관점에 id, name, files가 있어야 한다', () => {
      for (const p of PERSPECTIVES) {
        expect(p).toHaveProperty('id');
        expect(p).toHaveProperty('name');
        expect(p).toHaveProperty('files');
        expect(typeof p.id).toBe('string');
        expect(typeof p.name).toBe('string');
        expect(Array.isArray(p.files)).toBe(true);
        expect(p.files.length).toBeGreaterThan(0);
      }
    });

    it('모든 id가 고유해야 한다', () => {
      const ids = PERSPECTIVES.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('getCurrentPerspective', () => {
    it('executionCount % 8로 관점을 순환해야 한다', () => {
      expect(getCurrentPerspective(0).id).toBe('first-time-user');
      expect(getCurrentPerspective(1).id).toBe('command-flow');
      expect(getCurrentPerspective(7).id).toBe('intermediate-user');
      expect(getCurrentPerspective(8).id).toBe('first-time-user');
      expect(getCurrentPerspective(15).id).toBe('intermediate-user');
    });

    it('음수 입력 시 첫 번째 관점을 반환해야 한다', () => {
      const result = getCurrentPerspective(-1);
      expect(PERSPECTIVES.map((p) => p.id)).toContain(result.id);
    });

    it('NaN 입력 시 첫 번째 관점을 반환해야 한다', () => {
      const result = getCurrentPerspective(NaN);
      expect(result.id).toBe('first-time-user');
    });
  });

  describe('getPerspectiveAnalysisFiles', () => {
    it('유효한 관점 ID로 파일 패턴을 반환해야 한다', () => {
      const files = getPerspectiveAnalysisFiles('first-time-user');
      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBeGreaterThan(0);
    });

    it('잘못된 관점 ID는 빈 배열을 반환해야 한다', () => {
      const files = getPerspectiveAnalysisFiles('nonexistent');
      expect(files).toEqual([]);
    });

    it('command-flow 관점에 CLI 관련 파일이 포함되어야 한다', () => {
      const files = getPerspectiveAnalysisFiles('command-flow');
      expect(files.some((f) => f.includes('commands/'))).toBe(true);
    });

    it('sdk-dx 관점에 src/ 파일이 포함되어야 한다', () => {
      const files = getPerspectiveAnalysisFiles('sdk-dx');
      expect(files.some((f) => f.includes('src/'))).toBe(true);
    });
  });

  describe('buildPerspectiveContext', () => {
    it('히스토리 없이 기본 컨텍스트를 생성해야 한다', () => {
      const ctx = buildPerspectiveContext('first-time-user', []);
      expect(typeof ctx).toBe('string');
      expect(ctx).toContain('첫 사용자');
    });

    it('히스토리 엔트리가 있으면 요약을 포함해야 한다', () => {
      const entries = [
        {
          date: '2026-03-01',
          perspective: 'first-time-user',
          issues: 3,
          categories: ['flowClarity', 'errorQuality'],
          slaScore: 6.5,
        },
        {
          date: '2026-03-02',
          perspective: 'command-flow',
          issues: 2,
          categories: ['guideCompleteness'],
          slaScore: 7.0,
        },
      ];
      const ctx = buildPerspectiveContext('first-time-user', entries);
      expect(ctx).toContain('이전 실행');
    });

    it('동일 관점의 이전 결과를 강조해야 한다', () => {
      const entries = [
        {
          date: '2026-03-01',
          perspective: 'first-time-user',
          issues: 3,
          categories: ['flowClarity'],
          slaScore: 6.5,
        },
      ];
      const ctx = buildPerspectiveContext('first-time-user', entries);
      expect(ctx).toContain('first-time-user');
    });

    it('잘못된 관점 ID는 빈 문자열을 반환해야 한다', () => {
      const ctx = buildPerspectiveContext('nonexistent', []);
      expect(ctx).toBe('');
    });
  });
});
