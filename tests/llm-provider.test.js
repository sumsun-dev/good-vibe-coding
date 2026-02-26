import { describe, it, expect } from 'vitest';
import {
  SUPPORTED_PROVIDERS,
  buildProviderRequest,
  buildAuthHeaders,
  parseProviderResponse,
} from '../scripts/lib/llm-provider.js';

// --- SUPPORTED_PROVIDERS ---

describe('SUPPORTED_PROVIDERS', () => {
  it('claude, openai, gemini을 지원한다', () => {
    expect(SUPPORTED_PROVIDERS).toContain('claude');
    expect(SUPPORTED_PROVIDERS).toContain('openai');
    expect(SUPPORTED_PROVIDERS).toContain('gemini');
    expect(SUPPORTED_PROVIDERS).toHaveLength(3);
  });
});

// --- buildProviderRequest ---

describe('buildProviderRequest', () => {
  const prompt = '안녕하세요';

  it('Claude 요청을 생성한다', () => {
    const req = buildProviderRequest('claude', prompt, 'claude-sonnet-4-6');
    expect(req.url).toContain('anthropic.com');
    expect(req.body.model).toBe('claude-sonnet-4-6');
    expect(req.body.messages[0].content).toBe(prompt);
    expect(req.body.max_tokens).toBe(4096);
  });

  it('OpenAI 요청을 생성한다', () => {
    const req = buildProviderRequest('openai', prompt, 'gpt-4o');
    expect(req.url).toContain('openai.com');
    expect(req.body.model).toBe('gpt-4o');
    expect(req.body.messages[0].role).toBe('user');
    expect(req.body.messages[0].content).toBe(prompt);
  });

  it('Gemini 요청을 생성한다', () => {
    const req = buildProviderRequest('gemini', prompt, 'gemini-2.0-flash');
    expect(req.url).toContain('generativelanguage.googleapis.com');
    expect(req.url).toContain('gemini-2.0-flash');
    expect(req.body.contents[0].parts[0].text).toBe(prompt);
    expect(req.body.generationConfig.maxOutputTokens).toBe(4096);
  });

  it('커스텀 maxTokens를 적용한다', () => {
    const req = buildProviderRequest('claude', prompt, 'claude-sonnet-4-6', { maxTokens: 8192 });
    expect(req.body.max_tokens).toBe(8192);
  });

  it('지원하지 않는 프로바이더는 에러를 던진다', () => {
    expect(() => buildProviderRequest('unknown', prompt, 'model')).toThrow('지원하지 않는 프로바이더');
  });
});

// --- buildAuthHeaders ---

describe('buildAuthHeaders', () => {
  it('Claude API Key 헤더를 생성한다', () => {
    const headers = buildAuthHeaders('claude', { type: 'api-key', apiKey: 'sk-ant-test' });
    expect(headers['x-api-key']).toBe('sk-ant-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
  });

  it('OpenAI Bearer 토큰 헤더를 생성한다', () => {
    const headers = buildAuthHeaders('openai', { type: 'api-key', apiKey: 'sk-test' });
    expect(headers['Authorization']).toBe('Bearer sk-test');
  });

  it('Gemini OAuth 헤더를 생성한다', () => {
    const headers = buildAuthHeaders('gemini', { type: 'oauth', accessToken: 'ya29-test' });
    expect(headers['Authorization']).toBe('Bearer ya29-test');
  });

  it('Gemini API Key 헤더를 생성한다', () => {
    const headers = buildAuthHeaders('gemini', { type: 'api-key', apiKey: 'AI-test' });
    expect(headers['x-goog-api-key']).toBe('AI-test');
  });

  it('알 수 없는 프로바이더는 빈 헤더를 반환한다', () => {
    const headers = buildAuthHeaders('unknown', {});
    expect(headers).toEqual({});
  });
});

// --- parseProviderResponse ---

describe('parseProviderResponse', () => {
  it('Claude 응답을 파싱한다', () => {
    const data = {
      content: [{ type: 'text', text: '응답 텍스트' }],
      model: 'claude-sonnet-4-6',
      usage: { input_tokens: 100, output_tokens: 200 },
    };
    const result = parseProviderResponse('claude', data, 'claude-sonnet-4-6');
    expect(result.text).toBe('응답 텍스트');
    expect(result.provider).toBe('claude');
    expect(result.model).toBe('claude-sonnet-4-6');
    expect(result.tokenCount).toBe(300);
  });

  it('OpenAI 응답을 파싱한다', () => {
    const data = {
      choices: [{ message: { role: 'assistant', content: '응답입니다' } }],
      model: 'gpt-4o-2025-01-01',
      usage: { total_tokens: 500 },
    };
    const result = parseProviderResponse('openai', data, 'gpt-4o');
    expect(result.text).toBe('응답입니다');
    expect(result.provider).toBe('openai');
    expect(result.model).toBe('gpt-4o-2025-01-01');
    expect(result.tokenCount).toBe(500);
  });

  it('Gemini 응답을 파싱한다', () => {
    const data = {
      candidates: [{ content: { parts: [{ text: 'Gemini 응답' }] } }],
      usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 100 },
    };
    const result = parseProviderResponse('gemini', data, 'gemini-2.0-flash');
    expect(result.text).toBe('Gemini 응답');
    expect(result.provider).toBe('gemini');
    expect(result.model).toBe('gemini-2.0-flash');
    expect(result.tokenCount).toBe(150);
  });

  it('빈 응답을 처리한다 (Claude)', () => {
    const result = parseProviderResponse('claude', {}, 'claude-sonnet-4-6');
    expect(result.text).toBe('');
    expect(result.tokenCount).toBe(0);
  });

  it('빈 응답을 처리한다 (OpenAI)', () => {
    const result = parseProviderResponse('openai', {}, 'gpt-4o');
    expect(result.text).toBe('');
    expect(result.tokenCount).toBe(0);
  });

  it('빈 응답을 처리한다 (Gemini)', () => {
    const result = parseProviderResponse('gemini', {}, 'gemini-2.0-flash');
    expect(result.text).toBe('');
    expect(result.tokenCount).toBe(0);
  });

  it('알 수 없는 프로바이더는 빈 결과를 반환한다', () => {
    const result = parseProviderResponse('unknown', { text: 'test' }, 'model');
    expect(result.text).toBe('');
    expect(result.provider).toBe('unknown');
    expect(result.tokenCount).toBe(0);
  });
});
