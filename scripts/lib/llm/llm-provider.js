/**
 * llm-provider — 멀티모델 LLM 프로바이더 추상화
 *
 * Node 18+ 네이티브 fetch 사용, 추가 의존성 없음.
 * Claude, OpenAI, Gemini 3개 프로바이더 지원.
 * 프로바이더별 요청/응답 포맷 변환을 내부 처리.
 */

import { loadAuth } from './auth-manager.js';
import { callGeminiCli } from './gemini-bridge.js';
import { config } from '../core/config.js';
import { AppError, inputError, notFoundError } from '../core/validators.js';
import { truncateText } from '../core/text-utils.js';

/** 재시도 가능한 HTTP 상태 코드 */
const RETRYABLE_STATUS_CODES = new Set(config.http.retryableCodes);

/** 재시도 가능한 네트워크 에러 코드 */
const RETRYABLE_ERROR_CODES = new Set([
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'UND_ERR_CONNECT_TIMEOUT',
]);

/** 프로바이더별 API 엔드포인트 */
const PROVIDER_ENDPOINTS = {
  claude: 'https://api.anthropic.com/v1/messages',
  openai: 'https://api.openai.com/v1/chat/completions',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
};

/** 프로바이더별 기본 모델 */
const DEFAULT_MODELS = {
  claude: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  gemini: 'gemini-2.0-flash',
};

/** 지원 프로바이더 목록 */
export const SUPPORTED_PROVIDERS = ['claude', 'openai', 'gemini'];

/**
 * 통합 LLM 호출 인터페이스.
 * @param {string} providerId - 'claude' | 'openai' | 'gemini'
 * @param {string} prompt - 사용자 메시지 텍스트
 * @param {object} options - { model, maxTokens, timeout, systemMessage }
 * @param {string} [options.systemMessage] - 시스템 메시지 (Claude: cache_control 적용, OpenAI: system role, Gemini: systemInstruction)
 * @returns {Promise<{ text: string, provider: string, model: string, tokenCount: number }>}
 */
export async function callLLM(providerId, prompt, options = {}) {
  if (!SUPPORTED_PROVIDERS.includes(providerId)) {
    throw inputError(`지원하지 않는 프로바이더: ${providerId}`);
  }

  const auth = await loadAuth(providerId);
  if (!auth) {
    throw notFoundError(`${providerId} 인증 정보가 없습니다. 먼저 connect 명령으로 인증하세요.`);
  }

  // Gemini CLI 인증일 때 서브프로세스 경로로 분기
  if (providerId === 'gemini' && auth.type === 'cli') {
    const model = options.model || DEFAULT_MODELS.gemini;
    return callGeminiCli(prompt, { model, timeout: options.timeout });
  }

  const model = options.model || DEFAULT_MODELS[providerId];
  const request = buildProviderRequest(providerId, prompt, model, options);
  const headers = buildAuthHeaders(providerId, auth);
  const maxRetries = options.maxRetries ?? config.llm.maxRetries;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(request.body),
        signal: AbortSignal.timeout(options.timeout || config.llm.defaultTimeout),
      });

      if (!response.ok) {
        const errorText = await response.text();
        const truncated = truncateText(errorText, config.http.errorTruncateLength);
        const err = new AppError(
          `${providerId} API 호출 실패 (${response.status}): ${truncated}`,
          'SYSTEM_ERROR',
        );
        err.statusCode = response.status;

        // 재시도 불가 상태 코드(4xx, 429 제외)는 즉시 throw
        if (!RETRYABLE_STATUS_CODES.has(response.status)) {
          throw err;
        }
        lastError = err;
      } else {
        const data = await response.json();
        return parseProviderResponse(providerId, data, model);
      }
    } catch (err) {
      // 이미 재시도 불가로 판정된 에러는 즉시 재throw
      if (
        err instanceof AppError &&
        err.statusCode &&
        !RETRYABLE_STATUS_CODES.has(err.statusCode)
      ) {
        throw err;
      }
      // 네트워크 에러 중 재시도 가능한 것만 재시도
      if (
        !(err instanceof AppError) &&
        !RETRYABLE_ERROR_CODES.has(err.cause?.code) &&
        err.code !== 'UND_ERR_CONNECT_TIMEOUT' &&
        err.name !== 'TimeoutError'
      ) {
        throw err;
      }
      lastError = err;
    }

    // 마지막 시도면 재시도 안 함
    if (attempt < maxRetries) {
      const delay =
        Math.min(Math.pow(2, attempt) * 1000, config.http.maxRetryDelay) +
        Math.random() * config.http.retryJitter;
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}

/**
 * 프로바이더별 요청 포맷 변환.
 * @param {string} providerId
 * @param {string} prompt
 * @param {string} model
 * @param {object} options
 * @param {string} [options.systemMessage] - 시스템 메시지
 * @returns {{ url: string, body: object }}
 */
export function buildProviderRequest(providerId, prompt, model, options = {}) {
  const maxTokens = options.maxTokens || config.llm.defaultMaxTokens;
  const { systemMessage } = options;

  switch (providerId) {
    case 'claude': {
      const body = { model, max_tokens: maxTokens };
      if (systemMessage) {
        body.system = [{ type: 'text', text: systemMessage, cache_control: { type: 'ephemeral' } }];
      }
      body.messages = [{ role: 'user', content: prompt }];
      return { url: PROVIDER_ENDPOINTS.claude, body };
    }
    case 'openai': {
      const messages = systemMessage
        ? [
            { role: 'system', content: systemMessage },
            { role: 'user', content: prompt },
          ]
        : [{ role: 'user', content: prompt }];
      return {
        url: PROVIDER_ENDPOINTS.openai,
        body: { model, max_tokens: maxTokens, messages },
      };
    }
    case 'gemini': {
      const body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      };
      if (systemMessage) {
        body.systemInstruction = { parts: [{ text: systemMessage }] };
      }
      return {
        url: `${PROVIDER_ENDPOINTS.gemini}/${model}:generateContent`,
        body,
      };
    }
    default:
      throw inputError(`지원하지 않는 프로바이더: ${providerId}`);
  }
}

/**
 * 프로바이더별 인증 헤더 생성.
 * @param {string} providerId
 * @param {object} auth - 인증 정보
 * @returns {object} HTTP 헤더
 */
export function buildAuthHeaders(providerId, auth) {
  switch (providerId) {
    case 'claude':
      return {
        'x-api-key': auth.apiKey,
        'anthropic-version': '2023-06-01',
      };
    case 'openai':
      return { Authorization: `Bearer ${auth.apiKey}` };
    case 'gemini':
      return { 'x-goog-api-key': auth.apiKey };
    default:
      return {};
  }
}

/**
 * 프로바이더별 응답 정규화.
 * @param {string} providerId
 * @param {object} data - API 응답 데이터
 * @param {string} model - 사용된 모델
 * @returns {{ text: string, provider: string, model: string, tokenCount: number }}
 */
export function parseProviderResponse(providerId, data, model) {
  switch (providerId) {
    case 'claude':
      return {
        text: data.content?.[0]?.text || '',
        provider: 'claude',
        model: data.model || model,
        tokenCount: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        inputTokens: data.usage?.input_tokens || 0,
        outputTokens: data.usage?.output_tokens || 0,
        cacheCreationInputTokens: data.usage?.cache_creation_input_tokens || 0,
        cacheReadInputTokens: data.usage?.cache_read_input_tokens || 0,
      };
    case 'openai':
      return {
        text: data.choices?.[0]?.message?.content || '',
        provider: 'openai',
        model: data.model || model,
        tokenCount: data.usage?.total_tokens || 0,
        inputTokens: data.usage?.prompt_tokens || 0,
        outputTokens: data.usage?.completion_tokens || 0,
      };
    case 'gemini':
      return {
        text: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
        provider: 'gemini',
        model: model,
        tokenCount:
          (data.usageMetadata?.promptTokenCount || 0) +
          (data.usageMetadata?.candidatesTokenCount || 0),
        inputTokens: data.usageMetadata?.promptTokenCount || 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
      };
    default:
      throw inputError(`지원하지 않는 프로바이더 응답: ${providerId}`);
  }
}

/**
 * 프로바이더 연결 검증 (간단한 ping).
 * @param {string} providerId
 * @returns {Promise<{ connected: boolean, model: string, error?: string }>}
 */
export async function verifyConnection(providerId) {
  try {
    const result = await callLLM(providerId, 'Hello, respond with just "ok".', {
      maxTokens: config.llm.pingMaxTokens,
      timeout: config.llm.pingTimeout,
    });
    return { connected: true, model: result.model };
  } catch (err) {
    return { connected: false, model: '', error: err.message };
  }
}
