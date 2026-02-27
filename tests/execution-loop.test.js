import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'fs/promises';
import { resolve } from 'path';
import {
  createInitialExecutionState,
  isValidExecutionState,
  getNextExecutionStep,
  advanceExecution,
  initExecution,
  getExecutionSummary,
  PHASE_TRANSITIONS,
  isValidTransition,
} from '../scripts/lib/execution-loop.js';
import {
  createProject,
  addProjectTasks,
  updateProjectStatus,
  getProject,
  setBaseDir,
} from '../scripts/lib/project-manager.js';

const TMP_DIR = resolve('.tmp-test-execution-loop');

// 테스트용 프로젝트 + 태스크 헬퍼
async function createTestProject(phases = 2) {
  const project = await createProject('테스트', 'web-app', '설명', { mode: 'plan-execute' });
  const tasks = [];
  for (let p = 1; p <= phases; p++) {
    tasks.push({
      id: `task-${p}-1`,
      title: `Phase ${p} 구현`,
      assignee: 'backend',
      description: `Phase ${p} 백엔드 구현`,
      phase: p,
      status: 'pending',
    });
    tasks.push({
      id: `task-${p}-2`,
      title: `Phase ${p} 설계`,
      assignee: 'cto',
      description: `Phase ${p} 아키텍처 설계`,
      phase: p,
      status: 'pending',
    });
  }
  await addProjectTasks(project.id, tasks);
  await updateProjectStatus(project.id, 'approved');
  return getProject(project.id);
}

beforeEach(async () => {
  await mkdir(TMP_DIR, { recursive: true });
  setBaseDir(TMP_DIR);
});

afterEach(async () => {
  await rm(TMP_DIR, { recursive: true, force: true });
});

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
});

// === IO 함수 테스트 (통합) ===

describe('initExecution', () => {
  it('새 실행을 초기화한다', async () => {
    const project = await createTestProject();
    const result = await initExecution(project.id, { mode: 'interactive' });

    expect(result.resumed).toBe(false);
    expect(result.project.executionState.status).toBe('executing');
    expect(result.project.executionState.mode).toBe('interactive');
    expect(result.nextStep.action).toBe('execute-tasks');
  });

  it('auto 모드로 초기화한다', async () => {
    const project = await createTestProject();
    const result = await initExecution(project.id, { mode: 'auto' });
    expect(result.project.executionState.mode).toBe('auto');
  });

  it('resume=true로 기존 상태를 재개한다', async () => {
    const project = await createTestProject();
    await initExecution(project.id, { mode: 'interactive' });

    // review 단계로 진행
    await advanceExecution(project.id, { completedAction: 'execute-tasks', taskResults: [] });
    await advanceExecution(project.id, { completedAction: 'materialize' });

    // 재개
    const result = await initExecution(project.id, { mode: 'interactive', resume: true });
    expect(result.resumed).toBe(true);
    expect(result.nextStep.action).toBe('review');
  });

  it('resume=false면 기존 상태를 초기화한다', async () => {
    const project = await createTestProject();
    await initExecution(project.id, { mode: 'interactive' });
    await advanceExecution(project.id, { completedAction: 'execute-tasks', taskResults: [] });

    const result = await initExecution(project.id, { mode: 'interactive', resume: false });
    expect(result.resumed).toBe(false);
    expect(result.nextStep.action).toBe('execute-tasks');
  });

  it('paused 상태를 resume하면 executing으로 복원한다', async () => {
    const project = await createTestProject();
    await initExecution(project.id, { mode: 'interactive' });

    // escalated → abort → paused
    await advanceExecution(project.id, { completedAction: 'execute-tasks', taskResults: [] });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review', reviews: [] });
    // fixAttempt 2회까지 채우기
    await advanceExecution(project.id, { completedAction: 'quality-gate', qualityGateResult: { passed: false, issues: ['bug'] } });
    await advanceExecution(project.id, { completedAction: 'fix' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review', reviews: [] });
    await advanceExecution(project.id, { completedAction: 'quality-gate', qualityGateResult: { passed: false, issues: ['bug'] } });
    await advanceExecution(project.id, { completedAction: 'fix' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review', reviews: [] });
    await advanceExecution(project.id, { completedAction: 'quality-gate', qualityGateResult: { passed: false, issues: ['bug'] } });
    // 이제 escalated 상태
    await advanceExecution(project.id, { completedAction: 'escalation-response', escalationDecision: 'abort' });

    const paused = await getProject(project.id);
    expect(paused.executionState.status).toBe('paused');

    const resumed = await initExecution(project.id, { mode: 'interactive', resume: true });
    expect(resumed.project.executionState.status).toBe('executing');
  });

  it('존재하지 않는 프로젝트는 에러', async () => {
    await expect(initExecution('non-exist')).rejects.toThrow('프로젝트를 찾을 수 없습니다');
  });
});

describe('advanceExecution', () => {
  it('execute-tasks → materialize 전이', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    const result = await advanceExecution(project.id, { completedAction: 'execute-tasks', taskResults: ['r1'] });
    expect(result.project.executionState.phaseStep).toBe('materialize');
    expect(result.project.executionState.phaseResults[1].taskResults).toEqual(['r1']);
  });

  it('materialize → review 전이', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    await advanceExecution(project.id, { completedAction: 'execute-tasks' });
    const result = await advanceExecution(project.id, { completedAction: 'materialize' });
    expect(result.project.executionState.phaseStep).toBe('review');
    expect(result.project.executionState.status).toBe('reviewing');
  });

  it('review → quality-gate 전이', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    await advanceExecution(project.id, { completedAction: 'execute-tasks' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    const result = await advanceExecution(project.id, { completedAction: 'review', reviews: [{ score: 8 }] });
    expect(result.project.executionState.phaseStep).toBe('quality-gate');
    expect(result.project.executionState.phaseResults[1].reviews).toEqual([{ score: 8 }]);
  });

  it('quality-gate passed → commit 전이', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    await advanceExecution(project.id, { completedAction: 'execute-tasks' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    const result = await advanceExecution(project.id, {
      completedAction: 'quality-gate',
      qualityGateResult: { passed: true, issues: [] },
    });
    expect(result.project.executionState.phaseStep).toBe('commit');
    expect(result.project.executionState.status).toBe('committing');
  });

  it('quality-gate failed (fixAttempt < 2) → fix 전이', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    await advanceExecution(project.id, { completedAction: 'execute-tasks' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    const result = await advanceExecution(project.id, {
      completedAction: 'quality-gate',
      qualityGateResult: { passed: false, issues: ['critical-bug'] },
    });
    expect(result.project.executionState.phaseStep).toBe('fix');
    expect(result.project.executionState.status).toBe('fixing');
  });

  it('quality-gate failed (fixAttempt >= 2) → escalated 전이', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    await advanceExecution(project.id, { completedAction: 'execute-tasks' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    // 1차 실패 → fix
    await advanceExecution(project.id, { completedAction: 'quality-gate', qualityGateResult: { passed: false, issues: ['bug'] } });
    await advanceExecution(project.id, { completedAction: 'fix' }); // fixAttempt=1
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    // 2차 실패 → fix
    await advanceExecution(project.id, { completedAction: 'quality-gate', qualityGateResult: { passed: false, issues: ['bug'] } });
    await advanceExecution(project.id, { completedAction: 'fix' }); // fixAttempt=2
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    // 3차 실패 → escalated
    const result = await advanceExecution(project.id, {
      completedAction: 'quality-gate',
      qualityGateResult: { passed: false, issues: ['persistent-bug'] },
    });
    expect(result.project.executionState.status).toBe('escalated');
    expect(result.project.executionState.pendingEscalation.reason).toContain('2회');
    expect(result.project.executionState.pendingEscalation.unresolvedIssues).toContain('persistent-bug');
  });

  it('fix → materialize 전이 + fixAttempt 증가', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    await advanceExecution(project.id, { completedAction: 'execute-tasks' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    await advanceExecution(project.id, { completedAction: 'quality-gate', qualityGateResult: { passed: false, issues: [] } });

    const before = await getProject(project.id);
    expect(before.executionState.fixAttempt).toBe(0);

    const result = await advanceExecution(project.id, { completedAction: 'fix' });
    expect(result.project.executionState.phaseStep).toBe('materialize');
    expect(result.project.executionState.fixAttempt).toBe(1);
  });

  it('commit → build-context 전이', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    await advanceExecution(project.id, { completedAction: 'execute-tasks' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    await advanceExecution(project.id, { completedAction: 'quality-gate', qualityGateResult: { passed: true } });
    const result = await advanceExecution(project.id, { completedAction: 'commit' });
    expect(result.project.executionState.phaseStep).toBe('build-context');
    expect(result.project.executionState.phaseResults[1].committed).toBe(true);
  });

  it('build-context → 다음 phase execute-tasks 전이', async () => {
    const project = await createTestProject(2);
    await initExecution(project.id);
    await advanceExecution(project.id, { completedAction: 'execute-tasks' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    await advanceExecution(project.id, { completedAction: 'quality-gate', qualityGateResult: { passed: true } });
    await advanceExecution(project.id, { completedAction: 'commit' });
    const result = await advanceExecution(project.id, { completedAction: 'build-context' });

    expect(result.project.executionState.currentPhase).toBe(2);
    expect(result.project.executionState.phaseStep).toBe('execute-tasks');
    expect(result.project.executionState.fixAttempt).toBe(0);
    expect(result.project.executionState.completedPhases).toContain(1);
  });

  it('build-context → completed (마지막 phase)', async () => {
    const project = await createTestProject(1);
    await initExecution(project.id);
    await advanceExecution(project.id, { completedAction: 'execute-tasks' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    await advanceExecution(project.id, { completedAction: 'quality-gate', qualityGateResult: { passed: true } });
    await advanceExecution(project.id, { completedAction: 'commit' });
    const result = await advanceExecution(project.id, { completedAction: 'build-context' });

    expect(result.project.executionState.status).toBe('completed');
    expect(result.project.executionState.completedAt).toBeTruthy();
    expect(result.nextStep.action).toBe('already-completed');
  });

  it('escalation-response: continue → fix (fixAttempt 리셋)', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    // escalated 상태로 만들기
    await advanceExecution(project.id, { completedAction: 'execute-tasks' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    await advanceExecution(project.id, { completedAction: 'quality-gate', qualityGateResult: { passed: false, issues: [] } });
    await advanceExecution(project.id, { completedAction: 'fix' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    await advanceExecution(project.id, { completedAction: 'quality-gate', qualityGateResult: { passed: false, issues: [] } });
    await advanceExecution(project.id, { completedAction: 'fix' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    await advanceExecution(project.id, { completedAction: 'quality-gate', qualityGateResult: { passed: false, issues: [] } });

    const result = await advanceExecution(project.id, { completedAction: 'escalation-response', escalationDecision: 'continue' });
    expect(result.project.executionState.status).toBe('fixing');
    expect(result.project.executionState.phaseStep).toBe('fix');
    expect(result.project.executionState.fixAttempt).toBe(0);
    expect(result.project.executionState.pendingEscalation).toBeNull();
  });

  it('escalation-response: skip → commit', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    await advanceExecution(project.id, { completedAction: 'execute-tasks' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    await advanceExecution(project.id, { completedAction: 'quality-gate', qualityGateResult: { passed: false, issues: [] } });
    await advanceExecution(project.id, { completedAction: 'fix' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    await advanceExecution(project.id, { completedAction: 'quality-gate', qualityGateResult: { passed: false, issues: [] } });
    await advanceExecution(project.id, { completedAction: 'fix' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    await advanceExecution(project.id, { completedAction: 'quality-gate', qualityGateResult: { passed: false, issues: [] } });

    const result = await advanceExecution(project.id, { completedAction: 'escalation-response', escalationDecision: 'skip' });
    expect(result.project.executionState.phaseStep).toBe('commit');
    expect(result.project.executionState.status).toBe('committing');
  });

  it('escalation-response: abort → paused', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    await advanceExecution(project.id, { completedAction: 'execute-tasks' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    await advanceExecution(project.id, { completedAction: 'quality-gate', qualityGateResult: { passed: false, issues: [] } });
    await advanceExecution(project.id, { completedAction: 'fix' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    await advanceExecution(project.id, { completedAction: 'quality-gate', qualityGateResult: { passed: false, issues: [] } });
    await advanceExecution(project.id, { completedAction: 'fix' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    await advanceExecution(project.id, { completedAction: 'quality-gate', qualityGateResult: { passed: false, issues: [] } });

    const result = await advanceExecution(project.id, { completedAction: 'escalation-response', escalationDecision: 'abort' });
    expect(result.project.executionState.status).toBe('paused');
  });

  it('영속화를 확인한다: advanceExecution 후 project.json에 상태 저장됨', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    await advanceExecution(project.id, { completedAction: 'execute-tasks' });

    const saved = await getProject(project.id);
    expect(saved.executionState.phaseStep).toBe('materialize');
    expect(saved.executionState.lastCompletedStep).toBe('execute-tasks');
  });

  it('알 수 없는 completedAction은 에러', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    await expect(
      advanceExecution(project.id, { completedAction: 'unknown-action' })
    ).rejects.toThrow('알 수 없는 completedAction');
  });

  it('executionState 없이 advance하면 에러', async () => {
    const project = await createTestProject();
    await expect(
      advanceExecution(project.id, { completedAction: 'execute-tasks' })
    ).rejects.toThrow('실행 상태가 초기화되지 않았습니다');
  });

  it('stepResult가 null이면 에러', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    await expect(advanceExecution(project.id, null)).rejects.toThrow('stepResult 객체가 필요합니다');
  });

  it('stepResult.completedAction이 없으면 에러', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    await expect(advanceExecution(project.id, {})).rejects.toThrow('stepResult.completedAction 문자열이 필요합니다');
  });

  it('escalation-response with invalid decision throws error', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    await advanceExecution(project.id, { completedAction: 'execute-tasks' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    await advanceExecution(project.id, { completedAction: 'quality-gate', qualityGateResult: { passed: false, issues: [] } });
    await advanceExecution(project.id, { completedAction: 'fix' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    await advanceExecution(project.id, { completedAction: 'quality-gate', qualityGateResult: { passed: false, issues: [] } });
    await advanceExecution(project.id, { completedAction: 'fix' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    await advanceExecution(project.id, { completedAction: 'quality-gate', qualityGateResult: { passed: false, issues: [] } });

    await expect(
      advanceExecution(project.id, { completedAction: 'escalation-response', escalationDecision: 'invalid' })
    ).rejects.toThrow('알 수 없는 에스컬레이션 결정');
  });
});

describe('initExecution - edge cases', () => {
  it('resume=true이지만 기존 상태가 없으면 새로 초기화한다', async () => {
    const project = await createTestProject();
    const result = await initExecution(project.id, { mode: 'interactive', resume: true });
    expect(result.resumed).toBe(false);
    expect(result.nextStep.action).toBe('execute-tasks');
  });

  it('resume=true이고 기존 상태가 손상되었으면 에러', async () => {
    const project = await createTestProject();
    // 수동으로 손상된 상태 설정
    const { updateExecutionState } = await import('../scripts/lib/project-manager.js');
    await updateExecutionState(project.id, { status: 'invalid', phaseStep: 'bad' });

    await expect(
      initExecution(project.id, { mode: 'interactive', resume: true })
    ).rejects.toThrow('기존 실행 상태가 손상되었습니다');
  });
});

describe('PHASE_TRANSITIONS', () => {
  it('모든 유효한 phaseStep에 대한 전이가 정의되어 있다', () => {
    const steps = ['execute-tasks', 'materialize', 'review', 'quality-gate', 'fix', 'commit', 'build-context'];
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
