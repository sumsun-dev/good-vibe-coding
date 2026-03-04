import { describe, it, expect } from 'vitest';
import {
  countMustIssues,
  parseReviewStatusFromBody,
  interpretClaudeExit,
} from '../../scripts/lib/improvement/review-parser.js';

describe('review-parser', () => {
  describe('countMustIssues', () => {
    it('[MUST] 태그가 없으면 0을 반환한다', () => {
      expect(countMustIssues('좋은 코드입니다. [SHOULD] 리팩토링 고려')).toBe(0);
    });

    it('[MUST] 태그 1개를 정확히 카운트한다', () => {
      expect(countMustIssues('1. [MUST] 보안 취약점 발견')).toBe(1);
    });

    it('[MUST] 태그 여러 개를 정확히 카운트한다', () => {
      const text = `## [CHANGES_REQUESTED]
1. [MUST] 보안 취약점
2. [MUST] 로직 오류
3. [MUST] 컨벤션 위반
[SHOULD] 네이밍 개선`;
      expect(countMustIssues(text)).toBe(3);
    });

    it('빈 문자열이면 0을 반환한다', () => {
      expect(countMustIssues('')).toBe(0);
    });

    it('null이면 0을 반환한다', () => {
      expect(countMustIssues(null)).toBe(0);
    });

    it('undefined이면 0을 반환한다', () => {
      expect(countMustIssues(undefined)).toBe(0);
    });

    it('숫자 타입이면 0을 반환한다', () => {
      expect(countMustIssues(123)).toBe(0);
    });
  });

  describe('parseReviewStatusFromBody', () => {
    it('[APPROVED] 태그가 있으면 APPROVED를 반환한다', () => {
      expect(parseReviewStatusFromBody('## [APPROVED] 리뷰 통과')).toBe('APPROVED');
    });

    it('[CHANGES_REQUESTED] 태그가 있으면 CHANGES_REQUESTED를 반환한다', () => {
      expect(parseReviewStatusFromBody('## [CHANGES_REQUESTED] 수정 필요')).toBe(
        'CHANGES_REQUESTED',
      );
    });

    it('[MUST] 태그만 있으면 CHANGES_REQUESTED를 반환한다', () => {
      expect(parseReviewStatusFromBody('1. [MUST] 이슈가 있습니다')).toBe('CHANGES_REQUESTED');
    });

    it('[APPROVED]와 [MUST]가 모두 있으면 APPROVED가 우선한다', () => {
      expect(parseReviewStatusFromBody('[APPROVED] 통과\n[MUST] 이건 무시')).toBe('APPROVED');
    });

    it('태그가 없으면 UNKNOWN을 반환한다', () => {
      expect(parseReviewStatusFromBody('일반 코멘트입니다')).toBe('UNKNOWN');
    });

    it('빈 본문이면 UNKNOWN을 반환한다', () => {
      expect(parseReviewStatusFromBody('')).toBe('UNKNOWN');
    });

    it('null이면 UNKNOWN을 반환한다', () => {
      expect(parseReviewStatusFromBody(null)).toBe('UNKNOWN');
    });

    it('undefined이면 UNKNOWN을 반환한다', () => {
      expect(parseReviewStatusFromBody(undefined)).toBe('UNKNOWN');
    });
  });

  describe('interpretClaudeExit', () => {
    it('code 0이면 success를 반환한다', () => {
      expect(interpretClaudeExit(0)).toBe('success');
    });

    it('code 124이면 timeout을 반환한다', () => {
      expect(interpretClaudeExit(124)).toBe('timeout');
    });

    it('code 137이면 killed를 반환한다', () => {
      expect(interpretClaudeExit(137)).toBe('killed');
    });

    it('code 1이면 error:1을 반환한다', () => {
      expect(interpretClaudeExit(1)).toBe('error:1');
    });

    it('code 42이면 error:42를 반환한다', () => {
      expect(interpretClaudeExit(42)).toBe('error:42');
    });

    it('문자열 "0"이면 success를 반환한다', () => {
      expect(interpretClaudeExit('0')).toBe('success');
    });

    it('문자열 "124"이면 timeout을 반환한다', () => {
      expect(interpretClaudeExit('124')).toBe('timeout');
    });

    it('NaN이면 error:NaN을 반환한다', () => {
      expect(interpretClaudeExit('abc')).toBe('error:NaN');
    });
  });
});
