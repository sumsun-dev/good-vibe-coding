import { describe, it, expect } from 'vitest';
import { validate, coerce } from '../scripts/lib/core/schema-validator.js';

describe('validate', () => {
  it('유효한 문자열을 통과시킨다', () => {
    const result = validate('hello', { type: 'string' });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('타입 불일치를 감지한다', () => {
    const result = validate(123, { type: 'string' });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('string');
  });

  it('필수 필드 누락을 감지한다', () => {
    const result = validate(undefined, { type: 'string', required: true });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('필수');
  });

  it('optional 필드의 null은 허용한다', () => {
    const result = validate(null, { type: 'string' });
    expect(result.valid).toBe(true);
  });

  it('enum 값을 검증한다', () => {
    const schema = { type: 'string', enum: ['simple', 'medium', 'complex'] };
    expect(validate('simple', schema).valid).toBe(true);
    expect(validate('invalid', schema).valid).toBe(false);
  });

  it('객체의 중첩 프로퍼티를 검증한다', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string', required: true },
        age: { type: 'number' },
      },
    };
    const valid = validate({ name: 'test', age: 30 }, schema);
    expect(valid.valid).toBe(true);

    const invalid = validate({ age: 30 }, schema);
    expect(invalid.valid).toBe(false);
    expect(invalid.errors[0]).toContain('name');
  });

  it('배열의 아이템을 검증한다', () => {
    const schema = {
      type: 'array',
      items: { type: 'string' },
    };
    expect(validate(['a', 'b'], schema).valid).toBe(true);
    expect(validate(['a', 123], schema).valid).toBe(false);
  });

  it('복합 스키마를 검증한다 (리뷰 응답)', () => {
    const schema = {
      type: 'object',
      properties: {
        approved: { type: 'boolean', required: true },
        feedback: { type: 'string' },
        issues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
              description: { type: 'string', required: true },
            },
          },
        },
      },
    };

    const valid = validate({
      approved: true,
      feedback: 'Good',
      issues: [{ severity: 'minor', description: 'Small issue' }],
    }, schema);
    expect(valid.valid).toBe(true);

    const invalid = validate({
      approved: 'yes',
      issues: [{ severity: 'unknown' }],
    }, schema);
    expect(invalid.valid).toBe(false);
  });

  it('빈 객체를 optional 프로퍼티에 대해 허용한다', () => {
    const schema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
    };
    expect(validate({}, schema).valid).toBe(true);
  });
});

describe('coerce', () => {
  it('기본값을 적용한다', () => {
    const result = coerce(undefined, { type: 'string', default: 'fallback' });
    expect(result).toBe('fallback');
  });

  it('null에 기본값을 적용한다', () => {
    const result = coerce(null, { type: 'number', default: 0 });
    expect(result).toBe(0);
  });

  it('유효한 값은 그대로 반환한다', () => {
    expect(coerce('hello', { type: 'string', default: 'x' })).toBe('hello');
  });

  it('문자열을 숫자로 변환한다', () => {
    expect(coerce('42', { type: 'number' })).toBe(42);
  });

  it('숫자를 문자열로 변환한다', () => {
    expect(coerce(42, { type: 'string' })).toBe('42');
  });

  it('문자열을 boolean으로 변환한다', () => {
    expect(coerce('true', { type: 'boolean' })).toBe(true);
    expect(coerce('false', { type: 'boolean' })).toBe(false);
  });

  it('유효하지 않은 enum 값에 기본값을 적용한다', () => {
    const schema = { type: 'string', enum: ['a', 'b'], default: 'a' };
    expect(coerce('c', schema)).toBe('a');
    expect(coerce('a', schema)).toBe('a');
  });

  it('객체의 중첩 프로퍼티에 기본값을 적용한다', () => {
    const schema = {
      type: 'object',
      properties: {
        level: { type: 'string', enum: ['simple', 'medium', 'complex'], default: 'medium' },
        reasoning: { type: 'string', default: '' },
        recommendations: { type: 'array', default: [] },
      },
    };
    const result = coerce({}, schema);
    expect(result.level).toBe('medium');
    expect(result.reasoning).toBe('');
    expect(result.recommendations).toEqual([]);
  });

  it('배열 아이템에 coerce를 적용한다', () => {
    const schema = {
      type: 'array',
      items: { type: 'number' },
    };
    const result = coerce(['1', '2', '3'], schema);
    expect(result).toEqual([1, 2, 3]);
  });

  it('비배열을 배열로 감싼다', () => {
    expect(coerce('hello', { type: 'array' })).toEqual(['hello']);
  });

  it('변환 불가능한 숫자는 원본을 반환한다', () => {
    expect(coerce('not-a-number', { type: 'number' })).toBe('not-a-number');
  });
});
