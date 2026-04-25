import { describe, it, expect } from 'vitest';
import { defineStateMachine } from '../scripts/lib/core/state-machine-dsl.js';

const projectMachine = defineStateMachine({
  initial: 'planning',
  states: {
    planning: {
      on: {
        APPROVE: { target: 'approved' },
        RESET: { target: 'planning' },
      },
    },
    approved: {
      on: {
        EXECUTE: {
          target: 'executing',
          guard: (ctx) => ctx.team && ctx.team.length > 0,
        },
        REJECT: { target: 'planning' },
      },
    },
    executing: {
      on: {
        REVIEW: { target: 'reviewing' },
        COMPLETE: { target: 'completed' },
      },
    },
    reviewing: {
      on: {
        FIX: { target: 'executing' },
        COMPLETE: { target: 'completed' },
      },
    },
    completed: {
      on: {
        MODIFY: { target: 'approved' },
      },
    },
  },
});

describe('defineStateMachine — 기본 transition', () => {
  it('initial 상태를 노출한다', () => {
    expect(projectMachine.initial).toBe('planning');
  });

  it('정의된 event는 target state로 전이된다', () => {
    const result = projectMachine.transition('planning', 'APPROVE');
    expect(result.valid).toBe(true);
    expect(result.state).toBe('approved');
  });

  it('알 수 없는 event는 invalid를 반환한다', () => {
    const result = projectMachine.transition('planning', 'UNKNOWN_EVENT');
    expect(result.valid).toBe(false);
    expect(result.state).toBe('planning');
    expect(result.error).toMatch(/event/i);
  });

  it('알 수 없는 state는 invalid를 반환한다', () => {
    const result = projectMachine.transition('mystery-state', 'APPROVE');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/state/i);
  });

  it('self-transition도 허용된다', () => {
    const result = projectMachine.transition('planning', 'RESET');
    expect(result.valid).toBe(true);
    expect(result.state).toBe('planning');
  });
});

describe('defineStateMachine — guard', () => {
  it('guard가 true를 반환하면 transition 통과', () => {
    const result = projectMachine.transition('approved', 'EXECUTE', {
      context: { team: ['cto', 'qa'] },
    });
    expect(result.valid).toBe(true);
    expect(result.state).toBe('executing');
  });

  it('guard가 false를 반환하면 transition 거부', () => {
    const result = projectMachine.transition('approved', 'EXECUTE', {
      context: { team: [] },
    });
    expect(result.valid).toBe(false);
    expect(result.state).toBe('approved');
    expect(result.error).toMatch(/guard/i);
  });

  it('guard 없는 transition은 항상 통과', () => {
    const result = projectMachine.transition('approved', 'REJECT');
    expect(result.valid).toBe(true);
    expect(result.state).toBe('planning');
  });
});

describe('defineStateMachine — 헬퍼', () => {
  it('canTransition: target 도달 가능 여부', () => {
    expect(projectMachine.canTransition('planning', 'APPROVE')).toBe(true);
    expect(projectMachine.canTransition('planning', 'COMPLETE')).toBe(false);
  });

  it('availableEvents: 현재 state에서 가능한 events', () => {
    expect(projectMachine.availableEvents('planning')).toEqual(
      expect.arrayContaining(['APPROVE', 'RESET']),
    );
    expect(projectMachine.availableEvents('completed')).toEqual(['MODIFY']);
  });

  it('reachableStates: 한 step으로 도달 가능한 states', () => {
    expect(projectMachine.reachableStates('planning')).toEqual(
      expect.arrayContaining(['approved', 'planning']),
    );
  });

  it('allStates: 정의된 모든 state', () => {
    expect(projectMachine.allStates()).toEqual([
      'planning',
      'approved',
      'executing',
      'reviewing',
      'completed',
    ]);
  });
});

describe('defineStateMachine — 검증', () => {
  it('initial이 states에 없으면 throw', () => {
    expect(() =>
      defineStateMachine({
        initial: 'undefined-state',
        states: { foo: { on: {} } },
      }),
    ).toThrow(/initial/i);
  });

  it('transition target이 정의되지 않은 state면 throw', () => {
    expect(() =>
      defineStateMachine({
        initial: 'a',
        states: {
          a: { on: { GO: { target: 'nonexistent' } } },
        },
      }),
    ).toThrow(/target/i);
  });

  it('states가 비어있으면 throw', () => {
    expect(() => defineStateMachine({ initial: 'a', states: {} })).toThrow(/state/i);
  });
});

describe('defineStateMachine — actions (선택적 부수효과)', () => {
  it('transition에 actions 함수가 있으면 결과에 액션 result를 포함', () => {
    const machine = defineStateMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            GO: {
              target: 'b',
              actions: (ctx) => [{ type: 'log', data: ctx.data }],
            },
          },
        },
        b: { on: {} },
      },
    });
    const result = machine.transition('a', 'GO', { context: { data: 'hello' } });
    expect(result.valid).toBe(true);
    expect(result.actions).toEqual([{ type: 'log', data: 'hello' }]);
  });

  it('actions 함수가 없으면 빈 배열', () => {
    const result = projectMachine.transition('planning', 'APPROVE');
    expect(result.actions).toEqual([]);
  });
});
