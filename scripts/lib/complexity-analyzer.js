/**
 * complexity-analyzer — 프로젝트 복잡도 분석 모듈
 * 프로젝트 설명을 분석하여 적절한 모드와 팀 규모를 추천한다.
 */

/**
 * 프로젝트 설명을 분석해 복잡도 판단 프롬프트를 생성한다.
 * @param {string} description - 프로젝트 설명
 * @returns {string} 복잡도 분석 프롬프트
 */
export function buildComplexityAnalysisPrompt(description) {
  if (!description || description.trim() === '') {
    return '';
  }

  return `다음 프로젝트 설명을 분석하여 복잡도를 판단하세요.

## 프로젝트 설명
${description}

## 복잡도 판단 기준

**simple (간단)**:
- 단일 페이지 또는 단일 기능
- 외부 API 1-2개 이하
- 인증/인가 불필요 또는 단순
- 예: 날씨 봇, 간단한 CLI 도구, 랜딩 페이지

**medium (보통)**:
- 다중 페이지/기능
- 데이터베이스 연동
- 기본 인증 필요
- 예: 블로그, CRUD 앱, 간단한 대시보드

**complex (복잡)**:
- 마이크로서비스 또는 복잡한 아키텍처
- 실시간 기능, 결제, 복잡한 권한 체계
- 다수 외부 서비스 연동
- 예: 마켓플레이스, SaaS 플랫폼, 소셜 네트워크

## 출력 형식 (반드시 아래 JSON 형식으로 출력)

\`\`\`json
{
  "level": "simple 또는 medium 또는 complex",
  "suggestedMode": "quick-build 또는 plan-execute 또는 plan-only",
  "reasoning": "판단 근거를 1-2문장으로 설명"
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

  const parseJson = (str) => {
    const parsed = JSON.parse(str);
    const validLevels = ['simple', 'medium', 'complex'];
    const validModes = ['quick-build', 'plan-execute', 'plan-only'];

    return {
      level: validLevels.includes(parsed.level) ? parsed.level : 'medium',
      suggestedMode: validModes.includes(parsed.suggestedMode) ? parsed.suggestedMode : 'plan-execute',
      reasoning: parsed.reasoning || '',
    };
  };

  // JSON 직접 파싱
  try {
    return parseJson(rawOutput.trim());
  } catch {
    // fallthrough
  }

  // ```json ... ``` 블록
  const jsonBlockMatch = rawOutput.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonBlockMatch) {
    try {
      return parseJson(jsonBlockMatch[1].trim());
    } catch {
      // fallthrough
    }
  }

  // { ... } 패턴
  const objMatch = rawOutput.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return parseJson(objMatch[0]);
    } catch {
      // fallthrough
    }
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
      teamSize: { min: 2, max: 3 },
      discussionRounds: 0,
      reviewRounds: 1,
      suggestedRoles: ['cto', 'fullstack', 'qa'],
    },
    medium: {
      teamSize: { min: 3, max: 5 },
      discussionRounds: 1,
      reviewRounds: 1,
      suggestedRoles: ['cto', 'fullstack', 'frontend', 'backend', 'qa'],
    },
    complex: {
      teamSize: { min: 5, max: 15 },
      discussionRounds: 3,
      reviewRounds: 2,
      suggestedRoles: ['cto', 'po', 'fullstack', 'frontend', 'backend', 'qa', 'uiux', 'devops', 'security'],
    },
  };

  return defaults[level] || defaults.medium;
}
