/**
 * task-graph-actions — taskType 별 state → action 매핑.
 *
 * Phase B-4b 진행:
 * - ask/review/research: 실제 LLM 호출 builder 제공 (callLLM DI)
 * - code/plan: 여전히 placeholder (B-4c/d에서 교체)
 *
 * action 시그니처: `(state, ctx) → { event, output? }`
 *
 * `defaultActions(taskType, options)`:
 * - options.callLLM가 있으면 ask/review/research는 LLM 동작
 * - 없으면 placeholder (테스트/시연용)
 */

import { callLLMWithFallback } from '../llm/llm-fallback.js';
import { wrapUserInput } from '../core/prompt-builder.js';

const placeholder = (label, event) => async (state) => ({
  event,
  output: { placeholder: true, state, label },
});

// ─────────────────────────────────────────────────────────
// ask actions
// ─────────────────────────────────────────────────────────

const ASK_SYSTEM = `당신은 코드베이스에 대한 사용자 질문에 한국어로 명확하게 답변하는 도우미입니다. 알 수 없는 부분은 "확인 필요"로 명시하세요.`;

function buildAskPrompt(taskRoute) {
  const userInput = taskRoute.sanitizedInput || wrapUserInput(taskRoute.input || '');
  return `# 질문\n${userInput}\n\n# 답변\n3-5단락으로 답변하세요.`;
}

/**
 * ask 작업 유형의 실제 LLM action 매핑을 만든다.
 * @param {object} [opts]
 * @param {Function} [opts.callLLM] - DI용 (provider, prompt, options) => { text, model }
 * @param {string} [opts.provider='claude']
 * @param {string} [opts.model] - 미지정 시 callLLM 기본값
 */
export function buildAskActions(opts = {}) {
  const callLLM = opts.callLLM || callLLMWithFallback;
  const provider = opts.provider || 'claude';
  const model = opts.model;

  return Object.freeze({
    pending: async () => ({ event: 'START' }),
    answering: async (state, taskRoute) => {
      try {
        const result = await callLLM(provider, buildAskPrompt(taskRoute), {
          model,
          systemMessage: ASK_SYSTEM,
        });
        return {
          event: 'COMPLETE',
          output: { answer: result.text, model: result.model || model || 'unknown' },
        };
      } catch (err) {
        return { event: 'FAIL', output: { error: err.message } };
      }
    },
  });
}

// ─────────────────────────────────────────────────────────
// review actions
// ─────────────────────────────────────────────────────────

const REVIEW_SYSTEM = `당신은 시니어 엔지니어로서 코드 변경(diff/PR)을 검토합니다. 보안/성능/회귀 위험을 한국어로 간결하게 평가하세요.`;

function buildFetchDiffPrompt(taskRoute) {
  const userInput = taskRoute.sanitizedInput || wrapUserInput(taskRoute.input || '');
  return `# 사용자 요청\n${userInput}\n\n# 작업\n위 요청에서 검토 대상(PR URL/파일 경로/diff)을 식별하고 다음 단계 검토 컨텍스트를 한국어로 5줄 이내로 요약하세요.`;
}

function buildReviewPrompt(taskRoute, fetchOutput) {
  const userInput = taskRoute.sanitizedInput || wrapUserInput(taskRoute.input || '');
  const ctx = fetchOutput?.summary || '(컨텍스트 없음)';
  return `# 사용자 요청\n${userInput}\n\n# 검토 컨텍스트\n${ctx}\n\n# 작업\n위 컨텍스트를 바탕으로 보안/성능/회귀 관점의 리뷰를 한국어로 작성하세요. 각 항목은 [심각도] 형식으로 마킹하세요.`;
}

function buildSynthesizePrompt(taskRoute, reviewOutput) {
  const review = reviewOutput?.review || '(리뷰 없음)';
  return `# 리뷰 결과\n${review}\n\n# 작업\n위 리뷰를 종합하여 머지 권고(승인/조건부/거부)와 핵심 이유 3줄 이내로 한국어로 정리하세요.`;
}

/**
 * review actions builder.
 *
 * **주의**: 반환된 actions 객체는 단일 graph 실행에 사용해야 한다.
 * 클로저 내부 stage(plain object)로 단계별 LLM 출력을 누적하므로,
 * 동일 actions를 여러 runGraph에 재사용하면 이전 실행 결과가 오염된다.
 * 새 실행마다 buildReviewActions를 다시 호출하라.
 */
export function buildReviewActions(opts = {}) {
  const callLLM = opts.callLLM || callLLMWithFallback;
  const provider = opts.provider || 'claude';
  const model = opts.model;
  const callOpts = { model, systemMessage: REVIEW_SYSTEM };

  // 한 builder 호출 = 한 graph 실행 (stage 누적용 plain object)
  const stage = {};

  return Object.freeze({
    pending: async () => ({ event: 'START' }),
    'fetching-diff': async (state, taskRoute) => {
      try {
        const result = await callLLM(provider, buildFetchDiffPrompt(taskRoute), callOpts);
        stage.fetch = { summary: result.text, model: result.model };
        return { event: 'COMPLETE', output: stage.fetch };
      } catch (err) {
        return { event: 'FAIL', output: { error: err.message } };
      }
    },
    reviewing: async (state, taskRoute) => {
      try {
        const result = await callLLM(provider, buildReviewPrompt(taskRoute, stage.fetch), callOpts);
        stage.review = { review: result.text, model: result.model };
        return { event: 'COMPLETE', output: stage.review };
      } catch (err) {
        return { event: 'FAIL', output: { error: err.message } };
      }
    },
    synthesizing: async (state, taskRoute) => {
      try {
        const result = await callLLM(
          provider,
          buildSynthesizePrompt(taskRoute, stage.review),
          callOpts,
        );
        return {
          event: 'COMPLETE',
          output: { recommendation: result.text, model: result.model },
        };
      } catch (err) {
        return { event: 'FAIL', output: { error: err.message } };
      }
    },
  });
}

// ─────────────────────────────────────────────────────────
// research actions
// ─────────────────────────────────────────────────────────

const RESEARCH_SYSTEM = `당신은 시니어 엔지니어로서 기술 의사결정을 한국어로 비교/분석합니다. 트레이드오프를 명확히 제시하세요.`;

function buildResearchPrompt(taskRoute) {
  const userInput = taskRoute.sanitizedInput || wrapUserInput(taskRoute.input || '');
  return `# 의사결정 질문\n${userInput}\n\n# 작업\n각 옵션의 핵심 특성, 비용, 운영 부담을 한국어로 5줄 이내로 정리하세요.`;
}

function buildCrossReviewPrompt(taskRoute, researchOutput) {
  const research = researchOutput?.findings || '(조사 결과 없음)';
  return `# 1차 조사 결과\n${research}\n\n# 작업\n위 결과를 비판적으로 검토하여 누락된 관점이나 위험을 한국어로 3-5줄로 추가하세요.`;
}

function buildResearchSynthesizePrompt(taskRoute, crossOutput) {
  const cross = crossOutput?.crossReview || '(교차 리뷰 없음)';
  return `# 교차 리뷰\n${cross}\n\n# 작업\n위 분석을 종합하여 권장 옵션 + 핵심 이유 3줄 이내, 한국어로 정리하세요.`;
}

/**
 * research actions builder. 단일 graph 실행 가정 (review와 동일 — 재사용 금지).
 */
export function buildResearchActions(opts = {}) {
  const callLLM = opts.callLLM || callLLMWithFallback;
  const provider = opts.provider || 'claude';
  const model = opts.model;
  const callOpts = { model, systemMessage: RESEARCH_SYSTEM };
  const stage = {};

  return Object.freeze({
    pending: async () => ({ event: 'START' }),
    researching: async (state, taskRoute) => {
      try {
        const result = await callLLM(provider, buildResearchPrompt(taskRoute), callOpts);
        stage.research = { findings: result.text, model: result.model };
        return { event: 'COMPLETE', output: stage.research };
      } catch (err) {
        return { event: 'FAIL', output: { error: err.message } };
      }
    },
    'cross-reviewing': async (state, taskRoute) => {
      try {
        const result = await callLLM(
          provider,
          buildCrossReviewPrompt(taskRoute, stage.research),
          callOpts,
        );
        stage.crossReview = { crossReview: result.text, model: result.model };
        return { event: 'COMPLETE', output: stage.crossReview };
      } catch (err) {
        return { event: 'FAIL', output: { error: err.message } };
      }
    },
    synthesizing: async (state, taskRoute) => {
      try {
        const result = await callLLM(
          provider,
          buildResearchSynthesizePrompt(taskRoute, stage.crossReview),
          callOpts,
        );
        return {
          event: 'COMPLETE',
          output: { recommendation: result.text, model: result.model },
        };
      } catch (err) {
        return { event: 'FAIL', output: { error: err.message } };
      }
    },
  });
}

// ─────────────────────────────────────────────────────────
// placeholder (code/plan은 B-4c/d에서 교체)
// ─────────────────────────────────────────────────────────

const codePlaceholderActions = Object.freeze({
  pending: placeholder('code:pending', 'START'),
  'analyzing-side-impact': placeholder('code:analyzing-side-impact', 'COMPLETE'),
  executing: placeholder('code:executing', 'COMPLETE'),
  materializing: placeholder('code:materializing', 'COMPLETE'),
  reviewing: placeholder('code:reviewing', 'PASS'),
  // TODO(B-4c): 실제 fix action으로 교체.
  fixing: placeholder('code:fixing', 'GIVE_UP'),
  // TODO(B-4c): 실제 escalating action (CEO 입력) 으로 교체.
  escalating: placeholder('code:escalating', 'SKIP'),
  committing: placeholder('code:committing', 'COMPLETE'),
});

const planPlaceholderActions = Object.freeze({
  pending: placeholder('plan:pending', 'START'),
  discussing: placeholder('plan:discussing', 'CONVERGE'),
  'awaiting-approval': placeholder('plan:awaiting-approval', 'APPROVE'),
  executing: placeholder('plan:executing', 'COMPLETE'),
});

// ─────────────────────────────────────────────────────────
// 라우팅
// ─────────────────────────────────────────────────────────

const ASK_PLACEHOLDER = Object.freeze({
  pending: placeholder('ask:pending', 'START'),
  answering: placeholder('ask:answering', 'COMPLETE'),
});

const REVIEW_PLACEHOLDER = Object.freeze({
  pending: placeholder('review:pending', 'START'),
  'fetching-diff': placeholder('review:fetching-diff', 'COMPLETE'),
  reviewing: placeholder('review:reviewing', 'COMPLETE'),
  synthesizing: placeholder('review:synthesizing', 'COMPLETE'),
});

const RESEARCH_PLACEHOLDER = Object.freeze({
  pending: placeholder('research:pending', 'START'),
  researching: placeholder('research:researching', 'COMPLETE'),
  'cross-reviewing': placeholder('research:cross-reviewing', 'COMPLETE'),
  synthesizing: placeholder('research:synthesizing', 'COMPLETE'),
});

/**
 * 작업 유형별 기본 action 매핑.
 *
 * 활성화 조건 (둘 중 하나면 LLM 모드):
 * - `options.callLLM` 함수 주입 (테스트/커스텀 LLM)
 * - `options.useLLM === true` (기본 callLLMWithFallback 사용)
 *
 * 활성화 안 되면 placeholder (외부 API 의존 없음, 테스트/시연용).
 *
 * @param {string} taskType
 * @param {object} [options] - { callLLM, provider, model, useLLM }
 * @returns {Object<string, Function>}
 */
export function defaultActions(taskType, options = {}) {
  const useLLM = typeof options.callLLM === 'function' || options.useLLM === true;

  switch (taskType) {
    case 'ask':
      return useLLM ? buildAskActions(options) : ASK_PLACEHOLDER;
    case 'review':
      return useLLM ? buildReviewActions(options) : REVIEW_PLACEHOLDER;
    case 'research':
      return useLLM ? buildResearchActions(options) : RESEARCH_PLACEHOLDER;
    case 'code':
      return codePlaceholderActions;
    case 'plan':
      return planPlaceholderActions;
    default:
      throw new Error(`지원하지 않는 taskType: "${taskType}"`);
  }
}
