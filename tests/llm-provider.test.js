import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SUPPORTED_PROVIDERS,
  buildProviderRequest,
  buildAuthHeaders,
  parseProviderResponse,
} from '../scripts/lib/llm/llm-provider.js';

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
    expect(() => buildProviderRequest('unknown', prompt, 'model')).toThrow(
      '지원하지 않는 프로바이더',
    );
  });

  // systemMessage 옵션 테스트

  it('Claude: systemMessage 제공 시 system 배열에 cache_control을 포함한다', () => {
    const req = buildProviderRequest('claude', prompt, 'claude-sonnet-4-6', {
      systemMessage: '당신은 유용한 어시스턴트입니다.',
    });
    expect(req.body.system).toBeDefined();
    expect(req.body.system).toHaveLength(1);
    expect(req.body.system[0].type).toBe('text');
    expect(req.body.system[0].text).toBe('당신은 유용한 어시스턴트입니다.');
    expect(req.body.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(req.body.messages[0].role).toBe('user');
    expect(req.body.messages[0].content).toBe(prompt);
  });

  it('Claude: systemMessage 없으면 system 필드가 없다 (하위 호환)', () => {
    const req = buildProviderRequest('claude', prompt, 'claude-sonnet-4-6');
    expect(req.body.system).toBeUndefined();
    expect(req.body.messages[0].role).toBe('user');
    expect(req.body.messages[0].content).toBe(prompt);
  });

  it('OpenAI: systemMessage 제공 시 system role 메시지를 첫 번째로 추가한다', () => {
    const req = buildProviderRequest('openai', prompt, 'gpt-4o', {
      systemMessage: '당신은 전문가입니다.',
    });
    expect(req.body.messages).toHaveLength(2);
    expect(req.body.messages[0].role).toBe('system');
    expect(req.body.messages[0].content).toBe('당신은 전문가입니다.');
    expect(req.body.messages[1].role).toBe('user');
    expect(req.body.messages[1].content).toBe(prompt);
  });

  it('OpenAI: systemMessage 없으면 user 메시지만 포함한다 (하위 호환)', () => {
    const req = buildProviderRequest('openai', prompt, 'gpt-4o');
    expect(req.body.messages).toHaveLength(1);
    expect(req.body.messages[0].role).toBe('user');
  });

  it('Gemini: systemMessage 제공 시 systemInstruction을 설정한다', () => {
    const req = buildProviderRequest('gemini', prompt, 'gemini-2.0-flash', {
      systemMessage: '시스템 지침입니다.',
    });
    expect(req.body.systemInstruction).toBeDefined();
    expect(req.body.systemInstruction.parts[0].text).toBe('시스템 지침입니다.');
    expect(req.body.contents[0].parts[0].text).toBe(prompt);
  });

  it('Gemini: systemMessage 없으면 systemInstruction 필드가 없다 (하위 호환)', () => {
    const req = buildProviderRequest('gemini', prompt, 'gemini-2.0-flash');
    expect(req.body.systemInstruction).toBeUndefined();
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
    expect(result.inputTokens).toBe(100);
    expect(result.outputTokens).toBe(200);
  });

  it('OpenAI 응답을 파싱한다', () => {
    const data = {
      choices: [{ message: { role: 'assistant', content: '응답입니다' } }],
      model: 'gpt-4o-2025-01-01',
      usage: { total_tokens: 500, prompt_tokens: 150, completion_tokens: 350 },
    };
    const result = parseProviderResponse('openai', data, 'gpt-4o');
    expect(result.text).toBe('응답입니다');
    expect(result.provider).toBe('openai');
    expect(result.model).toBe('gpt-4o-2025-01-01');
    expect(result.tokenCount).toBe(500);
    expect(result.inputTokens).toBe(150);
    expect(result.outputTokens).toBe(350);
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
    expect(result.inputTokens).toBe(50);
    expect(result.outputTokens).toBe(100);
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

  it('알 수 없는 프로바이더는 에러를 던진다', () => {
    expect(() => parseProviderResponse('unknown', { text: 'test' }, 'model')).toThrow(
      '지원하지 않는 프로바이더 응답',
    );
  });

  it('Claude: cache_creation_input_tokens와 cache_read_input_tokens를 파싱한다', () => {
    const data = {
      content: [{ type: 'text', text: '캐시 응답' }],
      model: 'claude-sonnet-4-6',
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 200,
        cache_read_input_tokens: 80,
      },
    };
    const result = parseProviderResponse('claude', data, 'claude-sonnet-4-6');
    expect(result.cacheCreationInputTokens).toBe(200);
    expect(result.cacheReadInputTokens).toBe(80);
    expect(result.tokenCount).toBe(150);
  });

  it('Claude: 캐시 토큰 없을 때 0으로 기본값 처리한다', () => {
    const data = {
      content: [{ type: 'text', text: '일반 응답' }],
      model: 'claude-sonnet-4-6',
      usage: { input_tokens: 10, output_tokens: 20 },
    };
    const result = parseProviderResponse('claude', data, 'claude-sonnet-4-6');
    expect(result.cacheCreationInputTokens).toBe(0);
    expect(result.cacheReadInputTokens).toBe(0);
  });
});

// --- callLLM ---

describe('callLLM', () => {
  let callLLM;
  let mockLoadAuth;
  let mockCallGeminiCli;

  beforeEach(async () => {
    vi.resetModules();

    mockLoadAuth = vi.fn();
    mockCallGeminiCli = vi.fn();

    vi.doMock('../scripts/lib/llm/auth-manager.js', () => ({
      loadAuth: mockLoadAuth,
    }));
    vi.doMock('../scripts/lib/llm/gemini-bridge.js', () => ({
      callGeminiCli: mockCallGeminiCli,
    }));

    const mod = await import('../scripts/lib/llm/llm-provider.js');
    callLLM = mod.callLLM;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Claude 프로바이더로 성공적으로 호출한다', async () => {
    mockLoadAuth.mockResolvedValue({ type: 'api-key', apiKey: 'sk-ant-test' });
    const mockResponse = {
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '응답' }],
        model: 'claude-sonnet-4-6',
        usage: { input_tokens: 10, output_tokens: 20 },
      }),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    const result = await callLLM('claude', '안녕하세요');
    expect(result.text).toBe('응답');
    expect(result.provider).toBe('claude');
    expect(result.tokenCount).toBe(30);
  });

  it('OpenAI 프로바이더로 성공적으로 호출한다', async () => {
    mockLoadAuth.mockResolvedValue({ type: 'api-key', apiKey: 'sk-test' });
    const mockResponse = {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'OpenAI 응답' } }],
        model: 'gpt-4o',
        usage: { total_tokens: 50 },
      }),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    const result = await callLLM('openai', '안녕하세요');
    expect(result.text).toBe('OpenAI 응답');
    expect(result.provider).toBe('openai');
    expect(result.tokenCount).toBe(50);
  });

  it('Gemini CLI 인증 시 callGeminiCli로 분기한다', async () => {
    mockLoadAuth.mockResolvedValue({ type: 'cli' });
    mockCallGeminiCli.mockResolvedValue({
      text: 'Gemini 응답',
      model: 'gemini-2.0-flash',
      tokenCount: 40,
    });

    const result = await callLLM('gemini', '안녕하세요');
    expect(result.text).toBe('Gemini 응답');
    expect(mockCallGeminiCli).toHaveBeenCalled();
  });

  it('지원하지 않는 프로바이더는 에러를 던진다', async () => {
    await expect(callLLM('unknown', '안녕')).rejects.toThrow('지원하지 않는 프로바이더');
  });

  it('인증 정보가 없으면 에러를 던진다', async () => {
    mockLoadAuth.mockResolvedValue(null);
    await expect(callLLM('claude', '안녕')).rejects.toThrow('인증 정보가 없습니다');
  });

  it('HTTP 에러를 처리한다', async () => {
    mockLoadAuth.mockResolvedValue({ type: 'api-key', apiKey: 'sk-ant-test' });
    const mockResponse = {
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

    await expect(callLLM('claude', '안녕')).rejects.toThrow('API 호출 실패 (401)');
  });

  it('타임아웃 옵션을 전달한다', async () => {
    mockLoadAuth.mockResolvedValue({ type: 'api-key', apiKey: 'sk-ant-test' });
    const mockResponse = {
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '응답' }],
        model: 'claude-sonnet-4-6',
        usage: { input_tokens: 5, output_tokens: 5 },
      }),
    };
    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal('fetch', fetchMock);

    await callLLM('claude', '안녕', { timeout: 5000 });
    expect(fetchMock).toHaveBeenCalled();
  });

  it('429 시 재시도 후 성공한다 (#29)', async () => {
    mockLoadAuth.mockResolvedValue({ type: 'api-key', apiKey: 'sk-ant-test' });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429, text: async () => 'Rate limited' })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: '성공' }],
          model: 'claude-sonnet-4-6',
          usage: { input_tokens: 5, output_tokens: 5 },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await callLLM('claude', '안녕');
    expect(result.text).toBe('성공');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('401 시 즉시 throw한다 (#29)', async () => {
    mockLoadAuth.mockResolvedValue({ type: 'api-key', apiKey: 'sk-ant-test' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(callLLM('claude', '안녕')).rejects.toThrow('API 호출 실패 (401)');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('systemMessage 옵션으로 Claude 프로바이더를 호출하면 system 배열이 포함된 요청을 보낸다', async () => {
    mockLoadAuth.mockResolvedValue({ type: 'api-key', apiKey: 'sk-ant-test' });
    const mockResponse = {
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '시스템 응답' }],
        model: 'claude-sonnet-4-6',
        usage: {
          input_tokens: 10,
          output_tokens: 20,
          cache_creation_input_tokens: 500,
          cache_read_input_tokens: 0,
        },
      }),
    };
    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal('fetch', fetchMock);

    const result = await callLLM('claude', '사용자 질문', {
      systemMessage: '당신은 전문가입니다.',
    });

    expect(result.text).toBe('시스템 응답');
    expect(result.cacheCreationInputTokens).toBe(500);
    expect(result.cacheReadInputTokens).toBe(0);

    const [, fetchOptions] = fetchMock.mock.calls[0];
    const body = JSON.parse(fetchOptions.body);
    expect(body.system).toBeDefined();
    expect(body.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(body.system[0].text).toBe('당신은 전문가입니다.');
    expect(body.messages[0].content).toBe('사용자 질문');
  });

  it('systemMessage 옵션으로 OpenAI 프로바이더를 호출하면 system role 메시지가 포함된 요청을 보낸다', async () => {
    mockLoadAuth.mockResolvedValue({ type: 'api-key', apiKey: 'sk-test' });
    const mockResponse = {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'OpenAI 시스템 응답' } }],
        model: 'gpt-4o',
        usage: { total_tokens: 60, prompt_tokens: 30, completion_tokens: 30 },
      }),
    };
    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal('fetch', fetchMock);

    const result = await callLLM('openai', '사용자 질문', {
      systemMessage: '당신은 분석가입니다.',
    });

    expect(result.text).toBe('OpenAI 시스템 응답');

    const [, fetchOptions] = fetchMock.mock.calls[0];
    const body = JSON.parse(fetchOptions.body);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toBe('당신은 분석가입니다.');
    expect(body.messages[1].role).toBe('user');
    expect(body.messages[1].content).toBe('사용자 질문');
  });

  it('systemMessage 없이 호출하면 기존과 동일하게 동작한다 (하위 호환)', async () => {
    mockLoadAuth.mockResolvedValue({ type: 'api-key', apiKey: 'sk-ant-test' });
    const mockResponse = {
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: '일반 응답' }],
        model: 'claude-sonnet-4-6',
        usage: { input_tokens: 5, output_tokens: 10 },
      }),
    };
    const fetchMock = vi.fn().mockResolvedValue(mockResponse);
    vi.stubGlobal('fetch', fetchMock);

    const result = await callLLM('claude', '안녕하세요');

    expect(result.text).toBe('일반 응답');

    const [, fetchOptions] = fetchMock.mock.calls[0];
    const body = JSON.parse(fetchOptions.body);
    expect(body.system).toBeUndefined();
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe('user');
  });

  it('3회 실패 시 최종 에러를 던진다 (#29)', { timeout: 30000 }, async () => {
    mockLoadAuth.mockResolvedValue({ type: 'api-key', apiKey: 'sk-ant-test' });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(callLLM('claude', '안녕')).rejects.toThrow('API 호출 실패 (500)');
    // maxRetries(3) + 1 initial = 4 calls
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

// --- verifyConnection ---

describe('verifyConnection', () => {
  let verifyConnection;
  let mockLoadAuth;

  beforeEach(async () => {
    vi.resetModules();
    mockLoadAuth = vi.fn();
    vi.doMock('../scripts/lib/llm/auth-manager.js', () => ({
      loadAuth: mockLoadAuth,
    }));
    vi.doMock('../scripts/lib/llm/gemini-bridge.js', () => ({
      callGeminiCli: vi
        .fn()
        .mockResolvedValue({ text: 'ok', model: 'gemini-2.0-flash', tokenCount: 5 }),
    }));

    const mod = await import('../scripts/lib/llm/llm-provider.js');
    verifyConnection = mod.verifyConnection;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('연결 성공 시 connected: true를 반환한다', async () => {
    mockLoadAuth.mockResolvedValue({ type: 'api-key', apiKey: 'sk-ant-test' });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'ok' }],
          model: 'claude-sonnet-4-6',
          usage: { input_tokens: 3, output_tokens: 1 },
        }),
      }),
    );

    const result = await verifyConnection('claude');
    expect(result.connected).toBe(true);
    expect(result.model).toBe('claude-sonnet-4-6');
  });

  it('연결 실패 시 connected: false를 반환한다', async () => {
    mockLoadAuth.mockResolvedValue(null);
    const result = await verifyConnection('claude');
    expect(result.connected).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('네트워크 에러 시 connected: false를 반환한다', async () => {
    mockLoadAuth.mockResolvedValue({ type: 'api-key', apiKey: 'sk-ant-test' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const result = await verifyConnection('claude');
    expect(result.connected).toBe(false);
    expect(result.error).toContain('network error');
  });
});
