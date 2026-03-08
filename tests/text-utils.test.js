import { describe, it, expect } from 'vitest';
import { truncateText, truncateLines } from '../scripts/lib/core/text-utils.js';

describe('truncateText', () => {
  it('빈 문자열은 빈 문자열을 반환한다', () => {
    expect(truncateText('', 10)).toBe('');
  });

  it('null/undefined는 빈 문자열을 반환한다', () => {
    expect(truncateText(null, 10)).toBe('');
    expect(truncateText(undefined, 10)).toBe('');
  });

  it('maxLen 이하면 원본 그대로 반환한다', () => {
    expect(truncateText('hello', 10)).toBe('hello');
    expect(truncateText('hello', 5)).toBe('hello');
  });

  it('maxLen 초과하면 suffix 포함하여 잘라낸다', () => {
    expect(truncateText('hello world', 8)).toBe('hello...');
  });

  it('결과 문자열이 정확히 maxLen 이하이다', () => {
    const result = truncateText('a'.repeat(100), 50);
    expect(result.length).toBeLessThanOrEqual(50);
    expect(result).toBe('a'.repeat(47) + '...');
  });

  it('커스텀 suffix를 사용할 수 있다', () => {
    const result = truncateText('a'.repeat(20), 15, '...(truncated)');
    expect(result.length).toBeLessThanOrEqual(15);
    expect(result.endsWith('...(truncated)')).toBe(true);
  });

  it('suffix가 maxLen보다 길면 suffix만 반환한다', () => {
    const result = truncateText('hello world', 2, '...');
    expect(result).toBe('...');
  });
});

describe('truncateLines', () => {
  it('빈 문자열은 빈 문자열을 반환한다', () => {
    expect(truncateLines('', 5)).toBe('');
  });

  it('null/undefined는 빈 문자열을 반환한다', () => {
    expect(truncateLines(null, 5)).toBe('');
    expect(truncateLines(undefined, 5)).toBe('');
  });

  it('maxLines 이하면 원본 그대로 반환한다', () => {
    const text = 'line1\nline2\nline3';
    expect(truncateLines(text, 5)).toBe(text);
    expect(truncateLines(text, 3)).toBe(text);
  });

  it('maxLines 초과하면 잘라내고 suffix를 추가한다', () => {
    const text = 'line1\nline2\nline3\nline4\nline5';
    const result = truncateLines(text, 3);
    expect(result).toBe('line1\nline2\nline3\n...(truncated)');
  });

  it('커스텀 suffix를 사용할 수 있다', () => {
    const text = 'a\nb\nc\nd';
    const result = truncateLines(text, 2, '\n...(이하 생략)');
    expect(result).toBe('a\nb\n...(이하 생략)');
  });

  it('단일 라인은 잘라내지 않는다', () => {
    expect(truncateLines('single line', 1)).toBe('single line');
  });
});
