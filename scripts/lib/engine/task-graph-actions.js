/**
 * task-graph-actions — taskType 별 state → action 매핑.
 *
 * Phase B-4a (이 PR): 모든 action이 placeholder. 그래프가 happy path로 진행되도록
 * 각 state마다 적절한 다음 이벤트를 반환한다. 실제 LLM 호출은 후속 PR에서 교체:
 * - B-4b: ask/review/research action
 * - B-4c: code action (기존 execution-loop 흡수)
 * - B-4d: plan action + code 서브그래프 위임
 *
 * action 시그니처: `(state, ctx) → { event, output? }`
 */

const placeholder = (label, event) => async (state) => ({
  event,
  output: { placeholder: true, state, label },
});

const askActions = Object.freeze({
  pending: placeholder('ask:pending', 'START'),
  answering: placeholder('ask:answering', 'COMPLETE'),
});

const reviewActions = Object.freeze({
  pending: placeholder('review:pending', 'START'),
  'fetching-diff': placeholder('review:fetching-diff', 'COMPLETE'),
  reviewing: placeholder('review:reviewing', 'COMPLETE'),
  synthesizing: placeholder('review:synthesizing', 'COMPLETE'),
});

const researchActions = Object.freeze({
  pending: placeholder('research:pending', 'START'),
  researching: placeholder('research:researching', 'COMPLETE'),
  'cross-reviewing': placeholder('research:cross-reviewing', 'COMPLETE'),
  synthesizing: placeholder('research:synthesizing', 'COMPLETE'),
});

const codeActions = Object.freeze({
  pending: placeholder('code:pending', 'START'),
  'analyzing-side-impact': placeholder('code:analyzing-side-impact', 'COMPLETE'),
  executing: placeholder('code:executing', 'COMPLETE'),
  materializing: placeholder('code:materializing', 'COMPLETE'),
  reviewing: placeholder('code:reviewing', 'PASS'),
  // TODO(B-4c): 실제 fix action으로 교체. happy path에서 도달하지 않으므로
  // placeholder는 GIVE_UP → failed 경로 (무한 재시도 방지). 실제 통합 시
  // fixAttempt ctx와 LLM 호출로 reviewing 재진입 또는 ESCALATE 발행.
  fixing: placeholder('code:fixing', 'GIVE_UP'),
  // TODO(B-4c): 실제 escalating action으로 교체. CONTINUE/SKIP/ABORT는
  // CEO 입력에 따라 결정되어야 함. placeholder는 SKIP으로 단순 종료.
  escalating: placeholder('code:escalating', 'SKIP'),
  committing: placeholder('code:committing', 'COMPLETE'),
});

const planActions = Object.freeze({
  pending: placeholder('plan:pending', 'START'),
  discussing: placeholder('plan:discussing', 'CONVERGE'),
  'awaiting-approval': placeholder('plan:awaiting-approval', 'APPROVE'),
  executing: placeholder('plan:executing', 'COMPLETE'),
});

const ACTIONS_BY_TASK_TYPE = Object.freeze({
  ask: askActions,
  review: reviewActions,
  research: researchActions,
  code: codeActions,
  plan: planActions,
});

/**
 * 작업 유형별 기본 action 매핑(placeholder)을 반환.
 * 실제 LLM 통합은 후속 PR에서 이 매핑을 교체하거나 부분 오버라이드한다.
 *
 * @param {'ask'|'review'|'research'|'code'|'plan'} taskType
 * @returns {Object<string, Function>} state → action 함수 매핑 (frozen)
 */
export function defaultActions(taskType) {
  const actions = ACTIONS_BY_TASK_TYPE[taskType];
  if (!actions) {
    throw new Error(`지원하지 않는 taskType: "${taskType}"`);
  }
  return actions;
}
