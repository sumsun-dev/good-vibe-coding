import { describe, it, expect } from 'vitest';
import {
  SLA_DIMENSIONS,
  parseEvaluatorResponse,
  checkSlaStatus,
  calculateImprovement,
  buildRoundFeedback,
  buildRoundMetrics,
  buildSlaDashboard,
} from '../../internal/lib/sla-evaluator.js';

describe('sla-evaluator', () => {
  const fullScores = {
    architecture: 8.0,
    safety: 7.5,
    promptQuality: 6.0,
    reflection: 7.0,
    errorHandling: 8.5,
    testCoverage: 7.0,
    docConsistency: 6.5,
  };

  describe('SLA_DIMENSIONS', () => {
    it('7개 영역을 포함한다', () => {
      expect(SLA_DIMENSIONS).toHaveLength(7);
      expect(SLA_DIMENSIONS).toContain('architecture');
      expect(SLA_DIMENSIONS).toContain('safety');
      expect(SLA_DIMENSIONS).toContain('testCoverage');
    });
  });

  describe('parseEvaluatorResponse', () => {
    it('정상 JSON 문자열을 파싱한다', () => {
      const text = JSON.stringify({ scores: fullScores, summary: '테스트 요약' });
      const result = parseEvaluatorResponse(text);
      expect(result).not.toBeNull();
      expect(result.scores.architecture).toBe(8.0);
      expect(result.summary).toBe('테스트 요약');
    });

    it('```json 블록을 파싱한다', () => {
      const text = `분석 결과입니다:\n\`\`\`json\n${JSON.stringify({ scores: fullScores, summary: '블록 파싱' })}\n\`\`\`\n추가 설명`;
      const result = parseEvaluatorResponse(text);
      expect(result).not.toBeNull();
      expect(result.scores.safety).toBe(7.5);
    });

    it('텍스트 내 JSON 패턴을 찾는다', () => {
      const text = `평가 완료. 결과: {"scores": ${JSON.stringify(fullScores)}, "summary": "패턴 매칭"} 끝.`;
      const result = parseEvaluatorResponse(text);
      expect(result).not.toBeNull();
      expect(result.summary).toBe('패턴 매칭');
    });

    it('잘못된 형식이면 null을 반환한다', () => {
      expect(parseEvaluatorResponse('이것은 JSON이 아닙니다')).toBeNull();
    });

    it('null/빈 문자열이면 null을 반환한다', () => {
      expect(parseEvaluatorResponse(null)).toBeNull();
      expect(parseEvaluatorResponse('')).toBeNull();
    });

    it('scores 없는 JSON이면 null을 반환한다', () => {
      expect(parseEvaluatorResponse('{"summary": "점수 없음"}')).toBeNull();
    });

    it('범위 밖 점수 (>10)를 제외한다', () => {
      const scores = { ...fullScores, architecture: 15 };
      const text = JSON.stringify({ scores, summary: '' });
      const result = parseEvaluatorResponse(text);
      expect(result.scores.architecture).toBeUndefined();
      expect(result.scores.safety).toBe(7.5);
    });

    it('범위 밖 점수 (<0)를 제외한다', () => {
      const scores = { ...fullScores, safety: -1 };
      const text = JSON.stringify({ scores, summary: '' });
      const result = parseEvaluatorResponse(text);
      expect(result.scores.safety).toBeUndefined();
    });

    it('부분 점수만 있어도 파싱한다', () => {
      const text = JSON.stringify({ scores: { architecture: 8, safety: 7 }, summary: '' });
      const result = parseEvaluatorResponse(text);
      expect(Object.keys(result.scores)).toHaveLength(2);
    });

    it('summary가 없으면 빈 문자열을 반환한다', () => {
      const text = JSON.stringify({ scores: fullScores });
      const result = parseEvaluatorResponse(text);
      expect(result.summary).toBe('');
    });
  });

  describe('checkSlaStatus', () => {
    it('평균 >= target이면 met=true를 반환한다', () => {
      const highScores = Object.fromEntries(SLA_DIMENSIONS.map((d) => [d, 8.0]));
      const result = checkSlaStatus(highScores, 7.0);
      expect(result.met).toBe(true);
      expect(result.average).toBe(8.0);
    });

    it('평균 < target이면 met=false를 반환한다', () => {
      const lowScores = Object.fromEntries(SLA_DIMENSIONS.map((d) => [d, 5.0]));
      const result = checkSlaStatus(lowScores, 7.0);
      expect(result.met).toBe(false);
      expect(result.average).toBe(5.0);
    });

    it('belowTarget에 미달 영역을 포함한다', () => {
      const scores = { ...fullScores, promptQuality: 5.0, docConsistency: 4.0 };
      const result = checkSlaStatus(scores, 7.0);
      expect(result.belowTarget).toContain('promptQuality');
      expect(result.belowTarget).toContain('docConsistency');
    });

    it('aboveTarget에 달성 영역을 포함한다', () => {
      const result = checkSlaStatus(fullScores, 7.0);
      expect(result.aboveTarget).toContain('architecture');
      expect(result.aboveTarget).toContain('errorHandling');
    });

    it('빈 점수이면 met=false를 반환한다', () => {
      const result = checkSlaStatus({}, 7.0);
      expect(result.met).toBe(false);
      expect(result.average).toBe(0);
    });

    it('평균을 소수점 2자리로 반올림한다', () => {
      const scores = Object.fromEntries(SLA_DIMENSIONS.map((d) => [d, 7.333]));
      const result = checkSlaStatus(scores, 7.0);
      expect(result.average).toBe(7.33);
    });
  });

  describe('calculateImprovement', () => {
    it('이전 점수가 null이면 첫 라운드로 처리한다', () => {
      const result = calculateImprovement(null, fullScores, 0.3);
      expect(result.improvement).toBe(0);
      expect(result.stagnant).toBe(false);
      expect(result.dimensionDeltas).toEqual({});
    });

    it('개선폭을 올바르게 계산한다', () => {
      const prev = Object.fromEntries(SLA_DIMENSIONS.map((d) => [d, 6.0]));
      const current = Object.fromEntries(SLA_DIMENSIONS.map((d) => [d, 7.0]));
      const result = calculateImprovement(prev, current, 0.3);
      expect(result.improvement).toBe(1.0);
      expect(result.stagnant).toBe(false);
    });

    it('개선폭 < minImprovement이면 stagnant=true', () => {
      const prev = Object.fromEntries(SLA_DIMENSIONS.map((d) => [d, 7.0]));
      const current = Object.fromEntries(SLA_DIMENSIONS.map((d) => [d, 7.1]));
      const result = calculateImprovement(prev, current, 0.3);
      expect(result.stagnant).toBe(true);
    });

    it('dimensionDeltas를 올바르게 계산한다', () => {
      const prev = {
        architecture: 6.0,
        safety: 7.0,
        promptQuality: 5.0,
        reflection: 6.0,
        errorHandling: 7.0,
        testCoverage: 6.0,
        docConsistency: 5.0,
      };
      const current = {
        architecture: 8.0,
        safety: 7.0,
        promptQuality: 6.0,
        reflection: 6.0,
        errorHandling: 7.5,
        testCoverage: 7.0,
        docConsistency: 5.5,
      };
      const result = calculateImprovement(prev, current, 0.3);
      expect(result.dimensionDeltas.architecture).toBe(2.0);
      expect(result.dimensionDeltas.safety).toBe(0);
      expect(result.dimensionDeltas.promptQuality).toBe(1.0);
    });
  });

  describe('buildRoundFeedback', () => {
    it('미달 영역을 포함한 피드백을 생성한다', () => {
      const slaStatus = { belowTarget: ['promptQuality', 'docConsistency'], average: 6.5 };
      const scores = { promptQuality: 5.0, docConsistency: 4.0 };
      const feedback = buildRoundFeedback(slaStatus, scores);
      expect(feedback).toContain('promptQuality');
      expect(feedback).toContain('docConsistency');
      expect(feedback).toContain('5/10');
      expect(feedback).toContain('4/10');
    });

    it('달성 시 빈 문자열을 반환한다', () => {
      const slaStatus = { belowTarget: [], average: 8.0 };
      const feedback = buildRoundFeedback(slaStatus, fullScores);
      expect(feedback).toBe('');
    });

    it('평균 점수를 포함한다', () => {
      const slaStatus = { belowTarget: ['safety'], average: 6.2 };
      const feedback = buildRoundFeedback(slaStatus, { safety: 5.0 });
      expect(feedback).toContain('6.2/10');
    });
  });

  describe('buildRoundMetrics', () => {
    it('라운드 메트릭을 올바르게 구조화한다', () => {
      const slaStatus = { met: true, average: 7.5, belowTarget: [] };
      const metrics = buildRoundMetrics({
        round: 1,
        scores: fullScores,
        slaStatus,
        issueCount: 3,
        commitCount: 5,
      });
      expect(metrics.round).toBe(1);
      expect(metrics.average).toBe(7.5);
      expect(metrics.met).toBe(true);
      expect(metrics.issueCount).toBe(3);
      expect(metrics.timestamp).toBeDefined();
    });

    it('improvement가 null이어도 동작한다', () => {
      const slaStatus = { met: false, average: 5.0, belowTarget: ['safety'] };
      const metrics = buildRoundMetrics({ round: 1, scores: fullScores, slaStatus });
      expect(metrics.improvement).toBeNull();
      expect(metrics.stagnant).toBe(false);
    });
  });

  describe('buildSlaDashboard', () => {
    it('라운드별 점수 테이블을 생성한다', () => {
      const metrics = [
        { round: 1, scores: fullScores, average: 7.21, met: true, stagnant: false },
        { round: 2, scores: fullScores, average: 7.5, met: true, stagnant: false },
      ];
      const dashboard = buildSlaDashboard(metrics);
      expect(dashboard).toContain('SLA 대시보드');
      expect(dashboard).toContain('Round');
      expect(dashboard).toContain('Architecture');
      expect(dashboard).toContain('O');
    });

    it('빈 메트릭이면 기본 메시지를 반환한다', () => {
      expect(buildSlaDashboard([])).toContain('평가 데이터 없음');
      expect(buildSlaDashboard(null)).toContain('평가 데이터 없음');
    });

    it('최종 SLA 요약을 포함한다', () => {
      const metrics = [{ round: 1, scores: fullScores, average: 6.5, met: false, stagnant: true }];
      const dashboard = buildSlaDashboard(metrics);
      expect(dashboard).toContain('최종 SLA');
      expect(dashboard).toContain('미달');
      expect(dashboard).toContain('개선 정체');
    });

    it('총 라운드 수를 표시한다', () => {
      const metrics = [
        { round: 1, scores: fullScores, average: 6.0, met: false, stagnant: false },
        { round: 2, scores: fullScores, average: 7.0, met: true, stagnant: false },
      ];
      const dashboard = buildSlaDashboard(metrics);
      expect(dashboard).toContain('총 라운드**: 2');
    });
  });
});
