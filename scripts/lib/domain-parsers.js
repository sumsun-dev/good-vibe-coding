/**
 * domain-parsers — 도메인별 JSON 응답 파서
 * json-parser.js를 래핑하여 도메인별 검증/정규화를 제공한다.
 */

import { parseJsonObject, parseJsonArray } from './json-parser.js';

/**
 * 리뷰 응답을 파싱한다.
 * @param {string} rawResponse - LLM 원본 응답
 * @returns {{approved: boolean, feedback: string, issues: Array}} 정규화된 리뷰
 */
export function parseReviewResponse(rawResponse) {
  const parsed = parseJsonObject(rawResponse);
  if (!parsed) {
    return { approved: false, feedback: '', issues: [], parseError: true };
  }
  return {
    approved: Boolean(parsed.approved),
    feedback: parsed.feedback || '',
    issues: normalizeIssues(parsed.issues),
  };
}

/**
 * 복잡도 분석 응답을 파싱한다.
 * @param {string} rawResponse - LLM 원본 응답
 * @returns {{level: string, reasoning: string, recommendations: Array}} 정규화된 분석
 */
export function parseComplexityResponse(rawResponse) {
  const parsed = parseJsonObject(rawResponse);
  if (!parsed) {
    return { level: 'medium', reasoning: '', recommendations: [], parseError: true };
  }
  const validLevels = ['simple', 'medium', 'complex'];
  return {
    level: validLevels.includes(parsed.level) ? parsed.level : 'medium',
    reasoning: parsed.reasoning || '',
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
  };
}

/**
 * 태스크 목록 응답을 파싱한다.
 * @param {string} rawResponse - LLM 원본 응답
 * @returns {Array<{id: string, title: string, assignee: string}>} 정규화된 태스크 목록
 */
export function parseTaskListResponse(rawResponse) {
  const parsed = parseJsonArray(rawResponse);
  return parsed
    .filter(t => t && typeof t === 'object' && t.title)
    .map((t, i) => ({
      id: t.id || `task-${i + 1}`,
      title: t.title || '',
      assignee: t.assignee || '',
      phase: t.phase || 1,
    }));
}

/**
 * 개선 제안 응답을 파싱한다.
 * @param {string} rawResponse - LLM 원본 응답
 * @returns {Array<{section: string, suggested: string, reason: string}>}
 */
export function parseSuggestionsResponse(rawResponse) {
  const parsed = parseJsonArray(rawResponse);
  return parsed
    .filter(s => s && typeof s === 'object' && s.suggested)
    .map(s => ({
      section: s.section || '',
      current: s.current || '',
      suggested: s.suggested,
      reason: s.reason || '',
    }));
}

/**
 * issues 배열을 정규화한다.
 */
function normalizeIssues(issues) {
  if (!Array.isArray(issues)) return [];
  return issues
    .filter(i => i && typeof i === 'object')
    .map(i => ({
      severity: i.severity || 'minor',
      description: i.description || '',
      file: i.file || null,
      line: i.line || null,
    }));
}
