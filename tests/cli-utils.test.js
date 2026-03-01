import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
