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

  const MAX_FILE_STRUCTURE_LENGTH = 1000;

  let codebaseSection = '';
  if (codebaseInfo) {
    const fileStructure = codebaseInfo.fileStructure || '없음';
    const truncatedStructure =
      fileStructure.length > MAX_FILE_STRUCTURE_LENGTH
        ? fileStructure.slice(0, MAX_FILE_STRUCTURE_LENGTH) + '...(truncated)'
        : fileStructure;
    codebaseSection = `\n\n## 코드베이스 정보
- 기술 스택: ${(codebaseInfo.techStack || []).join(', ') || '없음'}
- 파일 구조: ${truncatedStructure}
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

// Legacy clarity functions — migrated to clarity-analyzer.js (#28)
// Re-export for backward compatibility
export {
  buildClarityCheckPromptV1 as buildClarityCheckPrompt,
  parseClarityCheckResult,
  buildClarificationQuestions,
} from './clarity-analyzer.js';
