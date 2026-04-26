/**
 * task-router — 자연어 입력을 5개 작업 유형으로 분류한다.
 *
 * PRD §6, §7, §8.3 (보안). v2 단일 진입점 `/gv`의 라우팅 핵심.
 *
 * 입력: 자연어 + 컨텍스트(현재 디렉토리 정보)
 * 출력: { taskType, intent, confidence, escalateForConfirm, warnings, context }
 *
 * 분류 우선순위(점수 동률 시): review > research > plan > ask > code(default).
 * 인젝션 패턴(한/영) 감지 시 confidence 0 + escalate.
 *
 * LLM 호출 없는 순수 규칙 기반. 향후 LLM fallback 추가 시
 * `wrapUserInput()` + `sanitizeForPrompt()`를 호출자(routeTask 사용처)에서 적용.
 */

import { sanitizeForPrompt, wrapUserInput } from '../core/prompt-builder.js';

export const TASK_TYPES = ['code', 'plan', 'research', 'review', 'ask'];
export const INTENT_TYPES = ['feature', 'refactor', 'debug'];

const MIN_WORDS = 3;
const ESCALATE_CONFIDENCE = 0.6;
const DEFAULT_CODE_CONFIDENCE = 0.6;

/** 한국어 프롬프트 인젝션 패턴 (영어는 sanitizeForPrompt가 처리) */
const KOREAN_INJECTION_PATTERNS = [
  /이전\s*(지시|명령|지침)/,
  /지금까지의?\s*(지시|명령)/,
  /새로운?\s*역할/,
  /다른\s*역할/,
  /시스템\s*프롬프트/,
  /프롬프트\s*(보여|출력|노출)/,
  /개발자\s*모드/,
  /관리자\s*권한/,
];

const REVIEW_KEYWORDS = [
  /(코드\s*)?리뷰/,
  /검토/,
  /\bPR\b/,
  /pull\s*request/i,
  /\bdiff\b/i,
  /merge.*전.*검토/,
  /\breview\b/i,
  /\baudit\b/i,
  /\bexamine\b/i,
  /look\s*over/i,
  /check.*before.*merge/i,
  /최근.*커밋/,
];

const ASK_KEYWORDS = [
  /\?/,
  /(어떻게|왜|뭐야|뭔가|뭘|무엇|어디서|어디에)/,
  /설명해/,
  /알려줘/,
  /\bwhat\b/i,
  /\bhow\b/i,
  /\bwhy\b/i,
  /\bwhere\b/i,
  /\bwhen\b/i,
  /show\s*me/i,
  /\bexplain\b/i,
];

const RESEARCH_KEYWORDS = [
  /\bvs\b/i,
  /비교/,
  /추천/,
  /(어떤|어느)\s*(게|것)/,
  /(어떤|어느).*?(라이브러리|툴|프레임워크|도구|DB|데이터베이스|써야|쓸|선택|적합|좋을지|좋을까)/,
  /(맞을지|적합할지)/,
  /(should\s*we|should\s*i)/i,
  /\bbest\s+(framework|library|tool|monitoring)/i,
  /\bcompare\b/i,
  /\brecommend(ation)?\b/i,
];

const PLAN_KEYWORDS = [
  /플랫폼/,
  /\bplatform\b/i,
  /시스템.*(만들|구축|설계|기획)/,
  /(만들|구축|기획).*?(플랫폼|서비스)/,
  /\bSaaS\b/i,
  /기획해/,
  /design\s+a[n]?\s+(?:[\w-]+\s+)*?(platform|system|backend)/i,
  /build\s+a[n]?\s+(?:[\w-]+\s+)*?(platform|marketplace)/i,
  /create\s+a[n]?\s+(?:[\w-]+\s+)*?(platform)/i,
  /plan\s+a[n]?\s+(?:[\w-]+\s+)*?(system|platform|dashboard)/i,
];

const CODE_REFACTOR_KEYWORDS = [
  /리팩토링/,
  /\brefactor\b/i,
  /최적화/,
  /\boptimize\b/i,
  /clean\s*up/i,
  /clean\s*(up\s+)?the/i,
  /성능.*개선/,
  /더\s*깔끔하게/,
  /깔끔하게\s*정리/,
];

const CODE_DEBUG_KEYWORDS = [
  /디버그/,
  /\bdebug\b/i,
  /\bbug\b/i,
  /버그/,
  /고쳐(줘)?/,
  /\berror\b/i,
  /에러/,
  /\bfix\b/i,
  /\bleak\b/i,
  /누수/,
  /왜\s*깨지/,
  /왜\s*안\s*되/,
];

/**
 * 자연어 입력을 5개 작업 유형으로 분류한다.
 *
 * 호출자가 LLM 프롬프트에 자연어를 삽입할 때는 반환된 `sanitizedInput`을 사용해야 한다
 * (이미 `wrapUserInput`으로 감싸진 상태).
 *
 * @param {string} input - 사용자 자연어
 * @param {object} [context] - 컨텍스트 (예: { hasGitRepo: boolean })
 * @returns {{
 *   taskType: 'code'|'plan'|'research'|'review'|'ask',
 *   intent: 'feature'|'refactor'|'debug'|null,
 *   confidence: number,
 *   escalateForConfirm: boolean,
 *   warnings: string[],
 *   context: object,
 *   sanitizedInput: string|null
 * }}
 */
export function routeTask(input, context = {}) {
  const safeContext = context && typeof context === 'object' ? context : {};
  const ctx = {
    ...safeContext,
    // 컨텍스트 불명 시 보수적으로 hasGitRepo=true (plan 점수 +1 보너스를 주지 않는 쪽)
    hasGitRepo: typeof safeContext.hasGitRepo === 'boolean' ? safeContext.hasGitRepo : true,
  };

  if (!input || typeof input !== 'string') {
    return reject('빈 입력', ctx);
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return reject('빈 입력', ctx);
  }

  if (trimmed.split(/\s+/).length < MIN_WORDS) {
    return reject(`입력이 너무 짧음 (${MIN_WORDS} 단어 미만)`, ctx);
  }

  const injectionWarnings = detectInjection(trimmed);
  if (injectionWarnings.length > 0) {
    return {
      taskType: 'ask',
      intent: null,
      confidence: 0,
      escalateForConfirm: true,
      warnings: injectionWarnings,
      context: ctx,
      sanitizedInput: null,
    };
  }

  const scores = {
    review: countMatches(trimmed, REVIEW_KEYWORDS),
    research: countMatches(trimmed, RESEARCH_KEYWORDS),
    plan: countMatches(trimmed, PLAN_KEYWORDS) + (ctx.hasGitRepo ? 0 : 1),
    ask: countMatches(trimmed, ASK_KEYWORDS),
  };

  // 우선순위 — 동률 시 앞에 있는 유형이 이김
  const order = ['review', 'research', 'plan', 'ask'];
  let bestType = 'code';
  let bestScore = 0;
  for (const type of order) {
    if (scores[type] > bestScore) {
      bestType = type;
      bestScore = scores[type];
    }
  }

  // ask 약한 신호와 code 신호가 동시에 있으면 code 우선
  // (예: "이 테스트가 왜 깨지지" — '왜'로 ask 1점이지만 '왜 깨지'는 debug)
  const codeSignal =
    countMatches(trimmed, CODE_DEBUG_KEYWORDS) + countMatches(trimmed, CODE_REFACTOR_KEYWORDS);
  if (bestType === 'ask' && bestScore <= 1 && codeSignal > 0) {
    bestType = 'code';
    bestScore = codeSignal;
  }

  let confidence;
  if (bestScore === 0) {
    bestType = 'code';
    confidence = DEFAULT_CODE_CONFIDENCE;
  } else if (bestScore === 1) {
    confidence = 0.7;
  } else {
    confidence = Math.min(0.95, 0.7 + bestScore * 0.1);
  }

  const intent = bestType === 'code' ? inferCodeIntent(trimmed) : null;

  return {
    taskType: bestType,
    intent,
    confidence,
    escalateForConfirm: confidence < ESCALATE_CONFIDENCE,
    warnings: [],
    context: ctx,
    sanitizedInput: wrapUserInput(trimmed),
  };
}

function reject(reason, ctx) {
  return {
    taskType: 'ask',
    intent: null,
    confidence: 0,
    escalateForConfirm: true,
    warnings: [reason],
    context: ctx,
    sanitizedInput: null,
  };
}

function detectInjection(input) {
  const warnings = [];
  const { warnings: enWarnings } = sanitizeForPrompt(input);
  warnings.push(...enWarnings);
  for (const pattern of KOREAN_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      warnings.push(`한국어 인젝션 의심 패턴: ${pattern.source}`);
    }
  }
  return warnings;
}

function countMatches(input, patterns) {
  return patterns.reduce((acc, p) => (p.test(input) ? acc + 1 : acc), 0);
}

function inferCodeIntent(input) {
  if (countMatches(input, CODE_DEBUG_KEYWORDS) > 0) return 'debug';
  if (countMatches(input, CODE_REFACTOR_KEYWORDS) > 0) return 'refactor';
  return 'feature';
}
