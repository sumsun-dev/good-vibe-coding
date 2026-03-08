import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createInitialExecutionState,
  initExecution,
  advanceExecution,
  categorizeFailure,
  buildFailureContext,
  extractContributions,
} from '../../scripts/lib/engine/execution-loop.js';
import { createTestProject, createTestEnvironment } from './helpers.js';

const env = createTestEnvironment('failure');
beforeEach(env.setup);
afterEach(env.cleanup);

// --- Phase 2: 실패 복구 체계 ---

describe('categorizeFailure', () => {
  it('보안 관련 이슈를 security로 분류한다', () => {
    expect(categorizeFailure({ description: 'SQL injection 취약점' })).toBe('security');
    expect(categorizeFailure({ description: 'XSS 공격 가능' })).toBe('security');
    expect(categorizeFailure({ description: '보안 문제 발견' })).toBe('security');
  });

  it('빌드 관련 이슈를 build로 분류한다', () => {
    expect(categorizeFailure({ description: 'build 실패' })).toBe('build');
    expect(categorizeFailure({ description: 'syntax error at line 5' })).toBe('build');
    expect(categorizeFailure({ description: '컴파일 에러' })).toBe('build');
  });

  it('테스트 관련 이슈를 test로 분류한다', () => {
    expect(categorizeFailure({ description: 'test coverage 부족' })).toBe('test');
    expect(categorizeFailure({ description: '테스트 미작성' })).toBe('test');
  });

  it('성능 관련 이슈를 performance로 분류한다', () => {
    expect(categorizeFailure({ description: 'performance 저하' })).toBe('performance');
    expect(categorizeFailure({ description: 'memory leak' })).toBe('performance');
  });

  it('타입 관련 이슈를 type으로 분류한다', () => {
    expect(categorizeFailure({ description: 'TypeScript type error' })).toBe('type');
  });

  it('아키텍처 관련 이슈를 architecture로 분류한다', () => {
    expect(categorizeFailure({ description: 'architecture 문제: tight coupling' })).toBe(
      'architecture',
    );
    expect(categorizeFailure({ description: '설계 패턴 위반' })).toBe('architecture');
  });

  it('분류 불가 이슈를 logic으로 분류한다', () => {
    expect(categorizeFailure({ description: '알 수 없는 문제' })).toBe('logic');
    expect(categorizeFailure({})).toBe('logic');
  });
});

describe('buildFailureContext', () => {
  it('이슈가 있는 실패 컨텍스트를 생성한다', () => {
    const state = createInitialExecutionState();
    const stepResult = {
      qualityGateResult: {
        passed: false,
        issues: [
          { severity: 'critical', description: 'SQL injection', suggestion: '파라미터 바인딩' },
        ],
      },
    };
    const ctx = buildFailureContext(state, stepResult);
    expect(ctx.attempt).toBe(1);
    expect(ctx.maxAttempts).toBe(2);
    expect(ctx.issues).toHaveLength(1);
    expect(ctx.issues[0].category).toBe('security');
    expect(ctx.previousAttempts).toEqual([]);
  });

  it('문자열 이슈를 객체로 변환한다', () => {
    const state = createInitialExecutionState();
    const stepResult = {
      qualityGateResult: { passed: false, issues: ['빌드 실패'] },
    };
    const ctx = buildFailureContext(state, stepResult);
    expect(ctx.issues[0].description).toBe('빌드 실패');
    expect(ctx.issues[0].severity).toBe('critical');
    expect(ctx.issues[0].category).toBeDefined();
  });

  it('이전 시도 이력을 포함한다', () => {
    const state = {
      ...createInitialExecutionState(),
      fixAttempt: 1,
      failureHistory: [{ attempt: 1, issues: [{ description: '이전 이슈' }] }],
    };
    const stepResult = {
      qualityGateResult: { passed: false, issues: [{ description: 'bug', severity: 'critical' }] },
    };
    const ctx = buildFailureContext(state, stepResult);
    expect(ctx.attempt).toBe(2);
    expect(ctx.previousAttempts).toHaveLength(1);
  });

  it('issues가 비어있어도 정상 동작한다', () => {
    const state = createInitialExecutionState();
    const stepResult = { qualityGateResult: { passed: false, issues: [] } };
    const ctx = buildFailureContext(state, stepResult);
    expect(ctx.issues).toEqual([]);
  });

  it('qualityGateResult가 없어도 정상 동작한다', () => {
    const state = createInitialExecutionState();
    const ctx = buildFailureContext(state, {});
    expect(ctx.issues).toEqual([]);
    expect(ctx.attempt).toBe(1);
  });

  it('suggestion도 카테고리 분류에 사용한다', () => {
    const state = createInitialExecutionState();
    const stepResult = {
      qualityGateResult: {
        passed: false,
        issues: [{ description: '문제', suggestion: 'test coverage 개선', severity: 'important' }],
      },
    };
    const ctx = buildFailureContext(state, stepResult);
    expect(ctx.issues[0].category).toBe('test');
  });
});

describe('createInitialExecutionState - 실패 컨텍스트 필드', () => {
  it('failureContext가 null로 초기화된다', () => {
    const state = createInitialExecutionState();
    expect(state.failureContext).toBeNull();
  });

  it('failureHistory가 빈 배열로 초기화된다', () => {
    const state = createInitialExecutionState();
    expect(state.failureHistory).toEqual([]);
  });
});

describe('advanceExecution - 실패 컨텍스트', () => {
  it('quality-gate 실패 시 failureContext를 저장한다', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    await advanceExecution(project.id, { completedAction: 'execute-tasks' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    const result = await advanceExecution(project.id, {
      completedAction: 'quality-gate',
      qualityGateResult: {
        passed: false,
        issues: [{ severity: 'critical', description: 'security 취약점' }],
      },
    });
    expect(result.project.executionState.failureContext).toBeTruthy();
    expect(result.project.executionState.failureContext.attempt).toBe(1);
    expect(result.project.executionState.failureContext.issues[0].category).toBe('security');
  });

  it('quality-gate 통과 시 failureContext를 null로 리셋한다', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    await advanceExecution(project.id, { completedAction: 'execute-tasks' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    const result = await advanceExecution(project.id, {
      completedAction: 'quality-gate',
      qualityGateResult: { passed: true },
    });
    expect(result.project.executionState.failureContext).toBeNull();
  });

  it('fix 시 failureHistory에 이력을 누적한다', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    await advanceExecution(project.id, { completedAction: 'execute-tasks' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    await advanceExecution(project.id, {
      completedAction: 'quality-gate',
      qualityGateResult: {
        passed: false,
        issues: [{ severity: 'critical', description: 'test 부족' }],
      },
    });
    const result = await advanceExecution(project.id, { completedAction: 'fix' });
    expect(result.project.executionState.failureHistory).toHaveLength(1);
    expect(result.project.executionState.failureHistory[0].attempt).toBe(1);
    expect(result.project.executionState.failureHistory[0].timestamp).toBeTruthy();
  });

  it('escalation에 failureHistory가 포함된다', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    await advanceExecution(project.id, { completedAction: 'execute-tasks' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    await advanceExecution(project.id, {
      completedAction: 'quality-gate',
      qualityGateResult: { passed: false, issues: ['bug'] },
    });
    await advanceExecution(project.id, { completedAction: 'fix' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    await advanceExecution(project.id, {
      completedAction: 'quality-gate',
      qualityGateResult: { passed: false, issues: ['bug'] },
    });
    await advanceExecution(project.id, { completedAction: 'fix' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    const result = await advanceExecution(project.id, {
      completedAction: 'quality-gate',
      qualityGateResult: { passed: false, issues: ['persistent-bug'] },
    });
    expect(result.project.executionState.status).toBe('escalated');
    expect(result.project.executionState.pendingEscalation.failureHistory).toBeDefined();
  });
});

describe('advanceExecution - 저널 보강', () => {
  it('quality-gate 실패 시 저널에 failureSummary가 포함된다', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    await advanceExecution(project.id, { completedAction: 'execute-tasks' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    const result = await advanceExecution(project.id, {
      completedAction: 'quality-gate',
      qualityGateResult: {
        passed: false,
        issues: [{ severity: 'critical', description: 'security 문제' }],
      },
    });
    const lastJournal = result.project.executionState.journal.at(-1);
    expect(lastJournal.failureSummary).toBeTruthy();
    expect(lastJournal.failureSummary.issueCount).toBe(1);
    expect(lastJournal.failureSummary.categories).toContain('security');
  });

  it('fix 완료 시 저널에 fixAttempt가 포함된다', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    await advanceExecution(project.id, { completedAction: 'execute-tasks' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    await advanceExecution(project.id, {
      completedAction: 'quality-gate',
      qualityGateResult: { passed: false, issues: [] },
    });
    const result = await advanceExecution(project.id, { completedAction: 'fix' });
    const lastJournal = result.project.executionState.journal.at(-1);
    expect(lastJournal.fixAttempt).toBe(1);
  });

  it('quality-gate 통과 시 저널에 failureSummary가 없다', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    await advanceExecution(project.id, { completedAction: 'execute-tasks' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    const result = await advanceExecution(project.id, {
      completedAction: 'quality-gate',
      qualityGateResult: { passed: true },
    });
    const lastJournal = result.project.executionState.journal.at(-1);
    expect(lastJournal.failureSummary).toBeUndefined();
  });
});

// --- Phase 3: extractContributions ---

describe('extractContributions', () => {
  it('역할별 기여도를 추출한다', () => {
    const reviews = [
      { reviewerId: 'qa', approved: false, issues: [{ severity: 'critical', description: 'bug' }] },
      {
        reviewerId: 'security',
        approved: true,
        issues: [{ severity: 'important', description: '개선점' }],
      },
    ];
    const result = extractContributions(reviews);
    expect(result).toHaveLength(2);
    const qa = result.find((c) => c.roleId === 'qa');
    expect(qa.criticalsCaught).toBe(1);
    expect(qa.uniqueIssues).toBe(1);
  });

  it('동일 역할의 여러 리뷰를 합산한다', () => {
    const reviews = [
      {
        reviewerId: 'qa',
        approved: false,
        issues: [{ severity: 'critical', description: 'bug1' }],
      },
      {
        reviewerId: 'qa',
        approved: false,
        issues: [{ severity: 'important', description: 'issue2' }],
      },
    ];
    const result = extractContributions(reviews);
    expect(result).toHaveLength(1);
    expect(result[0].roleId).toBe('qa');
    expect(result[0].uniqueIssues).toBe(2);
  });

  it('roleId가 없는 리뷰는 무시한다', () => {
    const reviews = [
      { approved: true, issues: [] },
      { reviewerId: 'cto', approved: true, issues: [] },
    ];
    const result = extractContributions(reviews);
    expect(result).toHaveLength(1);
    expect(result[0].roleId).toBe('cto');
  });

  it('빈 리뷰 배열은 빈 결과를 반환한다', () => {
    expect(extractContributions([])).toEqual([]);
  });

  it('roleId 대신 reviewerId를 사용한다', () => {
    const reviews = [{ roleId: 'backend', approved: true, issues: [] }];
    const result = extractContributions(reviews);
    expect(result).toHaveLength(1);
    expect(result[0].roleId).toBe('backend');
  });
});
