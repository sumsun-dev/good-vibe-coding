import { describe, it, expect, vi } from 'vitest';
import {
  buildHistoryEntry,
  readRecentEntries,
  buildHistorySummary,
  checkMergeStatus,
} from '../../internal/lib/history-analyzer.js';

describe('history-analyzer', () => {
  describe('buildHistoryEntry', () => {
    it('필수 필드만으로 엔트리를 생성한다', () => {
      const line = buildHistoryEntry({ date: '2026-03-01' });
      const entry = JSON.parse(line);
      expect(entry.date).toBe('2026-03-01');
      expect(entry.issues).toBe(0);
      expect(entry.categories).toEqual([]);
      expect(entry.approved).toBeNull();
      expect(entry.fixCycles).toBe(0);
      expect(entry.mergedAt).toBeNull();
      expect(entry.prUrl).toBeNull();
      expect(entry.stopReason).toBeNull();
    });

    it('모든 필드를 올바르게 설정한다', () => {
      const line = buildHistoryEntry({
        date: '2026-03-01',
        issues: 3,
        categories: ['quality', 'security'],
        approved: true,
        fixCycles: 2,
        prUrl: 'https://github.com/repo/pull/42',
        stopReason: 'approved',
      });
      const entry = JSON.parse(line);
      expect(entry.issues).toBe(3);
      expect(entry.categories).toEqual(['quality', 'security']);
      expect(entry.approved).toBe(true);
      expect(entry.fixCycles).toBe(2);
      expect(entry.prUrl).toBe('https://github.com/repo/pull/42');
      expect(entry.stopReason).toBe('approved');
    });

    it('stopReason 빈 문자열을 null로 변환한다', () => {
      const line = buildHistoryEntry({ date: '2026-03-01', stopReason: '' });
      const entry = JSON.parse(line);
      expect(entry.stopReason).toBeNull();
    });

    it('prUrl "null" 문자열을 null로 변환한다', () => {
      const line = buildHistoryEntry({ date: '2026-03-01', prUrl: 'null' });
      const entry = JSON.parse(line);
      expect(entry.prUrl).toBeNull();
    });

    it('approved 문자열 "true"를 boolean true로 변환한다', () => {
      const line = buildHistoryEntry({ date: '2026-03-01', approved: 'true' });
      const entry = JSON.parse(line);
      expect(entry.approved).toBe(true);
    });

    it('approved 문자열 "false"를 boolean false로 변환한다', () => {
      const line = buildHistoryEntry({ date: '2026-03-01', approved: 'false' });
      const entry = JSON.parse(line);
      expect(entry.approved).toBe(false);
    });

    it('빈 categories를 빈 배열로 유지한다', () => {
      const line = buildHistoryEntry({ date: '2026-03-01', categories: [] });
      const entry = JSON.parse(line);
      expect(entry.categories).toEqual([]);
    });

    it('categories가 배열이 아니면 빈 배열로 변환한다', () => {
      const line = buildHistoryEntry({ date: '2026-03-01', categories: 'quality' });
      const entry = JSON.parse(line);
      expect(entry.categories).toEqual([]);
    });

    it('totalRounds를 올바르게 설정한다', () => {
      const line = buildHistoryEntry({ date: '2026-03-01', totalRounds: 3 });
      const entry = JSON.parse(line);
      expect(entry.totalRounds).toBe(3);
    });

    it('totalRounds 기본값은 1이다', () => {
      const line = buildHistoryEntry({ date: '2026-03-01' });
      const entry = JSON.parse(line);
      expect(entry.totalRounds).toBe(1);
    });

    it('slaScore를 올바르게 설정한다', () => {
      const line = buildHistoryEntry({ date: '2026-03-01', slaScore: 7.5 });
      const entry = JSON.parse(line);
      expect(entry.slaScore).toBe(7.5);
    });

    it('slaScore 기본값은 null이다', () => {
      const line = buildHistoryEntry({ date: '2026-03-01' });
      const entry = JSON.parse(line);
      expect(entry.slaScore).toBeNull();
    });

    it('slaScore "null" 문자열을 null로 변환한다', () => {
      const line = buildHistoryEntry({ date: '2026-03-01', slaScore: 'null' });
      const entry = JSON.parse(line);
      expect(entry.slaScore).toBeNull();
    });
  });

  describe('readRecentEntries', () => {
    const today = new Date().toISOString().slice(0, 10);
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);

    const entries = [
      { date: today, issues: 1 },
      { date: twoDaysAgo, issues: 2 },
      { date: tenDaysAgo, issues: 3 },
    ];

    it('7일 이내 엔트리만 반환한다', () => {
      const recent = readRecentEntries(entries, 7);
      expect(recent).toHaveLength(2);
      expect(recent[0].date).toBe(today);
      expect(recent[1].date).toBe(twoDaysAgo);
    });

    it('빈 배열이면 빈 배열을 반환한다', () => {
      expect(readRecentEntries([], 7)).toEqual([]);
    });

    it('모든 엔트리가 범위 밖이면 빈 배열을 반환한다', () => {
      const old = [{ date: '2020-01-01', issues: 1 }];
      expect(readRecentEntries(old, 7)).toEqual([]);
    });

    it('days=0이면 오늘 엔트리만 반환한다', () => {
      const recent = readRecentEntries(entries, 0);
      expect(recent.every((e) => e.date >= today)).toBe(true);
    });

    it('days=30이면 모든 엔트리를 반환한다', () => {
      const recent = readRecentEntries(entries, 30);
      expect(recent).toHaveLength(3);
    });
  });

  describe('buildHistorySummary', () => {
    it('빈 배열이면 첫 실행 메시지를 반환한다', () => {
      expect(buildHistorySummary([])).toBe('실행 이력 없음 (첫 실행)');
    });

    it('null이면 첫 실행 메시지를 반환한다', () => {
      expect(buildHistorySummary(null)).toBe('실행 이력 없음 (첫 실행)');
    });

    it('카테고리 집계를 포함한다', () => {
      const entries = [
        { date: '2026-03-01', issues: 2, categories: ['quality', 'security'], approved: true },
        { date: '2026-03-02', issues: 1, categories: ['quality'], approved: false },
      ];
      const summary = buildHistorySummary(entries);
      expect(summary).toContain('quality: 2건');
      expect(summary).toContain('security: 1건');
    });

    it('승인율을 포함한다', () => {
      const entries = [
        { date: '2026-03-01', issues: 1, categories: [], approved: true },
        { date: '2026-03-02', issues: 1, categories: [], approved: false },
      ];
      const summary = buildHistorySummary(entries);
      expect(summary).toContain('승인율: 1/2');
    });

    it('발견 없음 카운트 3+ 시 분석 범위 확장 지침을 포함한다', () => {
      const entries = [
        { date: '2026-03-01', issues: 0, categories: [] },
        { date: '2026-03-02', issues: 0, categories: [] },
        { date: '2026-03-03', issues: 0, categories: [] },
      ];
      const summary = buildHistorySummary(entries);
      expect(summary).toContain('분석 범위를 확장');
    });

    it('승인율 < 50%이면 수정 품질 경고를 포함한다', () => {
      const entries = [
        { date: '2026-03-01', issues: 1, categories: [], approved: false },
        { date: '2026-03-02', issues: 1, categories: [], approved: false },
        { date: '2026-03-03', issues: 1, categories: [], approved: true },
      ];
      const summary = buildHistorySummary(entries);
      expect(summary).toContain('리뷰 통과율이 낮습니다');
    });

    it('누락 카테고리 재탐색 지침을 포함한다', () => {
      const entries = [
        { date: '2026-03-01', issues: 1, categories: ['quality'], approved: true },
      ];
      const summary = buildHistorySummary(entries);
      expect(summary).toContain('security 이슈가 발견되지 않았습니다');
      expect(summary).toContain('performance 이슈가 발견되지 않았습니다');
    });

    it('status text를 올바르게 생성한다', () => {
      const entries = [
        { date: '2026-03-01', issues: 0, categories: [] },
        { date: '2026-03-02', issues: 1, categories: [], approved: true, mergedAt: '2026-03-02' },
        {
          date: '2026-03-03',
          issues: 1,
          categories: [],
          approved: false,
          fixCycles: 3,
          stopReason: 'no_progress',
        },
      ];
      const summary = buildHistorySummary(entries);
      expect(summary).toContain('발견 없음');
      expect(summary).toContain('승인, 머지됨');
      expect(summary).toContain('3회 수정 후 중단 (진행 없음)');
    });

    it('historyDays 옵션을 반영한다', () => {
      const entries = [{ date: '2026-03-01', issues: 1, categories: [], approved: true }];
      const summary = buildHistorySummary(entries, { historyDays: 14 });
      expect(summary).toContain('14일간');
    });

    it('SLA 추이를 표시한다', () => {
      const entries = [
        { date: '2026-03-01', issues: 2, categories: ['quality'], approved: true, slaScore: 6.5, totalRounds: 2 },
        { date: '2026-03-02', issues: 1, categories: ['quality'], approved: true, slaScore: 7.2, totalRounds: 3 },
      ];
      const summary = buildHistorySummary(entries);
      expect(summary).toContain('SLA 추이');
      expect(summary).toContain('6.5/10');
      expect(summary).toContain('7.2/10');
      expect(summary).toContain('2 rounds');
      expect(summary).toContain('3 rounds');
    });

    it('SLA 점수가 없는 엔트리는 SLA 추이에서 제외한다', () => {
      const entries = [
        { date: '2026-03-01', issues: 1, categories: [], approved: true },
      ];
      const summary = buildHistorySummary(entries);
      expect(summary).not.toContain('SLA 추이');
    });

    it('엔트리에 SLA/라운드 정보를 표시한다', () => {
      const entries = [
        { date: '2026-03-01', issues: 1, categories: [], approved: true, slaScore: 7.0, totalRounds: 2 },
      ];
      const summary = buildHistorySummary(entries);
      expect(summary).toContain('SLA: 7/10');
      expect(summary).toContain('2R');
    });
  });

  describe('checkMergeStatus', () => {
    it('MERGED 상태 엔트리의 mergedAt을 업데이트한다', () => {
      const entries = [
        { date: new Date().toISOString().slice(0, 10), mergedAt: null, prUrl: 'https://github.com/repo/pull/42' },
      ];
      const ghPrViewFn = () => 'MERGED';
      const updated = checkMergeStatus(entries, ghPrViewFn);
      expect(updated[0].mergedAt).not.toBeNull();
    });

    it('이미 mergedAt이 있는 엔트리는 건너뛴다', () => {
      const entries = [
        { date: new Date().toISOString().slice(0, 10), mergedAt: '2026-03-01', prUrl: 'https://github.com/repo/pull/42' },
      ];
      const ghPrViewFn = vi.fn();
      const updated = checkMergeStatus(entries, ghPrViewFn);
      expect(ghPrViewFn).not.toHaveBeenCalled();
      expect(updated[0].mergedAt).toBe('2026-03-01');
    });

    it('prUrl이 없는 엔트리는 건너뛴다', () => {
      const entries = [{ date: new Date().toISOString().slice(0, 10), mergedAt: null, prUrl: null }];
      const ghPrViewFn = vi.fn();
      checkMergeStatus(entries, ghPrViewFn);
      expect(ghPrViewFn).not.toHaveBeenCalled();
    });

    it('30일 이전 엔트리는 건너뛴다', () => {
      const entries = [
        { date: '2025-01-01', mergedAt: null, prUrl: 'https://github.com/repo/pull/42' },
      ];
      const ghPrViewFn = vi.fn();
      checkMergeStatus(entries, ghPrViewFn);
      expect(ghPrViewFn).not.toHaveBeenCalled();
    });

    it('OPEN 상태면 mergedAt을 변경하지 않는다', () => {
      const entries = [
        { date: new Date().toISOString().slice(0, 10), mergedAt: null, prUrl: 'https://github.com/repo/pull/42' },
      ];
      const ghPrViewFn = () => 'OPEN';
      const updated = checkMergeStatus(entries, ghPrViewFn);
      expect(updated[0].mergedAt).toBeNull();
    });

    it('원본 엔트리를 변이시키지 않는다 (immutability)', () => {
      const original = {
        date: new Date().toISOString().slice(0, 10),
        mergedAt: null,
        prUrl: 'https://github.com/repo/pull/42',
      };
      const entries = [original];
      checkMergeStatus(entries, () => 'MERGED');
      expect(original.mergedAt).toBeNull();
    });
  });
});
