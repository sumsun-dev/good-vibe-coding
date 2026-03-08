import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initExecution, advanceExecution } from '../../scripts/lib/engine/execution-loop.js';
import { createTestProject, getProject, createTestEnvironment } from './helpers.js';

const env = createTestEnvironment('edge');
beforeEach(env.setup);
afterEach(env.cleanup);

describe('advanceExecution - 기본 전이', () => {
  it('execute-tasks → materialize 전이', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    const result = await advanceExecution(project.id, {
      completedAction: 'execute-tasks',
      taskResults: ['r1'],
    });
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
    const result = await advanceExecution(project.id, {
      completedAction: 'review',
      reviews: [{ score: 8 }],
    });
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

  it('fix → materialize 전이 + fixAttempt 증가', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    await advanceExecution(project.id, { completedAction: 'execute-tasks' });
    await advanceExecution(project.id, { completedAction: 'materialize' });
    await advanceExecution(project.id, { completedAction: 'review' });
    await advanceExecution(project.id, {
      completedAction: 'quality-gate',
      qualityGateResult: { passed: false, issues: [] },
    });

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
    await advanceExecution(project.id, {
      completedAction: 'quality-gate',
      qualityGateResult: { passed: true },
    });
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
    await advanceExecution(project.id, {
      completedAction: 'quality-gate',
      qualityGateResult: { passed: true },
    });
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
    await advanceExecution(project.id, {
      completedAction: 'quality-gate',
      qualityGateResult: { passed: true },
    });
    await advanceExecution(project.id, { completedAction: 'commit' });
    const result = await advanceExecution(project.id, { completedAction: 'build-context' });

    expect(result.project.executionState.status).toBe('completed');
    expect(result.project.executionState.completedAt).toBeTruthy();
    expect(result.nextStep.action).toBe('already-completed');
  });
});

describe('advanceExecution - 영속화 및 검증', () => {
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
      advanceExecution(project.id, { completedAction: 'unknown-action' }),
    ).rejects.toThrow('알 수 없는 completedAction');
  });

  it('executionState 없이 advance하면 에러', async () => {
    const project = await createTestProject();
    await expect(
      advanceExecution(project.id, { completedAction: 'execute-tasks' }),
    ).rejects.toThrow('실행 상태가 초기화되지 않았습니다');
  });

  it('stepResult가 null이면 에러', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    await expect(advanceExecution(project.id, null)).rejects.toThrow(
      'stepResult 객체가 필요합니다',
    );
  });

  it('stepResult.completedAction이 없으면 에러', async () => {
    const project = await createTestProject();
    await initExecution(project.id);
    await expect(advanceExecution(project.id, {})).rejects.toThrow(
      'stepResult.completedAction 문자열이 필요합니다',
    );
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
    const { project: updated } = await advanceExecution(project.id, {
      completedAction: 'materialize',
    });
    expect(updated.executionState.journal).toHaveLength(2);
    expect(updated.executionState.journal[1].action).toBe('materialize');
  });

  it('기존 journal이 없는 상태에서도 정상 동작한다', async () => {
    const project = await createTestProject(1);
    await initExecution(project.id, { mode: 'auto' });
    // 기존 journal 필드를 수동으로 제거한 뒤 테스트
    const p = await getProject(project.id);
    delete p.executionState.journal;
    const { updateExecutionState } = await import('../../scripts/lib/project/project-manager.js');
    await updateExecutionState(project.id, p.executionState);
    const { project: updated } = await advanceExecution(project.id, {
      completedAction: 'execute-tasks',
    });
    expect(updated.executionState.journal).toHaveLength(1);
  });
});

describe('PR 생성 실패 시 addPullRequest에 error 포함', () => {
  it('PR 실패 정보가 기록된다', async () => {
    // addPullRequest에 error 필드를 포함해 호출할 수 있는지 확인
    const { addPullRequest } = await import('../../scripts/lib/project/project-manager.js');
    const project = await createTestProject();
    await initExecution(project.id);
    // addPullRequest에 error 필드 포함 호출
    await addPullRequest(project.id, {
      url: null,
      branchName: 'gv/test-branch',
      error: 'PR creation failed: gh not found',
    });
    const updated = await getProject(project.id);
    expect(updated.pullRequests).toHaveLength(1);
    expect(updated.pullRequests[0].url).toBeNull();
    expect(updated.pullRequests[0].error).toBe('PR creation failed: gh not found');
    expect(updated.pullRequests[0].branchName).toBe('gv/test-branch');
  });
});
