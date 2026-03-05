import { describe, it, expect } from 'vitest';
import {
  computeStateTransition,
  createInitialExecutionState,
} from '../scripts/lib/engine/state-machine.js';

/**
 * structuredClone 성능 가드레일 (#23)
 * computeStateTransition의 성능을 대규모 태스크 시나리오에서 측정한다.
 */

function makeProjectWithNTasks(n) {
  const tasks = [];
  for (let i = 1; i <= n; i++) {
    tasks.push({
      id: `task-${i}`,
      title: `태스크 ${i}`,
      phase: Math.ceil(i / 5),
      assignee: i % 2 === 0 ? 'backend' : 'frontend',
      domain: 'backend',
    });
  }
  return {
    id: 'bench-project',
    name: '벤치마크 프로젝트',
    tasks,
    executionState: createInitialExecutionState('auto'),
  };
}

describe('computeStateTransition 성능 (#23)', () => {
  it('100 태스크에서 10ms 이내로 실행된다', () => {
    const project = makeProjectWithNTasks(100);
    const stepResult = { completedAction: 'execute-tasks', taskResults: project.tasks.slice(0, 5) };

    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      computeStateTransition(project, stepResult);
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / 100;

    expect(avgMs).toBeLessThan(10);
  });

  it('500 태스크에서 10ms 이내로 실행된다', () => {
    const project = makeProjectWithNTasks(500);
    const stepResult = { completedAction: 'execute-tasks', taskResults: project.tasks.slice(0, 5) };

    const start = performance.now();
    for (let i = 0; i < 50; i++) {
      computeStateTransition(project, stepResult);
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / 50;

    expect(avgMs).toBeLessThan(10);
  });

  it('1000 태스크에서 10ms 이내로 실행된다', () => {
    const project = makeProjectWithNTasks(1000);
    const stepResult = { completedAction: 'execute-tasks', taskResults: project.tasks.slice(0, 5) };

    const start = performance.now();
    for (let i = 0; i < 20; i++) {
      computeStateTransition(project, stepResult);
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / 20;

    expect(avgMs).toBeLessThan(10);
  });

  it('품질 게이트 실패 전이도 10ms 이내이다', () => {
    const project = makeProjectWithNTasks(500);
    // quality-gate 전이를 테스트하려면 phaseStep이 quality-gate여야 함
    project.executionState.phaseStep = 'quality-gate';
    project.executionState.status = 'reviewing';
    const stepResult = {
      completedAction: 'quality-gate',
      qualityGateResult: {
        passed: false,
        issues: [
          { severity: 'critical', description: '보안 취약점 발견' },
          { severity: 'important', description: 'build 에러' },
        ],
      },
    };

    const start = performance.now();
    for (let i = 0; i < 50; i++) {
      computeStateTransition(project, stepResult);
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / 50;

    expect(avgMs).toBeLessThan(10);
  });
});
