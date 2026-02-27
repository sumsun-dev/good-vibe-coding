/**
 * validators — 공통 입력 검증 유틸리티 + 에러 클래스
 * CLI 커맨드와 라이브러리 모듈 전체에서 재사용.
 */

/**
 * 구조화된 에러 클래스.
 * code: 'INPUT_ERROR' | 'NOT_FOUND' | 'SYSTEM_ERROR'
 */
export class AppError extends Error {
  constructor(message, code = 'SYSTEM_ERROR') {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

/**
 * 입력 검증 에러를 생성한다.
 */
export function inputError(message) {
  return new AppError(message, 'INPUT_ERROR');
}

/**
 * 리소스를 찾을 수 없는 에러를 생성한다.
 */
export function notFoundError(message) {
  return new AppError(message, 'NOT_FOUND');
}

/**
 * 비어있지 않은 문자열인지 검증한다.
 * @param {*} value - 검증 대상
 * @param {string} fieldName - 필드명 (에러 메시지용)
 * @returns {string} 검증된 문자열
 */
export function requireString(value, fieldName) {
  if (!value || typeof value !== 'string') {
    throw new Error(`${fieldName}는 비어있지 않은 문자열이어야 합니다`);
  }
  return value;
}

/**
 * 배열인지 검증한다.
 * @param {*} value - 검증 대상
 * @param {string} fieldName - 필드명 (에러 메시지용)
 * @returns {Array} 검증된 배열
 */
export function requireArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName}는 배열이어야 합니다`);
  }
  return value;
}

/**
 * 허용된 값 중 하나인지 검증한다.
 * @param {*} value - 검증 대상
 * @param {Array} allowed - 허용 값 목록
 * @param {string} fieldName - 필드명 (에러 메시지용)
 * @returns {*} 검증된 값
 */
export function requireOneOf(value, allowed, fieldName) {
  if (!allowed.includes(value)) {
    throw new Error(`${fieldName}는 다음 중 하나여야 합니다: ${allowed.join(', ')}`);
  }
  return value;
}

/**
 * null/undefined가 아닌지 검증한다.
 * @param {*} value - 검증 대상
 * @param {string} fieldName - 필드명 (에러 메시지용)
 * @returns {*} 검증된 값
 */
export function requireDefined(value, fieldName) {
  if (value === null || value === undefined) {
    throw new Error(`${fieldName}가 필요합니다`);
  }
  return value;
}

/**
 * stdin JSON 데이터에서 필수 필드들을 한번에 검증한다.
 * @param {object} data - stdin에서 읽은 데이터
 * @param {Array<string>} fields - 필수 필드 이름 목록
 * @returns {object} 원본 data (필드가 모두 존재)
 */
export function requireFields(data, fields) {
  for (const field of fields) {
    if (data[field] === undefined || data[field] === null) {
      throw new Error(`${field} 필드가 필요합니다`);
    }
  }
  return data;
}

/**
 * roleId 경로 순회를 검증한다.
 * @param {string} roleId - 역할 ID
 * @returns {string} 검증된 roleId
 */
export function validateRoleId(roleId) {
  requireString(roleId, 'roleId');
  if (/[/\\]/.test(roleId) || roleId.includes('..')) {
    throw new Error(`유효하지 않은 roleId: ${roleId}`);
  }
  return roleId;
}
