import { describe, it, expect } from 'vitest';
import { DEFAULTS, DEFAULT_MODELS } from '../../src/defaults.js';

describe('DEFAULTS', () => {
  it('기본값이 정의되어 있다', () => {
    expect(DEFAULTS.maxDiscussionRounds).toBe(3);
    expect(DEFAULTS.maxExecutionSteps).toBe(200);
  });

  it('Object.freeze로 불변이다', () => {
    expect(Object.isFrozen(DEFAULTS)).toBe(true);
  });

  it('변경 시도가 무시된다', () => {
    expect(() => { DEFAULTS.maxDiscussionRounds = 999; }).toThrow();
  });
});

describe('DEFAULT_MODELS', () => {
  it('3개 프로바이더 모델이 정의되어 있다', () => {
    expect(DEFAULT_MODELS.claude).toMatch(/^claude-/);
    expect(DEFAULT_MODELS.openai).toMatch(/^gpt-/);
    expect(DEFAULT_MODELS.gemini).toMatch(/^gemini-/);
  });

  it('Object.freeze로 불변이다', () => {
    expect(Object.isFrozen(DEFAULT_MODELS)).toBe(true);
  });
});
