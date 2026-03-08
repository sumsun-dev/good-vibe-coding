/**
 * prd-generator — PRD 프롬프트 생성/파싱/포맷 모듈
 * 명확도 분석 → 복잡도 분석 사이에 CEO 확인용 경량 PRD를 생성한다.
 */

import { parseJsonObject } from '../core/json-parser.js';
import {
  sanitizeForPrompt,
  wrapUserInput,
  DATA_BOUNDARY_INSTRUCTION,
} from '../core/prompt-builder.js';

const EMPTY_PRD = {
  overview: '',
  coreFeatures: [],
  userScenarios: [],
  technicalRequirements: { stack: [], integrations: [], constraints: [] },
  successCriteria: [],
  estimatedScope: { complexity: 'unknown', reasoning: '' },
  architectureDiagram: '',
  screenFlow: '',
  wireframes: '',
};

/**
 * PRD 생성 LLM 프롬프트를 생성한다.
 * @param {string} description - 보강된 프로젝트 설명
 * @param {object} clarityDimensions - 5차원 명확도 결과
 * @param {object} [codebaseInfo] - hello에서 스캔한 코드베이스 정보
 * @returns {string} LLM 프롬프트 (빈 설명이면 빈 문자열)
 */
export function buildPrdPrompt(description, clarityDimensions, codebaseInfo = null) {
  if (!description || (typeof description === 'string' && description.trim() === '')) {
    return '';
  }

  const { value: safeDescription } = sanitizeForPrompt(description, 3000);

  let claritySection = '';
  if (clarityDimensions && typeof clarityDimensions === 'object') {
    const dims = Object.entries(clarityDimensions)
      .map(([key, val]) => {
        const score = val?.score ?? 'N/A';
        const evidence = val?.evidence || '';
        return `- ${key}: ${score}${evidence ? ` — ${evidence}` : ''}`;
      })
      .join('\n');
    if (dims) {
      claritySection = `\n\n## 명확도 분석 결과\n${dims}`;
    }
  }

  let codebaseSection = '';
  if (codebaseInfo) {
    const techStack = (codebaseInfo.techStack || []).join(', ') || '없음';
    const fileStructure = codebaseInfo.fileStructure || '없음';
    codebaseSection = `\n\n## 코드베이스 정보\n- 기술 스택: ${techStack}\n- 파일 구조: ${fileStructure}`;
  }

  return `${DATA_BOUNDARY_INSTRUCTION}

프로젝트 설명을 기반으로 경량 PRD를 작성하세요.

## 프로젝트 설명
${wrapUserInput(safeDescription, 'description')}${claritySection}${codebaseSection}

## PRD 작성 지침
1. 프로젝트 개요 (1-2문장)
2. 핵심 기능 (3-7개, 우선순위순)
3. 사용자 시나리오 (1-3개)
4. 기술 요구사항 (stack, integrations, constraints)
5. 성공 기준 (3-5개, 측정 가능)
6. 예상 규모 (simple/medium/complex + 근거)
7. **아키텍처 다이어그램** (필수, Mermaid graph TD):
   - 주요 컴포넌트/모듈과 역할
   - 컴포넌트 간 데이터 흐름 (화살표 + 라벨)
   - 외부 서비스 연동 포인트
   - DB, 캐시, 메시지 큐 등 인프라 포함
8. **화면 흐름** (UI가 있는 프로젝트만, Mermaid flowchart):
   - 주요 화면 간 네비게이션 흐름
   - 사용자 액션과 화면 전환
   - UI가 없는 프로젝트(CLI, API 서버, 봇 등)는 빈 문자열
9. **와이어프레임** (UI가 있는 프로젝트만, ASCII art):
   - 핵심 화면 1-2개의 레이아웃을 ASCII art로 표현
   - 헤더, 사이드바, 콘텐츠 영역, 주요 버튼/폼의 배치
   - UI가 없는 프로젝트(CLI, API 서버, 봇 등)는 빈 문자열

## 출력 형식 (반드시 아래 JSON 형식으로 출력)

\`\`\`json
{
  "overview": "프로젝트 개요 1-2문장",
  "coreFeatures": ["기능1", "기능2", ...],
  "userScenarios": ["시나리오1", ...],
  "technicalRequirements": {
    "stack": ["기술1", "기술2"],
    "integrations": ["외부서비스1"],
    "constraints": ["제약사항1"]
  },
  "successCriteria": ["기준1", "기준2"],
  "estimatedScope": {
    "complexity": "simple 또는 medium 또는 complex",
    "reasoning": "근거"
  },
  "architectureDiagram": "graph TD\\n  A[React SPA] -->|REST API| B[Express Server]\\n  B --> C[(PostgreSQL)]",
  "screenFlow": "flowchart LR\\n  A[로그인] --> B[대시보드]\\n  B --> C[상세]",
  "wireframes": "┌──────────────────┐\\n│  Header          │\\n├────┬─────────────┤\\n│Nav │  Content    │\\n│    │             │\\n└────┴─────────────┘"
}
\`\`\`

**architectureDiagram**: 반드시 유효한 Mermaid graph TD 문법으로 작성하세요.
**screenFlow**: UI 프로젝트만 작성. CLI/API/봇 등은 빈 문자열("")로 출력하세요.
**wireframes**: UI 프로젝트만 작성. CLI/API/봇 등은 빈 문자열("")로 출력하세요.`;
}

/**
 * LLM 출력을 구조화된 PRD 객체로 파싱한다.
 * @param {string} rawOutput - LLM 응답 원문
 * @returns {object} 구조화된 PRD 객체
 */
export function parsePrdResult(rawOutput) {
  if (!rawOutput || (typeof rawOutput === 'string' && rawOutput.trim() === '')) {
    return { ...EMPTY_PRD };
  }

  const parsed = parseJsonObject(rawOutput);
  if (!parsed) {
    return { ...EMPTY_PRD };
  }

  const techReq = parsed.technicalRequirements || {};

  const prd = {
    overview: parsed.overview || '',
    coreFeatures: Array.isArray(parsed.coreFeatures) ? parsed.coreFeatures : [],
    userScenarios: Array.isArray(parsed.userScenarios) ? parsed.userScenarios : [],
    technicalRequirements: {
      stack: Array.isArray(techReq.stack) ? techReq.stack : [],
      integrations: Array.isArray(techReq.integrations) ? techReq.integrations : [],
      constraints: Array.isArray(techReq.constraints) ? techReq.constraints : [],
    },
    successCriteria: Array.isArray(parsed.successCriteria) ? parsed.successCriteria : [],
    estimatedScope: {
      complexity: parsed.estimatedScope?.complexity || 'unknown',
      reasoning: parsed.estimatedScope?.reasoning || '',
    },
    architectureDiagram: parsed.architectureDiagram || parsed.diagram || '',
    screenFlow: parsed.screenFlow || '',
    wireframes: parsed.wireframes || '',
  };

  return prd;
}

/**
 * PRD를 CEO 표시용 마크다운으로 포맷한다.
 * @param {object} prd - 파싱된 PRD 객체
 * @returns {string} 마크다운
 */
export function formatPrdForDisplay(prd) {
  const p = prd || {};
  const sections = [];

  sections.push(`## 프로젝트 개요\n${p.overview || '(없음)'}`);

  const features = p.coreFeatures || [];
  if (features.length > 0) {
    sections.push(`## 핵심 기능\n${features.map((f, i) => `${i + 1}. ${f}`).join('\n')}`);
  } else {
    sections.push('## 핵심 기능\n(없음)');
  }

  const scenarios = p.userScenarios || [];
  if (scenarios.length > 0) {
    sections.push(`## 사용자 시나리오\n${scenarios.map((s) => `- ${s}`).join('\n')}`);
  } else {
    sections.push('## 사용자 시나리오\n(없음)');
  }

  const tech = p.technicalRequirements || {};
  const stack = (tech.stack || []).join(', ') || '(없음)';
  const integrations = (tech.integrations || []).join(', ') || '(없음)';
  const constraints = (tech.constraints || []).join(', ') || '(없음)';
  sections.push(
    `## 기술 요구사항\n- 스택: ${stack}\n- 외부 연동: ${integrations}\n- 제약사항: ${constraints}`,
  );

  const criteria = p.successCriteria || [];
  if (criteria.length > 0) {
    sections.push(`## 성공 기준\n${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}`);
  } else {
    sections.push('## 성공 기준\n(없음)');
  }

  if (p.architectureDiagram) {
    sections.push(`## 시스템 아키텍처\n\`\`\`mermaid\n${p.architectureDiagram}\n\`\`\``);
  }

  if (p.screenFlow) {
    sections.push(`## 화면 흐름\n\`\`\`mermaid\n${p.screenFlow}\n\`\`\``);
  }

  if (p.wireframes) {
    sections.push(`## 화면 레이아웃\n\`\`\`\n${p.wireframes}\n\`\`\``);
  }

  const scope = p.estimatedScope || {};
  sections.push(`## 예상 규모: ${scope.complexity || 'unknown'}\n${scope.reasoning || ''}`);

  return sections.join('\n\n');
}
