import { describe, it, expect } from 'vitest';
import { config } from '../scripts/lib/core/config.js';

describe('config', () => {
  it('Object.freeze로 불변이다', () => {
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.discussion)).toBe(true);
    expect(Object.isFrozen(config.messaging)).toBe(true);
    expect(Object.isFrozen(config.convergence)).toBe(true);
    expect(Object.isFrozen(config.similarity)).toBe(true);
    expect(Object.isFrozen(config.execution)).toBe(true);
    expect(Object.isFrozen(config.build)).toBe(true);
    expect(Object.isFrozen(config.llm)).toBe(true);
    expect(Object.isFrozen(config.review)).toBe(true);
    expect(Object.isFrozen(config.team)).toBe(true);
    expect(Object.isFrozen(config.team.simple)).toBe(true);
    expect(Object.isFrozen(config.recommendation)).toBe(true);
    expect(Object.isFrozen(config.recommendation.weights)).toBe(true);
    expect(Object.isFrozen(config.pr)).toBe(true);
    expect(Object.isFrozen(config.commit)).toBe(true);
    expect(Object.isFrozen(config.http)).toBe(true);
    expect(Object.isFrozen(config.http.retryableCodes)).toBe(true);
    expect(Object.isFrozen(config.ciVersions)).toBe(true);
    expect(Object.isFrozen(config.ciVersions.python)).toBe(true);
    expect(Object.isFrozen(config.ciVersions.node)).toBe(true);
  });

  it('모든 설정값에 접근할 수 있다', () => {
    expect(config.discussion.parallelTiers).toBe(true);
    expect(config.messaging.enabled).toBe(false);
    expect(config.messaging.maxMessages).toBe(100);
    expect(config.messaging.ttl).toBe(86400);
    expect(config.messaging.maxThreadDepth).toBe(5);
    expect(config.convergence.threshold).toBe(0.8);
    expect(config.convergence.maxRounds).toBe(3);
    expect(config.similarity.redundancyThreshold).toBe(0.7);
    expect(config.similarity.contributionThreshold).toBe(0.5);
    expect(config.execution.maxFixAttempts).toBe(2);
    expect(config.execution.maxOutputLines).toBe(200);
    expect(config.build.defaultTimeout).toBe(30_000);
    expect(config.llm.defaultTimeout).toBe(60_000);
    expect(config.llm.defaultMaxTokens).toBe(4096);
    expect(config.llm.pingTimeout).toBe(15_000);
    expect(config.llm.pingMaxTokens).toBe(16);
    expect(config.review.minReviewers).toBe(2);
    expect(config.review.maxReviewers).toBe(3);
    expect(config.review.maxRevisionRounds).toBe(2);
    expect(config.team.simple).toEqual({ min: 2, max: 3 });
    expect(config.team.medium).toEqual({ min: 3, max: 5 });
    expect(config.team.complex).toEqual({ min: 5, max: 8 });
    expect(config.recommendation.minScore).toBe(3);
    expect(config.recommendation.maxPerCategory).toBe(5);
    expect(config.recommendation.maxKeywordHits).toBe(3);
    expect(config.recommendation.weights).toEqual({
      projectType: 3,
      complexity: 2,
      keyword: 1,
      roleAffinity: 2,
    });
    expect(config.pr.maxTitleLength).toBe(70);
    expect(config.commit.maxSubjectLength).toBe(72);
    expect(config.http.retryableCodes).toEqual([429, 500, 502, 503, 504]);
    expect(config.http.errorTruncateLength).toBe(200);
    expect(config.http.maxRetryDelay).toBe(8000);
    expect(config.http.retryJitter).toBe(200);
    expect(config.ciVersions.python).toEqual(['3.10', '3.11', '3.12']);
    expect(config.ciVersions.node).toEqual(['18', '20', '22']);
    expect(config.ciVersions.go).toBe('1.21');
    expect(config.ciVersions.java).toBe('17');
    expect(config.codebase.maxDepth).toBe(10);
  });

  it('값을 변경할 수 없다', () => {
    expect(() => {
      config.convergence.threshold = 0.5;
    }).toThrow();
    expect(() => {
      config.team.simple.min = 10;
    }).toThrow();
    expect(config.convergence.threshold).toBe(0.8);
  });
});
