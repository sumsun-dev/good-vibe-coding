import { describe, it, expect } from 'vitest';
import { resolve } from 'path';
import {
  requireString,
  requireArray,
  requireOneOf,
  requireDefined,
  requireFields,
  validateRoleId,
  assertWithinRoot,
  AppError,
  inputError,
  notFoundError,
} from '../scripts/lib/core/validators.js';

describe('requireString', () => {
  it('유효한 문자열을 반환한다', () => {
    expect(requireString('hello', 'name')).toBe('hello');
  });

  it('빈 문자열이면 AppError(INPUT_ERROR)를 던진다', () => {
    expect(() => requireString('', 'name')).toThrow('name는 비어있지 않은 문자열');
    try {
      requireString('', 'name');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect(e.code).toBe('INPUT_ERROR');
    }
  });

  it('null이면 에러를 던진다', () => {
    expect(() => requireString(null, 'name')).toThrow('name는 비어있지 않은 문자열');
  });

  it('undefined이면 에러를 던진다', () => {
    expect(() => requireString(undefined, 'name')).toThrow('name는 비어있지 않은 문자열');
  });

  it('숫자이면 에러를 던진다', () => {
    expect(() => requireString(123, 'name')).toThrow('name는 비어있지 않은 문자열');
  });
});

describe('requireArray', () => {
  it('유효한 배열을 반환한다', () => {
    expect(requireArray([1, 2], 'items')).toEqual([1, 2]);
  });

  it('빈 배열도 허용한다', () => {
    expect(requireArray([], 'items')).toEqual([]);
  });

  it('null이면 AppError(INPUT_ERROR)를 던진다', () => {
    expect(() => requireArray(null, 'items')).toThrow('items는 배열');
    try {
      requireArray(null, 'items');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect(e.code).toBe('INPUT_ERROR');
    }
  });

  it('객체이면 에러를 던진다', () => {
    expect(() => requireArray({}, 'items')).toThrow('items는 배열');
  });

  it('문자열이면 에러를 던진다', () => {
    expect(() => requireArray('hello', 'items')).toThrow('items는 배열');
  });
});

describe('requireOneOf', () => {
  it('허용된 값을 반환한다', () => {
    expect(requireOneOf('a', ['a', 'b', 'c'], 'choice')).toBe('a');
  });

  it('허용되지 않은 값이면 AppError(INPUT_ERROR)를 던진다', () => {
    expect(() => requireOneOf('d', ['a', 'b', 'c'], 'choice')).toThrow(
      'choice는 다음 중 하나여야 합니다: a, b, c (받은 값: "d")',
    );
    try {
      requireOneOf('d', ['a', 'b', 'c'], 'choice');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect(e.code).toBe('INPUT_ERROR');
    }
  });
});

describe('requireDefined', () => {
  it('유효한 값을 반환한다', () => {
    expect(requireDefined('hello', 'field')).toBe('hello');
    expect(requireDefined(0, 'field')).toBe(0);
    expect(requireDefined(false, 'field')).toBe(false);
  });

  it('null이면 AppError(INPUT_ERROR)를 던진다', () => {
    expect(() => requireDefined(null, 'field')).toThrow('field가 필요합니다');
    try {
      requireDefined(null, 'field');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect(e.code).toBe('INPUT_ERROR');
    }
  });

  it('undefined이면 에러를 던진다', () => {
    expect(() => requireDefined(undefined, 'field')).toThrow('field가 필요합니다');
  });
});

describe('requireFields', () => {
  it('모든 필수 필드가 있으면 data를 반환한다', () => {
    const data = { a: 1, b: 'hello', c: [] };
    expect(requireFields(data, ['a', 'b'])).toBe(data);
  });

  it('필드가 없으면 AppError(INPUT_ERROR)를 던진다', () => {
    expect(() => requireFields({ a: 1 }, ['a', 'b'])).toThrow('다음 필드가 필요합니다: b');
    try {
      requireFields({ a: 1 }, ['a', 'b']);
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect(e.code).toBe('INPUT_ERROR');
    }
  });

  it('여러 필드가 없으면 모든 누락 필드를 한번에 보고한다', () => {
    expect(() => requireFields({}, ['a', 'b', 'c'])).toThrow('다음 필드가 필요합니다: a, b, c');
  });

  it('필드가 null이면 에러를 던진다', () => {
    expect(() => requireFields({ a: null }, ['a'])).toThrow('다음 필드가 필요합니다: a');
  });

  it('빈 배열 필드는 허용한다', () => {
    expect(requireFields({ items: [] }, ['items'])).toEqual({ items: [] });
  });

  it('0과 false 값은 허용한다', () => {
    expect(requireFields({ count: 0, flag: false }, ['count', 'flag'])).toEqual({
      count: 0,
      flag: false,
    });
  });
});

describe('AppError', () => {
  it('code와 message를 가진다', () => {
    const err = new AppError('test', 'INPUT_ERROR');
    expect(err.message).toBe('test');
    expect(err.code).toBe('INPUT_ERROR');
    expect(err.name).toBe('AppError');
    expect(err instanceof Error).toBe(true);
  });

  it('기본 코드는 SYSTEM_ERROR이다', () => {
    const err = new AppError('test');
    expect(err.code).toBe('SYSTEM_ERROR');
  });

  it('action 필드를 지원한다', () => {
    const err = new AppError('test', 'INPUT_ERROR', 'retry with --id flag');
    expect(err.action).toBe('retry with --id flag');
  });

  it('action 기본값은 null이다', () => {
    const err = new AppError('test');
    expect(err.action).toBeNull();
  });
});

describe('inputError / notFoundError', () => {
  it('inputError는 INPUT_ERROR 코드를 가진다', () => {
    const err = inputError('필드 누락');
    expect(err.code).toBe('INPUT_ERROR');
    expect(err.message).toBe('필드 누락');
  });

  it('notFoundError는 NOT_FOUND 코드를 가진다', () => {
    const err = notFoundError('프로젝트 없음');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('프로젝트 없음');
  });

  it('inputError는 action을 지원한다', () => {
    const err = inputError('필드 누락', '필드를 확인하세요');
    expect(err.action).toBe('필드를 확인하세요');
  });

  it('notFoundError는 action을 지원한다', () => {
    const err = notFoundError('프로젝트 없음', 'good-vibe:projects로 확인');
    expect(err.action).toBe('good-vibe:projects로 확인');
  });

  it('action 없이 호출하면 null이다', () => {
    expect(inputError('test').action).toBeNull();
    expect(notFoundError('test').action).toBeNull();
  });
});

describe('validateRoleId', () => {
  it('유효한 roleId를 반환한다', () => {
    expect(validateRoleId('backend')).toBe('backend');
    expect(validateRoleId('cto')).toBe('cto');
  });

  it('경로 순회를 AppError(INPUT_ERROR)로 거부한다', () => {
    expect(() => validateRoleId('../etc/passwd')).toThrow('유효하지 않은 roleId');
    try {
      validateRoleId('../etc/passwd');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect(e.code).toBe('INPUT_ERROR');
    }
  });

  it('빈 문자열을 거부한다', () => {
    expect(() => validateRoleId('')).toThrow('비어있지 않은 문자열');
  });

  it('null을 거부한다', () => {
    expect(() => validateRoleId(null)).toThrow('비어있지 않은 문자열');
  });

  it('백슬래시를 거부한다', () => {
    expect(() => validateRoleId('dir\\evil')).toThrow('유효하지 않은 roleId');
  });

  it('슬래시를 거부한다', () => {
    expect(() => validateRoleId('dir/evil')).toThrow('유효하지 않은 roleId');
  });

  it('점점만으로 된 경로를 거부한다', () => {
    expect(() => validateRoleId('..')).toThrow('유효하지 않은 roleId');
  });
});

// --- assertWithinRoot (보안: path traversal 방지) ---

describe('assertWithinRoot', () => {
  const root = resolve('/project/dir');

  it('루트 내부 경로를 허용한다', () => {
    expect(() => assertWithinRoot(resolve('/project/dir/src/app.js'), root, 'file')).not.toThrow();
  });

  it('루트 자체를 허용한다', () => {
    expect(() => assertWithinRoot(root, root, 'file')).not.toThrow();
  });

  it('루트 바깥 경로를 거부한다', () => {
    expect(() => assertWithinRoot(resolve('/project/other'), root, 'file')).toThrow(
      '허용 범위를 벗어났습니다',
    );
    try {
      assertWithinRoot(resolve('/project/other'), root, 'file');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect(e.code).toBe('INPUT_ERROR');
    }
  });

  it('../로 탈출하는 경로를 거부한다', () => {
    expect(() => assertWithinRoot(resolve('/project/dir/../other'), root, 'file')).toThrow(
      '허용 범위를 벗어났습니다',
    );
  });

  it('루트 이름의 prefix 디렉토리를 거부한다', () => {
    // /project/dir-evil은 /project/dir로 시작하지만 sep가 아님
    expect(() => assertWithinRoot(resolve('/project/dir-evil/file'), root, 'file')).toThrow(
      '허용 범위를 벗어났습니다',
    );
  });

  it('절대 경로가 완전히 다른 경우를 거부한다', () => {
    expect(() => assertWithinRoot(resolve('/etc/passwd'), root, 'file')).toThrow(
      '허용 범위를 벗어났습니다',
    );
  });
});
