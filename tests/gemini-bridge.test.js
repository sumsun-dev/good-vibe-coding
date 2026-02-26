import { describe, it, expect } from 'vitest';
import { parseGeminiCliOutput } from '../scripts/lib/gemini-bridge.js';

describe('parseGeminiCliOutput', () => {
  it('정상 JSON 응답을 파싱한다 (response + stats)', () => {
    const stdout = JSON.stringify({
      response: '리뷰 결과입니다.',
      stats: {
        models: {
          'gemini-2.5-flash': { tokens: { total: 1234 } },
        },
      },
    });

    const result = parseGeminiCliOutput(stdout, 'gemini-2.0-flash');
    expect(result.text).toBe('리뷰 결과입니다.');
    expect(result.provider).toBe('gemini');
    expect(result.model).toBe('gemini-2.5-flash');
    expect(result.tokenCount).toBe(1234);
  });

  it('stats가 없는 응답을 처리한다', () => {
    const stdout = JSON.stringify({ response: '간단한 응답' });

    const result = parseGeminiCliOutput(stdout, 'gemini-2.0-flash');
    expect(result.text).toBe('간단한 응답');
    expect(result.provider).toBe('gemini');
    expect(result.model).toBe('gemini-2.0-flash');
    expect(result.tokenCount).toBe(0);
  });

  it('빈 stdout을 처리한다', () => {
    const result = parseGeminiCliOutput('', 'gemini-2.0-flash');
    expect(result.text).toBe('');
    expect(result.provider).toBe('gemini');
    expect(result.model).toBe('gemini-2.0-flash');
    expect(result.tokenCount).toBe(0);
  });

  it('null stdout을 처리한다', () => {
    const result = parseGeminiCliOutput(null, 'gemini-2.0-flash');
    expect(result.text).toBe('');
    expect(result.provider).toBe('gemini');
    expect(result.tokenCount).toBe(0);
  });

  it('JSON이 아닌 raw 텍스트를 fallback 처리한다', () => {
    const stdout = 'This is plain text response from CLI';

    const result = parseGeminiCliOutput(stdout, 'gemini-2.0-flash');
    expect(result.text).toBe('This is plain text response from CLI');
    expect(result.provider).toBe('gemini');
    expect(result.model).toBe('gemini-2.0-flash');
    expect(result.tokenCount).toBe(0);
  });

  it('response 키가 없는 JSON을 처리한다', () => {
    const stdout = JSON.stringify({ data: 'something', stats: {} });

    const result = parseGeminiCliOutput(stdout, 'gemini-2.0-flash');
    expect(result.text).toBe('');
    expect(result.provider).toBe('gemini');
    expect(result.tokenCount).toBe(0);
  });

  it('여러 모델 stats에서 첫 번째 모델을 사용한다', () => {
    const stdout = JSON.stringify({
      response: '멀티 모델 응답',
      stats: {
        models: {
          'gemini-2.5-pro': { tokens: { total: 500 } },
          'gemini-2.0-flash': { tokens: { total: 200 } },
        },
      },
    });

    const result = parseGeminiCliOutput(stdout);
    expect(result.text).toBe('멀티 모델 응답');
    expect(result.model).toBe('gemini-2.5-pro');
    expect(result.tokenCount).toBe(500);
  });

  it('model 인자가 없을 때 기본값을 사용한다', () => {
    const stdout = JSON.stringify({ response: '기본 모델 응답' });

    const result = parseGeminiCliOutput(stdout);
    expect(result.model).toBe('gemini-2.0-flash');
  });

  it('stats.models가 빈 객체일 때 처리한다', () => {
    const stdout = JSON.stringify({
      response: '빈 stats',
      stats: { models: {} },
    });

    const result = parseGeminiCliOutput(stdout, 'gemini-2.0-flash');
    expect(result.text).toBe('빈 stats');
    expect(result.model).toBe('gemini-2.0-flash');
    expect(result.tokenCount).toBe(0);
  });

  it('tokens.total이 없는 stats를 처리한다', () => {
    const stdout = JSON.stringify({
      response: 'no total',
      stats: {
        models: {
          'gemini-2.5-flash': { tokens: {} },
        },
      },
    });

    const result = parseGeminiCliOutput(stdout, 'gemini-2.0-flash');
    expect(result.text).toBe('no total');
    expect(result.model).toBe('gemini-2.5-flash');
    expect(result.tokenCount).toBe(0);
  });
});
