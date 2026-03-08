import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initExecution, advanceExecution } from '../../scripts/lib/engine/execution-loop.js';
import { createTestProject, getProject, createTestEnvironment } from './helpers.js';

const env = createTestEnvironment('escalation');
beforeEach(env.setup);
afterEach(env.cleanup);

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
    await advanceExecution(project.id, {
      completedAction: 'quality-gate',
      qualityGateResult: { passed: false, issues: ['bug'] },
    });
    await advanceExecution(project.id, { completedAction: 'fix' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review', reviews: [] });
    await advanceExecution(project.id, {
      completedAction: 'quality-gate',
      qualityGateResult: { passed: false, issues: ['bug'] },
    });
    await advanceExecution(project.id, { completedAction: 'fix' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review', reviews: [] });
    await advanceExecution(project.id, {
      completedAction: 'quality-gate',
      qualityGateResult: { passed: false, issues: ['bug'] },
    });
    // 이제 escalated 상태
    await advanceExecution(project.id, {
      completedAction: 'escalation-response',
      escalationDecision: 'abort',
    });

    const paused = await getProject(project.id);
    expect(paused.executionState.status).toBe('paused');

    const resumed = await initExecution(project.id, { mode: 'interactive', resume: true });
    expect(resumed.project.executionState.status).toBe('executing');
  });

  it('존재하지 않는 프로젝트는 에러', async () => {
    await expect(initExecution('non-exist')).rejects.toThrow('프로젝트를 찾을 수 없습니다');
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
    const { updateExecutionState } = await import('../../scripts/lib/project/project-manager.js');
    await updateExecutionState(project.id, { status: 'invalid', phaseStep: 'bad' });

    await expect(initExecution(project.id, { mode: 'interactive', resume: true })).rejects.toThrow(
      '기존 실행 상태가 손상되었습니다',
    );
  });
});

describe('advanceExecution - escalation-response', () => {
  async function advanceToEscalated(projectId) {
    await advanceExecution(projectId, { completedAction: 'execute-tasks' });
    await advanceExecution(projectId, { completedAction: 'materialize' });
    await advanceExecution(projectId, { completedAction: 'review' });
    await advanceExecution(projectId, {
      completedAction: 'quality-gate',
      qualityGateResult: { passed: false, issues: [] },
    });
    await advanceExecution(projectId, { completedAction: 'fix' });
    await advanceExecution(projectId, { completedAction: 'materialize' });
    await advanceExecution(projectId, { completedAction: 'review' });
    await advanceExecution(projectId, {
      completedAction: 'quality-gate',
      qualityGateResult: { passed: false, issues: [] },
    });
    await advanceExecution(projectId, { completedAction: 'fix' });
    await advanceExecution(projectId, { completedAction: 'materialize' });
    await advanceExecution(projectId, { completedAction: 'review' });
    await advanceExecution(projectId, {
      completedAction: 'quality-gate',
      qualityGateResult: { passed: false, issues: [] },
    });
  }

  it('continue → fix (fixAttempt 리셋)', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    await advanceToEscalated(project.id);

    const result = await advanceExecution(project.id, {
      completedAction: 'escalation-response',
      escalationDecision: 'continue',
    });
    expect(result.project.executionState.status).toBe('fixing');
    expect(result.project.executionState.phaseStep).toBe('fix');
    expect(result.project.executionState.fixAttempt).toBe(0);
    expect(result.project.executionState.pendingEscalation).toBeNull();
  });

  it('skip → commit', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    await advanceToEscalated(project.id);

    const result = await advanceExecution(project.id, {
      completedAction: 'escalation-response',
      escalationDecision: 'skip',
    });
    expect(result.project.executionState.phaseStep).toBe('commit');
    expect(result.project.executionState.status).toBe('committing');
  });

  it('abort → paused', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    await advanceToEscalated(project.id);

    const result = await advanceExecution(project.id, {
      completedAction: 'escalation-response',
      escalationDecision: 'abort',
    });
    expect(result.project.executionState.status).toBe('paused');
  });

  it('invalid decision throws error', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    await advanceToEscalated(project.id);

    await expect(
      advanceExecution(project.id, {
        completedAction: 'escalation-response',
        escalationDecision: 'invalid',
      }),
    ).rejects.toThrow('알 수 없는 에스컬레이션 결정');
  });
});

describe('advanceExecution - quality-gate escalation', () => {
  it('quality-gate failed (fixAttempt >= 2) → escalated 전이', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    await advanceExecution(project.id, { completedAction: 'execute-tasks' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    // 1차 실패 → fix
    await advanceExecution(project.id, {
      completedAction: 'quality-gate',
      qualityGateResult: { passed: false, issues: ['bug'] },
    });
    await advanceExecution(project.id, { completedAction: 'fix' }); // fixAttempt=1
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    // 2차 실패 → fix
    await advanceExecution(project.id, {
      completedAction: 'quality-gate',
      qualityGateResult: { passed: false, issues: ['bug'] },
    });
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
    expect(result.project.executionState.pendingEscalation.unresolvedIssues).toContain(
      'persistent-bug',
    );
  });
});
