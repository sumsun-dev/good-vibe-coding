/**
 * schema-builders — 경량 스키마 빌더 함수 + 공용 변수
 */

// === 경량 스키마 빌더 (반복 줄이기) ===
export const obj = (properties) => ({ type: 'object', properties });
export const str = (required = false) =>
  required ? { type: 'string', required: true } : { type: 'string' };
export const num = (required = false) =>
  required ? { type: 'number', required: true } : { type: 'number' };
export const bool = (required = false) =>
  required ? { type: 'boolean', required: true } : { type: 'boolean' };
export const arr = (required = false) =>
  required ? { type: 'array', required: true } : { type: 'array' };
export const objField = (required = false) =>
  required ? { type: 'object', required: true } : { type: 'object' };
export const strEnum = (values, required = false) => ({
  type: 'string',
  enum: values,
  ...(required ? { required: true } : {}),
});

export const promptOutput = obj({ prompt: str() });
export const projectAndNextStep = obj({ project: objField(), nextStep: objField() });
export const idArgsInput = obj({ id: str(true) });
