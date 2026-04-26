/**
 * task-graph-presets — 5개 작업 유형(code/plan/research/review/ask)별
 * 동적 워크플로우 그래프 프리셋.
 *
 * PRD #235 §6, §7. v2 단일 진입점 `/gv`의 의도 분류 후 실행 그래프 선택에 사용.
 *
 * 모든 그래프는 `state-machine-dsl`의 `defineStateMachine`으로 컴파일된다.
 * 공통 불변:
 * - `done` (성공 종착점), `failed` (실패 종착점) 상태 필수
 * - terminal 상태는 어떤 이벤트도 처리 안 함 (state-machine-dsl이 거부)
 * - 모든 그래프는 `START` 이벤트로 첫 작업 단계 진입
 */

import { defineStateMachine } from '../core/state-machine-dsl.js';
import { inputError } from '../core/validators.js';

/** 작업 유형 → 그래프 ID (사람이 읽을 수 있는 단일 식별자) */
export const TASK_GRAPH_IDS = Object.freeze({
  ask: 'ask-single-answer',
  review: 'review-parallel-synthesize',
  research: 'research-parallel-synthesize',
  code: 'code-execute-review-fix',
  plan: 'plan-discuss-approve-execute',
});

/**
 * 그래프 공통 이벤트 어휘.
 * 일부 이벤트는 특정 그래프 전용:
 * - SKIP: code 그래프의 `analyzing-side-impact → executing`, escalating에서 사용
 * - PASS: code 그래프의 `reviewing` 통과
 * - APPROVE/REJECT/CONVERGE/NEXT_ROUND: plan 그래프 전용
 * - ESCALATE/CONTINUE/ABORT: code 그래프 escalating 상태 전용
 */
export const GRAPH_EVENTS = Object.freeze({
  START: 'START',
  COMPLETE: 'COMPLETE',
  FAIL: 'FAIL',
  PASS: 'PASS',
  SKIP: 'SKIP',
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
  CONVERGE: 'CONVERGE',
  NEXT_ROUND: 'NEXT_ROUND',
  GIVE_UP: 'GIVE_UP',
  ESCALATE: 'ESCALATE',
  CONTINUE: 'CONTINUE',
  ABORT: 'ABORT',
});

/**
 * 서브그래프 위임 맵.
 * `parentTaskType:parentState` → `childTaskType`
 * execution-loop은 부모 그래프가 매핑된 상태에 진입할 때
 * `selectGraph(child)`로 서브그래프를 인스턴스화해 실행한다.
 */
export const SUBGRAPH_MAP = Object.freeze({
  'plan:executing': 'code',
});

const ASK_GRAPH = defineStateMachine({
  initial: 'pending',
  states: {
    pending: { on: { START: { target: 'answering' } } },
    answering: {
      on: {
        COMPLETE: { target: 'done' },
        FAIL: { target: 'failed' },
      },
    },
    done: {},
    failed: {},
  },
});

const REVIEW_GRAPH = defineStateMachine({
  initial: 'pending',
  states: {
    pending: { on: { START: { target: 'fetching-diff' } } },
    'fetching-diff': {
      on: {
        COMPLETE: { target: 'reviewing' },
        FAIL: { target: 'failed' },
      },
    },
    reviewing: {
      on: {
        COMPLETE: { target: 'synthesizing' },
        FAIL: { target: 'failed' },
      },
    },
    synthesizing: {
      on: {
        COMPLETE: { target: 'done' },
        FAIL: { target: 'failed' },
      },
    },
    done: {},
    failed: {},
  },
});

const RESEARCH_GRAPH = defineStateMachine({
  initial: 'pending',
  states: {
    pending: { on: { START: { target: 'researching' } } },
    researching: {
      on: {
        COMPLETE: { target: 'cross-reviewing' },
        FAIL: { target: 'failed' },
      },
    },
    'cross-reviewing': {
      on: {
        COMPLETE: { target: 'synthesizing' },
        FAIL: { target: 'failed' },
      },
    },
    synthesizing: {
      on: {
        COMPLETE: { target: 'done' },
        FAIL: { target: 'failed' },
      },
    },
    done: {},
    failed: {},
  },
});

/**
 * code 그래프 — 가장 복잡. 분석 → 실행 → 구체화 → 리뷰 → (수정 루프 max 2) → 커밋.
 * fixAttempt 카운터는 호출자가 ctx로 전달하며, guard에서 제한.
 */
const CODE_GRAPH = defineStateMachine({
  initial: 'pending',
  states: {
    pending: { on: { START: { target: 'analyzing-side-impact' } } },
    'analyzing-side-impact': {
      on: {
        COMPLETE: { target: 'executing' },
        SKIP: { target: 'executing' },
        FAIL: { target: 'failed' },
      },
    },
    executing: {
      on: {
        COMPLETE: { target: 'materializing' },
        FAIL: { target: 'failed' },
      },
    },
    materializing: {
      on: {
        COMPLETE: { target: 'reviewing' },
        FAIL: { target: 'failed' },
      },
    },
    reviewing: {
      on: {
        PASS: { target: 'committing' },
        FAIL: { target: 'fixing' },
      },
    },
    fixing: {
      on: {
        COMPLETE: {
          target: 'reviewing',
          guard: (ctx) => (ctx?.fixAttempt ?? 0) < (ctx?.maxFixAttempts ?? 2),
        },
        ESCALATE: { target: 'escalating' },
        GIVE_UP: { target: 'failed' },
      },
    },
    escalating: {
      // v1 state-machine.js의 `escalated` 상태 대응. CEO 결정으로 분기.
      on: {
        CONTINUE: { target: 'fixing' },
        SKIP: { target: 'committing' },
        ABORT: { target: 'failed' },
      },
    },
    committing: {
      on: {
        COMPLETE: { target: 'done' },
        FAIL: { target: 'failed' },
      },
    },
    done: {},
    failed: {},
  },
});

/**
 * plan 그래프 — discuss(수렴까지, 라운드 제한 guard) → 승인 대기 → execute(code 그래프 위임).
 * round 카운터는 ctx로 전달, maxRounds 도달 시 NEXT_ROUND guard 거부 → CONVERGE만 가능.
 * REJECT 루프도 maxRejects guard로 무한 거부 방지.
 *
 * `executing` 상태는 `SUBGRAPH_MAP['plan:executing']` = 'code'로 위임된다.
 * execution-loop은 이 상태 진입 시 `selectGraph('code')`로 서브그래프를 인스턴스화해
 * 실행하고, 서브그래프 종료(done/failed) 시 부모에 COMPLETE/FAIL을 전달한다.
 */
const PLAN_GRAPH = defineStateMachine({
  initial: 'pending',
  states: {
    pending: { on: { START: { target: 'discussing' } } },
    discussing: {
      on: {
        CONVERGE: { target: 'awaiting-approval' },
        NEXT_ROUND: {
          target: 'discussing',
          guard: (ctx) => (ctx?.round ?? 0) < (ctx?.maxRounds ?? 3),
        },
        FAIL: { target: 'failed' },
      },
    },
    'awaiting-approval': {
      on: {
        APPROVE: { target: 'executing' },
        REJECT: {
          target: 'discussing',
          guard: (ctx) => (ctx?.rejectAttempt ?? 0) < (ctx?.maxRejects ?? 3),
        },
      },
    },
    executing: {
      // SUBGRAPH_MAP['plan:executing'] = 'code' — execution-loop이 위임 처리
      on: {
        COMPLETE: { target: 'done' },
        FAIL: { target: 'failed' },
      },
    },
    done: {},
    failed: {},
  },
});

const GRAPHS = Object.freeze({
  ask: ASK_GRAPH,
  review: REVIEW_GRAPH,
  research: RESEARCH_GRAPH,
  code: CODE_GRAPH,
  plan: PLAN_GRAPH,
});

/**
 * 작업 유형에 해당하는 동적 그래프(state machine)를 반환한다.
 *
 * @param {'code'|'plan'|'research'|'review'|'ask'} taskType
 * @returns {ReturnType<typeof defineStateMachine>}
 */
export function selectGraph(taskType) {
  if (!taskType || typeof taskType !== 'string') {
    throw inputError('taskType은 비어있지 않은 문자열이어야 합니다');
  }
  const graph = GRAPHS[taskType];
  if (!graph) {
    throw inputError(
      `지원하지 않는 taskType: "${taskType}". 허용: ${Object.keys(GRAPHS).join(', ')}`,
    );
  }
  return graph;
}
