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
  isStaleExecution,
  buildFailureContext,
  categorizeFailure,
  extractContributions,
} from '../scripts/lib/engine/execution-loop.js';
import {
  createProject,
  addProjectTasks,
  updateProjectStatus,
  getProject,
  setBaseDir,
} from '../scripts/lib/project/project-manager.js';

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
  // Windows에서 한국어 폴더명 삭제 시 ENOTEMPTY 발생 가능 — 재시도
  for (let i = 0; i < 3; i++) {
    try {
      await rm(TMP_DIR, { recursive: true, force: true });
      break;
    } catch {
      await new Promise(r => setTimeout(r, 100));
    }
  }
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
      tasks: [{ id: 't1', phase: 1 }, { id: 't2', phase: 2 }],
      executionState: state,
    };
    const summary = getExecutionSummary(project);
    expect(summary.display).toContain('일시 중지');
    expect(summary.status).toBe('paused');
    expect(summary.percentage).toBe(0);
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
    const { updateExecutionState } = await import('../scripts/lib/project/project-manager.js');
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

// --- Phase 3b: 시맨틱 검증 강화 + 저널 + isStaleExecution ---

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

describe('advanceExecution journal 기록', () => {
  it('상태 전이 시 저널 엔트리가 기록된다', async () => {
    const project = await createTestProject(1);
    await initExecution(project.id, { mode: 'auto' });
    const { project: updated } = await advanceExecution(project.id, {
      completedAction: 'execute-tasks',
      taskResults: [{ taskId: 'task-1-1', output: '결과' }],
    });
    const journal = updated.executionState.journal;
    expect(journal).toHaveLength(1);
    expect(journal[0].action).toBe('execute-tasks');
    expect(journal[0].fromStep).toBe('execute-tasks');
    expect(journal[0].toStep).toBe('materialize');
    expect(journal[0].phase).toBe(1);
    expect(journal[0].timestamp).toBeTruthy();
  });

  it('여러 전이 시 저널이 누적된다', async () => {
    const project = await createTestProject(1);
    await initExecution(project.id, { mode: 'auto' });
    await advanceExecution(project.id, { completedAction: 'execute-tasks' });
    const { project: updated } = await advanceExecution(project.id, { completedAction: 'materialize' });
    expect(updated.executionState.journal).toHaveLength(2);
    expect(updated.executionState.journal[1].action).toBe('materialize');
  });

  it('기존 journal이 없는 상태에서도 정상 동작한다', async () => {
    const project = await createTestProject(1);
    await initExecution(project.id, { mode: 'auto' });
    // 기존 journal 필드를 수동으로 제거한 뒤 테스트
    const p = await getProject(project.id);
    delete p.executionState.journal;
    const { updateExecutionState } = await import('../scripts/lib/project/project-manager.js');
    await updateExecutionState(project.id, p.executionState);
    const { project: updated } = await advanceExecution(project.id, { completedAction: 'execute-tasks' });
    expect(updated.executionState.journal).toHaveLength(1);
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
    expect(categorizeFailure({ description: 'architecture 문제: tight coupling' })).toBe('architecture');
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
      qualityGateResult: { passed: false, issues: [{ severity: 'critical', description: 'security 취약점' }] },
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
      qualityGateResult: { passed: false, issues: [{ severity: 'critical', description: 'test 부족' }] },
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
    await advanceExecution(project.id, { completedAction: 'quality-gate', qualityGateResult: { passed: false, issues: ['bug'] } });
    await advanceExecution(project.id, { completedAction: 'fix' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    await advanceExecution(project.id, { completedAction: 'quality-gate', qualityGateResult: { passed: false, issues: ['bug'] } });
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
      qualityGateResult: { passed: false, issues: [{ severity: 'critical', description: 'security 문제' }] },
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
    await advanceExecution(project.id, { completedAction: 'quality-gate', qualityGateResult: { passed: false, issues: [] } });
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
      { reviewerId: 'security', approved: true, issues: [{ severity: 'important', description: '개선점' }] },
    ];
    const result = extractContributions(reviews);
    expect(result).toHaveLength(2);
    const qa = result.find(c => c.roleId === 'qa');
    expect(qa.criticalsCaught).toBe(1);
    expect(qa.uniqueIssues).toBe(1);
  });

  it('동일 역할의 여러 리뷰를 합산한다', () => {
    const reviews = [
      { reviewerId: 'qa', approved: false, issues: [{ severity: 'critical', description: 'bug1' }] },
      { reviewerId: 'qa', approved: false, issues: [{ severity: 'important', description: 'issue2' }] },
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
    const reviews = [
      { roleId: 'backend', approved: true, issues: [] },
    ];
    const result = extractContributions(reviews);
    expect(result).toHaveLength(1);
    expect(result[0].roleId).toBe('backend');
  });
});
