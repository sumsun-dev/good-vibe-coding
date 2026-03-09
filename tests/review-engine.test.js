import { describe, it, expect } from 'vitest';
import {
  selectReviewers,
  buildTaskReviewPrompt,
  parseTaskReview,
  checkQualityGate,
  buildRevisionPrompt,
  checkEnhancedQualityGate,
} from '../scripts/lib/engine/review-engine.js';

const SAMPLE_TEAM = [
  {
    roleId: 'cto',
    displayName: '민준',
    emoji: '',
    role: 'CTO',
    trait: '전략적',
    speakingStyle: '명확한',
    skills: ['architecture', 'tech-decision', 'code-review'],
    workDomains: ['architecture', 'tech-decision', 'code-review'],
    reviewDomains: ['architecture', 'tech-decision', 'code-review'],
  },
  {
    roleId: 'backend',
    displayName: '도윤',
    emoji: '',
    role: 'Backend Developer',
    trait: '체계적',
    speakingStyle: '논리적',
    skills: ['api', 'database', 'auth'],
    workDomains: ['api', 'database', 'auth', 'backend'],
    reviewDomains: ['api', 'database', 'auth', 'code-quality'],
  },
  {
    roleId: 'qa',
    displayName: '지민',
    emoji: '',
    role: 'QA Engineer',
    trait: '꼼꼼한',
    speakingStyle: '조심스러운',
    skills: ['testing', 'e2e', 'tdd'],
    workDomains: ['testing', 'code-quality', 'e2e'],
    reviewDomains: ['testing', 'code-quality', 'e2e'],
  },
  {
    roleId: 'security',
    displayName: '세진',
    emoji: '',
    role: 'Security Engineer',
    trait: '예리한',
    speakingStyle: '신중한',
    skills: ['security-audit', 'owasp', 'auth'],
    workDomains: ['security', 'auth', 'owasp'],
    reviewDomains: ['security', 'auth', 'owasp'],
  },
  {
    roleId: 'uiux',
    displayName: '하윤',
    emoji: '',
    role: 'UI/UX Designer',
    trait: '창의적',
    speakingStyle: '부드러운',
    skills: ['wireframe', 'user-flow', 'design-system'],
    workDomains: ['user-flow', 'design-system', 'accessibility'],
    reviewDomains: ['user-flow', 'accessibility', 'design-system'],
  },
  {
    roleId: 'fullstack',
    displayName: '서준',
    emoji: '',
    role: 'Full-stack Developer',
    trait: '다재다능한',
    speakingStyle: '실용적',
    skills: ['frontend', 'backend', 'database'],
    workDomains: ['frontend', 'backend', 'database', 'api'],
    reviewDomains: ['frontend', 'backend', 'code-quality'],
  },
  {
    roleId: 'frontend',
    displayName: '수아',
    emoji: '',
    role: 'Frontend Developer',
    trait: '세밀한',
    speakingStyle: '친절한',
    skills: ['react', 'css', 'accessibility'],
    workDomains: ['frontend', 'user-flow', 'accessibility'],
    reviewDomains: ['user-flow', 'accessibility', 'code-quality'],
  },
];

// --- selectReviewers ---

describe('selectReviewers', () => {
  it('백엔드 작업에 적합한 리뷰어를 선정한다', () => {
    const task = { id: 'task-1', assignee: 'backend' };
    const reviewers = selectReviewers(task, SAMPLE_TEAM);
    expect(reviewers.length).toBeGreaterThanOrEqual(2);
    // 담당자(backend)는 리뷰어에 포함되지 않는다
    expect(reviewers.every((r) => r.roleId !== 'backend')).toBe(true);
  });

  it('담당자를 리뷰어에서 제외한다', () => {
    const task = { id: 'task-1', assignee: 'cto' };
    const reviewers = selectReviewers(task, SAMPLE_TEAM);
    expect(reviewers.every((r) => r.roleId !== 'cto')).toBe(true);
  });

  it('최소 2명의 리뷰어를 선정한다', () => {
    const task = { id: 'task-1', assignee: 'backend' };
    const reviewers = selectReviewers(task, SAMPLE_TEAM);
    expect(reviewers.length).toBeGreaterThanOrEqual(2);
  });

  it('최대 3명의 리뷰어를 선정한다', () => {
    const task = { id: 'task-1', assignee: 'backend' };
    const reviewers = selectReviewers(task, SAMPLE_TEAM);
    expect(reviewers.length).toBeLessThanOrEqual(3);
  });

  it('빈 팀이면 빈 배열을 반환한다', () => {
    expect(selectReviewers({ assignee: 'backend' }, [])).toEqual([]);
    expect(selectReviewers({ assignee: 'backend' }, null)).toEqual([]);
    expect(selectReviewers(null, SAMPLE_TEAM)).toEqual([]);
  });

  it('팀원이 2명뿐이면 1명을 리뷰어로 선정한다', () => {
    const smallTeam = SAMPLE_TEAM.slice(0, 2); // cto, backend
    const task = { id: 'task-1', assignee: 'backend' };
    const reviewers = selectReviewers(task, smallTeam);
    expect(reviewers.length).toBe(1);
    expect(reviewers[0].roleId).toBe('cto');
  });

  it('reviewDomains가 없으면 skills를 사용한다', () => {
    const team = SAMPLE_TEAM.map((m) => {
      // eslint-disable-next-line no-unused-vars
      const { reviewDomains, ...rest } = m;
      return rest;
    });
    const task = { id: 'task-1', assignee: 'backend' };
    const reviewers = selectReviewers(task, team);
    expect(reviewers.length).toBeGreaterThanOrEqual(1);
  });

  it('알 수 없는 역할의 작업도 처리한다', () => {
    const task = { id: 'task-1', assignee: 'unknown-role' };
    const reviewers = selectReviewers(task, SAMPLE_TEAM);
    expect(reviewers.length).toBeGreaterThanOrEqual(2);
  });

  it('범용 리뷰 역할(QA, Security, CTO)이 우선 선정된다', () => {
    const task = { id: 'task-1', assignee: 'uiux' };
    const reviewers = selectReviewers(task, SAMPLE_TEAM);
    const reviewerIds = reviewers.map((r) => r.roleId);
    // QA, Security, CTO 중 최소 2명은 포함되어야 함
    const universalCount = reviewerIds.filter((id) =>
      ['qa', 'security', 'cto'].includes(id),
    ).length;
    expect(universalCount).toBeGreaterThanOrEqual(2);
  });

  it('담당자의 workDomains와 겹치는 reviewDomains를 가진 리뷰어가 우선된다', () => {
    // backend(workDomains: api, database, auth, backend) → security(reviewDomains: security, auth, owasp)는 auth 겹침
    const task = { id: 'task-1', assignee: 'backend' };
    const reviewers = selectReviewers(task, SAMPLE_TEAM);
    const reviewerIds = reviewers.map((r) => r.roleId);
    expect(reviewerIds).toContain('security'); // auth 겹침 + 범용 보너스
  });

  it('Frontend 작업 시 UIUX가 도메인 관련성으로 우선 선정된다', () => {
    // frontend(workDomains: frontend, user-flow, accessibility)
    // → uiux(reviewDomains: user-flow, accessibility, design-system) = overlap 2
    // → qa(reviewDomains: testing, code-quality, e2e) = overlap 0, +1 universal = 1
    // → cto(reviewDomains: architecture, tech-decision, code-review) = overlap 0, +1 universal = 1
    const task = { id: 'task-1', assignee: 'frontend' };
    const reviewers = selectReviewers(task, SAMPLE_TEAM);
    const reviewerIds = reviewers.map((r) => r.roleId);
    expect(reviewerIds[0]).toBe('uiux'); // overlap 2 → 최우선
    expect(reviewerIds).toContain('uiux');
  });

  it('Backend 작업 시 Security가 auth 겹침 + 범용 보너스로 우선 선정된다', () => {
    // backend(workDomains: api, database, auth, backend)
    // → security(reviewDomains: security, auth, owasp) = overlap 1 (auth), +1 universal = 2
    // → fullstack(reviewDomains: frontend, backend, code-quality) = overlap 1 (backend) = 1
    // → cto = overlap 0, +1 universal = 1
    // → qa = overlap 0, +1 universal = 1
    const task = { id: 'task-1', assignee: 'backend' };
    const reviewers = selectReviewers(task, SAMPLE_TEAM);
    const reviewerIds = reviewers.map((r) => r.roleId);
    expect(reviewerIds[0]).toBe('security'); // overlap 1 + universal 1 = 2 → 최우선
  });

  it('workDomains가 없으면 reviewDomains로 fallback한다', () => {
    const teamWithoutWorkDomains = SAMPLE_TEAM.map((m) => {
      // eslint-disable-next-line no-unused-vars
      const { workDomains, ...rest } = m;
      return rest;
    });
    const task = { id: 'task-1', assignee: 'backend' };
    const reviewers = selectReviewers(task, teamWithoutWorkDomains);
    expect(reviewers.length).toBeGreaterThanOrEqual(2);
    // backend의 reviewDomains(api, database, auth, code-quality)로 fallback
    // security(reviewDomains: security, auth, owasp) → auth 겹침 + universal = 2
    const reviewerIds = reviewers.map((r) => r.roleId);
    expect(reviewerIds).toContain('security');
  });

  it('이전 리뷰어에게 -0.5 피로도 페널티를 적용한다 (#24)', () => {
    const task = { id: 'task-1', assignee: 'uiux' };
    const withoutPrev = selectReviewers(task, SAMPLE_TEAM);
    const withPrev = selectReviewers(
      task,
      SAMPLE_TEAM,
      withoutPrev.map((r) => r.roleId),
    );
    // 이전 리뷰어와 새 리뷰어의 구성이 달라질 수 있음
    // 최소한 피로도 적용 후에도 리뷰어가 선정됨
    expect(withPrev.length).toBeGreaterThanOrEqual(2);
  });

  it('previousReviewerIds가 없으면 기존 동작을 유지한다 (#24)', () => {
    const task = { id: 'task-1', assignee: 'backend' };
    const reviewers = selectReviewers(task, SAMPLE_TEAM);
    const reviewersNoArg = selectReviewers(task, SAMPLE_TEAM, []);
    expect(reviewers.map((r) => r.roleId)).toEqual(reviewersNoArg.map((r) => r.roleId));
  });
});

// --- buildTaskReviewPrompt ---

describe('buildTaskReviewPrompt', () => {
  const task = {
    id: 'task-1',
    title: 'API 설계',
    assignee: 'backend',
    description: 'REST API를 설계하세요',
  };

  it('리뷰어 정보를 포함한다', () => {
    const prompt = buildTaskReviewPrompt(SAMPLE_TEAM[0], task, '결과물');
    expect(prompt).toContain('민준');
    expect(prompt).toContain('CTO');
  });

  it('작업 정보를 포함한다', () => {
    const prompt = buildTaskReviewPrompt(SAMPLE_TEAM[0], task, '결과물');
    expect(prompt).toContain('API 설계');
    expect(prompt).toContain('task-1');
    expect(prompt).toContain('backend');
  });

  it('작업 결과물을 포함한다', () => {
    const prompt = buildTaskReviewPrompt(SAMPLE_TEAM[0], task, '## API 엔드포인트\nGET /users');
    expect(prompt).toContain('GET /users');
  });

  it('심각도 분류 가이드를 포함한다', () => {
    const prompt = buildTaskReviewPrompt(SAMPLE_TEAM[0], task, '결과물');
    expect(prompt).toContain('critical');
    expect(prompt).toContain('important');
    expect(prompt).toContain('minor');
  });

  it('JSON 출력 형식을 포함한다', () => {
    const prompt = buildTaskReviewPrompt(SAMPLE_TEAM[0], task, '결과물');
    expect(prompt).toContain('verdict');
    expect(prompt).toContain('approve');
    expect(prompt).toContain('request-changes');
  });

  it('description이 없으면 기본 텍스트를 표시한다', () => {
    const taskNoDesc = { id: 'task-1', title: 'API 설계', assignee: 'backend' };
    const prompt = buildTaskReviewPrompt(SAMPLE_TEAM[0], taskNoDesc, '결과물');
    expect(prompt).toContain('(설명 없음)');
  });
});

// --- parseTaskReview ---

describe('parseTaskReview', () => {
  it('JSON 리뷰를 파싱한다', () => {
    const raw = JSON.stringify({
      verdict: 'approve',
      issues: [],
    });
    const result = parseTaskReview(raw);
    expect(result.verdict).toBe('approve');
    expect(result.issues).toEqual([]);
  });

  it('request-changes 리뷰를 파싱한다', () => {
    const raw = JSON.stringify({
      verdict: 'request-changes',
      issues: [
        { severity: 'critical', description: 'SQL 인젝션', suggestion: '파라미터 바인딩 사용' },
      ],
    });
    const result = parseTaskReview(raw);
    expect(result.verdict).toBe('request-changes');
    expect(result.issues.length).toBe(1);
    expect(result.issues[0].severity).toBe('critical');
    expect(result.issues[0].suggestion).toContain('파라미터');
  });

  it('JSON 코드블록에서 파싱한다', () => {
    const raw = '리뷰 결과:\n```json\n{"verdict":"approve","issues":[]}\n```';
    const result = parseTaskReview(raw);
    expect(result.verdict).toBe('approve');
  });

  it('빈 입력은 parse-error로 처리한다', () => {
    expect(parseTaskReview('')).toEqual({ verdict: 'parse-error', issues: [] });
    expect(parseTaskReview(null)).toEqual({ verdict: 'parse-error', issues: [] });
  });

  it('파싱 불가능한 텍스트는 parse-error로 처리한다', () => {
    const result = parseTaskReview('잘 모르겠습니다');
    expect(result.verdict).toBe('parse-error');
  });

  it('issues 필드가 없으면 빈 배열로 정규화한다', () => {
    const raw = JSON.stringify({ verdict: 'approve' });
    const result = parseTaskReview(raw);
    expect(result.issues).toEqual([]);
  });

  it('severity 기본값은 minor이다', () => {
    const raw = JSON.stringify({
      verdict: 'request-changes',
      issues: [{ description: '문제' }],
    });
    const result = parseTaskReview(raw);
    expect(result.issues[0].severity).toBe('minor');
  });

  it('suggestion 기본값은 빈 문자열이다', () => {
    const raw = JSON.stringify({
      verdict: 'request-changes',
      issues: [{ severity: 'minor', description: '문제' }],
    });
    const result = parseTaskReview(raw);
    expect(result.issues[0].suggestion).toBe('');
  });

  it('description이 없는 이슈는 빈 문자열로 기본 설정된다', () => {
    const raw = JSON.stringify({
      verdict: 'request-changes',
      issues: [{ severity: 'critical' }],
    });
    const result = parseTaskReview(raw);
    expect(result.issues[0].description).toBe('');
  });
});

// --- checkQualityGate ---

describe('checkQualityGate', () => {
  it('모두 approve이면 통과한다', () => {
    const reviews = [
      { verdict: 'approve', issues: [] },
      { verdict: 'approve', issues: [] },
    ];
    const result = checkQualityGate(reviews);
    expect(result.passed).toBe(true);
    expect(result.criticalCount).toBe(0);
    expect(result.summary).toContain('통과');
  });

  it('critical 이슈가 있으면 실패한다', () => {
    const reviews = [
      { verdict: 'approve', issues: [] },
      {
        verdict: 'request-changes',
        issues: [{ severity: 'critical', description: '보안 취약점' }],
      },
    ];
    const result = checkQualityGate(reviews);
    expect(result.passed).toBe(false);
    expect(result.criticalCount).toBe(1);
    expect(result.summary).toContain('실패');
  });

  it('important만 있으면 통과하지만 검토 권장', () => {
    const reviews = [
      {
        verdict: 'request-changes',
        issues: [{ severity: 'important', description: '테스트 부족' }],
      },
    ];
    const result = checkQualityGate(reviews);
    expect(result.passed).toBe(true);
    expect(result.importantCount).toBe(1);
    expect(result.summary).toContain('검토 권장');
  });

  it('빈 리뷰 배열이면 실패한다', () => {
    expect(checkQualityGate([])).toEqual({
      passed: false,
      criticalCount: 0,
      importantCount: 0,
      summary: '리뷰 결과 없음',
    });
    expect(checkQualityGate(null)).toEqual({
      passed: false,
      criticalCount: 0,
      importantCount: 0,
      summary: '리뷰 결과 없음',
    });
  });

  it('minor 이슈만 있으면 통과한다', () => {
    const reviews = [
      { verdict: 'approve', issues: [{ severity: 'minor', description: '스타일' }] },
    ];
    const result = checkQualityGate(reviews);
    expect(result.passed).toBe(true);
    expect(result.criticalCount).toBe(0);
    expect(result.importantCount).toBe(0);
  });

  it('issues 필드가 없는 리뷰도 처리한다', () => {
    const reviews = [{ verdict: 'approve' }, { verdict: 'approve', issues: undefined }];
    const result = checkQualityGate(reviews);
    expect(result.passed).toBe(true);
    expect(result.criticalCount).toBe(0);
    expect(result.importantCount).toBe(0);
  });
});

// --- buildRevisionPrompt ---

describe('buildRevisionPrompt', () => {
  const task = { id: 'task-1', title: 'API 설계' };
  const implementer = SAMPLE_TEAM[1]; // backend

  it('구현자 정보를 포함한다', () => {
    const reviews = [
      {
        verdict: 'request-changes',
        issues: [
          { severity: 'critical', description: 'SQL 인젝션', suggestion: '파라미터 바인딩' },
        ],
      },
    ];
    const prompt = buildRevisionPrompt(task, implementer, reviews);
    expect(prompt).toContain('도윤');
    expect(prompt).toContain('Backend Developer');
  });

  it('critical/important 이슈만 포함한다', () => {
    const reviews = [
      {
        verdict: 'request-changes',
        issues: [
          { severity: 'critical', description: '보안 이슈' },
          { severity: 'important', description: '테스트 부족' },
          { severity: 'minor', description: '코드 스타일' },
        ],
      },
    ];
    const prompt = buildRevisionPrompt(task, implementer, reviews);
    expect(prompt).toContain('보안 이슈');
    expect(prompt).toContain('테스트 부족');
    expect(prompt).not.toContain('코드 스타일');
  });

  it('빈 리뷰 배열이면 빈 문자열을 반환한다', () => {
    expect(buildRevisionPrompt(task, implementer, [])).toBe('');
    expect(buildRevisionPrompt(task, implementer, null)).toBe('');
  });

  it('critical/important 이슈가 없으면 빈 문자열을 반환한다', () => {
    const reviews = [
      { verdict: 'approve', issues: [{ severity: 'minor', description: '사소한 이슈' }] },
    ];
    const prompt = buildRevisionPrompt(task, implementer, reviews);
    expect(prompt).toBe('');
  });

  it('수정 방안(suggestion)이 있으면 포함한다', () => {
    const reviews = [
      {
        verdict: 'request-changes',
        issues: [
          { severity: 'critical', description: 'XSS 취약점', suggestion: '입력값 이스케이프 처리' },
        ],
      },
    ];
    const prompt = buildRevisionPrompt(task, implementer, reviews);
    expect(prompt).toContain('입력값 이스케이프 처리');
  });

  it('여러 리뷰에서 이슈를 합산한다', () => {
    const reviews = [
      { verdict: 'request-changes', issues: [{ severity: 'critical', description: '이슈1' }] },
      { verdict: 'request-changes', issues: [{ severity: 'important', description: '이슈2' }] },
    ];
    const prompt = buildRevisionPrompt(task, implementer, reviews);
    expect(prompt).toContain('이슈1');
    expect(prompt).toContain('이슈2');
  });

  it('issues 필드가 없는 리뷰도 처리한다', () => {
    const reviews = [
      { verdict: 'request-changes' },
      { verdict: 'request-changes', issues: [{ severity: 'critical', description: '실제 이슈' }] },
    ];
    const prompt = buildRevisionPrompt(task, implementer, reviews);
    expect(prompt).toContain('실제 이슈');
  });

  it('failureContext 없이 호출하면 하위 호환된다', () => {
    const reviews = [
      { verdict: 'request-changes', issues: [{ severity: 'critical', description: '이슈' }] },
    ];
    const prompt = buildRevisionPrompt(task, implementer, reviews);
    expect(prompt).not.toContain('수정 이력');
    expect(prompt).toContain('이슈');
  });

  it('failureContext가 있으면 시도 차수를 포함한다', () => {
    const reviews = [
      { verdict: 'request-changes', issues: [{ severity: 'critical', description: '보안 이슈' }] },
    ];
    const failureContext = {
      attempt: 2,
      maxAttempts: 2,
      issues: [{ description: '보안 이슈', severity: 'critical', category: 'security' }],
      previousAttempts: [
        { attempt: 1, issues: [{ description: '이전 보안 이슈', category: 'security' }] },
      ],
    };
    const prompt = buildRevisionPrompt(task, implementer, reviews, failureContext);
    expect(prompt).toContain('시도 2/2');
    expect(prompt).toContain('이전 시도');
    expect(prompt).toContain('시도 1');
    expect(prompt).toContain('이전 시도에서 해결되지 않은 이슈에 주의');
  });

  it('failureContext에 이전 시도가 없으면 이전 시도 섹션을 생략한다', () => {
    const reviews = [
      { verdict: 'request-changes', issues: [{ severity: 'critical', description: '이슈' }] },
    ];
    const failureContext = {
      attempt: 1,
      maxAttempts: 2,
      issues: [{ description: '이슈', severity: 'critical', category: 'logic' }],
      previousAttempts: [],
    };
    const prompt = buildRevisionPrompt(task, implementer, reviews, failureContext);
    expect(prompt).toContain('시도 1/2');
    expect(prompt).not.toContain('이전 시도');
    expect(prompt).toContain('문제 유형 분포');
  });

  it('failureContext가 null이면 무시한다', () => {
    const reviews = [
      { verdict: 'request-changes', issues: [{ severity: 'critical', description: '이슈' }] },
    ];
    const prompt = buildRevisionPrompt(task, implementer, reviews, null);
    expect(prompt).not.toContain('수정 이력');
  });
});

// --- checkEnhancedQualityGate ---

describe('checkEnhancedQualityGate', () => {
  const passingReviews = [
    { verdict: 'approve', issues: [] },
    { verdict: 'approve', issues: [] },
  ];

  const failingReviews = [
    { verdict: 'request-changes', issues: [{ severity: 'critical', description: '보안 취약점' }] },
  ];

  const executionPass = {
    verified: true,
    buildResult: { success: true, output: 'build ok', exitCode: 0 },
    testResult: { success: true, output: 'tests ok', exitCode: 0 },
    codeBlockCount: 3,
  };

  const executionFail = {
    verified: false,
    buildResult: { success: false, output: 'syntax error at line 5', exitCode: 1 },
    testResult: { success: null, output: 'no tests found', exitCode: null },
    codeBlockCount: 2,
  };

  it('텍스트 통과 + 실행 통과 = 전체 통과', () => {
    const result = checkEnhancedQualityGate(passingReviews, executionPass);
    expect(result.passed).toBe(true);
    expect(result.executionVerified).toBe(true);
    expect(result.summary).toContain('실행 검증 통과');
  });

  it('텍스트 통과 + 실행 실패 = 전체 실패', () => {
    const result = checkEnhancedQualityGate(passingReviews, executionFail);
    expect(result.passed).toBe(false);
    expect(result.executionVerified).toBe(false);
    expect(result.summary).toContain('실행 검증 실패');
    expect(result.summary).toContain('syntax error at line 5');
  });

  it('텍스트 실패 + 실행 통과 = 전체 실패', () => {
    const result = checkEnhancedQualityGate(failingReviews, executionPass);
    expect(result.passed).toBe(false);
    expect(result.executionVerified).toBe(true);
    expect(result.criticalCount).toBe(1);
  });

  it('텍스트 실패 + 실행 실패 = 전체 실패', () => {
    const result = checkEnhancedQualityGate(failingReviews, executionFail);
    expect(result.passed).toBe(false);
    expect(result.executionVerified).toBe(false);
  });

  it('실행 결과가 null이면 텍스트 결과만 반환한다', () => {
    const result = checkEnhancedQualityGate(passingReviews, null);
    expect(result.passed).toBe(true);
    expect(result.executionVerified).toBeNull();
    expect(result.summary).not.toContain('실행 검증');
  });

  it('실행 결과의 verified가 null이면 텍스트 결과만 반환한다', () => {
    const executionNull = { verified: null, reason: 'no-code-blocks', codeBlockCount: 0 };
    const result = checkEnhancedQualityGate(passingReviews, executionNull);
    expect(result.passed).toBe(true);
    expect(result.executionVerified).toBeNull();
  });

  it('executionResult 없이 호출하면 텍스트 결과만 반환한다', () => {
    const result = checkEnhancedQualityGate(passingReviews);
    expect(result.passed).toBe(true);
    expect(result.executionVerified).toBeNull();
  });

  it('summary에 실행 상태가 포함된다 (통과)', () => {
    const result = checkEnhancedQualityGate(passingReviews, executionPass);
    expect(result.summary).toContain('실행 검증 통과');
  });

  it('summary에 실행 상태가 포함된다 (실패)', () => {
    const result = checkEnhancedQualityGate(passingReviews, executionFail);
    expect(result.summary).toContain('실행 검증 실패');
  });

  it('빌드 출력이 없는 실패 시 기본 메시지를 표시한다', () => {
    const executionFailNoOutput = {
      verified: false,
      buildResult: null,
      codeBlockCount: 1,
    };
    const result = checkEnhancedQualityGate(passingReviews, executionFailNoOutput);
    expect(result.passed).toBe(false);
    expect(result.summary).toContain('build failed');
  });

  it('criticalCount와 importantCount를 올바르게 전달한다', () => {
    const mixedReviews = [
      { verdict: 'approve', issues: [{ severity: 'important', description: '테스트 부족' }] },
    ];
    const result = checkEnhancedQualityGate(mixedReviews, executionPass);
    expect(result.passed).toBe(true);
    expect(result.criticalCount).toBe(0);
    expect(result.importantCount).toBe(1);
    expect(result.executionVerified).toBe(true);
  });
});

describe('selectReviewers 1명 팀', () => {
  it('1명 팀에서 빈 리뷰어 배열을 반환한다', () => {
    const soloTeam = [
      { roleId: 'fullstack', workDomains: ['frontend', 'backend'], reviewDomains: ['frontend'] },
    ];
    const task = { assignee: 'fullstack' };
    const reviewers = selectReviewers(task, soloTeam);
    expect(reviewers).toEqual([]);
  });
});

describe('checkQualityGate important 경고', () => {
  it('important 초과 시 summary에 경고를 포함한다', () => {
    const issues = Array.from({ length: 15 }, (_, i) => ({
      severity: 'important',
      description: `이슈 ${i}`,
    }));
    const reviews = [{ verdict: 'approve', issues }];
    const result = checkQualityGate(reviews);
    expect(result.passed).toBe(true);
    expect(result.summary).toContain('경고');
  });
});

describe('buildRevisionPrompt 최종 시도 경고', () => {
  it('최종 시도 시 경고 문구를 포함한다', () => {
    const task = { id: 'task-1', title: '구현' };
    const implementer = { emoji: '', displayName: '풀스택', role: 'fullstack' };
    const reviews = [
      { issues: [{ severity: 'critical', description: '보안 취약점', suggestion: '수정 필요' }] },
    ];
    const failureContext = { attempt: 2, maxAttempts: 2, previousAttempts: [], issues: [] };
    const prompt = buildRevisionPrompt(task, implementer, reviews, failureContext);
    expect(prompt).toContain('마지막');
  });
});

describe('buildRevisionPrompt ceoGuidance', () => {
  const task = { id: 'task-1', title: 'API 설계' };
  const implementer = { displayName: '도윤', role: 'Backend Developer' };

  it('ceoGuidance가 있으면 CEO 지침 섹션을 포함한다', () => {
    const reviews = [{ issues: [{ severity: 'critical', description: '보안 이슈' }] }];
    const failureContext = {
      attempt: 1,
      maxAttempts: 2,
      issues: [],
      previousAttempts: [],
      ceoGuidance: 'JWT 인증 대신 OAuth2를 사용하세요',
    };
    const prompt = buildRevisionPrompt(task, implementer, reviews, failureContext);
    expect(prompt).toContain('CEO 지침');
    expect(prompt).toContain('JWT 인증 대신 OAuth2를 사용하세요');
    expect(prompt).toContain('최우선으로 반영');
  });

  it('ceoGuidance가 없으면 CEO 지침 섹션을 생략한다', () => {
    const reviews = [{ issues: [{ severity: 'critical', description: '이슈' }] }];
    const failureContext = {
      attempt: 1,
      maxAttempts: 2,
      issues: [],
      previousAttempts: [],
    };
    const prompt = buildRevisionPrompt(task, implementer, reviews, failureContext);
    expect(prompt).not.toContain('CEO 지침');
  });
});
