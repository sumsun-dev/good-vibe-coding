/**
 * complexity-analyzer — 프로젝트 복잡도 분석 모듈
 * 프로젝트 설명을 분석하여 적절한 모드와 팀 규모를 추천한다.
 */

import { parseJsonObject } from '../core/json-parser.js';
import { config } from '../core/config.js';

/** 복잡도 평가 5차원 */
export const COMPLEXITY_DIMENSIONS = [
  'featureScope',
  'dataComplexity',
  'integrations',
  'authSecurity',
  'scalability',
];

/** 차원별 가중치 */
export const COMPLEXITY_WEIGHTS = {
  featureScope: 0.25,
  dataComplexity: 0.2,
  integrations: 0.2,
  authSecurity: 0.15,
  scalability: 0.2,
};

/** 복잡도 레벨 임계값 */
export const COMPLEXITY_THRESHOLDS = { simple: 0.35, complex: 0.65 };

/**
 * 차원별 점수로 가중 평균 복잡도 점수를 계산한다 (순수 함수).
 * @param {Record<string, {score: number, evidence?: string}>} dimensions
 * @returns {number} 0.0~1.0 가중 평균
 */
export function calculateComplexityScore(dimensions) {
  if (!dimensions || typeof dimensions !== 'object') return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const dim of COMPLEXITY_DIMENSIONS) {
    const entry = dimensions[dim];
    if (!entry || typeof entry.score !== 'number') continue;
    const clamped = Math.max(0, Math.min(1, entry.score));
    const weight = COMPLEXITY_WEIGHTS[dim] || 0;
    weightedSum += clamped * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;
  const score = weightedSum / totalWeight;
  return Math.max(0, Math.min(1, score));
}

/**
 * 점수로 복잡도 레벨을 결정한다 (순수 함수).
 * @param {number} score - 0.0~1.0
 * @returns {'simple' | 'medium' | 'complex'}
 */
export function deriveComplexityLevel(score) {
  if (score < COMPLEXITY_THRESHOLDS.simple) return 'simple';
  if (score >= COMPLEXITY_THRESHOLDS.complex) return 'complex';
  return 'medium';
}

/**
 * 프로젝트 설명을 분석해 복잡도 판단 프롬프트를 생성한다.
 * @param {string} description - 프로젝트 설명
 * @returns {string} 복잡도 분석 프롬프트
 */
export function buildComplexityAnalysisPrompt(description, codebaseInfo = null) {
  if (!description || description.trim() === '') {
    return '';
  }

  let codebaseSection = '';
  if (codebaseInfo) {
    codebaseSection = `\n\n## 코드베이스 정보
- 기술 스택: ${(codebaseInfo.techStack || []).join(', ') || '없음'}
- 파일 구조: ${codebaseInfo.fileStructure || '없음'}
- 주요 언어: ${
      Object.entries(codebaseInfo.languages || {})
        .map(([l, c]) => `${l}(${c})`)
        .join(', ') || '없음'
    }`;
  }

  return `다음 프로젝트 설명을 분석하여 복잡도를 판단하세요.

## 프로젝트 설명
${description}${codebaseSection}

## 복잡도 판단 기준 (5차원 평가)

각 차원을 0.0~1.0 점수로 평가하세요:

**featureScope** (기능 범위, 가중치 25%):
- 0.0~0.3: 단일 기능, 간단한 CRUD
- 0.4~0.6: 다중 기능, 기본 워크플로우
- 0.7~1.0: 복잡한 비즈니스 로직, 다중 도메인

**dataComplexity** (데이터 복잡도, 가중치 20%):
- 0.0~0.3: 파일/인메모리, 단순 키-값
- 0.4~0.6: 단일 DB, 기본 관계
- 0.7~1.0: 다중 DB, 복잡한 스키마, 마이그레이션

**integrations** (외부 연동, 가중치 20%):
- 0.0~0.3: 외부 API 0-1개
- 0.4~0.6: 외부 API 2-3개, 기본 웹훅
- 0.7~1.0: 다수 서비스, 실시간, 메시지 큐

**authSecurity** (인증/보안, 가중치 15%):
- 0.0~0.3: 인증 불필요 또는 단순 API 키
- 0.4~0.6: 기본 인증, 세션/JWT
- 0.7~1.0: OAuth, RBAC, 결제, 민감 데이터

**scalability** (확장성, 가중치 20%):
- 0.0~0.3: 단일 서버, 소규모
- 0.4~0.6: 기본 캐싱, 중간 규모
- 0.7~1.0: 마이크로서비스, 분산 시스템, 고가용성

## 복잡도 레벨 기준
- **simple**: 가중 평균 < 0.35 (예: 날씨 봇, CLI 도구, 랜딩 페이지)
- **medium**: 0.35 ≤ 가중 평균 < 0.65 (예: 블로그, CRUD 앱, 대시보드)
- **complex**: 가중 평균 ≥ 0.65 (예: 마켓플레이스, SaaS, 소셜 네트워크)

## 출력 형식 (반드시 아래 JSON 형식으로 출력)

\`\`\`json
{
  "level": "simple 또는 medium 또는 complex",
  "suggestedMode": "quick-build 또는 plan-execute 또는 plan-only",
  "reasoning": "판단 근거를 1-2문장으로 설명",
  "dimensions": {
    "featureScope": {"score": 0.0, "evidence": "근거"},
    "dataComplexity": {"score": 0.0, "evidence": "근거"},
    "integrations": {"score": 0.0, "evidence": "근거"},
    "authSecurity": {"score": 0.0, "evidence": "근거"},
    "scalability": {"score": 0.0, "evidence": "근거"}
  }
}
\`\`\`

suggestedMode 기준:
- simple → "quick-build" (바로 만들기)
- medium → "plan-execute" (간단 기획 후 만들기)
- complex → "plan-only" (팀 토론 후 만들기, 별도 실행)`;
}

/**
 * 복잡도 분석 결과를 파싱한다.
 * @param {string} rawOutput - 분석 결과 원문
 * @returns {{ level: string, suggestedMode: string, reasoning: string }}
 */
export function parseComplexityAnalysis(rawOutput) {
  const defaultResult = { level: 'medium', suggestedMode: 'plan-execute', reasoning: '' };

  if (!rawOutput || rawOutput.trim() === '') {
    return defaultResult;
  }

  const parsed = parseJsonObject(rawOutput);
  if (parsed) {
    const validLevels = ['simple', 'medium', 'complex'];
    const validModes = ['quick-build', 'plan-execute', 'plan-only'];

    const result = {
      level: validLevels.includes(parsed.level) ? parsed.level : 'medium',
      suggestedMode: validModes.includes(parsed.suggestedMode)
        ? parsed.suggestedMode
        : 'plan-execute',
      reasoning: parsed.reasoning || '',
    };

    if (parsed.dimensions && typeof parsed.dimensions === 'object') {
      const validated = {};
      for (const dim of COMPLEXITY_DIMENSIONS) {
        const raw = parsed.dimensions[dim];
        if (raw && typeof raw === 'object' && typeof raw.score === 'number') {
          validated[dim] = {
            score: Math.max(0, Math.min(1, raw.score)),
            evidence: raw.evidence || '',
          };
        } else {
          validated[dim] = { score: 0.5, evidence: '' };
        }
      }
      result.dimensions = validated;
      result.complexityScore = calculateComplexityScore(validated);
    }

    return result;
  }

  return defaultResult;
}

/**
 * 복잡도별 기본값을 반환한다 (팀 크기, 토론 라운드 등).
 * @param {string} level - 복잡도 ('simple' | 'medium' | 'complex')
 * @returns {{ teamSize: {min: number, max: number}, discussionRounds: number, reviewRounds: number, suggestedRoles: Array<string> }}
 */
export function getDefaultsForComplexity(level) {
  const defaults = {
    simple: {
      teamSize: { ...config.team.simple },
      discussionRounds: 0,
      reviewRounds: 1,
      suggestedRoles: ['cto', 'fullstack', 'qa'],
      modelTiers: {
        leadership: 'sonnet',
        engineering: 'sonnet',
        design: 'haiku',
        research: 'haiku',
        support: 'haiku',
      },
    },
    medium: {
      teamSize: { ...config.team.medium },
      discussionRounds: 1,
      reviewRounds: 1,
      suggestedRoles: ['cto', 'frontend', 'backend', 'qa'],
      modelTiers: {
        leadership: 'sonnet',
        engineering: 'sonnet',
        design: 'sonnet',
        research: 'sonnet',
        support: 'haiku',
      },
    },
    complex: {
      teamSize: { ...config.team.complex },
      discussionRounds: 3,
      reviewRounds: 2,
      suggestedRoles: ['cto', 'po', 'frontend', 'backend', 'qa', 'security'],
      modelTiers: {
        leadership: 'opus',
        engineering: 'sonnet',
        design: 'sonnet',
        research: 'sonnet',
        support: 'haiku',
      },
    },
  };

  return defaults[level] || defaults.medium;
}

/** 명확성 체크 차원별 가중치 */
const CLARITY_WEIGHTS = { feature: 0.5, target: 0.25, tech: 0.25 };

/** 명확성 질문 매핑 */
const CLARITY_QUESTIONS = {
  feature: '핵심 기능을 구체적으로 알려주세요. 어떤 기능이 가장 중요한가요?',
  target: '타겟 사용자가 누구인가요? 어떤 환경에서 사용하나요?',
  tech: '선호하는 기술 스택이나 기술적 제약이 있나요?',
};

/**
 * 프로젝트 설명의 명확성을 체크하는 프롬프트를 생성한다.
 * @param {string|null} description - 프로젝트 설명
 * @returns {string} 명확성 체크 프롬프트 (빈 설명이면 빈 문자열)
 */
export function buildClarityCheckPrompt(description) {
  if (!description || description.trim() === '') return '';

  return `다음 프로젝트 설명의 명확성을 분석하세요.

## 프로젝트 설명
${description}

## 명확성 평가 차원

3가지 차원에서 각각 0.0~1.0 점수를 매기세요:
- **feature** (핵심 기능): 핵심 기능이 구체적으로 명시되어 있는가?
- **target** (타겟 사용자/환경): 타겟 사용자나 사용 환경이 명확한가?
- **tech** (기술 스택/제약): 기술적 요구사항이나 선호가 언급되어 있는가?

## 출력 형식 (반드시 JSON)

\`\`\`json
{
  "scores": { "feature": 0.0, "target": 0.0, "tech": 0.0 },
  "clarityScore": 0.0,
  "missingInfo": ["누락된 차원 키"],
  "reasoning": "판단 근거"
}
\`\`\`

- clarityScore = feature×0.5 + target×0.25 + tech×0.25 (가중 평균)
- missingInfo: 0.5 미만인 차원의 키`;
}

/**
 * 명확성 체크 결과를 파싱한다.
 * @param {string|null} rawOutput - LLM 출력
 * @returns {{ scores: object, clarityScore: number, missingInfo: string[], reasoning: string }}
 */
export function parseClarityCheckResult(rawOutput) {
  const defaultResult = {
    scores: { feature: 0.5, target: 0.5, tech: 0.5 },
    clarityScore: 0.5,
    missingInfo: [],
    reasoning: '',
  };

  if (!rawOutput || rawOutput.trim() === '') return defaultResult;

  const parsed = parseJsonObject(rawOutput);
  if (!parsed) return defaultResult;

  const scores = parsed.scores || defaultResult.scores;

  // 가중 평균 재계산
  const clarityScore =
    (scores.feature || 0) * CLARITY_WEIGHTS.feature +
    (scores.target || 0) * CLARITY_WEIGHTS.target +
    (scores.tech || 0) * CLARITY_WEIGHTS.tech;

  const missingInfo = Array.isArray(parsed.missingInfo) ? parsed.missingInfo : [];

  return {
    scores,
    clarityScore,
    missingInfo,
    reasoning: parsed.reasoning || '',
  };
}

/**
 * missingInfo 기반으로 사용자에게 물을 명확화 질문을 생성한다.
 * @param {string[]|null} missingInfo - 누락된 차원 키 배열
 * @param {number} [maxQuestions=3] - 최대 질문 수
 * @returns {string[]} 질문 배열
 */
export function buildClarificationQuestions(missingInfo, maxQuestions = 3) {
  if (!missingInfo || missingInfo.length === 0) return [];

  const unique = [...new Set(missingInfo)];
  const questions = [];

  for (const key of unique) {
    if (questions.length >= maxQuestions) break;
    const question = CLARITY_QUESTIONS[key];
    if (question) questions.push(question);
  }

  return questions;
}
