/**
 * prompt-builder — 프롬프트 구성 유틸리티
 * 역할 기반 프롬프트 생성에서 반복되는 패턴을 중앙화.
 */

/** 프롬프트 빌더 버전. 프롬프트 구조 변경 시 업데이트. */
export const PROMPT_VERSION = '1.1.0';

/**
 * 섹션들을 조합하여 프롬프트를 생성한다.
 * 값이 falsy인 섹션은 건너뛴다.
 * @param {string} intro - 도입부
 * @param {Array<{title: string, content: string|null}>} sections - 섹션 목록
 * @returns {string} 완성된 프롬프트
 */
export function buildSectioned(intro, sections = []) {
  let result = `<!-- prompt-version: ${PROMPT_VERSION} -->\n${intro}`;
  for (const { title, content } of sections) {
    if (!content) continue;
    result += `\n\n## ${title}\n${content}`;
  }
  return result;
}

/**
 * 배열 항목을 마크다운 목록으로 변환한다.
 * @param {Array} items - 항목 배열
 * @param {function} [formatter] - 항목 포맷 함수 (기본: String)
 * @returns {string} 마크다운 목록 (빈 배열이면 '- (없음)')
 */
export function toMarkdownList(items, formatter = String) {
  if (!items || items.length === 0) return '- (없음)';
  return items.map((item) => `- ${formatter(item)}`).join('\n');
}

/**
 * JSON 출력 형식 안내 섹션을 생성한다.
 * @param {object} schema - 예시 JSON 스키마
 * @returns {string} 출력 형식 안내 텍스트
 */
export function jsonOutputSection(schema) {
  return `반드시 아래 JSON 형식으로 응답하세요:\n\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\``;
}
