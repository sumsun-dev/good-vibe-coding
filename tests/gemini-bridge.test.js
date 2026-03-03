import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseGeminiCliOutput,
  isGeminiCliInstalled,
  callGeminiCli,
} from '../scripts/lib/llm/gemini-bridge.js';
import { spawnSync } from 'child_process';

vi.mock('child_process', () => ({
  spawnSync: vi.fn(),
}));

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

// --- isGeminiCliInstalled ---

describe('isGeminiCliInstalled', () => {
  beforeEach(() => {
    vi.mocked(spawnSync).mockReset();
  });

  it('CLI가 설치되어 있으면 true를 반환한다', () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 0,
      stdout: '1.0.0',
      stderr: '',
      pid: 1,
      output: [],
      signal: null,
    });
    expect(isGeminiCliInstalled('/usr/bin/gemini')).toBe(true);
    expect(spawnSync).toHaveBeenCalledWith(
      '/usr/bin/gemini',
      ['--version'],
      expect.objectContaining({ timeout: 5000 }),
    );
  });

  it('CLI가 없으면 false를 반환한다', () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 1,
      stdout: '',
      stderr: 'not found',
      pid: 1,
      output: [],
      signal: null,
    });
    expect(isGeminiCliInstalled()).toBe(false);
  });

  it('spawnSync가 에러를 던지면 false를 반환한다', () => {
    vi.mocked(spawnSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });
    expect(isGeminiCliInstalled()).toBe(false);
  });
});

// --- callGeminiCli ---

describe('callGeminiCli', () => {
  beforeEach(() => {
    vi.mocked(spawnSync).mockReset();
  });

  /** isGeminiCliInstalled + callGeminiCli 모두 spawnSync를 호출하므로 2번 mock */
  function mockInstalledThenCall(callResult) {
    vi.mocked(spawnSync)
      .mockReturnValueOnce({
        status: 0,
        stdout: '1.0.0',
        stderr: '',
        pid: 1,
        output: [],
        signal: null,
      })
      .mockReturnValueOnce(callResult);
  }

  it('정상 호출 시 파싱된 결과를 반환한다', () => {
    const cliOutput = JSON.stringify({
      response: '리뷰 완료',
      stats: { models: { 'gemini-2.5-flash': { tokens: { total: 100 } } } },
    });
    mockInstalledThenCall({
      status: 0,
      stdout: cliOutput,
      stderr: '',
      pid: 2,
      output: [],
      signal: null,
    });

    const result = callGeminiCli('리뷰해줘', { model: 'gemini-2.5-flash' });
    expect(result.text).toBe('리뷰 완료');
    expect(result.provider).toBe('gemini');
    expect(result.model).toBe('gemini-2.5-flash');
    expect(result.tokenCount).toBe(100);
  });

  it('올바른 인자로 spawnSync를 호출한다', () => {
    const cliOutput = JSON.stringify({ response: 'ok' });
    mockInstalledThenCall({
      status: 0,
      stdout: cliOutput,
      stderr: '',
      pid: 2,
      output: [],
      signal: null,
    });

    callGeminiCli('테스트 프롬프트', { model: 'gemini-2.0-flash', cliPath: '/custom/gemini' });

    const callArgs = vi.mocked(spawnSync).mock.calls[1];
    expect(callArgs[0]).toBe('/custom/gemini');
    expect(callArgs[1]).toEqual(['-p', '테스트 프롬프트', '-o', 'json', '-m', 'gemini-2.0-flash']);
  });

  it('CLI 미설치 시 에러를 던진다', () => {
    vi.mocked(spawnSync).mockReturnValue({
      status: 1,
      stdout: '',
      stderr: '',
      pid: 1,
      output: [],
      signal: null,
    });
    expect(() => callGeminiCli('hello')).toThrow('Gemini CLI가 설치되지 않았습니다');
  });

  it('타임아웃 시 에러를 던진다', () => {
    const timedOutError = new Error('spawnSync ETIMEDOUT');
    timedOutError.code = 'ETIMEDOUT';
    mockInstalledThenCall({
      status: null,
      stdout: '',
      stderr: '',
      pid: 2,
      output: [],
      signal: null,
      error: timedOutError,
    });

    expect(() => callGeminiCli('느린 프롬프트', { timeout: 5000 })).toThrow('타임아웃');
  });

  it('비정상 종료 시 stderr를 포함한 에러를 던진다', () => {
    mockInstalledThenCall({
      status: 2,
      stdout: '',
      stderr: 'authentication failed',
      pid: 2,
      output: [],
      signal: null,
    });

    expect(() => callGeminiCli('실패 프롬프트')).toThrow(
      '비정상 종료 (exit 2): authentication failed',
    );
  });

  it('일반 spawnSync 에러 시 메시지를 전달한다', () => {
    mockInstalledThenCall({
      status: null,
      stdout: '',
      stderr: '',
      pid: 2,
      output: [],
      signal: null,
      error: new Error('unknown failure'),
    });

    expect(() => callGeminiCli('에러 프롬프트')).toThrow('Gemini CLI 실행 실패: unknown failure');
  });

  it('기본 모델과 타임아웃을 사용한다', () => {
    const cliOutput = JSON.stringify({ response: 'default' });
    mockInstalledThenCall({
      status: 0,
      stdout: cliOutput,
      stderr: '',
      pid: 2,
      output: [],
      signal: null,
    });

    callGeminiCli('기본값 테스트');

    const callArgs = vi.mocked(spawnSync).mock.calls[1];
    expect(callArgs[1]).toContain('gemini-2.0-flash');
    expect(callArgs[2].timeout).toBe(120000);
  });
});

// --- 보안: shell injection 방지 ---

describe('callGeminiCli — 보안', () => {
  beforeEach(() => {
    vi.mocked(spawnSync).mockReset();
  });

  function mockInstalledThenCall(callResult) {
    vi.mocked(spawnSync)
      .mockReturnValueOnce({
        status: 0,
        stdout: '1.0.0',
        stderr: '',
        pid: 1,
        output: [],
        signal: null,
      })
      .mockReturnValueOnce(callResult);
  }

  it('shell 메타문자가 포함된 프롬프트가 args 배열로 전달된다 (injection 방지)', () => {
    const malicious = '$(rm -rf /) && echo pwned; cat /etc/passwd';
    const cliOutput = JSON.stringify({ response: 'safe' });
    mockInstalledThenCall({
      status: 0,
      stdout: cliOutput,
      stderr: '',
      pid: 2,
      output: [],
      signal: null,
    });

    callGeminiCli(malicious);

    const callArgs = vi.mocked(spawnSync).mock.calls[1];
    // args 배열로 전달 — shell 해석 안 함
    expect(callArgs[1]).toContain(malicious);
    // shell 옵션이 true가 아닌지 확인
    expect(callArgs[2].shell).toBeFalsy();
  });

  it('spawnSync에 shell: true가 전달되지 않는다', () => {
    const cliOutput = JSON.stringify({ response: 'ok' });
    mockInstalledThenCall({
      status: 0,
      stdout: cliOutput,
      stderr: '',
      pid: 2,
      output: [],
      signal: null,
    });

    callGeminiCli('normal prompt');

    const options = vi.mocked(spawnSync).mock.calls[1][2];
    expect(options.shell).toBeFalsy();
  });
});
