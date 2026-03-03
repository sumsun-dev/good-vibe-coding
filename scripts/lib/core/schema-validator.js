/**
 * schema-validator — 경량 스키마 검증 유틸리티
 * LLM 응답 구조 검증용. 외부 의존성 없음.
 *
 * 스키마 형식:
 * { type: 'string'|'number'|'boolean'|'array'|'object',
 *   required?: boolean, enum?: any[], default?: any,
 *   items?: Schema, properties?: Record<string, Schema> }
 */

/**
 * 데이터를 스키마에 맞게 검증한다.
 * @param {*} data - 검증할 데이터
 * @param {object} schema - 스키마 정의
 * @returns {{ valid: boolean, errors: string[], data: * }} 검증 결과
 */
export function validate(data, schema) {
  const errors = [];
  validateNode(data, schema, '', errors);
  return { valid: errors.length === 0, errors, data };
}

/**
 * 데이터를 스키마에 맞게 강제 변환한다 (default 적용, 타입 보정).
 * @param {*} data - 변환할 데이터
 * @param {object} schema - 스키마 정의
 * @returns {*} 변환된 데이터
 */
export function coerce(data, schema) {
  return coerceNode(data, schema);
}

function validateNode(data, schema, path, errors) {
  if (data === undefined || data === null) {
    if (schema.required) {
      errors.push(`${path || 'root'}: 필수 필드가 누락되었습니다`);
    }
    return;
  }

  if (schema.type) {
    const actualType = getType(data);
    if (actualType !== schema.type) {
      errors.push(`${path || 'root'}: ${schema.type} 타입이어야 하지만 ${actualType}입니다`);
      return;
    }
  }

  if (schema.enum && !schema.enum.includes(data)) {
    errors.push(`${path || 'root'}: 다음 중 하나여야 합니다: ${schema.enum.join(', ')}`);
  }

  if (schema.type === 'object' && schema.properties && typeof data === 'object') {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      validateNode(data[key], propSchema, path ? `${path}.${key}` : key, errors);
    }
  }

  if (schema.type === 'array' && schema.items && Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      validateNode(data[i], schema.items, `${path}[${i}]`, errors);
    }
  }
}

function coerceNode(data, schema) {
  if ((data === undefined || data === null) && schema.default !== undefined) {
    return schema.default;
  }

  if (data === undefined || data === null) {
    return data;
  }

  if (schema.type) {
    data = coerceType(data, schema.type);
  }

  if (schema.enum && !schema.enum.includes(data) && schema.default !== undefined) {
    return schema.default;
  }

  if (schema.type === 'object' && schema.properties && typeof data === 'object') {
    const result = { ...data };
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      result[key] = coerceNode(result[key], propSchema);
    }
    return result;
  }

  if (schema.type === 'array' && schema.items && Array.isArray(data)) {
    return data.map((item) => coerceNode(item, schema.items));
  }

  return data;
}

function coerceType(value, type) {
  const actualType = getType(value);
  if (actualType === type) return value;

  switch (type) {
    case 'string':
      return String(value);
    case 'number': {
      const n = Number(value);
      return isNaN(n) ? value : n;
    }
    case 'boolean':
      if (value === 'true' || value === 1) return true;
      if (value === 'false' || value === 0) return false;
      return Boolean(value);
    case 'array':
      return Array.isArray(value) ? value : [value];
    default:
      return value;
  }
}

function getType(value) {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  return typeof value;
}
