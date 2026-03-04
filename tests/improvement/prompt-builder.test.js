import { describe, it, expect } from 'vitest';
import {
  buildImproverPrompt,
  buildReviewerPrompt,
  buildFixerPrompt,
  buildReReviewerPrompt,
  buildEvaluatorPrompt,
  buildRoundImproverPrompt,
} from '../../internal/lib/prompt-builder.js';

describe('prompt-builder', () => {
  describe('buildImproverPrompt', () => {
    it('CLAUDE.md 참조를 포함한다', () => {
      const prompt = buildImproverPrompt({ runDir: '/tmp/test' });
      expect(prompt).toContain('CLAUDE.md');
    });

    it('히스토리 요약을 주입한다', () => {
      const prompt = buildImproverPrompt({
        historySummary: '최근 3건 발견',
        runDir: '/tmp/test',
      });
      expect(prompt).toContain('최근 3건 발견');
    });

    it('기존 이슈를 주입한다', () => {
      const prompt = buildImproverPrompt({
        existingIssues: '[{"title":"이슈1"}]',
        runDir: '/tmp/test',
      });
      expect(prompt).toContain('[{"title":"이슈1"}]');
    });

    it('runDir 경로를 포함한다', () => {
      const prompt = buildImproverPrompt({ runDir: '/tmp/my-run-dir' });
      expect(prompt).toContain('/tmp/my-run-dir/eslint-report.json');
      expect(prompt).toContain('/tmp/my-run-dir/test-report.json');
    });

    it('분석 범위 3가지를 포함한다', () => {
      const prompt = buildImproverPrompt({ runDir: '/tmp/test' });
      expect(prompt).toContain('코드 품질');
      expect(prompt).toContain('보안');
      expect(prompt).toContain('성능');
    });

    it('종료 판단 기준을 포함한다', () => {
      const prompt = buildImproverPrompt({ runDir: '/tmp/test' });
      expect(prompt).toContain('종료 판단');
    });

    it('기본값으로 동작한다', () => {
      const prompt = buildImproverPrompt({});
      expect(prompt).toContain('CLAUDE.md');
      expect(prompt).toContain('[]'); // default existingIssues
    });
  });

  describe('buildReviewerPrompt', () => {
    it('PR 번호를 포함한다', () => {
      const prompt = buildReviewerPrompt({ prNumber: 123 });
      expect(prompt).toContain('PR #123');
    });

    it('MUST/SHOULD 기준을 포함한다', () => {
      const prompt = buildReviewerPrompt({ prNumber: 1 });
      expect(prompt).toContain('MUST');
      expect(prompt).toContain('SHOULD');
    });

    it('gh pr diff 명령을 포함한다', () => {
      const prompt = buildReviewerPrompt({ prNumber: 42 });
      expect(prompt).toContain('gh pr diff 42');
    });

    it('gh pr review 명령을 포함한다', () => {
      const prompt = buildReviewerPrompt({ prNumber: 42 });
      expect(prompt).toContain('gh pr review 42');
    });

    it('[APPROVED] 태그를 포함한다', () => {
      const prompt = buildReviewerPrompt({ prNumber: 1 });
      expect(prompt).toContain('[APPROVED]');
    });

    it('[CHANGES_REQUESTED] 태그를 포함한다', () => {
      const prompt = buildReviewerPrompt({ prNumber: 1 });
      expect(prompt).toContain('[CHANGES_REQUESTED]');
    });

    it('유효하지 않은 PR 번호면 에러를 throw한다', () => {
      expect(() => buildReviewerPrompt({ prNumber: 'abc' })).toThrow(/유효하지 않은 PR 번호/);
      expect(() => buildReviewerPrompt({ prNumber: -1 })).toThrow(/유효하지 않은 PR 번호/);
      expect(() => buildReviewerPrompt({ prNumber: 0 })).toThrow(/유효하지 않은 PR 번호/);
    });
  });

  describe('buildFixerPrompt', () => {
    it('cycle/maxCycles를 포함한다', () => {
      const prompt = buildFixerPrompt({
        prNumber: 10,
        cycle: 2,
        maxCycles: 5,
        reviewBody: '리뷰 내용',
      });
      expect(prompt).toContain('2/5');
    });

    it('reviewBody를 주입한다', () => {
      const prompt = buildFixerPrompt({
        prNumber: 10,
        cycle: 1,
        maxCycles: 3,
        reviewBody: '[MUST] 보안 취약점 수정 필요',
      });
      expect(prompt).toContain('[MUST] 보안 취약점 수정 필요');
    });

    it('PR 번호를 포함한다', () => {
      const prompt = buildFixerPrompt({ prNumber: 99, cycle: 1, maxCycles: 5 });
      expect(prompt).toContain('PR #99');
    });

    it('[MUST] 태그만 수정하라는 지침을 포함한다', () => {
      const prompt = buildFixerPrompt({ prNumber: 1, cycle: 1, maxCycles: 3 });
      expect(prompt).toContain('[MUST] 태그가 붙은 이슈만 수정');
    });

    it('conventional commit 지침을 포함한다', () => {
      const prompt = buildFixerPrompt({ prNumber: 1, cycle: 2, maxCycles: 3 });
      expect(prompt).toContain('fix(review)');
    });
  });

  describe('buildReReviewerPrompt', () => {
    it('previousMust를 주입한다', () => {
      const prompt = buildReReviewerPrompt({
        prNumber: 10,
        cycle: 1,
        maxCycles: 5,
        previousMust: '1. [MUST] 보안 이슈',
      });
      expect(prompt).toContain('1. [MUST] 보안 이슈');
    });

    it('cycle/maxCycles를 포함한다', () => {
      const prompt = buildReReviewerPrompt({
        prNumber: 10,
        cycle: 3,
        maxCycles: 5,
      });
      expect(prompt).toContain('3/5');
    });

    it('PR 번호를 포함한다', () => {
      const prompt = buildReReviewerPrompt({ prNumber: 77, cycle: 1, maxCycles: 3 });
      expect(prompt).toContain('PR #77');
    });

    it('재리뷰 절차를 포함한다', () => {
      const prompt = buildReReviewerPrompt({ prNumber: 1, cycle: 1, maxCycles: 3 });
      expect(prompt).toContain('재리뷰 절차');
    });

    it('[APPROVED] 결과 실행 지침을 포함한다', () => {
      const prompt = buildReReviewerPrompt({ prNumber: 42, cycle: 1, maxCycles: 3 });
      expect(prompt).toContain('gh pr review 42');
      expect(prompt).toContain('[APPROVED]');
    });
  });

  describe('buildEvaluatorPrompt', () => {
    it('라운드 번호를 포함한다', () => {
      const prompt = buildEvaluatorPrompt({ round: 3, runDir: '/tmp/test' });
      expect(prompt).toContain('Round 3');
    });

    it('7가지 평가 영역을 포함한다', () => {
      const prompt = buildEvaluatorPrompt({ round: 1, runDir: '/tmp/test' });
      expect(prompt).toContain('architecture');
      expect(prompt).toContain('safety');
      expect(prompt).toContain('promptQuality');
      expect(prompt).toContain('reflection');
      expect(prompt).toContain('errorHandling');
      expect(prompt).toContain('testCoverage');
      expect(prompt).toContain('docConsistency');
    });

    it('JSON 출력 형식을 강제한다', () => {
      const prompt = buildEvaluatorPrompt({ round: 1 });
      expect(prompt).toContain('"scores"');
      expect(prompt).toContain('JSON');
    });

    it('코드 수정 금지를 명시한다', () => {
      const prompt = buildEvaluatorPrompt({ round: 1 });
      expect(prompt).toContain('수정하지 마세요');
    });

    it('이전 피드백이 있으면 주입한다', () => {
      const prompt = buildEvaluatorPrompt({
        round: 2,
        previousFeedback: 'safety 영역 개선 필요',
      });
      expect(prompt).toContain('safety 영역 개선 필요');
      expect(prompt).toContain('이전 라운드 피드백');
    });

    it('이전 피드백이 없으면 피드백 섹션을 생략한다', () => {
      const prompt = buildEvaluatorPrompt({ round: 1 });
      expect(prompt).not.toContain('이전 라운드 피드백');
    });

    it('runDir 경로를 포함한다', () => {
      const prompt = buildEvaluatorPrompt({ round: 1, runDir: '/tmp/my-dir' });
      expect(prompt).toContain('/tmp/my-dir/eslint-report.json');
    });
  });

  describe('buildRoundImproverPrompt', () => {
    it('기본 Improver 프롬프트를 포함한다', () => {
      const prompt = buildRoundImproverPrompt({ round: 2, runDir: '/tmp/test' });
      expect(prompt).toContain('CLAUDE.md');
      expect(prompt).toContain('분석 범위');
    });

    it('라운드 번호를 포함한다', () => {
      const prompt = buildRoundImproverPrompt({ round: 3 });
      expect(prompt).toContain('Round 3');
    });

    it('SLA 피드백을 주입한다', () => {
      const prompt = buildRoundImproverPrompt({
        round: 2,
        evalFeedback: 'testCoverage 영역 개선 필요',
      });
      expect(prompt).toContain('testCoverage 영역 개선 필요');
    });

    it('이전 점수를 주입한다', () => {
      const prompt = buildRoundImproverPrompt({
        round: 2,
        previousScores: { architecture: 7.5, safety: 8.0 },
      });
      expect(prompt).toContain('이전 라운드 점수');
      expect(prompt).toContain('7.5');
    });

    it('미해결 이슈를 주입한다', () => {
      const prompt = buildRoundImproverPrompt({
        round: 2,
        unresolvedIssues: '#10 보안 취약점\n#11 성능 이슈',
      });
      expect(prompt).toContain('미해결 이슈');
      expect(prompt).toContain('#10 보안 취약점');
    });

    it('이전 수정 유지 지침을 포함한다', () => {
      const prompt = buildRoundImproverPrompt({ round: 2 });
      expect(prompt).toContain('이전 수정을 유지');
    });
  });
});
