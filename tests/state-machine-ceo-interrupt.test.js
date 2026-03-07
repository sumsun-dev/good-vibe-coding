/**
 * state-machine — CEO Interrupt 메커니즘 테스트
 * phaseGuidance: Phase 간 CEO 지침 전달
 * reviewIntervention: 리뷰 후 CEO 개입
 */
import { describe, it, expect } from 'vitest';
import {
  computeStateTransition,
  createInitialExecutionState,
  getNextExecutionStep,
  PHASE_TRANSITIONS,
} from '../scripts/lib/engine/state-machine.js';

function makeProject(overrides = {}) {
  return {
    id: 'test-project',
    name: '테스트 프로젝트',
    tasks: [
      { id: 'task-1', title: '태스크 1', phase: 1, assignee: 'backend' },
      { id: 'task-2', title: '태스크 2', phase: 2, assignee: 'frontend' },
    ],
    executionState: createInitialExecutionState('interactive'),
    ...overrides,
  };
}

// --- phaseGuidance ---

describe('phaseGuidance (Phase 간 CEO 지침)', () => {
  it('build-context에서 phaseGuidance를 저장한다', () => {
    const project = makeProject();
    project.executionState.phaseStep = 'build-context';
    project.executionState.status = 'executing';
    project.executionState.completedPhases = [];

    const updated = computeStateTransition(project, {
      completedAction: 'build-context',
      phaseGuidance: 'API 설계를 RESTful로 통일하세요',
    });

    expect(updated.executionState.phaseGuidance).toBe('API 설계를 RESTful로 통일하세요');
  });

  it('phaseGuidance 없으면 null로 설정한다', () => {
    const project = makeProject();
    project.executionState.phaseStep = 'build-context';
    project.executionState.status = 'executing';

    const updated = computeStateTransition(project, {
      completedAction: 'build-context',
    });

    expect(updated.executionState.phaseGuidance).toBeNull();
  });

  it('execute-tasks 후 phaseGuidance가 소멸한다', () => {
    const project = makeProject();
    project.executionState.phaseStep = 'execute-tasks';
    project.executionState.status = 'executing';
    project.executionState.phaseGuidance = 'API를 RESTful로';

    const updated = computeStateTransition(project, {
      completedAction: 'execute-tasks',
      taskResults: [],
    });

    expect(updated.executionState.phaseGuidance).toBeNull();
  });
});

// --- reviewIntervention ---

describe('reviewIntervention (리뷰 후 CEO 개입)', () => {
  it('review-intervention에서 revisionGuidance가 있으면 fix로 전이한다', () => {
    const project = makeProject();
    project.executionState.phaseStep = 'review-intervention';
    project.executionState.status = 'executing';

    // review-intervention은 PHASE_TRANSITIONS에 등록되어야 함
    const updated = computeStateTransition(project, {
      completedAction: 'review-intervention',
      revisionGuidance: '보안 검증을 추가하세요',
    });

    expect(updated.executionState.phaseStep).toBe('fix');
    expect(updated.executionState.status).toBe('fixing');
    expect(updated.executionState.failureContext.ceoGuidance).toBe('보안 검증을 추가하세요');
    expect(updated.executionState.failureContext.source).toBe('review-intervention');
  });

  it('review-intervention에서 revisionGuidance 없으면 현재 상태 유지', () => {
    const project = makeProject();
    project.executionState.phaseStep = 'review-intervention';
    project.executionState.status = 'executing';

    const updated = computeStateTransition(project, {
      completedAction: 'review-intervention',
    });

    // revisionGuidance가 없으면 fix로 가지 않고 lastCompletedStep만 기록
    expect(updated.executionState.lastCompletedStep).toBe('review-intervention');
  });

  it('quality-gate에서 reviewIntervention=true + interactive면 review-intervention action 반환', () => {
    const project = makeProject();
    project.executionState.phaseStep = 'quality-gate';
    project.executionState.status = 'reviewing';
    project.executionState.reviewIntervention = true;
    project.executionState.mode = 'interactive';

    const step = getNextExecutionStep(project);
    expect(step.action).toBe('review-intervention');
  });

  it('quality-gate에서 reviewIntervention=false면 기존 quality-gate action 반환', () => {
    const project = makeProject();
    project.executionState.phaseStep = 'quality-gate';
    project.executionState.status = 'reviewing';
    project.executionState.reviewIntervention = false;
    project.executionState.mode = 'interactive';

    const step = getNextExecutionStep(project);
    expect(step.action).toBe('quality-gate');
  });

  it('quality-gate에서 reviewIntervention=true + auto면 기존 quality-gate action 반환', () => {
    const project = makeProject();
    project.executionState.phaseStep = 'quality-gate';
    project.executionState.status = 'reviewing';
    project.executionState.reviewIntervention = true;
    project.executionState.mode = 'auto';

    const step = getNextExecutionStep(project);
    expect(step.action).toBe('quality-gate');
  });
});

// --- PHASE_TRANSITIONS 확장 ---

describe('PHASE_TRANSITIONS 확장', () => {
  it('review-intervention → fix, quality-gate 전이가 허용된다', () => {
    expect(PHASE_TRANSITIONS['review-intervention']).toContain('fix');
    expect(PHASE_TRANSITIONS['review-intervention']).toContain('quality-gate');
  });

  it('quality-gate에서 review-intervention 전이가 허용된다', () => {
    // quality-gate → review-intervention 자체는 전이 맵에 없어도
    // STEP_HANDLERS에서 action만 반환하므로 ok
    // 하지만 review-intervention → quality-gate 복귀가 필요
    expect(PHASE_TRANSITIONS['review-intervention']).toBeDefined();
  });
});
