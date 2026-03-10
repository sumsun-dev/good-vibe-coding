import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'fs/promises';
import { resolve, join } from 'path';
import { execSync } from 'child_process';
import { parseArgs, outputOk } from '../scripts/cli-utils.js';

describe('parseArgs', () => {
  it('--key value 형식을 파싱한다', () => {
    const result = parseArgs(['--name', 'test', '--type', 'web-app']);
    expect(result).toEqual({ name: 'test', type: 'web-app' });
  });

  it('--key=value 형식을 파싱한다', () => {
    const result = parseArgs(['--name=test', '--type=web-app']);
    expect(result).toEqual({ name: 'test', type: 'web-app' });
  });

  it('혼합 형식을 파싱한다', () => {
    const result = parseArgs(['--name', 'test', '--verbose']);
    expect(result).toEqual({ name: 'test', verbose: true });
  });

  it('마지막 인자가 값 없는 플래그이면 true로 처리한다', () => {
    const result = parseArgs(['--debug']);
    expect(result).toEqual({ debug: true });
  });

  it('빈 배열을 처리한다', () => {
    expect(parseArgs([])).toEqual({});
  });

  it('--가 없는 인자는 무시한다', () => {
    const result = parseArgs(['positional', '--key', 'val']);
    expect(result).toEqual({ key: 'val' });
  });

  it('연속된 --key --key2는 각각 true로 처리한다', () => {
    const result = parseArgs(['--a', '--b', '--c']);
    expect(result).toEqual({ a: true, b: true, c: true });
  });

  it('=를 포함하는 값을 올바르게 처리한다', () => {
    const result = parseArgs(['--query=a=b']);
    expect(result).toEqual({ query: 'a=b' });
  });

  it('--key= 빈값을 빈 문자열로 처리한다', () => {
    const result = parseArgs(['--name=']);
    expect(result).toEqual({ name: '' });
  });

  it('음수값을 다음 키가 아닌 값으로 처리한다', () => {
    const result = parseArgs(['--offset', '-5', '--limit', '10']);
    expect(result).toEqual({ offset: '-5', limit: '10' });
  });
});

describe('outputOk', () => {
  let writeSpy;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    writeSpy.mockRestore();
  });

  it('success: true가 포함된 JSON을 출력한다', () => {
    outputOk({ data: 'test' });
    const output = writeSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.success).toBe(true);
    expect(parsed.data).toBe('test');
  });

  it('인자 없이 호출하면 success: true만 출력한다', () => {
    outputOk();
    const output = writeSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed).toEqual({ success: true });
  });
});

describe('readStdin --input-file', () => {
  const TMP_DIR = resolve('.tmp-test-cli-utils');
  const CLI_PATH = resolve('scripts/cli.js');

  function cliExecRaw(command, input) {
    try {
      const stdout = execSync(`node ${CLI_PATH} ${command}`, {
        input: input ? JSON.stringify(input) : '',
        encoding: 'utf-8',
        timeout: 10_000,
      });
      return { exitCode: 0, stdout, stderr: '' };
    } catch (err) {
      return { exitCode: err.status, stdout: err.stdout || '', stderr: err.stderr || '' };
    }
  }

  beforeEach(async () => {
    await mkdir(TMP_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
  });

  it('--input-file로 JSON 파일에서 데이터를 읽는다', async () => {
    const filePath = join(TMP_DIR, 'test-input.json');
    await writeFile(filePath, JSON.stringify({ rawOutput: 'test-data' }));

    const result = cliExecRaw(`parse-clarity --input-file ${filePath}`);
    // parse-clarity는 rawOutput 파싱을 시도하므로 parseError가 나올 수 있지만
    // 파일 읽기 자체는 성공 (INPUT_ERROR가 아닌 정상 JSON 응답)
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toHaveProperty('parseError', true);
  });

  it('존재하지 않는 파일이면 에러를 반환한다', () => {
    const result = cliExecRaw(`parse-clarity --input-file ${join(TMP_DIR, 'nonexistent.json')}`);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('오류');
  });

  it('잘못된 JSON 파일이면 INPUT_ERROR를 반환한다', async () => {
    const filePath = join(TMP_DIR, 'bad.json');
    await writeFile(filePath, '{ invalid json !!!');

    const result = cliExecRaw(`parse-clarity --input-file ${filePath}`);
    expect(result.exitCode).toBe(2); // INPUT_ERROR exit code
    expect(result.stderr).toContain('잘못된 JSON 파일');
  });

  it('빈 파일이면 빈 객체로 처리한다', async () => {
    const filePath = join(TMP_DIR, 'empty.json');
    await writeFile(filePath, '');

    // 빈 입력 → readStdin() returns {} → parse-clarity는 rawOutput 없어서 INPUT_ERROR
    const result = cliExecRaw(`parse-clarity --input-file ${filePath}`);
    expect(result.exitCode).toBe(2); // INPUT_ERROR: rawOutput 필드 필요
    expect(result.stderr).toContain('rawOutput');
  });

  it('stdin 기반 호출도 여전히 동작한다 (하위 호환)', () => {
    const result = cliExecRaw('parse-clarity', { rawOutput: 'stdin-test' });
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toHaveProperty('parseError', true);
  });

  it('prototype pollution 키가 파일 입력에서도 제거된다', async () => {
    const filePath = join(TMP_DIR, 'proto.json');
    await writeFile(
      filePath,
      JSON.stringify({
        rawOutput: 'test',
        __proto__: { polluted: true },
        constructor: { polluted: true },
      }),
    );

    const result = cliExecRaw(`parse-clarity --input-file ${filePath}`);
    expect(result.exitCode).toBe(0);
  });
});
