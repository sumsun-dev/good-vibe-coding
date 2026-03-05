/**
 * json-parser — 3-tier LLM JSON 응답 파싱 유틸리티
 *
 * LLM이 반환하는 JSON을 3단계로 안전하게 추출한다:
 *   1) 직접 JSON.parse
 *   2) ```json 펜스 블록 추출 후 파싱
 *   3) bare 패턴 매칭 ({...} 또는 [...]) 후 파싱
 */

/**
 * rawText에서 JSON 객체를 추출한다.
 * 3-tier fallback: direct parse → json fence → bare { } 패턴.
 * @param {string} rawText - LLM 응답 원문
 * @returns {object|null} 파싱된 객체 또는 null
 */
export function parseJsonObject(rawText) {
  if (!rawText || rawText.trim() === '') return null;

  // Tier 1: 직접 파싱
  try {
    const parsed = JSON.parse(rawText.trim());
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    // fallthrough
  }

  // Tier 2: ```json ... ``` 펜스 블록 추출
  const jsonBlockMatch = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1].trim());
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      // fallthrough
    }
  }

  // Tier 3: bare { ... } 추출 — 인덱스 기반 (ReDoS 방지)
  // NOTE: 문자열 내 중괄호는 오판 가능 (Tier 1/2 실패 시에만 사용)
  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      // fallthrough
    }
  }

  return null;
}

/**
 * rawText에서 JSON 배열을 추출한다.
 * 3-tier fallback: direct parse → json fence → bare [ ] 패턴.
 * @param {string} rawText - LLM 응답 원문
 * @returns {Array} 파싱된 배열 (실패 시 빈 배열)
 */
export function parseJsonArray(rawText) {
  if (!rawText || rawText.trim() === '') return [];

  // Tier 1: 직접 파싱
  try {
    const parsed = JSON.parse(rawText.trim());
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fallthrough
  }

  // Tier 2: ```json ... ``` 펜스 블록 추출
  const jsonBlockMatch = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1].trim());
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fallthrough
    }
  }

  // Tier 3: bare [ ... ] 추출 — 인덱스 기반 (ReDoS 방지)
  // NOTE: 문자열 내 대괄호는 오판 가능 (Tier 1/2 실패 시에만 사용)
  const firstBracket = rawText.indexOf('[');
  const lastBracket = rawText.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try {
      const parsed = JSON.parse(rawText.slice(firstBracket, lastBracket + 1));
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fallthrough
    }
  }

  return [];
}
