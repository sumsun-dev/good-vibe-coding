/**
 * text-utils — 텍스트 잘라내기 유틸리티
 * 코드베이스 전반의 중복 truncate 패턴을 통합한다.
 */

/**
 * 텍스트를 maxLen 이하로 잘라낸다.
 * 결과 문자열은 suffix를 포함하여 maxLen 이하를 보장한다.
 * @param {string} text - 원본 텍스트
 * @param {number} maxLen - 최대 길이
 * @param {string} [suffix='...'] - 잘라냈을 때 붙일 접미사
 * @returns {string}
 */
export function truncateText(text, maxLen, suffix = '...') {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  const cutAt = Math.max(0, maxLen - suffix.length);
  return text.slice(0, cutAt) + suffix;
}

/**
 * 텍스트를 maxLines 줄 이하로 잘라낸다.
 * @param {string} text - 원본 텍스트
 * @param {number} maxLines - 최대 줄 수
 * @param {string} [suffix='\n...(truncated)'] - 잘라냈을 때 붙일 접미사
 * @returns {string}
 */
export function truncateLines(text, maxLines, suffix = '\n...(truncated)') {
  if (!text) return '';
  const lines = text.split('\n');
  if (lines.length <= maxLines) return text;
  return lines.slice(0, maxLines).join('\n') + suffix;
}
