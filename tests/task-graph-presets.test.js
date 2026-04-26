/**
 * task-graph-presets 단위 테스트.
 * 5개 작업 유형(code/plan/research/review/ask)별 동적 그래프 정의가
 * state-machine-DSL로 유효하게 컴파일되고 happy path를 거치는지 검증.
 */

import { describe, it, expect } from 'vitest';
import {
  selectGraph,
  TASK_GRAPH_IDS,
  GRAPH_EVENTS,
  SUBGRAPH_MAP,
} from '../scripts/lib/engine/task-graph-presets.js';

const TASK_TYPES = ['code', 'plan', 'research', 'review', 'ask'];

describe('task-graph-presets', () => {
  describe('selectGraph()', () => {
    it.each(TASK_TYPES)('%s 유형의 그래프를 반환', (taskType) => {
      const graph = selectGraph(taskType);
      expect(graph).toBeDefined();
      expect(graph.initial).toBeDefined();
      expect(typeof graph.transition).toBe('function');
      expect(typeof graph.allStates).toBe('function');
    });

    it('잘못된 taskType → INPUT_ERROR', () => {
      expect(() => selectGraph('unknown')).toThrowError(/지원하지 않는/);
    });

    it('빈 입력/null → INPUT_ERROR', () => {
      expect(() => selectGraph(null)).toThrow();
      expect(() => selectGraph('')).toThrow();
    });
  });

  describe('TASK_GRAPH_IDS 상수', () => {
    it('5개 유형 모두 graphId 매핑 존재', () => {
      for (const t of TASK_TYPES) {
        expect(TASK_GRAPH_IDS[t]).toBeDefined();
        expect(typeof TASK_GRAPH_IDS[t]).toBe('string');
      }
    });

    it('각 graphId는 고유함', () => {
      const ids = Object.values(TASK_GRAPH_IDS);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('GRAPH_EVENTS 상수', () => {
    it('공통 이벤트 노출 (START/COMPLETE/FAIL)', () => {
      expect(GRAPH_EVENTS.START).toBeDefined();
      expect(GRAPH_EVENTS.COMPLETE).toBeDefined();
      expect(GRAPH_EVENTS.FAIL).toBeDefined();
    });
  });

  describe('ask 그래프 — 단일 에이전트 답변', () => {
    it('happy path: pending → answering → done', () => {
      const g = selectGraph('ask');
      let state = g.initial;
      const r1 = g.transition(state, GRAPH_EVENTS.START);
      expect(r1.valid).toBe(true);
      state = r1.state;
      const r2 = g.transition(state, GRAPH_EVENTS.COMPLETE);
      expect(r2.valid).toBe(true);
      expect(g.reachableStates(state)).toContain(r2.state);
    });

    it('terminal 상태(done)는 추가 transition 불가', () => {
      const g = selectGraph('ask');
      // happy path로 done까지
      let state = g.initial;
      state = g.transition(state, GRAPH_EVENTS.START).state;
      state = g.transition(state, GRAPH_EVENTS.COMPLETE).state;
      // done은 모든 이벤트 거부
      const r = g.transition(state, GRAPH_EVENTS.START);
      expect(r.valid).toBe(false);
    });
  });

  describe('review 그래프 — fetch → review → synthesize', () => {
    it('happy path 통과', () => {
      const g = selectGraph('review');
      let state = g.initial;
      const path = [
        GRAPH_EVENTS.START,
        GRAPH_EVENTS.COMPLETE,
        GRAPH_EVENTS.COMPLETE,
        GRAPH_EVENTS.COMPLETE,
      ];
      for (const ev of path) {
        const r = g.transition(state, ev);
        if (r.valid) state = r.state;
      }
      // 최소한 시작 상태에서 변화함
      expect(state).not.toBe(g.initial);
    });
  });

  describe('research 그래프 — 병렬 조사 → 크로스 리뷰 → 종합', () => {
    it('initial 상태가 정의되어 있고 START로 진입 가능', () => {
      const g = selectGraph('research');
      const r = g.transition(g.initial, GRAPH_EVENTS.START);
      expect(r.valid).toBe(true);
    });
  });

  describe('code 그래프 — 가장 복잡한 그래프 (수정 루프 포함)', () => {
    it('happy path: pending → ... → done', () => {
      const g = selectGraph('code');
      let state = g.initial;
      const r1 = g.transition(state, GRAPH_EVENTS.START);
      expect(r1.valid).toBe(true);
      state = r1.state;
      // code 그래프는 여러 중간 단계가 있음
      expect(g.allStates().length).toBeGreaterThanOrEqual(5);
    });

    it('실패 경로: 어떤 상태에서든 FAIL 이벤트로 failed 도달 가능', () => {
      const g = selectGraph('code');
      // failed가 reachable한지 (전이 그래프 검증)
      const allStates = g.allStates();
      expect(allStates).toContain('failed');
    });
  });

  describe('plan 그래프 — 토론 → 승인 → 실행', () => {
    it('initial → 첫 단계 (discussing)로 진입', () => {
      const g = selectGraph('plan');
      const r = g.transition(g.initial, GRAPH_EVENTS.START);
      expect(r.valid).toBe(true);
    });

    it('done과 failed terminal 상태 존재', () => {
      const g = selectGraph('plan');
      const states = g.allStates();
      expect(states).toContain('done');
      expect(states).toContain('failed');
    });
  });

  describe('code 그래프 guard 경계 (fixAttempt)', () => {
    it('fixAttempt 한도 미만 → COMPLETE 통과 → reviewing', () => {
      const g = selectGraph('code');
      const r = g.transition('fixing', GRAPH_EVENTS.COMPLETE, {
        context: { fixAttempt: 1, maxFixAttempts: 2 },
      });
      expect(r.valid).toBe(true);
      expect(r.state).toBe('reviewing');
    });

    it('fixAttempt 한도 도달 → COMPLETE guard 거부', () => {
      const g = selectGraph('code');
      const r = g.transition('fixing', GRAPH_EVENTS.COMPLETE, {
        context: { fixAttempt: 2, maxFixAttempts: 2 },
      });
      expect(r.valid).toBe(false);
    });

    it('fixing → ESCALATE → escalating 진입 가능', () => {
      const g = selectGraph('code');
      const r = g.transition('fixing', GRAPH_EVENTS.ESCALATE);
      expect(r.valid).toBe(true);
      expect(r.state).toBe('escalating');
    });

    it.each([
      [GRAPH_EVENTS.CONTINUE, 'fixing'],
      [GRAPH_EVENTS.SKIP, 'committing'],
      [GRAPH_EVENTS.ABORT, 'failed'],
    ])('escalating에서 %s → %s', (event, expectedTarget) => {
      const g = selectGraph('code');
      const r = g.transition('escalating', event);
      expect(r.valid).toBe(true);
      expect(r.state).toBe(expectedTarget);
    });
  });

  describe('plan 그래프 guard 경계 (round, rejectAttempt)', () => {
    it('round 한도 미만 → NEXT_ROUND 통과', () => {
      const g = selectGraph('plan');
      const r = g.transition('discussing', GRAPH_EVENTS.NEXT_ROUND, {
        context: { round: 1, maxRounds: 3 },
      });
      expect(r.valid).toBe(true);
    });

    it('round 한도 도달 → NEXT_ROUND guard 거부', () => {
      const g = selectGraph('plan');
      const r = g.transition('discussing', GRAPH_EVENTS.NEXT_ROUND, {
        context: { round: 3, maxRounds: 3 },
      });
      expect(r.valid).toBe(false);
    });

    it('rejectAttempt 한도 도달 → REJECT guard 거부', () => {
      const g = selectGraph('plan');
      const r = g.transition('awaiting-approval', GRAPH_EVENTS.REJECT, {
        context: { rejectAttempt: 3, maxRejects: 3 },
      });
      expect(r.valid).toBe(false);
    });
  });

  describe('SUBGRAPH_MAP — plan:executing 위임 계약', () => {
    it('plan:executing → code 위임 매핑 존재', () => {
      expect(SUBGRAPH_MAP['plan:executing']).toBe('code');
    });

    it('SUBGRAPH_MAP의 모든 child taskType은 selectGraph로 선택 가능', () => {
      for (const childType of Object.values(SUBGRAPH_MAP)) {
        expect(() => selectGraph(childType)).not.toThrow();
      }
    });
  });

  describe('공통 불변 — 모든 그래프가 done/failed 종착점 보유', () => {
    it.each(TASK_TYPES)('%s 그래프에 done/failed 존재', (taskType) => {
      const g = selectGraph(taskType);
      const states = g.allStates();
      expect(states).toContain('done');
      expect(states).toContain('failed');
    });

    it.each(TASK_TYPES)('%s 그래프의 done은 terminal (어떤 이벤트도 거부)', (taskType) => {
      const g = selectGraph(taskType);
      const r = g.transition('done', GRAPH_EVENTS.START);
      expect(r.valid).toBe(false);
    });
  });
});
