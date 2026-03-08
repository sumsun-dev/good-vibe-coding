import { describe, it, expect } from 'vitest';
import {
  createInitialExecutionState,
  isValidExecutionState,
  getNextExecutionStep,
  getExecutionSummary,
  PHASE_TRANSITIONS,
  isValidTransition,
  isStaleExecution,
  computeStateTransition,
} from '../../scripts/lib/engine/execution-loop.js';
import { config } from '../../scripts/lib/core/config.js';

// === Pure 함수 테스트 ===

describe('createInitialExecutionState', () => {
  it('interactive 모드 초기 상태를 생성한다', () => {
    const state = createInitialExecutionState('interactive');
    expect(state.status).toBe('executing');
    expect(state.currentPhase).toBe(1);
    expect(state.phaseStep).toBe('execute-tasks');
    expect(state.fixAttempt).toBe(0);
    expect(state.mode).toBe('interactive');
    expect(state.completedPhases).toEqual([]);
    expect(state.pendingEscalation).toBeNull();
    expect(state.completedAt).toBeNull();
    expect(state.startedAt).toBeTruthy();
    expect(state.phaseResults).toEqual({});
  });

  it('auto 모드 초기 상태를 생성한다', () => {
    const state = createInitialExecutionState('auto');
    expect(state.mode).toBe('auto');
  });

  it('기본값은 interactive 모드이다', () => {
    const state = createInitialExecutionState();
    expect(state.mode).toBe('interactive');
  });

  it('유효하지 않은 모드는 interactive로 설정된다', () => {
    const state = createInitialExecutionState('invalid');
    expect(state.mode).toBe('interactive');
  });
});

describe('isValidExecutionState', () => {
  it('유효한 상태를 true로 반환한다', () => {
    const state = createInitialExecutionState();
    expect(isValidExecutionState(state)).toBe(true);
  });

  it('null을 false로 반환한다', () => {
    expect(isValidExecutionState(null)).toBe(false);
  });

  it('빈 객체를 false로 반환한다', () => {
    expect(isValidExecutionState({})).toBe(false);
  });

  it('잘못된 status를 false로 반환한다', () => {
    const state = createInitialExecutionState();
    state.status = 'invalid-status';
    expect(isValidExecutionState(state)).toBe(false);
  });

  it('잘못된 phaseStep을 false로 반환한다', () => {
    const state = createInitialExecutionState();
    state.phaseStep = 'invalid-step';
    expect(isValidExecutionState(state)).toBe(false);
  });

  it('currentPhase < 1이면 false', () => {
    const state = createInitialExecutionState();
    state.currentPhase = 0;
    expect(isValidExecutionState(state)).toBe(false);
  });

  it('잘못된 mode를 false로 반환한다', () => {
    const state = createInitialExecutionState();
    state.mode = 'turbo';
    expect(isValidExecutionState(state)).toBe(false);
  });
});

describe('getNextExecutionStep', () => {
  it('executionState 없으면 not-started를 반환한다', () => {
    const project = { tasks: [] };
    const result = getNextExecutionStep(project);
    expect(result.action).toBe('not-started');
  });

  it('completed 상태면 already-completed를 반환한다', () => {
    const project = {
      tasks: [{ id: 't1', phase: 1 }],
      executionState: { ...createInitialExecutionState(), status: 'completed' },
    };
    const result = getNextExecutionStep(project);
    expect(result.action).toBe('already-completed');
  });

  it('escalated 상태면 escalate를 반환한다', () => {
    const state = createInitialExecutionState();
    state.status = 'escalated';
    state.pendingEscalation = { reason: 'test', unresolvedIssues: [] };
    const project = { tasks: [{ id: 't1', phase: 1 }], executionState: state };
    const result = getNextExecutionStep(project);
    expect(result.action).toBe('escalate');
    expect(result.context.escalation.reason).toBe('test');
  });

  it('paused 상태면 paused를 반환한다', () => {
    const state = createInitialExecutionState();
    state.status = 'paused';
    const project = { tasks: [{ id: 't1', phase: 1 }], executionState: state };
    const result = getNextExecutionStep(project);
    expect(result.action).toBe('paused');
  });

  it('execute-tasks 단계를 반환한다', () => {
    const state = createInitialExecutionState();
    const project = {
      tasks: [
        { id: 't1', title: 'API 구현', assignee: 'backend', phase: 1 },
        { id: 't2', title: '설계', assignee: 'cto', phase: 1 },
      ],
      executionState: state,
    };
    const result = getNextExecutionStep(project);
    expect(result.action).toBe('execute-tasks');
    expect(result.phase).toBe(1);
    expect(result.tasks).toHaveLength(2);
  });

  it('materialize 단계를 반환한다 (코드 태스크 필터링)', () => {
    const state = createInitialExecutionState();
    state.phaseStep = 'materialize';
    const project = {
      tasks: [
        { id: 't1', title: 'API 구현', assignee: 'backend', phase: 1 },
        { id: 't2', title: '아키텍처 설계', assignee: 'cto', phase: 1 },
      ],
      executionState: state,
    };
    const result = getNextExecutionStep(project);
    expect(result.action).toBe('materialize');
    // backend은 코드 태스크, cto는 아님
    expect(result.tasks.length).toBeGreaterThanOrEqual(1);
  });

  it('review 단계를 반환한다', () => {
    const state = createInitialExecutionState();
    state.phaseStep = 'review';
    const project = { tasks: [{ id: 't1', phase: 1 }], executionState: state };
    const result = getNextExecutionStep(project);
    expect(result.action).toBe('review');
  });

  it('quality-gate 단계를 반환한다', () => {
    const state = createInitialExecutionState();
    state.phaseStep = 'quality-gate';
    const project = { tasks: [{ id: 't1', phase: 1 }], executionState: state };
    const result = getNextExecutionStep(project);
    expect(result.action).toBe('quality-gate');
  });

  it('fix 단계를 반환한다 (시도 횟수 포함)', () => {
    const state = createInitialExecutionState();
    state.phaseStep = 'fix';
    state.fixAttempt = 1;
    const project = { tasks: [{ id: 't1', phase: 1 }], executionState: state };
    const result = getNextExecutionStep(project);
    expect(result.action).toBe('fix');
    expect(result.description).toContain('2/2');
  });

  it('commit 단계를 반환한다', () => {
    const state = createInitialExecutionState();
    state.phaseStep = 'commit';
    const project = { tasks: [{ id: 't1', phase: 1 }], executionState: state };
    const result = getNextExecutionStep(project);
    expect(result.action).toBe('commit');
  });

  it('build-context + interactive + 마지막이 아닌 phase → confirm-next-phase', () => {
    const state = createInitialExecutionState('interactive');
    state.phaseStep = 'build-context';
    const project = {
      tasks: [
        { id: 't1', phase: 1 },
        { id: 't2', phase: 2 },
      ],
      executionState: state,
    };
    const result = getNextExecutionStep(project);
    expect(result.action).toBe('confirm-next-phase');
  });

  it('build-context + auto + 마지막이 아닌 phase → build-context', () => {
    const state = createInitialExecutionState('auto');
    state.phaseStep = 'build-context';
    const project = {
      tasks: [
        { id: 't1', phase: 1 },
        { id: 't2', phase: 2 },
      ],
      executionState: state,
    };
    const result = getNextExecutionStep(project);
    expect(result.action).toBe('build-context');
  });

  it('build-context + 마지막 phase → complete', () => {
    const state = createInitialExecutionState();
    state.phaseStep = 'build-context';
    const project = {
      tasks: [{ id: 't1', phase: 1 }],
      executionState: state,
    };
    const result = getNextExecutionStep(project);
    expect(result.action).toBe('complete');
  });

  it('알 수 없는 phaseStep이면 not-started를 반환한다', () => {
    const state = createInitialExecutionState();
    state.phaseStep = 'unknown-step';
    const project = {
      tasks: [{ id: 't1', phase: 1 }],
      executionState: state,
    };
    const result = getNextExecutionStep(project);
    expect(result.action).toBe('not-started');
    expect(result.description).toContain('알 수 없는 phaseStep');
    expect(result.description).toContain('unknown-step');
  });
});

describe('getExecutionSummary', () => {
  it('executionState 없으면 idle을 반환한다', () => {
    const project = { tasks: [{ id: 't1', phase: 1 }] };
    const summary = getExecutionSummary(project);
    expect(summary.status).toBe('idle');
    expect(summary.percentage).toBe(0);
    expect(summary.display).toBe('실행 대기 중');
  });

  it('실행 중 상태의 진행률을 계산한다', () => {
    const state = createInitialExecutionState();
    state.completedPhases = [1];
    state.currentPhase = 2;
    const project = {
      tasks: [
        { id: 't1', phase: 1 },
        { id: 't2', phase: 2 },
      ],
      executionState: state,
    };
    const summary = getExecutionSummary(project);
    expect(summary.percentage).toBe(50);
    expect(summary.currentPhase).toBe(2);
    expect(summary.totalPhases).toBe(2);
  });

  it('completed 상태는 100%를 반환한다', () => {
    const state = createInitialExecutionState();
    state.status = 'completed';
    state.completedPhases = [1, 2];
    const project = {
      tasks: [
        { id: 't1', phase: 1 },
        { id: 't2', phase: 2 },
      ],
      executionState: state,
    };
    const summary = getExecutionSummary(project);
    expect(summary.percentage).toBe(100);
    expect(summary.display).toContain('전체 완료');
  });

  it('escalated 상태 display를 반환한다', () => {
    const state = createInitialExecutionState();
    state.status = 'escalated';
    const project = { tasks: [{ id: 't1', phase: 1 }], executionState: state };
    const summary = getExecutionSummary(project);
    expect(summary.display).toContain('CEO 결정 대기');
  });

  it('paused 상태 display를 반환한다', () => {
    const state = createInitialExecutionState();
    state.status = 'paused';
    const project = {
      tasks: [
        { id: 't1', phase: 1 },
        { id: 't2', phase: 2 },
      ],
      executionState: state,
    };
    const summary = getExecutionSummary(project);
    expect(summary.display).toContain('일시 중지');
    expect(summary.status).toBe('paused');
    expect(summary.percentage).toBe(0);
  });
});

describe('PHASE_TRANSITIONS', () => {
  it('모든 유효한 phaseStep에 대한 전이가 정의되어 있다', () => {
    const steps = [
      'execute-tasks',
      'materialize',
      'review',
      'quality-gate',
      'fix',
      'commit',
      'build-context',
    ];
    for (const step of steps) {
      expect(PHASE_TRANSITIONS[step]).toBeDefined();
      expect(Array.isArray(PHASE_TRANSITIONS[step])).toBe(true);
    }
  });

  it('execute-tasks → materialize 전이가 유효하다', () => {
    expect(isValidTransition('execute-tasks', 'materialize')).toBe(true);
    expect(isValidTransition('execute-tasks', 'commit')).toBe(false);
  });

  it('quality-gate는 commit, fix, escalated로 분기한다', () => {
    expect(isValidTransition('quality-gate', 'commit')).toBe(true);
    expect(isValidTransition('quality-gate', 'fix')).toBe(true);
    expect(isValidTransition('quality-gate', 'escalated')).toBe(true);
    expect(isValidTransition('quality-gate', 'review')).toBe(false);
  });

  it('fix → materialize 재진입이 유효하다', () => {
    expect(isValidTransition('fix', 'materialize')).toBe(true);
  });

  it('build-context → execute-tasks 또는 completed로 분기한다', () => {
    expect(isValidTransition('build-context', 'execute-tasks')).toBe(true);
    expect(isValidTransition('build-context', 'completed')).toBe(true);
  });

  it('존재하지 않는 단계는 false를 반환한다', () => {
    expect(isValidTransition('unknown', 'commit')).toBe(false);
  });
});

describe('isStaleExecution', () => {
  it('최근 저널이 있으면 fresh로 판정한다', () => {
    const state = {
      startedAt: new Date().toISOString(),
      journal: [{ timestamp: new Date().toISOString() }],
    };
    expect(isStaleExecution(state, 60_000)).toBe(false);
  });

  it('오래된 저널이면 stale로 판정한다', () => {
    const old = new Date(Date.now() - 120_000).toISOString();
    const state = {
      startedAt: old,
      journal: [{ timestamp: old }],
    };
    expect(isStaleExecution(state, 60_000)).toBe(true);
  });

  it('저널이 없으면 startedAt 기준으로 판정한다', () => {
    const state = {
      startedAt: new Date().toISOString(),
      journal: [],
    };
    expect(isStaleExecution(state, 60_000)).toBe(false);
  });

  it('null 상태는 stale로 판정한다', () => {
    expect(isStaleExecution(null, 60_000)).toBe(true);
  });
});

// --- 시맨틱 검증 ---

describe('isValidExecutionState 시맨틱 검증', () => {
  it('fixAttempt > maxFixAttempts이면 false', () => {
    const state = createInitialExecutionState();
    state.fixAttempt = 3;
    expect(isValidExecutionState(state)).toBe(false);
  });

  it('completed 상태인데 completedAt이 없으면 false', () => {
    const state = createInitialExecutionState();
    state.status = 'completed';
    state.completedAt = null;
    expect(isValidExecutionState(state)).toBe(false);
  });

  it('completed + completedAt이 있으면 true', () => {
    const state = createInitialExecutionState();
    state.status = 'completed';
    state.completedAt = new Date().toISOString();
    expect(isValidExecutionState(state)).toBe(true);
  });

  it('escalated 상태인데 pendingEscalation이 없으면 false', () => {
    const state = createInitialExecutionState();
    state.status = 'escalated';
    state.pendingEscalation = null;
    expect(isValidExecutionState(state)).toBe(false);
  });

  it('escalated + pendingEscalation이 있으면 true', () => {
    const state = createInitialExecutionState();
    state.status = 'escalated';
    state.pendingEscalation = { reason: 'test' };
    expect(isValidExecutionState(state)).toBe(true);
  });

  it('completedPhases에 중복이 있으면 false', () => {
    const state = createInitialExecutionState();
    state.completedPhases = [1, 1, 2];
    expect(isValidExecutionState(state)).toBe(false);
  });
});

describe('createInitialExecutionState journal', () => {
  it('초기 상태에 빈 journal 배열이 포함된다', () => {
    const state = createInitialExecutionState();
    expect(state.journal).toEqual([]);
  });
});

describe('computeStateTransition 불변성', () => {
  it('원본 프로젝트의 executionState를 변경하지 않는다', () => {
    const originalState = createInitialExecutionState('auto');
    originalState.phaseResults = {
      1: {
        taskResults: [{ id: 'task-1', output: 'original' }],
        reviews: [],
        qualityGate: null,
        committed: false,
      },
    };
    const project = {
      id: 'immutability-test',
      tasks: [{ id: 'task-1', phase: 1 }],
      executionState: originalState,
    };

    // deep copy 확인: 원본 phaseResults 내부 배열이 참조 공유되지 않아야 함
    const originalTaskResults = project.executionState.phaseResults[1].taskResults;
    const originalTaskResultsCopy = [...originalTaskResults];

    const result = computeStateTransition(project, {
      completedAction: 'execute-tasks',
      taskResults: [{ id: 'task-1', output: 'modified' }],
    });

    // 원본이 변경되지 않았는지 확인
    expect(project.executionState.phaseResults[1].taskResults).toEqual(originalTaskResultsCopy);
    expect(project.executionState.phaseStep).toBe('execute-tasks');
    // 결과는 변경되어야 함
    expect(result.executionState.phaseStep).toBe('materialize');
  });
});

describe('config.execution.maxEscalationAttempts 참조', () => {
  it('config에 maxEscalationAttempts가 존재한다', () => {
    expect(config.execution.maxEscalationAttempts).toBe(3);
  });

  it('maxEscalationAttempts 초과 시 에러를 던진다', () => {
    const state = createInitialExecutionState('auto');
    state.status = 'escalated';
    state.phaseStep = 'quality-gate';
    state.fixAttempt = 2;
    state.pendingEscalation = { reason: 'test' };
    state.escalationCount = config.execution.maxEscalationAttempts;
    const project = {
      id: 'esc-test',
      name: '에스컬레이션 테스트',
      tasks: [{ id: 't1', title: 't1', phase: 1, assignee: 'backend' }],
      executionState: state,
    };
    expect(() =>
      computeStateTransition(project, {
        completedAction: 'escalation-response',
        escalationDecision: 'continue',
      }),
    ).toThrow('에스컬레이션 최대 횟수');
  });
});

describe('유효하지 않은 상태 전이 검증', () => {
  it('execute-tasks에서 quality-gate로 직접 전이 시 에러를 던진다', () => {
    const state = createInitialExecutionState('auto');
    state.phaseStep = 'execute-tasks';
    state.status = 'executing';
    const project = {
      id: 'trans-test',
      name: '전이 테스트',
      tasks: [{ id: 't1', title: 't1', phase: 1, assignee: 'backend' }],
      executionState: state,
    };
    expect(() =>
      computeStateTransition(project, {
        completedAction: 'quality-gate',
        qualityGateResult: { passed: true },
      }),
    ).toThrow('유효하지 않은 상태 전이');
  });
});
