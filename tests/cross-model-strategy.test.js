import { describe, it, expect } from 'vitest';
import {
  getEnabledProviders,
  assignReviewProviders,
  resolveReviewAssignments,
  summarizeCrossModelResults,
} from '../scripts/lib/cross-model-strategy.js';

const SAMPLE_REVIEWERS = [
  { roleId: 'qa', displayName: '지민', role: 'QA Engineer' },
  { roleId: 'security', displayName: '세진', role: 'Security Engineer' },
  { roleId: 'cto', displayName: '민준', role: 'CTO' },
];

const makeConfig = (enabled) => ({
  defaultProvider: 'claude',
  reviewStrategy: 'cross-model',
  providers: Object.fromEntries(
    Object.entries(enabled).map(([id, on]) => [id, { enabled: on }])
  ),
});

// --- getEnabledProviders ---

describe('getEnabledProviders', () => {
  it('활성화된 프로바이더만 반환한다', () => {
    const config = makeConfig({ claude: true, openai: false, gemini: true });
    expect(getEnabledProviders(config)).toEqual(['claude', 'gemini']);
  });

  it('모두 비활성이면 빈 배열을 반환한다', () => {
    const config = makeConfig({ claude: false, openai: false });
    expect(getEnabledProviders(config)).toEqual([]);
  });

  it('null config는 빈 배열을 반환한다', () => {
    expect(getEnabledProviders(null)).toEqual([]);
    expect(getEnabledProviders({})).toEqual([]);
  });
});

// --- assignReviewProviders ---

describe('assignReviewProviders', () => {
  it('프로바이더가 3개면 구현자 제외 후 라운드로빈 배정', () => {
    const config = makeConfig({ claude: true, openai: true, gemini: true });
    const assignments = assignReviewProviders(SAMPLE_REVIEWERS, 'claude', config);

    expect(assignments).toHaveLength(3);
    // claude 제외, openai와 gemini를 라운드로빈
    expect(assignments[0].provider).toBe('openai');
    expect(assignments[1].provider).toBe('gemini');
    expect(assignments[2].provider).toBe('openai');
    // 리뷰어 정보 유지
    expect(assignments[0].reviewer.roleId).toBe('qa');
  });

  it('프로바이더가 2개면 구현자 제외한 1개로 배정', () => {
    const config = makeConfig({ claude: true, openai: true });
    const assignments = assignReviewProviders(SAMPLE_REVIEWERS, 'claude', config);

    expect(assignments.every(a => a.provider === 'openai')).toBe(true);
  });

  it('프로바이더가 1개면 단일 모델 배정', () => {
    const config = makeConfig({ claude: true });
    const assignments = assignReviewProviders(SAMPLE_REVIEWERS, 'claude', config);

    expect(assignments.every(a => a.provider === 'claude')).toBe(true);
  });

  it('가용 프로바이더가 없으면 구현자 프로바이더 사용', () => {
    const config = makeConfig({});
    const assignments = assignReviewProviders(SAMPLE_REVIEWERS, 'claude', config);

    expect(assignments.every(a => a.provider === 'claude')).toBe(true);
  });

  it('빈 리뷰어 배열이면 빈 배열 반환', () => {
    const config = makeConfig({ claude: true, openai: true });
    expect(assignReviewProviders([], 'claude', config)).toEqual([]);
    expect(assignReviewProviders(null, 'claude', config)).toEqual([]);
  });

  it('구현자 프로바이더만 활성화되면 구현자 프로바이더 사용', () => {
    const config = makeConfig({ openai: true });
    const assignments = assignReviewProviders(SAMPLE_REVIEWERS, 'openai', config);

    expect(assignments.every(a => a.provider === 'openai')).toBe(true);
  });
});

// --- resolveReviewAssignments ---

describe('resolveReviewAssignments', () => {
  it('cross-model 전략이면 크로스 모델 배정', async () => {
    const config = makeConfig({ claude: true, openai: true, gemini: true });
    config.reviewStrategy = 'cross-model';
    config.defaultProvider = 'claude';

    const assignments = await resolveReviewAssignments(SAMPLE_REVIEWERS, config);
    // 구현자(claude) 제외, openai/gemini 배정
    const providers = assignments.map(a => a.provider);
    expect(providers).not.toContain('claude');
  });

  it('single 전략이면 기본 프로바이더 배정', async () => {
    const config = makeConfig({ claude: true, openai: true });
    config.reviewStrategy = 'single';
    config.defaultProvider = 'claude';

    const assignments = await resolveReviewAssignments(SAMPLE_REVIEWERS, config);
    expect(assignments.every(a => a.provider === 'claude')).toBe(true);
  });

  it('빈 리뷰어면 빈 배열 반환', async () => {
    const config = makeConfig({ claude: true });
    expect(await resolveReviewAssignments([], config)).toEqual([]);
    expect(await resolveReviewAssignments(null, config)).toEqual([]);
  });
});

// --- summarizeCrossModelResults ---

describe('summarizeCrossModelResults', () => {
  it('크로스 모델 결과를 요약한다', () => {
    const results = [
      { reviewer: SAMPLE_REVIEWERS[0], provider: 'openai', review: { verdict: 'approve', issues: [] }, tokenCount: 500 },
      { reviewer: SAMPLE_REVIEWERS[1], provider: 'gemini', review: { verdict: 'approve', issues: [{ severity: 'minor' }] }, tokenCount: 300 },
    ];

    const summary = summarizeCrossModelResults(results);
    expect(summary.crossModelUsed).toBe(true);
    expect(summary.totalTokens).toBe(800);
    expect(summary.providerBreakdown.openai.reviewCount).toBe(1);
    expect(summary.providerBreakdown.gemini.reviewCount).toBe(1);
    expect(summary.providerBreakdown.gemini.issues).toBe(1);
    expect(summary.summary).toContain('크로스 모델');
  });

  it('단일 모델 결과를 요약한다', () => {
    const results = [
      { reviewer: SAMPLE_REVIEWERS[0], provider: 'claude', review: { verdict: 'approve', issues: [] }, tokenCount: 400 },
      { reviewer: SAMPLE_REVIEWERS[1], provider: 'claude', review: { verdict: 'approve', issues: [] }, tokenCount: 350 },
    ];

    const summary = summarizeCrossModelResults(results);
    expect(summary.crossModelUsed).toBe(false);
    expect(summary.totalTokens).toBe(750);
    expect(summary.summary).toContain('단일 모델');
  });

  it('빈 결과는 기본값을 반환한다', () => {
    const summary = summarizeCrossModelResults([]);
    expect(summary.crossModelUsed).toBe(false);
    expect(summary.totalTokens).toBe(0);
    expect(summary.summary).toBe('리뷰 결과 없음');

    expect(summarizeCrossModelResults(null)).toEqual(summary);
  });

  it('토큰 카운트가 없어도 처리한다', () => {
    const results = [
      { reviewer: SAMPLE_REVIEWERS[0], provider: 'openai', review: { verdict: 'approve', issues: [] } },
    ];

    const summary = summarizeCrossModelResults(results);
    expect(summary.totalTokens).toBe(0);
    expect(summary.providerBreakdown.openai.tokenCount).toBe(0);
  });

  it('3개 프로바이더 결과를 요약한다', () => {
    const results = [
      { reviewer: SAMPLE_REVIEWERS[0], provider: 'claude', review: { verdict: 'approve', issues: [] }, tokenCount: 100 },
      { reviewer: SAMPLE_REVIEWERS[1], provider: 'openai', review: { verdict: 'approve', issues: [{ severity: 'critical' }] }, tokenCount: 200 },
      { reviewer: SAMPLE_REVIEWERS[2], provider: 'gemini', review: { verdict: 'request-changes', issues: [{ severity: 'important' }, { severity: 'minor' }] }, tokenCount: 150 },
    ];

    const summary = summarizeCrossModelResults(results);
    expect(summary.crossModelUsed).toBe(true);
    expect(summary.totalTokens).toBe(450);
    expect(Object.keys(summary.providerBreakdown)).toHaveLength(3);
    expect(summary.providerBreakdown.openai.issues).toBe(1);
    expect(summary.providerBreakdown.gemini.issues).toBe(2);
  });
});
