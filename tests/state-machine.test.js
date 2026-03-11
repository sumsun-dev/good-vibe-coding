import { describe, it, expect } from 'vitest';
import {
  PHASE_TRANSITIONS,
  isValidTransition,
  createInitialExecutionState,
  isValidExecutionState,
  getNextExecutionStep,
  computeStateTransition,
} from '../scripts/lib/engine/state-machine.js';
import { config } from '../scripts/lib/core/config.js';

const MAX_FIX = config.execution.maxFixAttempts;
const MAX_ESCALATION = config.execution.maxEscalationAttempts;

// ──────────────── 헬퍼 ────────────────

function makeProject(tasks = [], overrides = {}) {
  return {
    id: 'test-proj',
    name: '테스트',
    tasks,
    executionState: { ...createInitialExecutionState('auto'), ...overrides },
  };
}

function makeTasks(count = 3, phase = 1) {
  return Array.from({ length: count }, (_, i) => ({
    id: `task-${i + 1}`,
    title: `태스크 ${i + 1}`,
    phase,
    assignee: i % 2 === 0 ? 'backend' : 'frontend',
    domain: 'backend',
  }));
}

function makeMultiPhaseTasks(phaseCounts = [3, 2]) {
  const tasks = [];
  for (let p = 0; p < phaseCounts.length; p++) {
    for (let i = 0; i < phaseCounts[p]; i++) {
      tasks.push({
        id: `task-p${p + 1}-${i + 1}`,
        title: `Phase ${p + 1} 태스크 ${i + 1}`,
        phase: p + 1,
        assignee: i % 2 === 0 ? 'backend' : 'frontend',
        domain: 'backend',
      });
    }
  }
  return tasks;
}

/** 한 Phase를 처음부터 commit까지 통과시킨다 (quality-gate passed). */
function advanceThroughPhase(project) {
  let p = project;
  p = computeStateTransition(p, { completedAction: 'execute-tasks', taskResults: [] });
  p = computeStateTransition(p, { completedAction: 'materialize' });
  p = computeStateTransition(p, { completedAction: 'review', reviews: [] });
  p = computeStateTransition(p, {
    completedAction: 'quality-gate',
    qualityGateResult: { passed: true },
  });
  p = computeStateTransition(p, { completedAction: 'commit' });
  p = computeStateTransition(p, { completedAction: 'build-context' });
  return p;
}

// ──────────────── isValidTransition ────────────────

describe('isValidTransition', () => {
  it('PHASE_TRANSITIONS의 모든 유효 전이를 승인한다', () => {
    for (const [from, toList] of Object.entries(PHASE_TRANSITIONS)) {
      for (const to of toList) {
        expect(isValidTransition(from, to)).toBe(true);
      }
    }
  });

  it('유효하지 않은 전이를 거부한다 (execute-tasks → commit)', () => {
    expect(isValidTransition('execute-tasks', 'commit')).toBe(false);
  });

  it('유효하지 않은 전이를 거부한다 (review → fix)', () => {
    expect(isValidTransition('review', 'fix')).toBe(false);
  });

  it('유효하지 않은 전이를 거부한다 (commit → review)', () => {
    expect(isValidTransition('commit', 'review')).toBe(false);
  });

  it('존재하지 않는 from 단계이면 false', () => {
    expect(isValidTransition('unknown-step', 'review')).toBe(false);
  });

  it('존재하지 않는 to 단계이면 false', () => {
    expect(isValidTransition('execute-tasks', 'unknown-step')).toBe(false);
  });

  it('quality-gate에서 commit, fix, escalated 모두 유효하다', () => {
    expect(isValidTransition('quality-gate', 'commit')).toBe(true);
    expect(isValidTransition('quality-gate', 'fix')).toBe(true);
    expect(isValidTransition('quality-gate', 'escalated')).toBe(true);
  });

  it('build-context에서 execute-tasks, completed 모두 유효하다', () => {
    expect(isValidTransition('build-context', 'execute-tasks')).toBe(true);
    expect(isValidTransition('build-context', 'completed')).toBe(true);
  });
});

// ──────────────── createInitialExecutionState ────────────────

describe('createInitialExecutionState', () => {
  it('기본값(interactive) 모드를 설정한다', () => {
    const state = createInitialExecutionState();
    expect(state.mode).toBe('interactive');
  });

  it('auto 모드를 올바르게 설정한다', () => {
    const state = createInitialExecutionState('auto');
    expect(state.mode).toBe('auto');
  });

  it('올바른 초기 필드를 갖는다', () => {
    const state = createInitialExecutionState('auto');
    expect(state.status).toBe('executing');
    expect(state.currentPhase).toBe(1);
    expect(state.phaseStep).toBe('execute-tasks');
    expect(state.fixAttempt).toBe(0);
    expect(state.lastCompletedStep).toBeNull();
    expect(state.completedPhases).toEqual([]);
    expect(state.pendingEscalation).toBeNull();
    expect(state.completedAt).toBeNull();
    expect(state.phaseResults).toEqual({});
    expect(state.journal).toEqual([]);
    expect(state.failureContext).toBeNull();
    expect(state.failureHistory).toEqual([]);
    expect(state.branchName).toBeNull();
  });

  it('startedAt을 ISO 문자열로 설정한다', () => {
    const state = createInitialExecutionState();
    expect(typeof state.startedAt).toBe('string');
    expect(new Date(state.startedAt).toISOString()).toBe(state.startedAt);
  });

  it('알 수 없는 모드는 interactive로 폴백한다', () => {
    const state = createInitialExecutionState('unknown');
    expect(state.mode).toBe('interactive');
  });
});

// ──────────────── isValidExecutionState ────────────────

describe('isValidExecutionState', () => {
  it('유효한 초기 상태는 true', () => {
    expect(isValidExecutionState(createInitialExecutionState())).toBe(true);
  });

  it('null → false', () => {
    expect(isValidExecutionState(null)).toBe(false);
  });

  it('undefined → false', () => {
    expect(isValidExecutionState(undefined)).toBe(false);
  });

  it('문자열 → false', () => {
    expect(isValidExecutionState('invalid')).toBe(false);
  });

  it('유효하지 않은 status → false', () => {
    const state = createInitialExecutionState();
    state.status = 'running';
    expect(isValidExecutionState(state)).toBe(false);
  });

  it('유효하지 않은 phaseStep → false', () => {
    const state = createInitialExecutionState();
    state.phaseStep = 'unknown-step';
    expect(isValidExecutionState(state)).toBe(false);
  });

  it('currentPhase < 1 → false', () => {
    const state = createInitialExecutionState();
    state.currentPhase = 0;
    expect(isValidExecutionState(state)).toBe(false);
  });

  it('currentPhase가 숫자가 아님 → false', () => {
    const state = createInitialExecutionState();
    state.currentPhase = 'one';
    expect(isValidExecutionState(state)).toBe(false);
  });

  it('fixAttempt < 0 → false', () => {
    const state = createInitialExecutionState();
    state.fixAttempt = -1;
    expect(isValidExecutionState(state)).toBe(false);
  });

  it('fixAttempt가 숫자가 아님 → false', () => {
    const state = createInitialExecutionState();
    state.fixAttempt = 'zero';
    expect(isValidExecutionState(state)).toBe(false);
  });

  it('유효하지 않은 mode → false', () => {
    const state = createInitialExecutionState();
    state.mode = 'batch';
    expect(isValidExecutionState(state)).toBe(false);
  });

  it('completedPhases가 배열이 아님 → false', () => {
    const state = createInitialExecutionState();
    state.completedPhases = 'none';
    expect(isValidExecutionState(state)).toBe(false);
  });

  it('fixAttempt > maxFixAttempts → false', () => {
    const state = createInitialExecutionState();
    state.fixAttempt = MAX_FIX + 1;
    expect(isValidExecutionState(state)).toBe(false);
  });

  it('completed 상태에 completedAt 없으면 → false', () => {
    const state = createInitialExecutionState();
    state.status = 'completed';
    state.completedAt = null;
    expect(isValidExecutionState(state)).toBe(false);
  });

  it('completed 상태에 completedAt 있으면 → true', () => {
    const state = createInitialExecutionState();
    state.status = 'completed';
    state.completedAt = new Date().toISOString();
    expect(isValidExecutionState(state)).toBe(true);
  });

  it('escalated 상태에 pendingEscalation 없으면 → false', () => {
    const state = createInitialExecutionState();
    state.status = 'escalated';
    state.pendingEscalation = null;
    expect(isValidExecutionState(state)).toBe(false);
  });

  it('escalated 상태에 pendingEscalation 있으면 → true', () => {
    const state = createInitialExecutionState();
    state.status = 'escalated';
    state.pendingEscalation = { reason: 'test' };
    expect(isValidExecutionState(state)).toBe(true);
  });

  it('completedPhases에 중복이 있으면 → false', () => {
    const state = createInitialExecutionState();
    state.completedPhases = [1, 1, 2];
    expect(isValidExecutionState(state)).toBe(false);
  });

  it('completedPhases에 중복이 없으면 → true', () => {
    const state = createInitialExecutionState();
    state.completedPhases = [1, 2, 3];
    expect(isValidExecutionState(state)).toBe(true);
  });

  it('모든 유효한 status 값을 수용한다', () => {
    const validStatuses = [
      'idle',
      'executing',
      'reviewing',
      'fixing',
      'committing',
      'paused',
      'escalated',
      'completed',
    ];
    for (const status of validStatuses) {
      const state = createInitialExecutionState();
      state.status = status;
      if (status === 'completed') state.completedAt = new Date().toISOString();
      if (status === 'escalated') state.pendingEscalation = { reason: 'test' };
      expect(isValidExecutionState(state)).toBe(true);
    }
  });

  it('모든 유효한 phaseStep 값을 수용한다', () => {
    const validSteps = [
      'execute-tasks',
      'materialize',
      'review',
      'quality-gate',
      'fix',
      'commit',
      'build-context',
    ];
    for (const step of validSteps) {
      const state = createInitialExecutionState();
      state.phaseStep = step;
      expect(isValidExecutionState(state)).toBe(true);
    }
  });
});

// ──────────────── getNextExecutionStep ────────────────

describe('getNextExecutionStep', () => {
  it('executionState null → not-started', () => {
    const project = { id: 'p1', tasks: makeTasks(), executionState: null };
    const result = getNextExecutionStep(project);
    expect(result.action).toBe('not-started');
    expect(result.phase).toBe(0);
  });

  it('completed 상태 → already-completed', () => {
    const project = makeProject(makeTasks(), {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });
    const result = getNextExecutionStep(project);
    expect(result.action).toBe('already-completed');
  });

  it('completed + branchName + PR 없음 → suggest-pr', () => {
    const project = makeProject(makeTasks(), {
      status: 'completed',
      completedAt: new Date().toISOString(),
      branchName: 'gv/test-branch',
    });
    const result = getNextExecutionStep(project);
    expect(result.action).toBe('suggest-pr');
    expect(result.branchName).toBe('gv/test-branch');
  });

  it('completed + branchName + PR 있음 → already-completed', () => {
    const project = {
      ...makeProject(makeTasks(), {
        status: 'completed',
        completedAt: new Date().toISOString(),
        branchName: 'gv/test-branch',
      }),
      pullRequests: [{ url: 'https://github.com/test/pr/1' }],
    };
    const result = getNextExecutionStep(project);
    expect(result.action).toBe('already-completed');
  });

  it('paused 상태 → paused', () => {
    const project = makeProject(makeTasks(), { status: 'paused' });
    const result = getNextExecutionStep(project);
    expect(result.action).toBe('paused');
  });

  it('escalated 상태 → escalate', () => {
    const project = makeProject(makeTasks(), {
      status: 'escalated',
      pendingEscalation: { reason: '수정 2회 실패' },
    });
    const result = getNextExecutionStep(project);
    expect(result.action).toBe('escalate');
    expect(result.context.escalation.reason).toBe('수정 2회 실패');
  });

  it('execute-tasks phaseStep → execute-tasks action', () => {
    const tasks = makeTasks(3, 1);
    const project = makeProject(tasks, { phaseStep: 'execute-tasks' });
    const result = getNextExecutionStep(project);
    expect(result.action).toBe('execute-tasks');
    expect(result.phase).toBe(1);
    expect(result.tasks).toHaveLength(3);
  });

  it('materialize phaseStep → materialize action (코드 태스크만 필터링)', () => {
    const tasks = makeTasks(3, 1);
    const project = makeProject(tasks, { phaseStep: 'materialize' });
    const result = getNextExecutionStep(project);
    expect(result.action).toBe('materialize');
    // backend, frontend는 engineer role이므로 isCodeTask가 true
    expect(result.tasks.length).toBeGreaterThan(0);
  });

  it('review phaseStep → review action', () => {
    const tasks = makeTasks(3, 1);
    const project = makeProject(tasks, { phaseStep: 'review' });
    const result = getNextExecutionStep(project);
    expect(result.action).toBe('review');
    expect(result.tasks).toHaveLength(3);
  });

  it('quality-gate phaseStep → quality-gate action', () => {
    const project = makeProject(makeTasks(), { phaseStep: 'quality-gate' });
    const result = getNextExecutionStep(project);
    expect(result.action).toBe('quality-gate');
  });

  it('fix phaseStep → fix action (fixAttempt 표시 포함)', () => {
    const project = makeProject(makeTasks(), { phaseStep: 'fix', fixAttempt: 1 });
    const result = getNextExecutionStep(project);
    expect(result.action).toBe('fix');
    expect(result.description).toContain('시도 2');
  });

  it('commit phaseStep → commit action', () => {
    const project = makeProject(makeTasks(), { phaseStep: 'commit' });
    const result = getNextExecutionStep(project);
    expect(result.action).toBe('commit');
  });

  it('build-context (마지막 phase, auto 모드) → complete action', () => {
    const tasks = makeTasks(3, 1);
    const project = makeProject(tasks, { phaseStep: 'build-context', mode: 'auto' });
    const result = getNextExecutionStep(project);
    // 1 phase뿐이므로 complete
    expect(result.action).toBe('complete');
  });

  it('build-context (남은 phase, auto 모드) → build-context action', () => {
    const tasks = makeMultiPhaseTasks([3, 2]);
    const project = makeProject(tasks, {
      phaseStep: 'build-context',
      mode: 'auto',
      currentPhase: 1,
    });
    const result = getNextExecutionStep(project);
    expect(result.action).toBe('build-context');
  });

  it('build-context (남은 phase, interactive 모드) → confirm-next-phase action', () => {
    const tasks = makeMultiPhaseTasks([3, 2]);
    const project = makeProject(tasks, {
      phaseStep: 'build-context',
      mode: 'interactive',
      currentPhase: 1,
    });
    const result = getNextExecutionStep(project);
    expect(result.action).toBe('confirm-next-phase');
    expect(result.description).toContain('Phase 2');
  });
});

// ──────────────── computeStateTransition ────────────────

describe('computeStateTransition', () => {
  // ──── 입력 검증 ────

  describe('입력 검증', () => {
    it('stepResult가 null → inputError', () => {
      const project = makeProject(makeTasks());
      expect(() => computeStateTransition(project, null)).toThrow('stepResult');
    });

    it('stepResult가 문자열 → inputError', () => {
      const project = makeProject(makeTasks());
      expect(() => computeStateTransition(project, 'bad')).toThrow('stepResult');
    });

    it('completedAction 누락 → inputError', () => {
      const project = makeProject(makeTasks());
      expect(() => computeStateTransition(project, {})).toThrow('completedAction');
    });

    it('completedAction이 숫자 → inputError', () => {
      const project = makeProject(makeTasks());
      expect(() => computeStateTransition(project, { completedAction: 42 })).toThrow(
        'completedAction',
      );
    });

    it('executionState 누락 → inputError', () => {
      const project = { id: 'p1', tasks: makeTasks(), executionState: null };
      expect(() => computeStateTransition(project, { completedAction: 'execute-tasks' })).toThrow();
    });

    it('알 수 없는 completedAction → inputError', () => {
      const project = makeProject(makeTasks());
      expect(() => computeStateTransition(project, { completedAction: 'unknown-action' })).toThrow(
        'unknown-action',
      );
    });
  });

  // ──── 정상 전이: execute-tasks → materialize ────

  describe('execute-tasks → materialize', () => {
    it('phaseStep을 materialize로 전이한다', () => {
      const project = makeProject(makeTasks());
      const result = computeStateTransition(project, {
        completedAction: 'execute-tasks',
        taskResults: [{ id: 'task-1', status: 'done' }],
      });
      expect(result.executionState.phaseStep).toBe('materialize');
      expect(result.executionState.lastCompletedStep).toBe('execute-tasks');
    });

    it('taskResults를 phaseResults에 저장한다', () => {
      const project = makeProject(makeTasks());
      const taskResults = [{ id: 'task-1', status: 'done' }];
      const result = computeStateTransition(project, {
        completedAction: 'execute-tasks',
        taskResults,
      });
      expect(result.executionState.phaseResults[1].taskResults).toEqual(taskResults);
    });
  });

  // ──── materialize → review ────

  describe('materialize → review', () => {
    it('phaseStep을 review로, status를 reviewing으로 전이한다', () => {
      const project = makeProject(makeTasks(), {
        phaseStep: 'materialize',
        lastCompletedStep: 'execute-tasks',
      });
      const result = computeStateTransition(project, { completedAction: 'materialize' });
      expect(result.executionState.phaseStep).toBe('review');
      expect(result.executionState.status).toBe('reviewing');
      expect(result.executionState.lastCompletedStep).toBe('materialize');
    });
  });

  // ──── review → quality-gate ────

  describe('review → quality-gate', () => {
    it('phaseStep을 quality-gate로 전이한다', () => {
      const project = makeProject(makeTasks(), {
        phaseStep: 'review',
        status: 'reviewing',
        lastCompletedStep: 'materialize',
      });
      const reviews = [{ reviewerId: 'qa', score: 90, issues: [] }];
      const result = computeStateTransition(project, {
        completedAction: 'review',
        reviews,
      });
      expect(result.executionState.phaseStep).toBe('quality-gate');
      expect(result.executionState.lastCompletedStep).toBe('review');
      expect(result.executionState.phaseResults[1].reviews).toEqual(reviews);
    });
  });

  // ──── quality-gate passed → commit ────

  describe('quality-gate passed → commit', () => {
    it('phaseStep을 commit으로, status를 committing으로 전이한다', () => {
      const project = makeProject(makeTasks(), {
        phaseStep: 'quality-gate',
        status: 'reviewing',
        lastCompletedStep: 'review',
      });
      const result = computeStateTransition(project, {
        completedAction: 'quality-gate',
        qualityGateResult: { passed: true },
      });
      expect(result.executionState.phaseStep).toBe('commit');
      expect(result.executionState.status).toBe('committing');
      expect(result.executionState.failureContext).toBeNull();
    });

    it('qualityGateResult를 phaseResults에 저장한다', () => {
      const project = makeProject(makeTasks(), {
        phaseStep: 'quality-gate',
        lastCompletedStep: 'review',
      });
      const qg = { passed: true };
      const result = computeStateTransition(project, {
        completedAction: 'quality-gate',
        qualityGateResult: qg,
      });
      expect(result.executionState.phaseResults[1].qualityGate).toEqual(qg);
    });
  });

  // ──── quality-gate failed (fixAttempt < max) → fix ────

  describe('quality-gate failed (fixAttempt < max) → fix', () => {
    it('phaseStep을 fix로, status를 fixing으로 전이한다', () => {
      const project = makeProject(makeTasks(), {
        phaseStep: 'quality-gate',
        fixAttempt: 0,
        lastCompletedStep: 'review',
      });
      const result = computeStateTransition(project, {
        completedAction: 'quality-gate',
        qualityGateResult: { passed: false, issues: [{ description: 'bug' }] },
      });
      expect(result.executionState.phaseStep).toBe('fix');
      expect(result.executionState.status).toBe('fixing');
      expect(result.executionState.failureContext).not.toBeNull();
    });

    it('failureContext에 issues와 attempt 정보가 담긴다', () => {
      const project = makeProject(makeTasks(), {
        phaseStep: 'quality-gate',
        fixAttempt: 1,
        lastCompletedStep: 'review',
      });
      const result = computeStateTransition(project, {
        completedAction: 'quality-gate',
        qualityGateResult: { passed: false, issues: [{ description: 'security xss' }] },
      });
      expect(result.executionState.failureContext.attempt).toBe(2);
      expect(result.executionState.failureContext.issues).toHaveLength(1);
      expect(result.executionState.failureContext.issues[0].category).toBe('security');
    });
  });

  // ──── quality-gate failed (fixAttempt >= max) → escalated ────

  describe('quality-gate failed (fixAttempt >= max) → escalated', () => {
    it('phaseStep은 quality-gate 유지, status를 escalated로, pendingEscalation을 설정한다', () => {
      const project = makeProject(makeTasks(), {
        phaseStep: 'quality-gate',
        fixAttempt: MAX_FIX,
        lastCompletedStep: 'review',
      });
      const issues = [{ description: 'critical bug', severity: 'critical' }];
      const result = computeStateTransition(project, {
        completedAction: 'quality-gate',
        qualityGateResult: { passed: false, issues },
      });
      expect(result.executionState.status).toBe('escalated');
      expect(result.executionState.pendingEscalation).not.toBeNull();
      expect(result.executionState.pendingEscalation.reason).toContain(`${MAX_FIX}회`);
      expect(result.executionState.pendingEscalation.unresolvedIssues).toEqual(issues);
    });
  });

  // ──── fix → materialize ────

  describe('fix → materialize', () => {
    it('fixAttempt를 증가시키고 phaseStep을 materialize로 전이한다', () => {
      const project = makeProject(makeTasks(), {
        phaseStep: 'fix',
        status: 'fixing',
        fixAttempt: 0,
        lastCompletedStep: 'quality-gate',
        failureContext: {
          issues: [{ description: 'bug', category: 'logic' }],
          attempt: 1,
          maxAttempts: MAX_FIX,
          previousAttempts: [],
        },
      });
      const result = computeStateTransition(project, { completedAction: 'fix' });
      expect(result.executionState.phaseStep).toBe('materialize');
      expect(result.executionState.fixAttempt).toBe(1);
      expect(result.executionState.status).toBe('executing');
      expect(result.executionState.lastCompletedStep).toBe('fix');
    });

    it('failureHistory에 이전 실패 컨텍스트를 누적한다', () => {
      const failureContext = {
        issues: [{ description: 'test failure', category: 'test' }],
        attempt: 1,
        maxAttempts: MAX_FIX,
        previousAttempts: [],
      };
      const project = makeProject(makeTasks(), {
        phaseStep: 'fix',
        status: 'fixing',
        fixAttempt: 0,
        lastCompletedStep: 'quality-gate',
        failureContext,
        failureHistory: [],
      });
      const result = computeStateTransition(project, { completedAction: 'fix' });
      expect(result.executionState.failureHistory).toHaveLength(1);
      expect(result.executionState.failureHistory[0].attempt).toBe(1);
      expect(result.executionState.failureHistory[0].issues).toEqual(failureContext.issues);
    });

    it('failureContext가 null이면 failureHistory에 추가하지 않는다', () => {
      const project = makeProject(makeTasks(), {
        phaseStep: 'fix',
        status: 'fixing',
        fixAttempt: 0,
        lastCompletedStep: 'quality-gate',
        failureContext: null,
        failureHistory: [],
      });
      const result = computeStateTransition(project, { completedAction: 'fix' });
      expect(result.executionState.failureHistory).toHaveLength(0);
    });
  });

  // ──── commit → build-context ────

  describe('commit → build-context', () => {
    it('phaseStep을 build-context로 전이하고 committed를 true로 설정한다', () => {
      const project = makeProject(makeTasks(), {
        phaseStep: 'commit',
        status: 'committing',
        lastCompletedStep: 'quality-gate',
      });
      const result = computeStateTransition(project, { completedAction: 'commit' });
      expect(result.executionState.phaseStep).toBe('build-context');
      expect(result.executionState.status).toBe('executing');
      expect(result.executionState.lastCompletedStep).toBe('commit');
      expect(result.executionState.phaseResults[1].committed).toBe(true);
    });
  });

  // ──── build-context (마지막 phase) → completed ────

  describe('build-context (마지막 phase) → completed', () => {
    it('status를 completed로, completedAt을 설정한다', () => {
      const tasks = makeTasks(3, 1); // 1 phase only
      const project = makeProject(tasks, {
        phaseStep: 'build-context',
        lastCompletedStep: 'commit',
        currentPhase: 1,
      });
      const result = computeStateTransition(project, { completedAction: 'build-context' });
      expect(result.executionState.status).toBe('completed');
      expect(result.executionState.completedAt).not.toBeNull();
      expect(result.executionState.completedPhases).toContain(1);
    });
  });

  // ──── build-context (남은 phase) → 다음 phase ────

  describe('build-context (남은 phase) → 다음 phase', () => {
    it('currentPhase를 증가시키고 fixAttempt를 리셋한다', () => {
      const tasks = makeMultiPhaseTasks([3, 2]);
      const project = makeProject(tasks, {
        phaseStep: 'build-context',
        lastCompletedStep: 'commit',
        currentPhase: 1,
        fixAttempt: 1,
      });
      const result = computeStateTransition(project, { completedAction: 'build-context' });
      expect(result.executionState.currentPhase).toBe(2);
      expect(result.executionState.phaseStep).toBe('execute-tasks');
      expect(result.executionState.fixAttempt).toBe(0);
      expect(result.executionState.status).toBe('executing');
      expect(result.executionState.completedPhases).toContain(1);
    });
  });

  // ──── escalation-response ────

  describe('escalation-response', () => {
    function makeEscalatedProject() {
      return makeProject(makeTasks(), {
        phaseStep: 'quality-gate',
        status: 'escalated',
        fixAttempt: MAX_FIX,
        lastCompletedStep: 'quality-gate',
        pendingEscalation: { reason: 'test', unresolvedIssues: [], failureHistory: [] },
      });
    }

    it('continue → fix로 전이, fixAttempt 리셋', () => {
      const project = makeEscalatedProject();
      const result = computeStateTransition(project, {
        completedAction: 'escalation-response',
        escalationDecision: 'continue',
      });
      expect(result.executionState.phaseStep).toBe('fix');
      expect(result.executionState.status).toBe('fixing');
      expect(result.executionState.fixAttempt).toBe(0);
      expect(result.executionState.pendingEscalation).toBeNull();
    });

    it('skip → commit으로 전이', () => {
      const project = makeEscalatedProject();
      const result = computeStateTransition(project, {
        completedAction: 'escalation-response',
        escalationDecision: 'skip',
      });
      expect(result.executionState.phaseStep).toBe('commit');
      expect(result.executionState.status).toBe('committing');
      expect(result.executionState.pendingEscalation).toBeNull();
    });

    it('abort → paused', () => {
      const project = makeEscalatedProject();
      const result = computeStateTransition(project, {
        completedAction: 'escalation-response',
        escalationDecision: 'abort',
      });
      expect(result.executionState.status).toBe('paused');
    });

    it('알 수 없는 escalationDecision → inputError', () => {
      const project = makeEscalatedProject();
      expect(() =>
        computeStateTransition(project, {
          completedAction: 'escalation-response',
          escalationDecision: 'retry',
        }),
      ).toThrow('retry');
    });

    it('continue 횟수가 maxEscalationAttempts 초과 시 inputError', () => {
      const project = makeEscalatedProject();
      project.executionState.escalationCount = MAX_ESCALATION;
      expect(() =>
        computeStateTransition(project, {
          completedAction: 'escalation-response',
          escalationDecision: 'continue',
        }),
      ).toThrow(`${MAX_ESCALATION}`);
    });

    it('continue로 escalationCount가 1씩 증가한다', () => {
      const project = makeEscalatedProject();
      const result = computeStateTransition(project, {
        completedAction: 'escalation-response',
        escalationDecision: 'continue',
      });
      expect(result.executionState.escalationCount).toBe(1);
    });
  });

  // ──── interactive 모드에서 build-context → confirm-next-phase ────

  describe('interactive 모드에서 build-context', () => {
    it('getNextExecutionStep에서 confirm-next-phase를 반환한다', () => {
      const tasks = makeMultiPhaseTasks([2, 2]);
      const project = makeProject(tasks, {
        phaseStep: 'build-context',
        mode: 'interactive',
        currentPhase: 1,
        lastCompletedStep: 'commit',
      });
      // computeStateTransition은 build-context를 처리하지만
      // interactive/auto 구분은 getNextExecutionStep에서 일어난다
      const step = getNextExecutionStep(project);
      expect(step.action).toBe('confirm-next-phase');
    });
  });

  // ──── 저널 기록 ────

  describe('저널 기록', () => {
    it('각 전이마다 journal에 엔트리를 추가한다', () => {
      const project = makeProject(makeTasks());
      const result = computeStateTransition(project, {
        completedAction: 'execute-tasks',
        taskResults: [],
      });
      expect(result.executionState.journal).toHaveLength(1);
      const entry = result.executionState.journal[0];
      expect(entry.action).toBe('execute-tasks');
      expect(entry.fromStep).toBe('execute-tasks');
      expect(entry.toStep).toBe('materialize');
      expect(entry.timestamp).toBeDefined();
    });

    it('quality-gate 실패 시 failureSummary가 저널에 포함된다', () => {
      const project = makeProject(makeTasks(), {
        phaseStep: 'quality-gate',
        fixAttempt: 0,
        lastCompletedStep: 'review',
      });
      const result = computeStateTransition(project, {
        completedAction: 'quality-gate',
        qualityGateResult: {
          passed: false,
          issues: [
            { description: 'security xss vulnerability', severity: 'critical' },
            { description: 'test coverage low', severity: 'important' },
          ],
        },
      });
      const entry = result.executionState.journal[0];
      expect(entry.failureSummary).toBeDefined();
      expect(entry.failureSummary.issueCount).toBe(2);
      expect(entry.failureSummary.categories).toContain('security');
    });

    it('fix 전이 시 fixAttempt가 저널에 기록된다', () => {
      const project = makeProject(makeTasks(), {
        phaseStep: 'fix',
        status: 'fixing',
        fixAttempt: 0,
        lastCompletedStep: 'quality-gate',
        failureContext: {
          issues: [{ description: 'bug', category: 'logic' }],
          attempt: 1,
          maxAttempts: MAX_FIX,
          previousAttempts: [],
        },
      });
      const result = computeStateTransition(project, { completedAction: 'fix' });
      const entry = result.executionState.journal[0];
      expect(entry.fixAttempt).toBe(1);
    });

    it('연속 전이 시 저널이 누적된다', () => {
      let project = makeProject(makeTasks());
      project = computeStateTransition(project, {
        completedAction: 'execute-tasks',
        taskResults: [],
      });
      expect(project.executionState.journal).toHaveLength(1);
      project = computeStateTransition(project, { completedAction: 'materialize' });
      expect(project.executionState.journal).toHaveLength(2);
      project = computeStateTransition(project, { completedAction: 'review', reviews: [] });
      expect(project.executionState.journal).toHaveLength(3);
    });
  });

  // ──── 불변성 보장 ────

  describe('불변성 보장', () => {
    it('원본 project가 변경되지 않는다', () => {
      const project = makeProject(makeTasks());
      const originalState = JSON.parse(JSON.stringify(project.executionState));
      computeStateTransition(project, { completedAction: 'execute-tasks', taskResults: [] });
      expect(project.executionState).toEqual(originalState);
    });

    it('원본 journal 배열이 변경되지 않는다', () => {
      const project = makeProject(makeTasks());
      const originalJournal = project.executionState.journal;
      computeStateTransition(project, { completedAction: 'execute-tasks', taskResults: [] });
      expect(originalJournal).toHaveLength(0);
    });

    it('원본 completedPhases 배열이 변경되지 않는다', () => {
      const tasks = makeTasks(3, 1);
      const project = makeProject(tasks, {
        phaseStep: 'build-context',
        lastCompletedStep: 'commit',
        currentPhase: 1,
      });
      const originalPhases = project.executionState.completedPhases;
      computeStateTransition(project, { completedAction: 'build-context' });
      expect(originalPhases).toHaveLength(0);
    });

    it('원본 failureHistory 배열이 변경되지 않는다', () => {
      const project = makeProject(makeTasks(), {
        phaseStep: 'fix',
        status: 'fixing',
        fixAttempt: 0,
        lastCompletedStep: 'quality-gate',
        failureContext: {
          issues: [{ description: 'bug', category: 'logic' }],
          attempt: 1,
          maxAttempts: MAX_FIX,
          previousAttempts: [],
        },
        failureHistory: [],
      });
      const originalHistory = project.executionState.failureHistory;
      computeStateTransition(project, { completedAction: 'fix' });
      expect(originalHistory).toHaveLength(0);
    });
  });

  // ──── 유효하지 않은 상태 전이 ────

  describe('유효하지 않은 상태 전이', () => {
    it('execute-tasks에서 commit을 시도하면 inputError', () => {
      const project = makeProject(makeTasks(), { phaseStep: 'execute-tasks' });
      expect(() => computeStateTransition(project, { completedAction: 'commit' })).toThrow();
    });

    it('review에서 commit을 시도하면 inputError', () => {
      const project = makeProject(makeTasks(), {
        phaseStep: 'review',
        status: 'reviewing',
        lastCompletedStep: 'materialize',
      });
      expect(() => computeStateTransition(project, { completedAction: 'commit' })).toThrow();
    });
  });

  // ──── 전체 Phase 사이클 ────

  describe('전체 Phase 사이클', () => {
    it('1-phase 프로젝트: execute → materialize → review → quality-gate → commit → build-context → completed', () => {
      const tasks = makeTasks(3, 1);
      const project = makeProject(tasks);
      const result = advanceThroughPhase(project);
      expect(result.executionState.status).toBe('completed');
      expect(result.executionState.completedAt).not.toBeNull();
      expect(result.executionState.completedPhases).toEqual([1]);
      expect(result.executionState.journal).toHaveLength(6);
    });

    it('2-phase 프로젝트: 두 Phase를 모두 통과하면 completed', () => {
      const tasks = makeMultiPhaseTasks([3, 2]);
      let project = makeProject(tasks);

      // Phase 1
      project = advanceThroughPhase(project);
      expect(project.executionState.status).toBe('executing');
      expect(project.executionState.currentPhase).toBe(2);
      expect(project.executionState.completedPhases).toEqual([1]);

      // Phase 2
      project = advanceThroughPhase(project);
      expect(project.executionState.status).toBe('completed');
      expect(project.executionState.completedPhases).toEqual([1, 2]);
      expect(project.executionState.journal).toHaveLength(12);
    });

    it('fix 사이클: quality-gate 실패 → fix → materialize → review → quality-gate 통과', () => {
      const tasks = makeTasks(3, 1);
      let project = makeProject(tasks);

      // execute-tasks → materialize → review
      project = computeStateTransition(project, {
        completedAction: 'execute-tasks',
        taskResults: [],
      });
      project = computeStateTransition(project, { completedAction: 'materialize' });
      project = computeStateTransition(project, { completedAction: 'review', reviews: [] });

      // quality-gate 실패
      project = computeStateTransition(project, {
        completedAction: 'quality-gate',
        qualityGateResult: { passed: false, issues: [{ description: 'bug found' }] },
      });
      expect(project.executionState.phaseStep).toBe('fix');
      expect(project.executionState.status).toBe('fixing');

      // fix → materialize → review → quality-gate 통과
      project = computeStateTransition(project, { completedAction: 'fix' });
      expect(project.executionState.fixAttempt).toBe(1);

      project = computeStateTransition(project, { completedAction: 'materialize' });
      project = computeStateTransition(project, { completedAction: 'review', reviews: [] });
      project = computeStateTransition(project, {
        completedAction: 'quality-gate',
        qualityGateResult: { passed: true },
      });
      expect(project.executionState.phaseStep).toBe('commit');
      expect(project.executionState.status).toBe('committing');
    });

    it('escalation 사이클: 2회 fix 실패 → escalated → continue → fix → 통과', () => {
      const tasks = makeTasks(3, 1);
      let project = makeProject(tasks);

      // execute → materialize → review
      project = computeStateTransition(project, {
        completedAction: 'execute-tasks',
        taskResults: [],
      });
      project = computeStateTransition(project, { completedAction: 'materialize' });
      project = computeStateTransition(project, { completedAction: 'review', reviews: [] });

      // quality-gate 실패 #1
      project = computeStateTransition(project, {
        completedAction: 'quality-gate',
        qualityGateResult: { passed: false, issues: [{ description: 'bug 1' }] },
      });
      // fix #1
      project = computeStateTransition(project, { completedAction: 'fix' });
      project = computeStateTransition(project, { completedAction: 'materialize' });
      project = computeStateTransition(project, { completedAction: 'review', reviews: [] });

      // quality-gate 실패 #2
      project = computeStateTransition(project, {
        completedAction: 'quality-gate',
        qualityGateResult: { passed: false, issues: [{ description: 'bug 2' }] },
      });
      // fix #2
      project = computeStateTransition(project, { completedAction: 'fix' });
      project = computeStateTransition(project, { completedAction: 'materialize' });
      project = computeStateTransition(project, { completedAction: 'review', reviews: [] });

      // quality-gate 실패 #3 → fixAttempt(2) >= MAX_FIX(2) → escalated
      project = computeStateTransition(project, {
        completedAction: 'quality-gate',
        qualityGateResult: { passed: false, issues: [{ description: 'bug 3' }] },
      });
      expect(project.executionState.status).toBe('escalated');
      expect(project.executionState.pendingEscalation).not.toBeNull();

      // CEO가 continue 결정
      project = computeStateTransition(project, {
        completedAction: 'escalation-response',
        escalationDecision: 'continue',
      });
      expect(project.executionState.status).toBe('fixing');
      expect(project.executionState.fixAttempt).toBe(0);

      // fix → materialize → review → quality-gate 통과
      project = computeStateTransition(project, { completedAction: 'fix' });
      project = computeStateTransition(project, { completedAction: 'materialize' });
      project = computeStateTransition(project, { completedAction: 'review', reviews: [] });
      project = computeStateTransition(project, {
        completedAction: 'quality-gate',
        qualityGateResult: { passed: true },
      });
      expect(project.executionState.phaseStep).toBe('commit');
      expect(project.executionState.status).toBe('committing');
    });
  });

  // ──── failureHistory 누적 확인 ────

  describe('failureHistory 누적', () => {
    it('여러 번의 fix를 거치면 failureHistory가 순서대로 누적된다', () => {
      const tasks = makeTasks(3, 1);
      let project = makeProject(tasks);

      // execute → materialize → review
      project = computeStateTransition(project, {
        completedAction: 'execute-tasks',
        taskResults: [],
      });
      project = computeStateTransition(project, { completedAction: 'materialize' });
      project = computeStateTransition(project, { completedAction: 'review', reviews: [] });

      // quality-gate 실패 #1
      project = computeStateTransition(project, {
        completedAction: 'quality-gate',
        qualityGateResult: { passed: false, issues: [{ description: 'first bug' }] },
      });
      project = computeStateTransition(project, { completedAction: 'fix' });
      expect(project.executionState.failureHistory).toHaveLength(1);
      expect(project.executionState.failureHistory[0].attempt).toBe(1);

      // materialize → review → quality-gate 실패 #2
      project = computeStateTransition(project, { completedAction: 'materialize' });
      project = computeStateTransition(project, { completedAction: 'review', reviews: [] });
      project = computeStateTransition(project, {
        completedAction: 'quality-gate',
        qualityGateResult: { passed: false, issues: [{ description: 'second bug' }] },
      });
      project = computeStateTransition(project, { completedAction: 'fix' });
      expect(project.executionState.failureHistory).toHaveLength(2);
      expect(project.executionState.failureHistory[1].attempt).toBe(2);
    });
  });

  // ──── Phase 넘어갈 때 fixAttempt 리셋 ────

  describe('Phase 넘어갈 때 fixAttempt 리셋', () => {
    it('build-context에서 다음 Phase로 이동하면 fixAttempt가 0이 된다', () => {
      const tasks = makeMultiPhaseTasks([2, 2]);
      let project = makeProject(tasks, { fixAttempt: 1 });

      // Phase 1 통과
      project = advanceThroughPhase(project);
      expect(project.executionState.currentPhase).toBe(2);
      expect(project.executionState.fixAttempt).toBe(0);
    });
  });

  // ──── phaseResults 초기화/유지 ────

  describe('phaseResults 관리', () => {
    it('새 Phase 시작 시 phaseResults가 올바르게 초기화된다', () => {
      const tasks = makeTasks(3, 1);
      const project = makeProject(tasks);
      const result = computeStateTransition(project, {
        completedAction: 'execute-tasks',
        taskResults: [{ id: 'task-1' }],
      });
      expect(result.executionState.phaseResults[1]).toBeDefined();
      expect(result.executionState.phaseResults[1].taskResults).toEqual([{ id: 'task-1' }]);
      expect(result.executionState.phaseResults[1].reviews).toEqual([]);
      expect(result.executionState.phaseResults[1].qualityGate).toBeNull();
      expect(result.executionState.phaseResults[1].committed).toBe(false);
    });

    it('기존 phaseResults가 있으면 보존된다', () => {
      const tasks = makeTasks(3, 1);
      const project = makeProject(tasks, {
        phaseStep: 'review',
        status: 'reviewing',
        lastCompletedStep: 'materialize',
        phaseResults: {
          1: {
            taskResults: [{ id: 'task-1' }],
            reviews: [],
            qualityGate: null,
            committed: false,
          },
        },
      });
      const reviews = [{ reviewerId: 'qa', score: 85 }];
      const result = computeStateTransition(project, {
        completedAction: 'review',
        reviews,
      });
      // 기존 taskResults 보존
      expect(result.executionState.phaseResults[1].taskResults).toEqual([{ id: 'task-1' }]);
      // 새 reviews 추가
      expect(result.executionState.phaseResults[1].reviews).toEqual(reviews);
    });
  });
});

// ──────────────── parallelGroups 지원 테스트 ────────────────

describe('createInitialExecutionState — parallelGroups 필드', () => {
  it('activePhases와 parallelGroups 초기값이 포함된다', () => {
    const state = createInitialExecutionState('auto');
    expect(state.activePhases).toEqual([]);
    expect(state.parallelGroups).toBeNull();
  });

  it('parallelGroups 옵션이 있으면 activePhases가 첫 tier로 세팅된다', () => {
    const state = createInitialExecutionState('auto', {
      parallelGroups: [[1], [2, 3], [4]],
    });
    expect(state.parallelGroups).toEqual([[1], [2, 3], [4]]);
    expect(state.activePhases).toEqual([1]);
  });

  it('parallelGroups 옵션의 첫 tier에 복수 Phase가 있으면 activePhases에 모두 포함된다', () => {
    const state = createInitialExecutionState('auto', {
      parallelGroups: [[1, 2], [3]],
    });
    expect(state.activePhases).toEqual([1, 2]);
  });
});

describe('handleBuildContext — parallelGroups가 null이면 기존 순차 실행', () => {
  it('parallelGroups 없이 Phase 1 완료 시 currentPhase가 2가 된다', () => {
    const tasks = makeMultiPhaseTasks([2, 2]);
    const project = makeProject(tasks);
    // Phase 1 통과
    const result = advanceThroughPhase(project);
    expect(result.executionState.parallelGroups).toBeNull();
    expect(result.executionState.currentPhase).toBe(2);
    expect(result.executionState.status).toBe('executing');
  });

  it('parallelGroups 없이 마지막 Phase 완료 시 completed가 된다', () => {
    const tasks = makeTasks(2, 1);
    const project = makeProject(tasks);
    const result = advanceThroughPhase(project);
    expect(result.executionState.status).toBe('completed');
    expect(result.executionState.completedAt).toBeTruthy();
  });
});

describe('handleBuildContext — parallelGroups가 있으면 다음 tier 세팅', () => {
  it('Phase 1 완료 시 다음 tier([2,3])가 activePhases에 세팅된다', () => {
    // parallelGroups: [[1], [2, 3]] — Phase 1 완료 후 Phase 2,3이 activePhases에 세팅
    const tasks = [...makeTasks(2, 1), ...makeTasks(2, 2), ...makeTasks(2, 3)];
    const project = makeProject(tasks, {
      parallelGroups: [[1], [2, 3]],
    });
    const result = advanceThroughPhase(project);
    expect(result.executionState.activePhases).toEqual(expect.arrayContaining([2, 3]));
    expect(result.executionState.currentPhase).toBe(2);
    expect(result.executionState.status).toBe('executing');
  });

  it('모든 tier의 Phase가 완료되면 completed가 된다', () => {
    // parallelGroups: [[1], [2]] — Phase 1, 2 순서로 완료
    const tasks = [...makeTasks(2, 1), ...makeTasks(2, 2)];
    let project = makeProject(tasks, {
      parallelGroups: [[1], [2]],
    });
    // Phase 1 통과
    project = advanceThroughPhase(project);
    expect(project.executionState.status).toBe('executing');
    expect(project.executionState.activePhases).toEqual([2]);

    // Phase 2 통과
    project = advanceThroughPhase(project);
    expect(project.executionState.status).toBe('completed');
    expect(project.executionState.completedAt).toBeTruthy();
  });

  it('parallelGroups 3 tier: [[1],[2,3],[4]] 전체 통과', () => {
    const tasks = [...makeTasks(1, 1), ...makeTasks(1, 2), ...makeTasks(1, 3), ...makeTasks(1, 4)];
    let project = makeProject(tasks, {
      parallelGroups: [[1], [2, 3], [4]],
    });

    // Phase 1 완료 → activePhases = [2,3]
    project = advanceThroughPhase(project);
    expect(project.executionState.activePhases).toEqual(expect.arrayContaining([2, 3]));

    // Phase 2 완료 → activePhases에 3이 남아있음
    project = advanceThroughPhase(project);
    expect(project.executionState.completedPhases).toContain(2);
    // Phase 3이 아직 미완료이므로 status는 executing
    expect(project.executionState.status).toBe('executing');

    // Phase 3 완료 → activePhases 소진, 다음 tier [4] 세팅
    project = advanceThroughPhase(project);
    expect(project.executionState.activePhases).toEqual([4]);

    // Phase 4 완료 → 전체 완료
    project = advanceThroughPhase(project);
    expect(project.executionState.status).toBe('completed');
  });
});

describe('getNextExecutionStep — build-context에서 parallelGroups가 있으면 complete 단축 반환 방지', () => {
  it('parallelGroups가 없고 마지막 Phase면 complete를 반환한다', () => {
    const tasks = makeTasks(2, 1);
    const project = makeProject(tasks, {
      phaseStep: 'build-context',
      currentPhase: 1,
    });
    const step = getNextExecutionStep(project);
    expect(step.action).toBe('complete');
  });

  it('parallelGroups가 있으면 마지막 Phase 번호여도 build-context를 반환한다', () => {
    const tasks = [...makeTasks(1, 1), ...makeTasks(1, 2), ...makeTasks(1, 3)];
    const project = makeProject(tasks, {
      phaseStep: 'build-context',
      currentPhase: 3,
      completedPhases: [1, 2],
      activePhases: [3],
      parallelGroups: [[1], [2, 3]],
    });
    const step = getNextExecutionStep(project);
    // parallelGroups가 있으므로 complete가 아닌 build-context (auto 모드)
    expect(step.action).toBe('build-context');
  });
});

describe('getNextExecutionStep — activePhases 지원', () => {
  it('activePhases가 있을 때 첫 번째 미완료 Phase의 태스크를 반환한다', () => {
    const tasks = [...makeTasks(2, 1), ...makeTasks(2, 2), ...makeTasks(2, 3)];
    const project = makeProject(tasks, {
      completedPhases: [1],
      activePhases: [2, 3],
      parallelGroups: [[1], [2, 3]],
      currentPhase: 2,
    });
    const step = getNextExecutionStep(project);
    expect(step.action).toBe('execute-tasks');
    expect(step.phase).toBe(2);
    expect(step.tasks.length).toBe(2);
  });

  it('activePhases의 모든 Phase가 완료되면 첫 번째 미완료를 올바르게 찾는다', () => {
    const tasks = [...makeTasks(2, 1), ...makeTasks(2, 2), ...makeTasks(2, 3)];
    // Phase 2 완료, Phase 3 미완료
    const project = makeProject(tasks, {
      completedPhases: [1, 2],
      activePhases: [2, 3],
      parallelGroups: [[1], [2, 3]],
      currentPhase: 3,
    });
    const step = getNextExecutionStep(project);
    expect(step.action).toBe('execute-tasks');
    expect(step.phase).toBe(3);
  });
});

// ──────────────── 병렬 Phase (targetPhase + phaseStates) ────────────────

describe('getNextExecutionStep — targetPhase 병렬 실행', () => {
  it('targetPhase로 특정 Phase의 상태를 조회한다', () => {
    const tasks = [...makeTasks(2, 1), ...makeTasks(2, 2)];
    const project = makeProject(tasks, {
      activePhases: [1, 2],
      parallelGroups: [[1, 2]],
      phaseStates: {
        1: { phaseStep: 'review', fixAttempt: 0 },
        2: { phaseStep: 'execute-tasks', fixAttempt: 0 },
      },
    });
    const step1 = getNextExecutionStep(project, 1);
    expect(step1.action).toBe('review');
    expect(step1.phase).toBe(1);

    const step2 = getNextExecutionStep(project, 2);
    expect(step2.action).toBe('execute-tasks');
    expect(step2.phase).toBe(2);
  });

  it('targetPhase 없이 호출하면 공유 상태를 사용한다 (하위 호환)', () => {
    const tasks = [...makeTasks(2, 1), ...makeTasks(2, 2)];
    const project = makeProject(tasks, {
      phaseStep: 'review',
      activePhases: [1, 2],
      parallelGroups: [[1, 2]],
      phaseStates: {
        1: { phaseStep: 'materialize', fixAttempt: 0 },
        2: { phaseStep: 'execute-tasks', fixAttempt: 0 },
      },
    });
    // targetPhase 없이 호출 → 공유 state.phaseStep('review') 사용
    const step = getNextExecutionStep(project);
    expect(step.action).toBe('review');
  });
});

describe('computeStateTransition — stepResult.phase 병렬 전이', () => {
  it('stepResult.phase로 특정 Phase만 전이한다', () => {
    const tasks = [...makeTasks(2, 1), ...makeTasks(2, 2)];
    const project = makeProject(tasks, {
      activePhases: [1, 2],
      parallelGroups: [[1, 2]],
      phaseStates: {
        1: { phaseStep: 'execute-tasks', fixAttempt: 0 },
        2: { phaseStep: 'execute-tasks', fixAttempt: 0 },
      },
    });

    // Phase 1만 execute-tasks → materialize 전이
    const updated = computeStateTransition(project, {
      completedAction: 'execute-tasks',
      taskResults: [],
      phase: 1,
    });

    // Phase 1은 materialize로 전이
    expect(updated.executionState.phaseStates[1].phaseStep).toBe('materialize');
    // Phase 2는 그대로 execute-tasks
    expect(updated.executionState.phaseStates[2].phaseStep).toBe('execute-tasks');
  });

  it('Phase 2를 독립적으로 전이할 수 있다', () => {
    const tasks = [...makeTasks(2, 1), ...makeTasks(2, 2)];
    const project = makeProject(tasks, {
      activePhases: [1, 2],
      parallelGroups: [[1, 2]],
      phaseStates: {
        1: { phaseStep: 'review', fixAttempt: 0 },
        2: { phaseStep: 'execute-tasks', fixAttempt: 0 },
      },
    });

    const updated = computeStateTransition(project, {
      completedAction: 'execute-tasks',
      taskResults: [],
      phase: 2,
    });

    // Phase 1 그대로
    expect(updated.executionState.phaseStates[1].phaseStep).toBe('review');
    // Phase 2만 전이
    expect(updated.executionState.phaseStates[2].phaseStep).toBe('materialize');
  });

  it('같은 Tier의 모든 Phase가 build-context를 완료하면 다음 Tier로 전이한다', () => {
    const tasks = [...makeTasks(1, 1), ...makeTasks(1, 2), ...makeTasks(1, 3)];
    const project = makeProject(tasks, {
      activePhases: [1, 2],
      parallelGroups: [[1, 2], [3]],
      completedPhases: [1],
      phaseStates: {
        1: { phaseStep: 'build-context', fixAttempt: 0 },
        2: { phaseStep: 'build-context', fixAttempt: 0 },
      },
      currentPhase: 2,
      phaseStep: 'build-context',
    });

    // Phase 2의 build-context 완료 → Phase 1도 이미 완료 → 다음 Tier [3]으로
    const updated = computeStateTransition(project, {
      completedAction: 'build-context',
      phase: 2,
    });

    expect(updated.executionState.completedPhases).toContain(2);
    expect(updated.executionState.activePhases).toEqual([3]);
    expect(updated.executionState.phaseStates[3]).toEqual({
      phaseStep: 'execute-tasks',
      fixAttempt: 0,
    });
  });

  it('Tier 내 일부 Phase만 완료되면 같은 Tier에 머문다', () => {
    const tasks = [...makeTasks(1, 1), ...makeTasks(1, 2), ...makeTasks(1, 3)];
    const project = makeProject(tasks, {
      activePhases: [1, 2],
      parallelGroups: [[1, 2], [3]],
      completedPhases: [],
      phaseStates: {
        1: { phaseStep: 'build-context', fixAttempt: 0 },
        2: { phaseStep: 'review', fixAttempt: 0 },
      },
      currentPhase: 1,
      phaseStep: 'build-context',
    });

    // Phase 1 build-context 완료, Phase 2는 아직 진행 중
    const updated = computeStateTransition(project, {
      completedAction: 'build-context',
      phase: 1,
    });

    expect(updated.executionState.completedPhases).toEqual([1]);
    // Phase 2가 아직 남아있으므로 같은 Tier
    expect(updated.executionState.activePhases).toEqual([2]);
    // Phase 2의 상태는 보존
    expect(updated.executionState.phaseStates[2].phaseStep).toBe('review');
  });
});
