/**
 * llm-fallback — 자동 모델 폴백 라우팅
 *
 * 첫 모델 호출이 retryable 에러로 실패하면 ModelSelector.selectFallback로
 * 다음 모델로 자동 전환한다. opus → sonnet → haiku 순.
 *
 * 비-재시도 에러(401, 403 등 권한)는 즉시 throw하여 폴백 시도 안 함.
 *
 * 외부 의존성 0. callLLM을 인자로 받아 dependency injection.
 */

import { createModelSelector, DEFAULT_FALLBACK_CHAIN } from './model-selector.js';
import { callLLM as defaultCallLLM } from './llm-provider.js';
import { config } from '../core/config.js';

const RETRYABLE_STATUS_CODES = new Set(config.http.retryableCodes);

const defaultSelector = createModelSelector('default');

function isFallbackable(err) {
  if (!err) return false;
  if (typeof err.statusCode === 'number') return RETRYABLE_STATUS_CODES.has(err.statusCode);
  // statusCode 없는 에러 (네트워크 등)는 폴백 시도 — llm-provider가 자체 재시도 후 던진 것
  return true;
}

function buildModelChain(startModel, explicitChain) {
  if (Array.isArray(explicitChain) && explicitChain.length > 0) {
    return explicitChain;
  }
  // selectFallback으로 체인 구성: startModel → fallback → fallback → ...
  const chain = [startModel];
  let current = startModel;
  while (true) {
    const next = defaultSelector.selectFallback(current);
    if (!next || chain.includes(next)) break;
    chain.push(next);
    current = next;
  }
  // startModel이 DEFAULT_FALLBACK_CHAIN에 없으면 단일 시도만
  if (chain.length === 1 && !DEFAULT_FALLBACK_CHAIN.includes(startModel)) {
    return [startModel];
  }
  return chain;
}

/**
 * 모델 폴백을 자동 적용하여 LLM을 호출한다.
 *
 * @param {string} provider - 'claude' | 'openai' | 'gemini'
 * @param {string} prompt
 * @param {object} options
 * @param {string} [options.model] - 시작 모델
 * @param {string[]} [options.modelChain] - 명시적 폴백 체인 (model 무시)
 * @param {(info: { from: string, to: string, reason: string }) => void} [options.onFallback] - 폴백 시점 콜백
 * @param {Function} [options.callLLM] - DI용 callLLM (기본: llm-provider.callLLM)
 * @param {number} [options.maxTokens] - 단일 시도 옵션 (전달)
 * @param {number} [options.timeout] - 단일 시도 옵션 (전달)
 * @param {string} [options.systemMessage]
 * @returns {Promise<{ text: string, model: string, fallbackChain: string[], fallbackUsed: boolean, ... }>}
 */
export async function callLLMWithFallback(provider, prompt, options = {}) {
  const callLLM = options.callLLM || defaultCallLLM;
  const startModel = options.model;
  const chain = buildModelChain(startModel, options.modelChain);

  const usedChain = [];
  let lastError;

  // callLLM에 전달할 옵션 (callLLM/onFallback/modelChain은 제거)
  const passOptions = { ...options };
  delete passOptions.callLLM;
  delete passOptions.onFallback;
  delete passOptions.modelChain;

  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    usedChain.push(model);

    try {
      const result = await callLLM(provider, prompt, { ...passOptions, model });
      return {
        ...result,
        fallbackChain: usedChain,
        fallbackUsed: usedChain.length > 1,
      };
    } catch (err) {
      lastError = err;

      if (!isFallbackable(err)) {
        // 권한 에러 등은 즉시 throw — 폴백 의미 없음
        throw err;
      }

      // 마지막 모델 실패 시 throw
      if (i === chain.length - 1) throw err;

      // 다음 모델로 폴백
      const nextModel = chain[i + 1];
      if (typeof options.onFallback === 'function') {
        try {
          options.onFallback({
            from: model,
            to: nextModel,
            reason: err.message || `status ${err.statusCode}`,
          });
        } catch {
          // 콜백 에러는 무시
        }
      }
    }
  }

  // 도달 불가 (마지막 모델 실패는 위에서 throw)
  throw lastError;
}
