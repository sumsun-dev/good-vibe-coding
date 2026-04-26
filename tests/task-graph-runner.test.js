/**
 * task-graph-runner 단위 테스트.
 * 그래프 진행, 무한 루프 방지, 잘못된 event 방어, 콜백 호출.
 */

import { describe, it, expect, vi } from 'vitest';
import { runGraph } from '../scripts/lib/engine/task-graph-runner.js';
import { defaultActions } from '../scripts/lib/engine/task-graph-actions.js';

const TASK_TYPES = ['ask', 'review', 'research', 'code', 'plan'];

describe('task-graph-runner', () => {
  describe('happy path — 5개 그래프 모두 placeholder action으로 done까지', () => {
    it.each(TASK_TYPES)('%s 그래프 happy path', async (taskType) => {
      const r = await runGraph({ taskType, intent: null }, { actions: defaultActions(taskType) });
      expect(r.success).toBe(true);
      expect(r.finalState).toBe('done');
      expect(r.history.length).toBeGreaterThan(0);
    });
  });

  describe('잘못된 입력', () => {
    it('taskRoute null → throw', async () => {
      await expect(runGraph(null, { actions: {} })).rejects.toThrow();
    });

    it('taskType 없음 → throw', async () => {
      await expect(runGraph({}, { actions: {} })).rejects.toThrow();
    });

    it('actions 누락 → throw', async () => {
      await expect(runGraph({ taskType: 'ask' }, {})).rejects.toThrow();
    });

    it('지원하지 않는 taskType → selectGraph가 throw', async () => {
      await expect(runGraph({ taskType: 'unknown' }, { actions: {} })).rejects.toThrow();
    });
  });

  describe('action에 매핑이 없는 state → failed', () => {
    it('state action 누락 → failed + reason', async () => {
      const r = await runGraph(
        { taskType: 'ask' },
        {
          actions: {
            /* pending action 없음 */
          },
        },
      );
      expect(r.finalState).toBe('failed');
      expect(r.reason).toMatch(/action 매핑 없음/);
    });
  });

  describe('action 예외 → failed', () => {
    it('action에서 throw → failed + reason', async () => {
      const r = await runGraph(
        { taskType: 'ask' },
        {
          actions: {
            pending: async () => {
              throw new Error('일부러 실패');
            },
          },
        },
      );
      expect(r.finalState).toBe('failed');
      expect(r.reason).toMatch(/action 예외/);
    });
  });

  describe('잘못된 event 반환 → failed', () => {
    it('graph가 거부하는 event → failed', async () => {
      const r = await runGraph(
        { taskType: 'ask' },
        {
          actions: {
            pending: async () => ({ event: 'INVALID_EVENT' }),
          },
        },
      );
      expect(r.finalState).toBe('failed');
      expect(r.reason).toMatch(/잘못된 transition/);
    });
  });

  describe('무한 루프 방지 (maxSteps)', () => {
    it('maxSteps 미달 시 failed + reason에 maxSteps 표시', async () => {
      const r = await runGraph(
        { taskType: 'review' },
        { actions: defaultActions('review'), maxSteps: 1 },
      );
      expect(r.finalState).toBe('failed');
      expect(r.steps).toBe(1);
      expect(r.reason).toMatch(/maxSteps/);
    });
  });

  describe('invalid transition journal 기록', () => {
    it('잘못된 event → journal에 graph-invalid-transition 기록', async () => {
      const journal = vi.fn();
      await runGraph(
        { taskType: 'ask' },
        {
          actions: { pending: async () => ({ event: 'INVALID' }) },
          journal,
        },
      );
      const types = journal.mock.calls.map((c) => c[0].type);
      expect(types).toContain('graph-invalid-transition');
    });
  });

  describe('콜백', () => {
    it('onProgress + journal 호출', async () => {
      const onProgress = vi.fn();
      const journal = vi.fn();
      await runGraph({ taskType: 'ask' }, { actions: defaultActions('ask'), onProgress, journal });
      expect(onProgress).toHaveBeenCalled();
      expect(journal).toHaveBeenCalled();
      // journal 인자 형식 검증
      const firstCall = journal.mock.calls[0][0];
      expect(firstCall).toHaveProperty('type');
    });

    it('onProgress 예외가 실행을 깨뜨리지 않음', async () => {
      const r = await runGraph(
        { taskType: 'ask' },
        {
          actions: defaultActions('ask'),
          onProgress: () => {
            throw new Error('progress 실패');
          },
        },
      );
      expect(r.success).toBe(true);
    });

    it('journal 예외도 실행을 깨뜨리지 않음', async () => {
      const r = await runGraph(
        { taskType: 'ask' },
        {
          actions: defaultActions('ask'),
          journal: () => {
            throw new Error('journal 실패');
          },
        },
      );
      expect(r.success).toBe(true);
    });
  });

  describe('history 기록', () => {
    it('각 step의 state/event/output을 history에 기록', async () => {
      const r = await runGraph({ taskType: 'ask' }, { actions: defaultActions('ask') });
      expect(r.history).toBeInstanceOf(Array);
      expect(r.history[0]).toHaveProperty('state');
      expect(r.history[0]).toHaveProperty('event');
    });
  });
});

describe('task-graph-actions — defaultActions', () => {
  it.each(TASK_TYPES)('%s 매핑 반환', (taskType) => {
    const actions = defaultActions(taskType);
    expect(typeof actions).toBe('object');
    expect(Object.keys(actions).length).toBeGreaterThan(0);
  });

  it('지원하지 않는 taskType → throw', () => {
    expect(() => defaultActions('unknown')).toThrow();
  });

  it('각 action이 함수', () => {
    const actions = defaultActions('code');
    for (const key of Object.keys(actions)) {
      expect(typeof actions[key]).toBe('function');
    }
  });
});
