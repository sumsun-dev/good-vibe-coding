/**
 * task-graph-runner — task-graph-presets 그래프를 따라 작업을 실행하는 드라이버.
 *
 * PRD #235 §6/§14 Phase B Step 2의 핵심. 이 모듈은 그래프 진행만 담당하고,
 * 각 state의 실제 동작(LLM 호출 등)은 호출자가 `actions` 맵으로 주입한다.
 *
 * 구조:
 * - runGraph(taskRoute, options) → { finalState, history, success, steps }
 * - actions[state]: 비동기 함수 (state, ctx) → { event, output?, error? }
 * - onProgress: 매 step마다 패널 렌더링용 콜백 (renderPanel에 그대로 전달 가능)
 * - journal: 매 step마다 이벤트 append 콜백
 *
 * 무한 루프 / 잘못된 event / action 예외에 대해 모두 방어적으로 처리.
 */

import { selectGraph } from './task-graph-presets.js';

export const DEFAULT_MAX_STEPS = 50;
const TERMINAL_STATES = new Set(['done', 'failed']);

const noop = () => {};

/**
 * 작업 그래프를 실행한다.
 *
 * @param {object} taskRoute - { taskType, intent?, sanitizedInput?, ... }
 * @param {object} options
 * @param {Object<string, Function>} options.actions - state → action 함수 매핑
 * @param {Function} [options.onProgress] - 매 step 콜백 (renderPanel용 데이터)
 * @param {Function} [options.journal] - 매 step journal append 콜백
 * @param {number} [options.maxSteps=50] - 무한 루프 방지
 * @returns {Promise<{
 *   finalState: string,
 *   history: Array,
 *   success: boolean,
 *   steps: number,
 *   reason?: string
 * }>}
 */
export async function runGraph(taskRoute, options = {}) {
  if (!taskRoute || typeof taskRoute !== 'object' || !taskRoute.taskType) {
    throw new Error('taskRoute에 taskType이 필요합니다');
  }
  const actions = options.actions;
  if (!actions || typeof actions !== 'object') {
    throw new Error('options.actions 매핑이 필요합니다');
  }

  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : noop;
  const journal = typeof options.journal === 'function' ? options.journal : noop;
  const maxSteps =
    Number.isInteger(options.maxSteps) && options.maxSteps > 0
      ? options.maxSteps
      : DEFAULT_MAX_STEPS;

  const graph = selectGraph(taskRoute.taskType);
  let state = graph.initial;
  const history = [];

  for (let step = 0; step < maxSteps; step++) {
    if (TERMINAL_STATES.has(state)) {
      return finalize(state, history, step, taskRoute, graph);
    }

    const action = actions[state];
    if (typeof action !== 'function') {
      const reason = `state "${state}"에 대한 action 매핑 없음`;
      history.push({ state, event: null, error: reason });
      await safeJournal(journal, { type: 'graph-error', state, reason });
      return finalize('failed', history, step, taskRoute, graph, reason);
    }

    let result;
    try {
      result = await action(state, taskRoute);
    } catch (err) {
      const reason = `action 예외: ${err.message}`;
      history.push({ state, event: null, error: reason });
      await safeJournal(journal, { type: 'graph-action-error', state, reason });
      return finalize('failed', history, step, taskRoute, graph, reason);
    }

    const event = result?.event;
    const transitionResult = graph.transition(state, event, { context: taskRoute });
    history.push({ state, event, output: result?.output, valid: transitionResult.valid });

    await safeProgress(onProgress, {
      taskRoute,
      step,
      currentState: state,
      nextState: transitionResult.state,
      graphStates: graph.allStates(),
      event,
      output: result?.output,
    });
    await safeJournal(journal, {
      type: 'graph-transition',
      state,
      event,
      next: transitionResult.state,
      valid: transitionResult.valid,
    });

    if (!transitionResult.valid) {
      const reason = `잘못된 transition: state="${state}" event="${event}" — ${transitionResult.error}`;
      await safeJournal(journal, { type: 'graph-invalid-transition', state, event, reason });
      return finalize('failed', history, step + 1, taskRoute, graph, reason);
    }

    state = transitionResult.state;
  }

  // maxSteps 도달
  return finalize('failed', history, maxSteps, taskRoute, graph, `maxSteps(${maxSteps}) 도달`);
}

function finalize(finalState, history, steps, taskRoute, graph, reason) {
  return {
    finalState,
    history,
    success: finalState === 'done',
    steps,
    graphStates: graph.allStates(),
    taskType: taskRoute.taskType,
    reason: reason || (finalState === 'done' ? '정상 완료' : `terminal(${finalState}) 도달`),
  };
}

async function safeProgress(onProgress, payload) {
  try {
    await onProgress(payload);
  } catch {
    // onProgress 실패가 실행 자체를 깨뜨리지 않도록 무시
  }
}

async function safeJournal(journal, entry) {
  try {
    await journal(entry);
  } catch {
    // journal 실패도 실행을 깨뜨리지 않음 (fire-and-forget)
  }
}
