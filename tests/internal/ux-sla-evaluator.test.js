import { describe, it, expect } from 'vitest';
import {
  UX_SLA_DIMENSIONS,
  parseUxEvaluatorResponse,
  checkUxSlaStatus,
  calculateUxImprovement,
  buildUxRoundFeedback,
  buildUxSlaDashboard,
} from '../../internal/lib/ux-sla-evaluator.js';

describe('ux-sla-evaluator', () => {
  describe('UX_SLA_DIMENSIONS', () => {
    it('5가지 UX 영역이 정의되어 있어야 한다', () => {
      expect(UX_SLA_DIMENSIONS).toHaveLength(5);
      expect(UX_SLA_DIMENSIONS).toEqual([
        'flowClarity',
        'errorQuality',
        'guideCompleteness',
        'onboardingFriction',
        'sdkUsability',
      ]);
    });
  });

  describe('parseUxEvaluatorResponse', () => {
    it('직접 JSON 파싱 (Tier 1)', () => {
      const json = JSON.stringify({
        scores: {
          flowClarity: 7.5,
          errorQuality: 8.0,
          guideCompleteness: 6.5,
          onboardingFriction: 7.0,
          sdkUsability: 6.0,
        },
        summary: '전반적으로 양호',
      });
      const result = parseUxEvaluatorResponse(json);
      expect(result).not.toBeNull();
      expect(result.scores.flowClarity).toBe(7.5);
      expect(result.summary).toBe('전반적으로 양호');
    });

    it('코드 블록에서 JSON 추출 (Tier 2)', () => {
      const text = `분석 결과입니다.

\`\`\`json
{
  "scores": {
    "flowClarity": 7.0,
    "errorQuality": 6.5,
    "guideCompleteness": 8.0,
    "onboardingFriction": 7.5,
    "sdkUsability": 7.0
  },
  "summary": "테스트"
}
\`\`\`

이상입니다.`;
      const result = parseUxEvaluatorResponse(text);
      expect(result).not.toBeNull();
      expect(result.scores.guideCompleteness).toBe(8.0);
    });

    it('{"scores": 패턴 매칭 (Tier 3)', () => {
      const text =
        '평가 결과: {"scores": {"flowClarity": 5.0, "errorQuality": 6.0, "guideCompleteness": 7.0, "onboardingFriction": 8.0, "sdkUsability": 6.5}, "summary": "OK"} 끝';
      const result = parseUxEvaluatorResponse(text);
      expect(result).not.toBeNull();
      expect(result.scores.onboardingFriction).toBe(8.0);
    });

    it('빈 입력은 null 반환', () => {
      expect(parseUxEvaluatorResponse('')).toBeNull();
      expect(parseUxEvaluatorResponse(null)).toBeNull();
      expect(parseUxEvaluatorResponse(undefined)).toBeNull();
    });

    it('0-10 범위 외 점수는 제외', () => {
      const json = JSON.stringify({
        scores: {
          flowClarity: 11,
          errorQuality: -1,
          guideCompleteness: 7.0,
          onboardingFriction: 8.0,
          sdkUsability: 6.0,
        },
      });
      const result = parseUxEvaluatorResponse(json);
      expect(result).not.toBeNull();
      expect(result.scores.flowClarity).toBeUndefined();
      expect(result.scores.errorQuality).toBeUndefined();
      expect(result.scores.guideCompleteness).toBe(7.0);
    });
  });

  describe('checkUxSlaStatus', () => {
    it('평균이 목표 이상이면 met=true', () => {
      const scores = {
        flowClarity: 8.0,
        errorQuality: 7.5,
        guideCompleteness: 7.0,
        onboardingFriction: 7.5,
        sdkUsability: 8.0,
      };
      const result = checkUxSlaStatus(scores, 7.0);
      expect(result.met).toBe(true);
      expect(result.average).toBeCloseTo(7.6, 1);
    });

    it('평균이 목표 미만이면 met=false', () => {
      const scores = {
        flowClarity: 5.0,
        errorQuality: 6.0,
        guideCompleteness: 5.5,
        onboardingFriction: 6.0,
        sdkUsability: 5.0,
      };
      const result = checkUxSlaStatus(scores, 7.0);
      expect(result.met).toBe(false);
      expect(result.belowTarget.length).toBeGreaterThan(0);
    });

    it('빈 점수는 met=false, average=0', () => {
      const result = checkUxSlaStatus({}, 7.0);
      expect(result.met).toBe(false);
      expect(result.average).toBe(0);
    });

    it('belowTarget과 aboveTarget을 올바르게 분류', () => {
      const scores = {
        flowClarity: 8.0,
        errorQuality: 5.0,
        guideCompleteness: 7.5,
        onboardingFriction: 6.0,
        sdkUsability: 7.0,
      };
      const result = checkUxSlaStatus(scores, 7.0);
      expect(result.belowTarget).toContain('errorQuality');
      expect(result.belowTarget).toContain('onboardingFriction');
      expect(result.aboveTarget).toContain('flowClarity');
    });
  });

  describe('calculateUxImprovement', () => {
    it('이전 점수가 없으면 stagnant=false', () => {
      const current = { flowClarity: 7.0, errorQuality: 6.0 };
      const result = calculateUxImprovement(null, current, 0.3);
      expect(result.stagnant).toBe(false);
      expect(result.improvement).toBe(0);
    });

    it('개선폭 계산', () => {
      const prev = {
        flowClarity: 6.0,
        errorQuality: 5.0,
        guideCompleteness: 6.0,
        onboardingFriction: 5.5,
        sdkUsability: 5.5,
      };
      const current = {
        flowClarity: 7.0,
        errorQuality: 6.0,
        guideCompleteness: 7.0,
        onboardingFriction: 6.5,
        sdkUsability: 6.5,
      };
      const result = calculateUxImprovement(prev, current, 0.3);
      expect(result.improvement).toBe(1);
      expect(result.stagnant).toBe(false);
    });

    it('개선폭이 최소 미만이면 stagnant=true', () => {
      const prev = { flowClarity: 7.0, errorQuality: 6.0 };
      const current = { flowClarity: 7.1, errorQuality: 6.1 };
      const result = calculateUxImprovement(prev, current, 0.3);
      expect(result.stagnant).toBe(true);
    });

    it('dimensionDeltas 계산', () => {
      const prev = { flowClarity: 6.0, errorQuality: 5.0 };
      const current = { flowClarity: 7.5, errorQuality: 5.5 };
      const result = calculateUxImprovement(prev, current, 0.3);
      expect(result.dimensionDeltas.flowClarity).toBe(1.5);
      expect(result.dimensionDeltas.errorQuality).toBe(0.5);
    });
  });

  describe('buildUxRoundFeedback', () => {
    it('미달 영역이 없으면 빈 문자열', () => {
      const result = buildUxRoundFeedback({ belowTarget: [], average: 8.0 }, {});
      expect(result).toBe('');
    });

    it('미달 영역에 대해 피드백 생성', () => {
      const slaStatus = {
        belowTarget: ['errorQuality', 'sdkUsability'],
        average: 6.2,
      };
      const scores = { errorQuality: 5.5, sdkUsability: 6.0 };
      const result = buildUxRoundFeedback(slaStatus, scores);
      expect(result).toContain('에러 메시지 품질');
      expect(result).toContain('SDK 사용성');
      expect(result).toContain('6.2/10');
    });
  });

  describe('buildUxSlaDashboard', () => {
    it('빈 메트릭은 기본 메시지 반환', () => {
      const result = buildUxSlaDashboard([]);
      expect(result).toContain('평가 데이터 없음');
    });

    it('라운드 메트릭으로 대시보드 생성', () => {
      const metrics = [
        {
          round: 1,
          scores: {
            flowClarity: 7.0,
            errorQuality: 6.5,
            guideCompleteness: 7.5,
            onboardingFriction: 6.0,
            sdkUsability: 7.0,
          },
          average: 6.8,
          met: false,
          stagnant: false,
        },
        {
          round: 2,
          scores: {
            flowClarity: 7.5,
            errorQuality: 7.0,
            guideCompleteness: 8.0,
            onboardingFriction: 7.0,
            sdkUsability: 7.5,
          },
          average: 7.4,
          met: true,
          stagnant: false,
        },
      ];
      const result = buildUxSlaDashboard(metrics);
      expect(result).toContain('UX SLA 대시보드');
      expect(result).toContain('7.4');
      expect(result).toContain('달성');
      expect(result).toContain('총 라운드');
    });
  });
});
