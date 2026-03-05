/**
 * clarity-analyzer — 프로젝트 설명 명확도 분석 모듈 (v2)
 *
 * Ouroboros 수학 모델 기반:
 *   clarity = Σ(dᵢ.score × wᵢ) / Σ(wᵢ)
 *
 * 5차원 평가 + 적응형 가중치 + 수렴 판정 + 개선 속도 추적
 */

import { parseJsonObject } from '../core/json-parser.js';
import { config } from '../core/config.js';

/** 프로젝트 타입별 가중치 프로파일 */
const WEIGHT_PROFILES = {
  default: { scope: 0.3, userStory: 0.2, techStack: 0.15, constraints: 0.15, successCriteria: 0.2 },
  'web-app': {
    scope: 0.25,
    userStory: 0.25,
    techStack: 0.2,
    constraints: 0.15,
    successCriteria: 0.15,
  },
  'cli-tool': {
    scope: 0.35,
    userStory: 0.15,
    techStack: 0.15,
    constraints: 0.1,
    successCriteria: 0.25,
  },
  'api-server': {
    scope: 0.3,
    userStory: 0.15,
    techStack: 0.2,
    constraints: 0.2,
    successCriteria: 0.15,
  },
};

const DIMENSIONS = ['scope', 'userStory', 'techStack', 'constraints', 'successCriteria'];

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}
function round4(v) {
  return Math.round(v * 10000) / 10000;
}

/**
 * 프로젝트 타입에 따른 가중치 프로파일을 반환한다.
 * @param {string} projectType - 프로젝트 타입 (default, web-app, cli-tool, api-server)
 * @param {boolean} [hasCodebaseInfo=false] - Brownfield 여부
 * @returns {Record<string, number>} 5차원 가중치 (합계 1.0)
 */
export function getWeightProfile(projectType, hasCodebaseInfo = false) {
  const base = { ...(WEIGHT_PROFILES[projectType] || WEIGHT_PROFILES.default) };

  if (hasCodebaseInfo) {
    const reduction = base.techStack - 0.05;
    base.techStack = 0.05;
    const others = Object.keys(base).filter((k) => k !== 'techStack');
    const bonus = reduction / others.length;
    for (const k of others) base[k] = round4(base[k] + bonus);
  }

  // 부동소수점 보정: 합이 1.0에서 벗어나면 마지막 항목에 오차 할당
  const keys = Object.keys(base);
  const sum = keys.reduce((acc, k) => acc + base[k], 0);
  const diff = round4(1.0 - sum);
  if (diff !== 0) {
    base[keys[keys.length - 1]] = round4(base[keys[keys.length - 1]] + diff);
  }

  return base;
}

/**
 * 프로젝트 설명의 명확도를 평가하는 LLM 프롬프트를 생성한다.
 * @param {string} description - 프로젝트 설명
 * @param {string} [projectType] - 프로젝트 타입
 * @param {object} [codebaseInfo] - 코드베이스 정보
 * @returns {string} LLM 프롬프트 (빈 설명이면 빈 문자열)
 */
function buildContextSections(projectType, codebaseInfo) {
  let projectTypeSection = '';
  if (projectType) {
    projectTypeSection = `\n## 프로젝트 타입\n${projectType}\n`;
  }

  let codebaseSection = '';
  if (codebaseInfo) {
    codebaseSection = `\n## 코드베이스 정보
- 기술 스택: ${(codebaseInfo.techStack || []).join(', ') || '없음'}
- 파일 구조: ${codebaseInfo.fileStructure || '없음'}\n`;
  }

  return `${projectTypeSection}${codebaseSection}`;
}

function buildDimensionSection() {
  return `## 평가 차원

### scope (기능 범위)
0.9+: "할일 CRUD + 우선순위 + 마감 알림 + 팀 공유"
0.6-0.8: "할일 관리 앱"
0.3-0.5: "생산성 앱"
0.0-0.2: "좋은 앱"

### userStory (사용자 시나리오)
0.9+: "재택 개발자가 매일 업무 정리하고 팀원과 공유"
0.6-0.8: "개발자를 위한 도구"
0.3-0.5: "업무 관리"
0.0-0.2: 사용자 언급 없음

### techStack (기술 스택)
0.9+: "Next.js + Supabase + PWA, 모바일 반응형"
0.6-0.8: "웹으로 만들어줘"
0.3-0.5: "앱으로"
0.0-0.2: 기술 언급 없음

### constraints (비기능 요구사항)
0.9+: "동시 100명, Google OAuth, 한/영 지원"
0.6-0.8: "빠르게 동작해야 함"
0.3-0.5: 암묵적 제약 유추 가능
0.0-0.2: 제약 없음

### successCriteria (완료 기준)
0.9+: "1단계 CRUD, 2단계 알림, 3단계 팀"
0.6-0.8: "기본 기능 동작"
0.3-0.5: 범위 열려 있음
0.0-0.2: 기준 없음`;
}

function buildOutputFormatSection() {
  return `## 질문 생성

score < 0.6인 차원마다 질문을 생성하세요.
각 질문에 3-4개 선택형 옵션을 포함하세요.
질문은 설명 내용에 맞춤화하세요.

BAD: "어떤 기능이 필요하세요?" (일반적)
GOOD: "날씨 앱에 어떤 기능이 필요하세요? 예: 현재 날씨, 주간 예보, 미세먼지" (맞춤)

### 질문 생성 규칙
1. **도메인 구체적 질문 우선**
   - BAD: "어떤 기능이 필요하세요?" (일반적)
   - GOOD: "뉴스 봇의 뉴스 소스는?" + ["Hacker News API", "RSS 피드", "NewsAPI.org", "웹 스크래핑"]

2. **외부 데이터/서비스 질문**: 외부 데이터가 필요하면 반드시 소스를 질문
   - "어디서 데이터를 가져올까요?"
   - "알림 채널은? (텔레그램/슬랙/이메일/디스코드)"

3. **주기/빈도 질문**: 반복 작업이면 빈도 질문
   - "수집 주기는?" + ["실시간", "1시간마다", "하루 1회", "수동"]

4. **설정/인증 질문**: 외부 서비스 API 키 보유 여부 확인

## 출력 (JSON)

\`\`\`json
{
  "dimensions": {
    "scope": {"score": 0.0, "evidence": "근거"},
    "userStory": {"score": 0.0, "evidence": "근거"},
    "techStack": {"score": 0.0, "evidence": "근거"},
    "constraints": {"score": 0.0, "evidence": "근거"},
    "successCriteria": {"score": 0.0, "evidence": "근거"}
  },
  "questions": [
    {
      "dimension": "scope",
      "question": "맞춤 질문",
      "options": ["옵션1", "옵션2", "옵션3"],
      "context": "이 질문을 하는 이유"
    }
  ],
  "summary": "전체 평가 1문장"
}
\`\`\``;
}

export function buildClarityCheckPrompt(description, projectType, codebaseInfo) {
  if (!description || description.trim() === '') return '';

  const maxLen = config.clarity?.maxDescriptionLength ?? 3000;
  const trimmedDesc = description.trim().slice(0, maxLen);

  return `프로젝트 설명의 명확도를 5개 차원에서 평가하세요.
각 차원을 0.0~1.0으로 점수 매기세요.

## 프로젝트 설명
${trimmedDesc}
${buildContextSections(projectType, codebaseInfo)}
${buildDimensionSection()}

${buildOutputFormatSection()}`;
}

/**
 * LLM의 명확도 분석 결과를 파싱한다.
 * @param {string} rawOutput - LLM 출력
 * @returns {{ clarity: number, dimensions: object, gaps: string[], questions: Array, summary: string, parseError?: boolean }}
 */
export function parseClarityResult(rawOutput) {
  const defaultDimensions = {};
  for (const dim of DIMENSIONS) {
    defaultDimensions[dim] = { score: 0.3, evidence: '' };
  }
  const defaultResult = {
    clarity: 0.3,
    dimensions: defaultDimensions,
    gaps: [],
    questions: [],
    summary: '',
    parseError: true,
  };

  if (!rawOutput || rawOutput.trim() === '') return defaultResult;

  const parsed = parseJsonObject(rawOutput);
  if (!parsed || !parsed.dimensions) return defaultResult;

  const dimensions = {};
  for (const dim of DIMENSIONS) {
    const raw = parsed.dimensions[dim];
    if (raw && typeof raw.score === 'number') {
      dimensions[dim] = {
        score: clamp01(raw.score),
        evidence: raw.evidence || '',
      };
    } else {
      dimensions[dim] = { score: 0.5, evidence: '' };
    }
  }

  const weights = getWeightProfile('default');
  const clarity = calculateClarity(dimensions, weights);

  const gaps = DIMENSIONS.filter(
    (d) => dimensions[d].score < (config.clarity?.dimensionThreshold ?? 0.6),
  );

  const questions = Array.isArray(parsed.questions)
    ? parsed.questions.filter((q) => q && q.question && Array.isArray(q.options))
    : [];

  return {
    clarity,
    dimensions,
    gaps,
    questions,
    summary: parsed.summary || '',
  };
}

/**
 * 차원 점수와 가중치로 명확도를 계산한다 (순수 함수).
 * @param {Record<string, {score: number}>} dimensions - 차원별 점수
 * @param {Record<string, number>} weights - 차원별 가중치
 * @returns {number} 0.0~1.0 가중 평균
 */
export function calculateClarity(dimensions, weights) {
  let total = 0;
  let weightSum = 0;

  for (const [dim, weight] of Object.entries(weights)) {
    const score = dimensions[dim]?.score;
    if (typeof score === 'number' && !isNaN(score)) {
      total += clamp01(score) * weight;
      weightSum += weight;
    }
  }

  return weightSum > 0 ? round4(total / weightSum) : 0.5;
}

/**
 * 현재 명확도와 이전 명확도로 수렴 여부를 판정한다 (순수 함수).
 * @param {number} clarity - 현재 명확도 (0.0~1.0)
 * @param {number|null} previousClarity - 이전 라운드 명확도
 * @returns {{ proceed: boolean, reason: 'clear'|'stagnation'|null }}
 */
export function shouldProceed(clarity, previousClarity) {
  if (isNaN(clarity)) {
    return { proceed: false, reason: 'invalid-clarity' };
  }

  const threshold = config.clarity?.threshold ?? 0.8;
  const minImprovement = config.clarity?.minImprovement ?? 0.05;

  if (clarity >= threshold) {
    return { proceed: true, reason: 'clear' };
  }

  if (previousClarity !== null && previousClarity !== undefined) {
    if (clarity - previousClarity < minImprovement) {
      return { proceed: true, reason: 'stagnation' };
    }
  }

  return { proceed: false, reason: null };
}

/**
 * score < dimensionThreshold인 차원의 질문만 필터한다 (순수 함수).
 * @param {Array|null} questions - 전체 질문 배열
 * @param {Record<string, {score: number}>} dimensions - 차원별 점수
 * @returns {Array} 필터된 질문
 */
export function filterQuestions(questions, dimensions) {
  if (!questions || !Array.isArray(questions)) return [];

  const dimThreshold = config.clarity?.dimensionThreshold ?? 0.6;

  return questions.filter((q) => {
    const dimScore = dimensions[q.dimension]?.score;
    return dimScore === undefined || dimScore < dimThreshold;
  });
}

/**
 * 원본 설명에 사용자 답변을 병합한다 (순수 함수, LLM 호출 없음).
 * @param {string} original - 원본 프로젝트 설명
 * @param {Array<{selectedOption: string}>} answers - 사용자 답변
 * @returns {string} 보강된 설명
 */
export function enrichDescription(original, answers) {
  if (!original) return '';
  if (!answers || answers.length === 0) return original.trim();

  const parts = [original.trim()];
  for (const { selectedOption } of answers) {
    if (selectedOption) parts.push(selectedOption);
  }
  return parts.join('\n');
}

// --- Legacy v1 clarity functions (migrated from complexity-analyzer.js, #28) ---

/** v1 명확성 체크 차원별 가중치 (3차원) */
const CLARITY_WEIGHTS_V1 = { feature: 0.5, target: 0.25, tech: 0.25 };

/** v1 명확성 질문 매핑 */
const CLARITY_QUESTIONS_V1 = {
  feature: '핵심 기능을 구체적으로 알려주세요. 어떤 기능이 가장 중요한가요?',
  target: '타겟 사용자가 누구인가요? 어떤 환경에서 사용하나요?',
  tech: '선호하는 기술 스택이나 기술적 제약이 있나요?',
};

/**
 * [Legacy] 프로젝트 설명의 명확성을 체크하는 프롬프트를 생성한다 (3차원 버전).
 * @param {string|null} description - 프로젝트 설명
 * @returns {string} 명확성 체크 프롬프트 (빈 설명이면 빈 문자열)
 */
export function buildClarityCheckPromptV1(description) {
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
 * [Legacy] 명확성 체크 결과를 파싱한다 (3차원 버전).
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

  const clarityScore =
    (scores.feature || 0) * CLARITY_WEIGHTS_V1.feature +
    (scores.target || 0) * CLARITY_WEIGHTS_V1.target +
    (scores.tech || 0) * CLARITY_WEIGHTS_V1.tech;

  const missingInfo = Array.isArray(parsed.missingInfo) ? parsed.missingInfo : [];

  return {
    scores,
    clarityScore,
    missingInfo,
    reasoning: parsed.reasoning || '',
  };
}

/**
 * [Legacy] missingInfo 기반으로 사용자에게 물을 명확화 질문을 생성한다.
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
    const question = CLARITY_QUESTIONS_V1[key];
    if (question) questions.push(question);
  }

  return questions;
}
