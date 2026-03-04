import { describe, it, expect, vi } from 'vitest';
import {
  verifyCreatedIssues,
  verifyClosesLinks,
  findStaleIssues,
  extractFilePathsFromBody,
  verifyIssueResolution,
  trackCrossRoundIssues,
} from '../../scripts/lib/improvement/issue-manager.js';

describe('issue-manager', () => {
  describe('verifyCreatedIssues', () => {
    it('expected와 actual이 일치하면 모두 verified', () => {
      const result = verifyCreatedIssues({
        expectedIssues: [1, 2, 3],
        ghIssueFn: () => [1, 2, 3],
      });
      expect(result.verified).toEqual([1, 2, 3]);
      expect(result.missing).toEqual([]);
      expect(result.unexpected).toEqual([]);
    });

    it('누락된 이슈를 감지한다', () => {
      const result = verifyCreatedIssues({
        expectedIssues: [1, 2, 3],
        ghIssueFn: () => [1, 3],
      });
      expect(result.missing).toEqual([2]);
    });

    it('예상외 이슈를 감지한다', () => {
      const result = verifyCreatedIssues({
        expectedIssues: [1, 2],
        ghIssueFn: () => [1, 2, 99],
      });
      expect(result.unexpected).toEqual([99]);
    });

    it('빈 배열을 처리한다', () => {
      const result = verifyCreatedIssues({
        expectedIssues: [],
        ghIssueFn: () => [],
      });
      expect(result.verified).toEqual([]);
      expect(result.missing).toEqual([]);
      expect(result.unexpected).toEqual([]);
    });

    it('expected가 비고 actual이 있는 경우', () => {
      const result = verifyCreatedIssues({
        expectedIssues: [],
        ghIssueFn: () => [5, 6],
      });
      expect(result.unexpected).toEqual([5, 6]);
    });
  });

  describe('verifyClosesLinks', () => {
    it('closes #N 패턴을 추출한다', () => {
      const result = verifyClosesLinks({
        prBody: 'fixes: closes #1, closes #2\n일반 텍스트',
        createdIssues: [1, 2, 3],
      });
      expect(result.linked).toEqual([1, 2]);
      expect(result.unlinked).toEqual([3]);
    });

    it('fixes #N 변형을 인식한다', () => {
      const result = verifyClosesLinks({
        prBody: 'fixes #10\nresolves #20',
        createdIssues: [10, 20],
      });
      expect(result.linked).toEqual([10, 20]);
    });

    it('close #N (단수형)도 인식한다', () => {
      const result = verifyClosesLinks({
        prBody: 'close #5',
        createdIssues: [5],
      });
      expect(result.linked).toEqual([5]);
    });

    it('연결되지 않은 이슈를 감지한다', () => {
      const result = verifyClosesLinks({
        prBody: 'closes #1',
        createdIssues: [1, 2],
      });
      expect(result.unlinked).toEqual([2]);
    });

    it('orphaned 이슈를 감지한다 (PR에 있지만 생성 목록에 없음)', () => {
      const result = verifyClosesLinks({
        prBody: 'closes #1, closes #99',
        createdIssues: [1],
      });
      expect(result.orphaned).toEqual([99]);
    });

    it('빈 PR body를 처리한다', () => {
      const result = verifyClosesLinks({
        prBody: '',
        createdIssues: [1, 2],
      });
      expect(result.linked).toEqual([]);
      expect(result.unlinked).toEqual([1, 2]);
    });

    it('기본값으로 동작한다', () => {
      const result = verifyClosesLinks({});
      expect(result.linked).toEqual([]);
      expect(result.unlinked).toEqual([]);
      expect(result.orphaned).toEqual([]);
    });
  });

  describe('findStaleIssues', () => {
    it('N일 이상 열린 이슈를 반환한다', () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
      const result = findStaleIssues({
        staleDays: 14,
        ghIssueFn: () => [
          { number: 1, title: '오래된 이슈', createdAt: thirtyDaysAgo },
        ],
      });
      expect(result).toHaveLength(1);
      expect(result[0].number).toBe(1);
      expect(result[0].daysOpen).toBeGreaterThanOrEqual(30);
    });

    it('최근 이슈를 제외한다', () => {
      const now = new Date().toISOString();
      const result = findStaleIssues({
        staleDays: 14,
        ghIssueFn: () => [
          { number: 1, title: '새 이슈', createdAt: now },
        ],
      });
      expect(result).toHaveLength(0);
    });

    it('경계값을 올바르게 처리한다', () => {
      const exactlyStale = new Date(Date.now() - 14 * 86400000).toISOString();
      const result = findStaleIssues({
        staleDays: 14,
        ghIssueFn: () => [
          { number: 1, title: '정확히 14일', createdAt: exactlyStale },
        ],
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('extractFilePathsFromBody', () => {
    it('백틱 내 파일 경로를 추출한다', () => {
      const body = '문제 파일: `scripts/lib/core/config.js`에서 발견';
      const paths = extractFilePathsFromBody(body);
      expect(paths).toContain('scripts/lib/core/config.js');
    });

    it('파일: 라벨 뒤 경로를 추출한다', () => {
      const body = '- 파일: scripts/lib/foo.js\n- path: src/index.ts';
      const paths = extractFilePathsFromBody(body);
      expect(paths).toContain('scripts/lib/foo.js');
      expect(paths).toContain('src/index.ts');
    });

    it('빈 본문이면 빈 배열을 반환한다', () => {
      expect(extractFilePathsFromBody('')).toEqual([]);
      expect(extractFilePathsFromBody(null)).toEqual([]);
    });

    it('중복 경로를 제거한다', () => {
      const body = '`foo.js`와 `foo.js`에서 문제';
      const paths = extractFilePathsFromBody(body);
      expect(paths.filter((p) => p === 'foo.js')).toHaveLength(1);
    });

    it('여러 패턴을 동시에 추출한다', () => {
      const body = '파일: a.js\n`b.js`에서도 발견\nfile: c.ts';
      const paths = extractFilePathsFromBody(body);
      expect(paths.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('verifyIssueResolution', () => {
    const sampleDiff = `diff --git a/scripts/lib/core/config.js b/scripts/lib/core/config.js
--- a/scripts/lib/core/config.js
+++ b/scripts/lib/core/config.js
@@ -1,3 +1,4 @@
+// fixed
 export const config = {};`;

    it('diff에 파일이 있으면 resolved=true', () => {
      const result = verifyIssueResolution({
        issues: [{ number: 1, body: '파일: `scripts/lib/core/config.js`' }],
        diffText: sampleDiff,
      });
      expect(result[0].resolved).toBe(true);
      expect(result[0].filesMatched.length).toBeGreaterThan(0);
    });

    it('diff에 파일이 없으면 resolved=false', () => {
      const result = verifyIssueResolution({
        issues: [{ number: 1, body: '파일: `src/missing.ts`' }],
        diffText: sampleDiff,
      });
      expect(result[0].resolved).toBe(false);
    });

    it('빈 이슈 배열을 처리한다', () => {
      const result = verifyIssueResolution({ issues: [], diffText: sampleDiff });
      expect(result).toEqual([]);
    });

    it('이슈 본문에 경로가 없으면 resolved=false', () => {
      const result = verifyIssueResolution({
        issues: [{ number: 1, body: '경로 없는 이슈입니다' }],
        diffText: sampleDiff,
      });
      expect(result[0].resolved).toBe(false);
    });
  });

  describe('trackCrossRoundIssues', () => {
    it('해결된 이슈를 감지한다 (closes 패턴)', () => {
      const result = trackCrossRoundIssues({
        previousRoundIssues: [1, 2, 3],
        currentRoundIssues: [2, 4],
        diffText: 'closes #1',
      });
      expect(result.resolved).toContain(1);
      expect(result.resolved).toContain(3); // current에 없으면 해결 간주
    });

    it('미해결 이슈를 감지한다', () => {
      const result = trackCrossRoundIssues({
        previousRoundIssues: [1, 2],
        currentRoundIssues: [2],
        diffText: '',
      });
      expect(result.stillOpen).toContain(2);
    });

    it('새 이슈를 감지한다', () => {
      const result = trackCrossRoundIssues({
        previousRoundIssues: [1],
        currentRoundIssues: [1, 5, 6],
        diffText: '',
      });
      expect(result.newIssues).toEqual([5, 6]);
    });

    it('빈 배열을 처리한다', () => {
      const result = trackCrossRoundIssues({
        previousRoundIssues: [],
        currentRoundIssues: [],
        diffText: '',
      });
      expect(result.resolved).toEqual([]);
      expect(result.stillOpen).toEqual([]);
      expect(result.newIssues).toEqual([]);
    });
  });
});
