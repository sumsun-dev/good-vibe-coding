import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callLLMWithFallback } from '../scripts/lib/llm/llm-fallback.js';
import { AppError } from '../scripts/lib/core/validators.js';

function makeRetryableError(status = 429) {
  const err = new AppError(`mock ${status}`, 'SYSTEM_ERROR');
  err.statusCode = status;
  return err;
}

describe('callLLMWithFallback', () => {
  let callLLM;
  beforeEach(() => {
    callLLM = vi.fn();
  });

  it('첫 모델 성공 시 그대로 반환 (폴백 안 함)', async () => {
    callLLM.mockResolvedValueOnce({ text: 'ok', model: 'opus', tokenCount: 100 });
    const result = await callLLMWithFallback('claude', 'hello', {
      model: 'opus',
      callLLM,
    });
    expect(result.text).toBe('ok');
    expect(result.model).toBe('opus');
    expect(result.fallbackChain).toEqual(['opus']);
    expect(result.fallbackUsed).toBe(false);
    expect(callLLM).toHaveBeenCalledTimes(1);
  });

  it('첫 모델 retryable 에러 시 다음 모델로 폴백', async () => {
    callLLM
      .mockRejectedValueOnce(makeRetryableError(429))
      .mockResolvedValueOnce({ text: 'ok-from-sonnet', model: 'sonnet', tokenCount: 80 });

    const result = await callLLMWithFallback('claude', 'hello', {
      model: 'opus',
      callLLM,
    });

    expect(result.text).toBe('ok-from-sonnet');
    expect(result.model).toBe('sonnet');
    expect(result.fallbackChain).toEqual(['opus', 'sonnet']);
    expect(result.fallbackUsed).toBe(true);
    expect(callLLM).toHaveBeenCalledTimes(2);
  });

  it('모든 모델 실패 시 최종 에러를 throw', async () => {
    callLLM
      .mockRejectedValueOnce(makeRetryableError(503))
      .mockRejectedValueOnce(makeRetryableError(503))
      .mockRejectedValueOnce(makeRetryableError(503));

    await expect(
      callLLMWithFallback('claude', 'hello', { model: 'opus', callLLM }),
    ).rejects.toThrow(/503/);
    expect(callLLM).toHaveBeenCalledTimes(3);
  });

  it('비-재시도 에러(401)는 즉시 throw, 폴백 안 함', async () => {
    const err = new AppError('mock 401 unauthorized', 'SYSTEM_ERROR');
    err.statusCode = 401;
    callLLM.mockRejectedValueOnce(err);

    await expect(
      callLLMWithFallback('claude', 'hello', { model: 'opus', callLLM }),
    ).rejects.toThrow(/401/);
    expect(callLLM).toHaveBeenCalledTimes(1);
  });

  it('explicit modelChain을 따른다', async () => {
    callLLM
      .mockRejectedValueOnce(makeRetryableError(429))
      .mockResolvedValueOnce({ text: 'tiny', model: 'haiku', tokenCount: 10 });

    const result = await callLLMWithFallback('claude', 'hello', {
      modelChain: ['opus', 'haiku'], // sonnet 건너뛰기
      callLLM,
    });

    expect(result.fallbackChain).toEqual(['opus', 'haiku']);
    expect(result.fallbackUsed).toBe(true);
    expect(callLLM).toHaveBeenCalledTimes(2);
    expect(callLLM.mock.calls[1][2]).toMatchObject({ model: 'haiku' });
  });

  it('알 수 없는 모델로 시작하면 폴백 체인 없이 호출 (단일 시도)', async () => {
    callLLM.mockRejectedValueOnce(makeRetryableError(429));
    await expect(
      callLLMWithFallback('claude', 'hello', { model: 'mystery-model', callLLM }),
    ).rejects.toThrow(/429/);
    expect(callLLM).toHaveBeenCalledTimes(1);
  });

  it('onFallback 콜백이 폴백 시점에 실행된다', async () => {
    callLLM
      .mockRejectedValueOnce(makeRetryableError(429))
      .mockResolvedValueOnce({ text: 'ok', model: 'sonnet', tokenCount: 50 });

    const events = [];
    await callLLMWithFallback('claude', 'hello', {
      model: 'opus',
      callLLM,
      onFallback: (info) => events.push(info),
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      from: 'opus',
      to: 'sonnet',
      reason: expect.stringMatching(/429/),
    });
  });

  it('fallback 시 options(maxTokens 등)는 보존된다', async () => {
    callLLM
      .mockRejectedValueOnce(makeRetryableError(429))
      .mockResolvedValueOnce({ text: 'ok', model: 'sonnet', tokenCount: 50 });

    await callLLMWithFallback('claude', 'hello', {
      model: 'opus',
      maxTokens: 8192,
      timeout: 30_000,
      callLLM,
    });

    expect(callLLM.mock.calls[1][2]).toMatchObject({
      model: 'sonnet',
      maxTokens: 8192,
      timeout: 30_000,
    });
  });
});
