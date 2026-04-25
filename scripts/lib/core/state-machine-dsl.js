/**
 * state-machine-dsl — 경량 상태 머신 정의 DSL
 *
 * xstate 같은 라이브러리 없이 자체 구현. 명시적 transition 표현으로
 * state-machine.js의 암묵적 if-else 분기를 대체할 기반.
 *
 * 정의 형식:
 * ```js
 * const machine = defineStateMachine({
 *   initial: 'planning',
 *   states: {
 *     planning: {
 *       on: {
 *         APPROVE: { target: 'approved', guard: (ctx) => ..., actions: (ctx) => [...] },
 *         RESET: { target: 'planning' },
 *       },
 *     },
 *     ...
 *   },
 * });
 * ```
 *
 * 외부 의존성 0.
 */

import { inputError } from './validators.js';

function validateDefinition(def) {
  if (!def || typeof def !== 'object') throw inputError('state machine 정의는 object여야 합니다');
  if (!def.states || typeof def.states !== 'object') {
    throw inputError('state machine은 states 객체가 필요합니다');
  }
  const stateNames = Object.keys(def.states);
  if (stateNames.length === 0) {
    throw inputError('state machine은 최소 1개의 state가 필요합니다');
  }
  if (!def.initial || !stateNames.includes(def.initial)) {
    throw inputError(`initial state "${def.initial}"가 states에 정의되지 않았습니다`);
  }

  for (const [stateName, stateDef] of Object.entries(def.states)) {
    if (!stateDef || typeof stateDef !== 'object') {
      throw inputError(`state "${stateName}" 정의가 올바르지 않습니다`);
    }
    const transitions = stateDef.on || {};
    for (const [eventName, transition] of Object.entries(transitions)) {
      if (!transition || typeof transition !== 'object' || !transition.target) {
        throw inputError(`transition "${stateName}.on.${eventName}"에 target이 없습니다`);
      }
      if (!stateNames.includes(transition.target)) {
        throw inputError(
          `transition "${stateName}.on.${eventName}"의 target "${transition.target}"이 정의되지 않은 state입니다`,
        );
      }
    }
  }
}

/**
 * 상태 머신을 정의한다.
 *
 * @param {object} definition
 * @param {string} definition.initial - 초기 state
 * @param {Object<string, { on?: Object<string, { target: string, guard?: Function, actions?: Function }> }>} definition.states
 * @returns {{
 *   initial: string,
 *   transition: (state: string, event: string, options?: { context?: any }) => { valid: boolean, state: string, error?: string, actions: any[] },
 *   canTransition: (state: string, event: string) => boolean,
 *   availableEvents: (state: string) => string[],
 *   reachableStates: (state: string) => string[],
 *   allStates: () => string[],
 * }}
 */
export function defineStateMachine(definition) {
  validateDefinition(definition);

  const { initial, states } = definition;
  const stateNames = Object.keys(states);

  function getTransition(state, event) {
    const stateDef = states[state];
    if (!stateDef) return null;
    return (stateDef.on || {})[event] || null;
  }

  function transition(state, event, options = {}) {
    if (!stateNames.includes(state)) {
      return {
        valid: false,
        state,
        error: `알 수 없는 state: ${state}`,
        actions: [],
      };
    }

    const trans = getTransition(state, event);
    if (!trans) {
      return {
        valid: false,
        state,
        error: `state "${state}"에서 event "${event}" 처리 불가`,
        actions: [],
      };
    }

    const ctx = options.context;

    if (typeof trans.guard === 'function') {
      let allowed;
      try {
        allowed = Boolean(trans.guard(ctx));
      } catch (err) {
        return {
          valid: false,
          state,
          error: `guard 실행 중 오류: ${err.message}`,
          actions: [],
        };
      }
      if (!allowed) {
        return {
          valid: false,
          state,
          error: `guard 거부: ${state}.on.${event}`,
          actions: [],
        };
      }
    }

    let actions = [];
    if (typeof trans.actions === 'function') {
      try {
        const result = trans.actions(ctx);
        actions = Array.isArray(result) ? result : [];
      } catch (err) {
        return {
          valid: false,
          state,
          error: `actions 실행 중 오류: ${err.message}`,
          actions: [],
        };
      }
    }

    return {
      valid: true,
      state: trans.target,
      actions,
    };
  }

  function canTransition(state, event) {
    return getTransition(state, event) !== null;
  }

  function availableEvents(state) {
    const stateDef = states[state];
    if (!stateDef) return [];
    return Object.keys(stateDef.on || {});
  }

  function reachableStates(state) {
    const stateDef = states[state];
    if (!stateDef) return [];
    const targets = new Set();
    for (const trans of Object.values(stateDef.on || {})) {
      targets.add(trans.target);
    }
    return [...targets];
  }

  function allStates() {
    return [...stateNames];
  }

  return {
    initial,
    transition,
    canTransition,
    availableEvents,
    reachableStates,
    allStates,
  };
}
