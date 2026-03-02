import { describe, it, expect } from 'vitest';
import {
  measureOutputSimilarity,
  detectRedundantAgents,
  trackRoleContribution,
  recommendOptimalTeam,
  buildOptimizationReport,
} from '../scripts/lib/agent/agent-optimizer.js';

// --- measureOutputSimilarity ---

describe('measureOutputSimilarity', () => {
  it('동일한 텍스트는 1.0을 반환한다', () => {
    const text = '이 프로젝트는 Node.js와 Express를 사용합니다';
    expect(measureOutputSimilarity(text, text)).toBe(1.0);
  });

  it('완전히 다른 텍스트는 0에 가까운 값을 반환한다', () => {
    const a = 'aaaaaaaaaa';
    const b = 'zzzzzzzzzz';
    const similarity = measureOutputSimilarity(a, b);
    expect(similarity).toBeLessThan(0.1);
  });

  it('부분적으로 겹치는 텍스트는 중간 값을 반환한다', () => {
    const a = 'Node.js를 사용한 백엔드 개발';
    const b = 'Node.js를 사용한 프론트엔드 개발';
    const similarity = measureOutputSimilarity(a, b);
    expect(similarity).toBeGreaterThan(0.3);
    expect(similarity).toBeLessThan(1.0);
  });

  it('빈 문자열 두 개는 1.0을 반환한다', () => {
    expect(measureOutputSimilarity('', '')).toBe(1.0);
  });

  it('한쪽만 빈 문자열이면 0을 반환한다', () => {
    expect(measureOutputSimilarity('hello world', '')).toBe(0);
    expect(measureOutputSimilarity('', 'hello world')).toBe(0);
  });

  it('null/undefined 입력을 처리한다', () => {
    expect(measureOutputSimilarity(null, null)).toBe(1.0);
    expect(measureOutputSimilarity(undefined, 'text')).toBe(0);
    expect(measureOutputSimilarity('text', null)).toBe(0);
  });

  it('대소문자를 무시한다', () => {
    const a = 'Hello World Test';
    const b = 'hello world test';
    expect(measureOutputSimilarity(a, b)).toBe(1.0);
  });

  it('0과 1 사이의 값을 반환한다', () => {
    const a = '프로젝트 아키텍처 설계 방안';
    const b = '프로젝트 테스트 전략 수립';
    const similarity = measureOutputSimilarity(a, b);
    expect(similarity).toBeGreaterThanOrEqual(0);
    expect(similarity).toBeLessThanOrEqual(1);
  });
});

// --- detectRedundantAgents ---

describe('detectRedundantAgents', () => {
  it('유사도가 임계값을 초과하는 쌍을 탐지한다', () => {
    const outputs = [
      { roleId: 'frontend', output: 'React와 TypeScript를 사용하여 프론트엔드를 구현합니다' },
      { roleId: 'fullstack', output: 'React와 TypeScript를 사용하여 프론트엔드를 구현합니다' },
    ];
    const result = detectRedundantAgents(outputs);
    expect(result.length).toBe(1);
    expect(result[0].roleId).toBe('fullstack');
    expect(result[0].similarTo).toBe('frontend');
    expect(result[0].similarity).toBeGreaterThan(0.7);
  });

  it('유사도가 낮은 출력은 중복으로 탐지하지 않는다', () => {
    const outputs = [
      { roleId: 'cto', output: 'aaaaaaaaaaaaaaaaaaaaaa' },
      { roleId: 'qa', output: 'zzzzzzzzzzzzzzzzzzzzzz' },
    ];
    const result = detectRedundantAgents(outputs);
    expect(result.length).toBe(0);
  });

  it('빈 배열을 처리한다', () => {
    expect(detectRedundantAgents([])).toEqual([]);
  });

  it('null/undefined를 처리한다', () => {
    expect(detectRedundantAgents(null)).toEqual([]);
    expect(detectRedundantAgents(undefined)).toEqual([]);
  });

  it('에이전트가 1명이면 빈 배열을 반환한다', () => {
    const outputs = [{ roleId: 'cto', output: 'some output' }];
    expect(detectRedundantAgents(outputs)).toEqual([]);
  });

  it('여러 중복 쌍을 탐지한다', () => {
    const sharedOutput = 'Node.js Express API 서버를 구축하고 MongoDB를 사용합니다';
    const outputs = [
      { roleId: 'backend', output: sharedOutput },
      { roleId: 'fullstack', output: sharedOutput },
      { roleId: 'cto', output: sharedOutput },
    ];
    const result = detectRedundantAgents(outputs);
    // backend-fullstack, backend-cto, fullstack-cto 쌍 모두 탐지
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('커스텀 임계값을 사용할 수 있다', () => {
    const a = 'Node.js를 사용한 백엔드 개발 프로젝트입니다';
    const b = 'Node.js를 사용한 프론트엔드 개발 프로젝트입니다';
    const outputs = [
      { roleId: 'backend', output: a },
      { roleId: 'frontend', output: b },
    ];
    // 매우 낮은 임계값으로 설정하면 중복으로 탐지될 수 있다
    const resultLow = detectRedundantAgents(outputs, 0.1);
    const resultHigh = detectRedundantAgents(outputs, 0.99);
    expect(resultLow.length).toBeGreaterThanOrEqual(resultHigh.length);
  });

  it('모든 출력이 동일하면 모두 중복으로 탐지한다', () => {
    const outputs = [
      { roleId: 'a', output: 'identical output text here for testing' },
      { roleId: 'b', output: 'identical output text here for testing' },
      { roleId: 'c', output: 'identical output text here for testing' },
    ];
    const result = detectRedundantAgents(outputs);
    // b는 a와 중복, c는 a와 중복 + b와 중복 => 최소 2개
    expect(result.length).toBeGreaterThanOrEqual(2);
  });
});

// --- trackRoleContribution ---

describe('trackRoleContribution', () => {
  it('이슈를 정확히 카운트한다', () => {
    const reviews = [
      { approved: false, issues: [{ severity: 'critical', description: 'SQL 인젝션' }] },
      { approved: false, issues: [{ severity: 'minor', description: '코드 스타일' }, { severity: 'important', description: '에러 처리' }] },
    ];
    const result = trackRoleContribution('qa', reviews);
    expect(result.roleId).toBe('qa');
    expect(result.uniqueIssues).toBe(3);
    expect(result.criticalsCaught).toBe(1);
    expect(result.emptyReviews).toBe(0);
  });

  it('승인만 하는 리뷰를 카운트한다', () => {
    const reviews = [
      { approved: true, issues: [] },
      { approved: true, issues: [] },
      { approved: false, issues: [{ severity: 'minor', description: '사소한 문제' }] },
    ];
    const result = trackRoleContribution('frontend', reviews);
    expect(result.emptyReviews).toBe(2);
    expect(result.uniqueIssues).toBe(1);
  });

  it('빈 리뷰 배열을 처리한다', () => {
    const result = trackRoleContribution('backend', []);
    expect(result.roleId).toBe('backend');
    expect(result.uniqueIssues).toBe(0);
    expect(result.emptyReviews).toBe(0);
    expect(result.criticalsCaught).toBe(0);
    expect(result.contributionScore).toBe(0);
  });

  it('null 리뷰를 처리한다', () => {
    const result = trackRoleContribution('backend', null);
    expect(result.uniqueIssues).toBe(0);
    expect(result.contributionScore).toBe(0);
  });

  it('critical 이슈가 기여도 점수를 높인다', () => {
    const reviewsWithCritical = [
      { approved: false, issues: [{ severity: 'critical', description: '보안 취약점' }] },
    ];
    const reviewsWithMinor = [
      { approved: false, issues: [{ severity: 'minor', description: '스타일 이슈' }] },
    ];
    const scoreCritical = trackRoleContribution('security', reviewsWithCritical).contributionScore;
    const scoreMinor = trackRoleContribution('frontend', reviewsWithMinor).contributionScore;
    expect(scoreCritical).toBeGreaterThan(scoreMinor);
  });

  it('contributionScore가 0 이상이다', () => {
    const reviews = [
      { approved: true, issues: [] },
      { approved: true, issues: [] },
      { approved: true, issues: [] },
    ];
    const result = trackRoleContribution('tech-writer', reviews);
    expect(result.contributionScore).toBeGreaterThanOrEqual(0);
  });

  it('issues가 undefined인 리뷰를 처리한다', () => {
    const reviews = [{ approved: true }];
    const result = trackRoleContribution('cto', reviews);
    expect(result.uniqueIssues).toBe(0);
    expect(result.emptyReviews).toBe(1);
  });
});

// --- recommendOptimalTeam ---

describe('recommendOptimalTeam', () => {
  const baseOutputs = [
    { roleId: 'cto', output: 'unique strategic analysis of architecture and technical decisions' },
    { roleId: 'qa', output: 'unique quality assurance testing plan and methodology review' },
    { roleId: 'security', output: 'unique security audit findings and vulnerability assessment' },
    { roleId: 'frontend', output: 'unique frontend implementation details and component design' },
    { roleId: 'backend', output: 'unique backend api design and database architecture' },
  ];

  const baseContributions = [
    { roleId: 'cto', contributionScore: 2.0 },
    { roleId: 'qa', contributionScore: 1.5 },
    { roleId: 'security', contributionScore: 1.8 },
    { roleId: 'frontend', contributionScore: 1.0 },
    { roleId: 'backend', contributionScore: 1.2 },
  ];

  it('범용 리뷰어를 항상 유지한다', () => {
    const result = recommendOptimalTeam(baseOutputs, baseContributions);
    expect(result.keep).toContain('cto');
    expect(result.keep).toContain('qa');
    expect(result.keep).toContain('security');
  });

  it('중복이고 기여도가 낮은 에이전트를 제거 권장한다', () => {
    const outputs = [
      { roleId: 'cto', output: 'architecture analysis' },
      { roleId: 'frontend', output: 'this is identical duplicate text for testing purposes only' },
      { roleId: 'fullstack', output: 'this is identical duplicate text for testing purposes only' },
    ];
    const contributions = [
      { roleId: 'cto', contributionScore: 2.0 },
      { roleId: 'frontend', contributionScore: 1.0 },
      { roleId: 'fullstack', contributionScore: 0.3 },
    ];
    const result = recommendOptimalTeam(outputs, contributions);
    expect(result.remove).toContain('fullstack');
    expect(result.keep).toContain('frontend');
  });

  it('빈 입력을 처리한다', () => {
    const result = recommendOptimalTeam([], []);
    expect(result.keep).toEqual([]);
    expect(result.remove).toEqual([]);
    expect(result.reasoning.length).toBeGreaterThan(0);
  });

  it('null 입력을 처리한다', () => {
    const result = recommendOptimalTeam(null, null);
    expect(result.keep).toEqual([]);
    expect(result.remove).toEqual([]);
  });

  it('범용 리뷰어의 기여도가 낮으면 경고를 포함한다', () => {
    const outputs = [
      { roleId: 'cto', output: 'some unique cto output for testing purposes' },
      { roleId: 'qa', output: 'some unique qa output for testing purposes different' },
    ];
    const contributions = [
      { roleId: 'cto', contributionScore: 0.1 },
      { roleId: 'qa', contributionScore: 0.2 },
    ];
    const result = recommendOptimalTeam(outputs, contributions);
    expect(result.keep).toContain('cto');
    expect(result.keep).toContain('qa');
    expect(result.reasoning.some(r => r.includes('기여도가 낮습니다'))).toBe(true);
  });

  it('teamSize 제약을 적용한다', () => {
    const result = recommendOptimalTeam(baseOutputs, baseContributions, 3);
    expect(result.keep.length).toBeLessThanOrEqual(3);
    expect(result.remove.length).toBeGreaterThan(0);
  });

  it('기여도가 높은 중복 에이전트는 유지한다', () => {
    const outputs = [
      { roleId: 'frontend', output: 'same implementation plan for react components and design' },
      { roleId: 'fullstack', output: 'same implementation plan for react components and design' },
    ];
    const contributions = [
      { roleId: 'frontend', contributionScore: 2.0 },
      { roleId: 'fullstack', contributionScore: 2.0 },
    ];
    const result = recommendOptimalTeam(outputs, contributions);
    expect(result.keep).toContain('fullstack');
  });

  it('에이전트가 1명일 때 해당 에이전트를 유지한다', () => {
    const outputs = [{ roleId: 'cto', output: 'solo output' }];
    const contributions = [{ roleId: 'cto', contributionScore: 1.0 }];
    const result = recommendOptimalTeam(outputs, contributions);
    expect(result.keep).toContain('cto');
    expect(result.remove).toEqual([]);
  });
});

// --- buildOptimizationReport ---

describe('buildOptimizationReport', () => {
  it('마크다운 문자열을 반환한다', () => {
    const recommendations = {
      keep: ['cto', 'qa'],
      remove: ['tech-writer'],
      reasoning: ['tech-writer: 기여도 낮음'],
    };
    const report = buildOptimizationReport(recommendations);
    expect(report).toContain('# 에이전트 최적화 보고서');
    expect(report).toContain('cto');
    expect(report).toContain('qa');
    expect(report).toContain('tech-writer');
  });

  it('비어 있지 않은 문자열을 반환한다', () => {
    const recommendations = { keep: ['cto'], remove: [], reasoning: [] };
    const report = buildOptimizationReport(recommendations);
    expect(report.length).toBeGreaterThan(0);
    expect(report).toContain('# 에이전트 최적화 보고서');
  });

  it('null 입력을 처리한다', () => {
    const report = buildOptimizationReport(null);
    expect(report).toContain('에이전트 최적화 보고서');
    expect(report).toContain('분석 데이터가 없습니다');
  });

  it('유지/제거 에이전트 수를 요약에 포함한다', () => {
    const recommendations = {
      keep: ['cto', 'qa', 'security'],
      remove: ['tech-writer', 'fullstack'],
      reasoning: [],
    };
    const report = buildOptimizationReport(recommendations);
    expect(report).toContain('유지: 3개');
    expect(report).toContain('제거 권장: 2개');
  });

  it('reasoning을 상세 분석 섹션에 포함한다', () => {
    const recommendations = {
      keep: [],
      remove: [],
      reasoning: ['cto: 기여도가 낮습니다', 'qa: 범용 리뷰어로 유지'],
    };
    const report = buildOptimizationReport(recommendations);
    expect(report).toContain('상세 분석');
    expect(report).toContain('cto: 기여도가 낮습니다');
    expect(report).toContain('qa: 범용 리뷰어로 유지');
  });

  it('빈 recommendations 객체를 처리한다', () => {
    const report = buildOptimizationReport({ keep: [], remove: [], reasoning: [] });
    expect(report).toContain('# 에이전트 최적화 보고서');
    expect(report).toContain('유지: 0개');
  });
});
