/**
 * llm-provider — 멀티모델 LLM 프로바이더 추상화
 *
 * Node 18+ 네이티브 fetch 사용, 추가 의존성 없음.
 * Claude, OpenAI, Gemini 3개 프로바이더 지원.
 * 프로바이더별 요청/응답 포맷 변환을 내부 처리.
 */

import { loadAuth, isExpired, refreshOAuthToken } from './auth-manager.js';
import { callGeminiCli } from './gemini-bridge.js';

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
 * @param {string} prompt - 프롬프트 텍스트
 * @param {object} options - { model, maxTokens, timeout }
 * @returns {Promise<{ text: string, provider: string, model: string, tokenCount: number }>}
 */
export async function callLLM(providerId, prompt, options = {}) {
  if (!SUPPORTED_PROVIDERS.includes(providerId)) {
    throw new Error(`지원하지 않는 프로바이더: ${providerId}`);
  }

  let auth = await loadAuth(providerId);
  if (!auth) {
    throw new Error(`${providerId} 인증 정보가 없습니다. 먼저 connect 명령으로 인증하세요.`);
  }

  // Gemini CLI 인증일 때 서브프로세스 경로로 분기
  if (providerId === 'gemini' && auth.type === 'cli') {
    const model = options.model || DEFAULT_MODELS.gemini;
    return callGeminiCli(prompt, { model, timeout: options.timeout });
  }

  // OAuth 토큰 만료 시 자동 갱신
  if (auth.type === 'oauth' && auth.expiresAt && isExpired(auth.expiresAt)) {
    auth = await refreshOAuthToken(providerId, auth);
  }

  const model = options.model || DEFAULT_MODELS[providerId];
  const request = buildProviderRequest(providerId, prompt, model, options);
  const headers = buildAuthHeaders(providerId, auth);

  const response = await fetch(request.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(request.body),
    signal: AbortSignal.timeout(options.timeout || 60000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${providerId} API 호출 실패 (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return parseProviderResponse(providerId, data, model);
}

/**
 * 프로바이더별 요청 포맷 변환.
 * @param {string} providerId
 * @param {string} prompt
 * @param {string} model
 * @param {object} options
 * @returns {{ url: string, body: object }}
 */
export function buildProviderRequest(providerId, prompt, model, options = {}) {
  const maxTokens = options.maxTokens || 4096;

  switch (providerId) {
    case 'claude':
      return {
        url: PROVIDER_ENDPOINTS.claude,
        body: {
          model,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
        },
      };
    case 'openai':
      return {
        url: PROVIDER_ENDPOINTS.openai,
        body: {
          model,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
        },
      };
    case 'gemini':
      return {
        url: `${PROVIDER_ENDPOINTS.gemini}/${model}:generateContent`,
        body: {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: maxTokens },
        },
      };
    default:
      throw new Error(`지원하지 않는 프로바이더: ${providerId}`);
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
      return { 'Authorization': `Bearer ${auth.apiKey}` };
    case 'gemini':
      if (auth.type === 'oauth') {
        return { 'Authorization': `Bearer ${auth.accessToken}` };
      }
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
      };
    case 'openai':
      return {
        text: data.choices?.[0]?.message?.content || '',
        provider: 'openai',
        model: data.model || model,
        tokenCount: data.usage?.total_tokens || 0,
      };
    case 'gemini':
      return {
        text: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
        provider: 'gemini',
        model: model,
        tokenCount: (data.usageMetadata?.promptTokenCount || 0) +
                    (data.usageMetadata?.candidatesTokenCount || 0),
      };
    default:
      return { text: '', provider: providerId, model: model || '', tokenCount: 0 };
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
      maxTokens: 16,
      timeout: 15000,
    });
    return { connected: true, model: result.model };
  } catch (err) {
    return { connected: false, model: '', error: err.message };
  }
}
