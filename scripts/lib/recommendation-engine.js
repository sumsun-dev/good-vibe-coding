/**
 * recommendation-engine — 스킬/에이전트 추천 엔진
 * 프로젝트 컨텍스트 기반 멀티시그널 스코어링. LLM 호출 없음.
 */

import { readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { LazyCache } from './cache.js';
import { config } from './config.js';
import { requireString, requireOneOf, inputError } from './validators.js';
import { validate } from './schema-validator.js';

const VALID_COMPLEXITIES = ['simple', 'medium', 'complex'];

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = resolve(__dirname, '../../presets/recommendation-catalog.json');

const CATALOG_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    id: { type: 'string', required: true },
    displayName: { type: 'string', required: true },
    description: { type: 'string', required: true },
    sourcePath: { type: 'string', required: true },
    installPath: { type: 'string', required: true },
    type: { type: 'string', required: true, enum: ['skill', 'agent'] },
    keywords: { type: 'array', required: true },
    applicableProjectTypes: { type: 'array', required: true },
    complexityRange: { type: 'array', required: true },
    targetRoles: { type: 'array', required: true },
    priority: { type: 'string', required: true, enum: ['high', 'medium', 'low'] },
  },
};

function validateCatalog(catalog) {
  const allItems = [...(catalog.skills || []), ...(catalog.agents || [])];
  const errors = [];
  for (const item of allItems) {
    const result = validate(item, CATALOG_ITEM_SCHEMA);
    if (!result.valid) {
      errors.push(`카탈로그 항목 "${item.id || '(unknown)'}": ${result.errors.join(', ')}`);
    }
  }
  if (errors.length > 0) {
    throw inputError(`카탈로그 검증 실패:\n${errors.join('\n')}`);
  }
  return catalog;
}

const catalogCache = new LazyCache(async () => {
  const raw = await readFile(CATALOG_PATH, 'utf-8');
  const catalog = JSON.parse(raw);
  return validateCatalog(catalog);
});

/** 한국어 조사 패턴 (단어 끝에 붙는 1-2자) */
const KOREAN_PARTICLES = /[은는이가을를의에로서와과도만까지부터마저조차]$/;

/** 한글 포함 여부 */
const HAS_HANGUL = /[\uAC00-\uD7AF]/;

/**
 * 설명 텍스트에서 키워드를 추출한다.
 * 공백/구두점 기준 토큰화, 한국어 조사 제거, 영어 소문자 정규화.
 * 한글 토큰은 1자도 허용 (웹, 앱, 봇 등), 영어는 2자 이상만.
 * @param {string} description - 입력 텍스트
 * @returns {Set<string>} 키워드 집합
 */
export function extractKeywords(description) {
  if (!description || typeof description !== 'string') return new Set();

  const tokens = description
    .replace(/[.,!?;:()[\]{}"'`~@#$%^&*+=<>/\\|]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 1)
    .map(t => {
      const stripped = t.replace(KOREAN_PARTICLES, '');
      const token = stripped.length >= 1 ? stripped : t;
      return token.toLowerCase();
    })
    .filter(t => t.length >= 2 || HAS_HANGUL.test(t));

  return new Set(tokens);
}

/**
 * 단일 항목의 추천 점수를 계산한다.
 * @param {object} item - 카탈로그 항목
 * @param {object} context - 프로젝트 컨텍스트
 * @param {string} context.projectType - 프로젝트 타입
 * @param {string} context.complexity - 복잡도 (simple/medium/complex)
 * @param {string} context.description - 프로젝트 설명
 * @param {string[]} context.teamRoles - 팀 역할 목록
 * @returns {number} 점수
 */
export function scoreItem(item, context) {
  const w = config.recommendation.weights;
  let score = 0;

  // 1. 프로젝트 타입 매칭
  if (item.applicableProjectTypes.length === 0) {
    score += 1;
  } else if (item.applicableProjectTypes.includes(context.projectType)) {
    score += w.projectType;
  }

  // 2. 복잡도 매칭
  if (item.complexityRange.includes(context.complexity)) {
    score += w.complexity;
  }

  // 3. 키워드 교집합
  const descKeywords = extractKeywords(context.description);
  const itemKeywords = new Set(item.keywords.map(k => k.toLowerCase()));
  let keywordHits = 0;
  for (const kw of descKeywords) {
    if (itemKeywords.has(kw)) keywordHits++;
  }
  score += Math.min(keywordHits, config.recommendation.maxKeywordHits) * w.keyword;

  // 4. 역할 친화성
  if (item.targetRoles.length > 0 && context.teamRoles) {
    const teamSet = new Set(context.teamRoles);
    let roleHits = 0;
    for (const role of item.targetRoles) {
      if (teamSet.has(role)) roleHits++;
    }
    score += roleHits * w.roleAffinity;
  }

  return score;
}

/**
 * 추천 이유 텍스트를 생성한다.
 * @param {object} item - 카탈로그 항목
 * @param {object} context - 프로젝트 컨텍스트
 * @returns {string} 한국어 추천 이유
 */
export function buildReasonText(item, context) {
  const reasons = [];

  if (item.applicableProjectTypes.length === 0) {
    reasons.push('모든 프로젝트에 유용');
  } else if (item.applicableProjectTypes.includes(context.projectType)) {
    reasons.push(`${context.projectType} 프로젝트에 적합`);
  }

  if (item.complexityRange.includes(context.complexity)) {
    reasons.push(`${context.complexity} 복잡도에 권장`);
  }

  if (item.targetRoles.length > 0 && context.teamRoles) {
    const teamSet = new Set(context.teamRoles);
    const matched = item.targetRoles.filter(r => teamSet.has(r));
    if (matched.length > 0) {
      reasons.push(`${matched.join(', ')} 역할과 연관`);
    }
  }

  return reasons.length > 0 ? reasons.join('; ') : item.description;
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

/**
 * 프로젝트 컨텍스트 기반으로 스킬/에이전트를 추천한다.
 * @param {object} context
 * @param {string} context.projectType - 프로젝트 타입
 * @param {string} context.complexity - 복잡도
 * @param {string} context.description - 프로젝트 설명
 * @param {string[]} context.teamRoles - 팀 역할
 * @param {Set<string>} [context.installedItems] - 이미 설치된 항목 ID
 * @returns {Promise<{skills: Array, agents: Array}>}
 */
export async function recommendSetup(context) {
  requireString(context.projectType, 'projectType');
  requireString(context.description, 'description');
  requireOneOf(context.complexity, VALID_COMPLEXITIES, 'complexity');

  const catalog = await catalogCache.get();
  const installed = context.installedItems || new Set();
  const { minScore, maxPerCategory } = config.recommendation;

  function processItems(items) {
    return items
      .filter(item => !installed.has(item.id))
      .map(item => ({
        ...item,
        score: scoreItem(item, context),
        reason: buildReasonText(item, context),
      }))
      .filter(item => item.score >= minScore)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
      })
      .slice(0, maxPerCategory);
  }

  return {
    skills: processItems(catalog.skills),
    agents: processItems(catalog.agents),
  };
}

/**
 * 추천 결과를 마크다운 테이블로 포맷한다.
 * @param {{skills: Array, agents: Array}} recommendations
 * @returns {string} 마크다운 문자열 (빈 결과면 빈 문자열)
 */
export function formatRecommendations(recommendations) {
  const { skills, agents } = recommendations;
  if (skills.length === 0 && agents.length === 0) return '';

  const lines = [];

  if (skills.length > 0) {
    lines.push('### 추천 스킬');
    lines.push('| 스킬 | 설명 | 추천 이유 |');
    lines.push('|------|------|-----------|');
    for (const s of skills) {
      lines.push(`| ${s.displayName} | ${s.description} | ${s.reason} |`);
    }
    lines.push('');
  }

  if (agents.length > 0) {
    lines.push('### 추천 에이전트');
    lines.push('| 에이전트 | 모델 | 설명 | 추천 이유 |');
    lines.push('|----------|------|------|-----------|');
    for (const a of agents) {
      lines.push(`| ${a.displayName} | ${a.model || '-'} | ${a.description} | ${a.reason} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 카탈로그 전체를 반환한다.
 * @returns {Promise<object>}
 */
export async function getCatalog() {
  return catalogCache.get();
}

/** 테스트용 캐시 초기화 */
export function clearCache() {
  catalogCache.clear();
}
