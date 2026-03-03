import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getEnabledProviders,
  assignReviewProviders,
  resolveReviewAssignments,
  summarizeCrossModelResults,
} from '../scripts/lib/engine/cross-model-strategy.js';

const SAMPLE_REVIEWERS = [
  { roleId: 'qa', displayName: '지민', role: 'QA Engineer' },
  { roleId: 'security', displayName: '세진', role: 'Security Engineer' },
  { roleId: 'cto', displayName: '민준', role: 'CTO' },
];

const makeConfig = (enabled) => ({
  defaultProvider: 'claude',
  reviewStrategy: 'cross-model',
  providers: Object.fromEntries(Object.entries(enabled).map(([id, on]) => [id, { enabled: on }])),
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

    expect(assignments.every((a) => a.provider === 'openai')).toBe(true);
  });

  it('프로바이더가 1개면 단일 모델 배정', () => {
    const config = makeConfig({ claude: true });
    const assignments = assignReviewProviders(SAMPLE_REVIEWERS, 'claude', config);

    expect(assignments.every((a) => a.provider === 'claude')).toBe(true);
  });

  it('가용 프로바이더가 없으면 구현자 프로바이더 사용', () => {
    const config = makeConfig({});
    const assignments = assignReviewProviders(SAMPLE_REVIEWERS, 'claude', config);

    expect(assignments.every((a) => a.provider === 'claude')).toBe(true);
  });

  it('빈 리뷰어 배열이면 빈 배열 반환', () => {
    const config = makeConfig({ claude: true, openai: true });
    expect(assignReviewProviders([], 'claude', config)).toEqual([]);
    expect(assignReviewProviders(null, 'claude', config)).toEqual([]);
  });

  it('구현자 프로바이더만 활성화되면 구현자 프로바이더 사용', () => {
    const config = makeConfig({ openai: true });
    const assignments = assignReviewProviders(SAMPLE_REVIEWERS, 'openai', config);

    expect(assignments.every((a) => a.provider === 'openai')).toBe(true);
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
    const providers = assignments.map((a) => a.provider);
    expect(providers).not.toContain('claude');
  });

  it('single 전략이면 기본 프로바이더 배정', async () => {
    const config = makeConfig({ claude: true, openai: true });
    config.reviewStrategy = 'single';
    config.defaultProvider = 'claude';

    const assignments = await resolveReviewAssignments(SAMPLE_REVIEWERS, config);
    expect(assignments.every((a) => a.provider === 'claude')).toBe(true);
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
      {
        reviewer: SAMPLE_REVIEWERS[0],
        provider: 'openai',
        review: { verdict: 'approve', issues: [] },
        tokenCount: 500,
      },
      {
        reviewer: SAMPLE_REVIEWERS[1],
        provider: 'gemini',
        review: { verdict: 'approve', issues: [{ severity: 'minor' }] },
        tokenCount: 300,
      },
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
      {
        reviewer: SAMPLE_REVIEWERS[0],
        provider: 'claude',
        review: { verdict: 'approve', issues: [] },
        tokenCount: 400,
      },
      {
        reviewer: SAMPLE_REVIEWERS[1],
        provider: 'claude',
        review: { verdict: 'approve', issues: [] },
        tokenCount: 350,
      },
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
      {
        reviewer: SAMPLE_REVIEWERS[0],
        provider: 'openai',
        review: { verdict: 'approve', issues: [] },
      },
    ];

    const summary = summarizeCrossModelResults(results);
    expect(summary.totalTokens).toBe(0);
    expect(summary.providerBreakdown.openai.tokenCount).toBe(0);
  });

  it('3개 프로바이더 결과를 요약한다', () => {
    const results = [
      {
        reviewer: SAMPLE_REVIEWERS[0],
        provider: 'claude',
        review: { verdict: 'approve', issues: [] },
        tokenCount: 100,
      },
      {
        reviewer: SAMPLE_REVIEWERS[1],
        provider: 'openai',
        review: { verdict: 'approve', issues: [{ severity: 'critical' }] },
        tokenCount: 200,
      },
      {
        reviewer: SAMPLE_REVIEWERS[2],
        provider: 'gemini',
        review: {
          verdict: 'request-changes',
          issues: [{ severity: 'important' }, { severity: 'minor' }],
        },
        tokenCount: 150,
      },
    ];

    const summary = summarizeCrossModelResults(results);
    expect(summary.crossModelUsed).toBe(true);
    expect(summary.totalTokens).toBe(450);
    expect(Object.keys(summary.providerBreakdown)).toHaveLength(3);
    expect(summary.providerBreakdown.openai.issues).toBe(1);
    expect(summary.providerBreakdown.gemini.issues).toBe(2);
  });
});

// --- executeCrossModelReviews ---

describe('executeCrossModelReviews', () => {
  let executeCrossModelReviews;
  let mockCallLLM;

  beforeEach(async () => {
    vi.resetModules();

    mockCallLLM = vi.fn();

    vi.doMock('../scripts/lib/llm/llm-provider.js', () => ({
      callLLM: mockCallLLM,
    }));

    // review-engine uses json-parser, so let it load naturally
    const mod = await import('../scripts/lib/engine/cross-model-strategy.js');
    executeCrossModelReviews = mod.executeCrossModelReviews;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('빈 assignments에 빈 배열을 반환한다', async () => {
    expect(await executeCrossModelReviews([], {}, '')).toEqual([]);
    expect(await executeCrossModelReviews(null, {}, '')).toEqual([]);
  });

  it('단일 리뷰어로 성공적으로 실행한다', async () => {
    mockCallLLM.mockResolvedValue({
      text: '{"verdict": "approve", "issues": []}',
      model: 'gpt-4o',
      tokenCount: 200,
    });

    const assignments = [{ reviewer: SAMPLE_REVIEWERS[0], provider: 'openai' }];
    const task = { id: 'task-1', title: '테스트', assignee: 'backend' };
    const results = await executeCrossModelReviews(assignments, task, '구현 결과');

    expect(results).toHaveLength(1);
    expect(results[0].provider).toBe('openai');
    expect(results[0].review.verdict).toBe('approve');
    expect(results[0].tokenCount).toBe(200);
  });

  it('다중 리뷰어로 병렬 실행한다', async () => {
    mockCallLLM
      .mockResolvedValueOnce({
        text: '{"verdict": "approve", "issues": []}',
        model: 'gpt-4o',
        tokenCount: 200,
      })
      .mockResolvedValueOnce({
        text: '{"verdict": "request-changes", "issues": [{"severity": "critical", "description": "보안 문제"}]}',
        model: 'gemini-2.0-flash',
        tokenCount: 300,
      });

    const assignments = [
      { reviewer: SAMPLE_REVIEWERS[0], provider: 'openai' },
      { reviewer: SAMPLE_REVIEWERS[1], provider: 'gemini' },
    ];
    const task = { id: 'task-1', title: '테스트', assignee: 'backend' };
    const results = await executeCrossModelReviews(assignments, task, '구현 결과');

    expect(results).toHaveLength(2);
    expect(results[0].review.verdict).toBe('approve');
    expect(results[1].review.verdict).toBe('request-changes');
    expect(results[1].review.issues).toHaveLength(1);
  });

  it('부분 실패 시 실패한 리뷰어에 request-changes를 반환한다', async () => {
    mockCallLLM
      .mockResolvedValueOnce({
        text: '{"verdict": "approve", "issues": []}',
        model: 'gpt-4o',
        tokenCount: 200,
      })
      .mockRejectedValueOnce(new Error('API timeout'));

    const assignments = [
      { reviewer: SAMPLE_REVIEWERS[0], provider: 'openai' },
      { reviewer: SAMPLE_REVIEWERS[1], provider: 'gemini' },
    ];
    const task = { id: 'task-1', title: '테스트', assignee: 'backend' };
    const results = await executeCrossModelReviews(assignments, task, '구현 결과');

    expect(results).toHaveLength(2);
    expect(results[0].review.verdict).toBe('approve');
    expect(results[1].review.verdict).toBe('request-changes');
    expect(results[1].review.issues[0].description).toContain('API 호출 실패');
    expect(results[1].tokenCount).toBe(0);
  });

  it('전체 실패 시 모든 리뷰가 request-changes를 반환한다', async () => {
    mockCallLLM.mockRejectedValue(new Error('Network error'));

    const assignments = [
      { reviewer: SAMPLE_REVIEWERS[0], provider: 'openai' },
      { reviewer: SAMPLE_REVIEWERS[1], provider: 'gemini' },
    ];
    const task = { id: 'task-1', title: '테스트', assignee: 'backend' };
    const results = await executeCrossModelReviews(assignments, task, '구현 결과');

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.review.verdict === 'request-changes')).toBe(true);
  });

  it('parse-error 시 1회 재시도한다 (#25)', async () => {
    mockCallLLM
      .mockResolvedValueOnce({ text: '잘 모르겠습니다', model: 'gpt-4o', tokenCount: 100 })
      .mockResolvedValueOnce({
        text: '{"verdict": "approve", "issues": []}',
        model: 'gpt-4o',
        tokenCount: 150,
      });

    const assignments = [{ reviewer: SAMPLE_REVIEWERS[0], provider: 'openai' }];
    const task = { id: 'task-1', title: '테스트', assignee: 'backend' };
    const results = await executeCrossModelReviews(assignments, task, '구현 결과');

    expect(results).toHaveLength(1);
    expect(results[0].review.verdict).toBe('approve');
    expect(mockCallLLM).toHaveBeenCalledTimes(2);
  });

  it('2회 연속 parse-error 시 fallback을 반환한다 (#25)', async () => {
    mockCallLLM.mockResolvedValue({ text: '파싱 불가 텍스트', model: 'gpt-4o', tokenCount: 100 });

    const assignments = [{ reviewer: SAMPLE_REVIEWERS[0], provider: 'openai' }];
    const task = { id: 'task-1', title: '테스트', assignee: 'backend' };
    const results = await executeCrossModelReviews(assignments, task, '구현 결과');

    expect(results).toHaveLength(1);
    expect(results[0].review.verdict).toBe('request-changes');
    expect(results[0].review.issues[0].description).toBe('리뷰 형식 파싱 실패');
    expect(mockCallLLM).toHaveBeenCalledTimes(2);
  });
});
