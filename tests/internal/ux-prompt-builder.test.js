import { describe, it, expect } from 'vitest';
import {
  buildUxImproverPrompt,
  buildUxReviewerPrompt,
  buildUxFixerPrompt,
  buildUxEvaluatorPrompt,
  buildUxRoundImproverPrompt,
} from '../../internal/lib/ux-prompt-builder.js';

describe('ux-prompt-builder', () => {
  describe('buildUxImproverPrompt', () => {
    it('관점 정보가 포함되어야 한다', () => {
      const prompt = buildUxImproverPrompt({
        perspective: { id: 'first-time-user', name: '첫 사용자', files: ['commands/hello.md'] },
        historySummary: '',
        existingIssues: '[]',
        runDir: '/tmp/run',
      });
      expect(prompt).toContain('첫 사용자');
      expect(prompt).toContain('first-time-user');
      expect(prompt).toContain('commands/hello.md');
    });

    it('히스토리 요약이 포함되어야 한다', () => {
      const prompt = buildUxImproverPrompt({
        perspective: { id: 'command-flow', name: '커맨드 플로우', files: [] },
        historySummary: '최근 3건 발견',
        existingIssues: '[]',
        runDir: '/tmp/run',
      });
      expect(prompt).toContain('최근 3건 발견');
    });

    it('안전 수정 범위가 명시되어야 한다', () => {
      const prompt = buildUxImproverPrompt({
        perspective: { id: 'error-recovery', name: '에러 복구', files: [] },
        historySummary: '',
        existingIssues: '[]',
        runDir: '/tmp/run',
      });
      expect(prompt).toContain('ux-improvement');
    });

    it('UX 분석 영역이 포함되어야 한다', () => {
      const prompt = buildUxImproverPrompt({
        perspective: { id: 'sdk-dx', name: 'SDK DX', files: [] },
        historySummary: '',
        existingIssues: '[]',
        runDir: '/tmp/run',
      });
      expect(prompt).toContain('커맨드 플로우');
      expect(prompt).toContain('에러 메시지');
    });
  });

  describe('buildUxReviewerPrompt', () => {
    it('PR 번호가 포함되어야 한다', () => {
      const prompt = buildUxReviewerPrompt({ prNumber: 42 });
      expect(prompt).toContain('42');
      expect(prompt).toContain('리뷰');
    });

    it('잘못된 PR 번호는 에러를 throw해야 한다', () => {
      expect(() => buildUxReviewerPrompt({ prNumber: 'abc' })).toThrow();
      expect(() => buildUxReviewerPrompt({ prNumber: -1 })).toThrow();
    });

    it('UX 관점 리뷰 기준이 포함되어야 한다', () => {
      const prompt = buildUxReviewerPrompt({ prNumber: 10 });
      expect(prompt).toContain('MUST');
      expect(prompt).toContain('SHOULD');
    });
  });

  describe('buildUxFixerPrompt', () => {
    it('PR 번호와 사이클 정보가 포함되어야 한다', () => {
      const prompt = buildUxFixerPrompt({
        prNumber: 42,
        cycle: 2,
        maxCycles: 3,
        reviewBody: '[MUST] 에러 메시지 개선',
      });
      expect(prompt).toContain('42');
      expect(prompt).toContain('2/3');
      expect(prompt).toContain('[MUST] 에러 메시지 개선');
    });
  });

  describe('buildUxEvaluatorPrompt', () => {
    it('UX 5영역이 포함되어야 한다', () => {
      const prompt = buildUxEvaluatorPrompt({ round: 1, runDir: '/tmp/run' });
      expect(prompt).toContain('flowClarity');
      expect(prompt).toContain('errorQuality');
      expect(prompt).toContain('guideCompleteness');
      expect(prompt).toContain('onboardingFriction');
      expect(prompt).toContain('sdkUsability');
    });

    it('관점 정보가 포함되어야 한다', () => {
      const prompt = buildUxEvaluatorPrompt({
        round: 1,
        runDir: '/tmp/run',
        perspective: { id: 'first-time-user', name: '첫 사용자' },
      });
      expect(prompt).toContain('첫 사용자');
    });

    it('이전 피드백이 있으면 포함되어야 한다', () => {
      const prompt = buildUxEvaluatorPrompt({
        round: 2,
        runDir: '/tmp/run',
        previousFeedback: '개선 필요',
      });
      expect(prompt).toContain('개선 필요');
    });

    it('JSON 출력 형식이 명시되어야 한다', () => {
      const prompt = buildUxEvaluatorPrompt({ round: 1, runDir: '/tmp/run' });
      expect(prompt).toContain('json');
      expect(prompt).toContain('scores');
    });
  });

  describe('buildUxRoundImproverPrompt', () => {
    it('라운드 번호와 이전 피드백이 포함되어야 한다', () => {
      const prompt = buildUxRoundImproverPrompt({
        round: 2,
        evalFeedback: 'flowClarity 개선 필요',
        perspective: { id: 'command-flow', name: '커맨드 플로우', files: [] },
        runDir: '/tmp/run',
      });
      expect(prompt).toContain('Round 2');
      expect(prompt).toContain('flowClarity 개선 필요');
    });

    it('이전 점수가 있으면 포함되어야 한다', () => {
      const prompt = buildUxRoundImproverPrompt({
        round: 2,
        evalFeedback: '',
        previousScores: { flowClarity: 6.5, errorQuality: 5.5 },
        perspective: { id: 'command-flow', name: '커맨드 플로우', files: [] },
        runDir: '/tmp/run',
      });
      expect(prompt).toContain('6.5');
    });
  });
});
