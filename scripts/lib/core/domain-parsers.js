/**
 * domain-parsers — 도메인별 JSON 응답 파서
 * json-parser.js를 래핑하여 도메인별 검증/정규화를 제공한다.
 */

import { parseJsonObject, parseJsonArray } from './json-parser.js';
import { coerce } from './schema-validator.js';

/** 리뷰 응답 스키마 */
const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    approved: { type: 'boolean', required: true, default: false },
    feedback: { type: 'string', default: '' },
    issues: {
      type: 'array',
      default: [],
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['critical', 'important', 'minor'], default: 'minor' },
          description: { type: 'string', default: '' },
        },
      },
    },
  },
};

/** 복잡도 분석 스키마 */
const COMPLEXITY_SCHEMA = {
  type: 'object',
  properties: {
    level: { type: 'string', enum: ['simple', 'medium', 'complex'], default: 'medium' },
    reasoning: { type: 'string', default: '' },
    recommendations: { type: 'array', default: [] },
  },
};

/** 태스크 목록 아이템 스키마 */
const TASK_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', default: '' },
    title: { type: 'string', required: true, default: '' },
    assignee: { type: 'string', default: '' },
    phase: { type: 'number', default: 1 },
  },
};

/** 개선 제안 아이템 스키마 */
const SUGGESTION_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    section: { type: 'string', default: '' },
    current: { type: 'string', default: '' },
    suggested: { type: 'string', required: true, default: '' },
    reason: { type: 'string', default: '' },
  },
};

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
  const coerced = coerce(parsed, REVIEW_SCHEMA);
  return {
    approved: Boolean(coerced.approved),
    feedback: coerced.feedback || '',
    issues: normalizeIssues(coerced.issues),
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
  const coerced = coerce(parsed, COMPLEXITY_SCHEMA);
  return {
    level: coerced.level,
    reasoning: coerced.reasoning,
    recommendations: coerced.recommendations,
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
    .filter((t) => t && typeof t === 'object' && t.title)
    .map((t, i) => {
      const coerced = coerce(t, TASK_ITEM_SCHEMA);
      return {
        id: coerced.id || `task-${i + 1}`,
        title: coerced.title,
        assignee: coerced.assignee,
        phase: coerced.phase,
      };
    });
}

/**
 * 개선 제안 응답을 파싱한다.
 * @param {string} rawResponse - LLM 원본 응답
 * @returns {Array<{section: string, suggested: string, reason: string}>}
 */
export function parseSuggestionsResponse(rawResponse) {
  const parsed = parseJsonArray(rawResponse);
  return parsed
    .filter((s) => s && typeof s === 'object' && s.suggested)
    .map((s) => {
      const coerced = coerce(s, SUGGESTION_ITEM_SCHEMA);
      return {
        section: coerced.section,
        current: coerced.current,
        suggested: coerced.suggested,
        reason: coerced.reason,
      };
    });
}

/**
 * issues 배열을 정규화한다.
 */
function normalizeIssues(issues) {
  if (!Array.isArray(issues)) return [];
  return issues
    .filter((i) => i && typeof i === 'object')
    .map((i) => ({
      severity: i.severity || 'minor',
      description: i.description || '',
      file: i.file || null,
      line: i.line || null,
    }));
}
