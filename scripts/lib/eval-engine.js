/**
 * eval-engine — A/B 평가 프레임워크
 * 멀티에이전트 오케스트레이션과 단순 접근법의 성능을 비교 측정한다.
 */

import { readFile, writeFile, readdir } from 'fs/promises';
import { resolve } from 'path';
import crypto from 'crypto';
import { ensureDir, fileExists } from './file-writer.js';
import { COST_RATES } from './project-metrics.js';

const DEFAULT_EVAL_DIR = resolve(process.env.HOME || process.env.USERPROFILE, '.claude', 'good-vibe', 'evaluations');
let evalDir = DEFAULT_EVAL_DIR;

/**
 * 테스트용 평가 디렉토리를 설정한다.
 * @param {string} dir - 새 디렉토리
 */
export function setEvalDir(dir) {
  evalDir = dir;
}

/**
 * 토큰당 비용 상수 (project-metrics.js의 COST_RATES에서 input 비용 사용)
 */
const COST_PER_TOKEN = {
  claude: COST_RATES.claude.input,
  openai: COST_RATES.openai.input,
  gemini: COST_RATES.gemini.input,
};

/**
 * 평가 세션을 생성한다.
 * @param {string} projectDescription - 프로젝트 설명
 * @param {string[]} approaches - 접근법 배열 (예: ['single-prompt', 'multi-agent'])
 * @returns {{ sessionId: string, projectDescription: string, approaches: string[], results: object, createdAt: string }}
 */
export function createEvalSession(projectDescription, approaches) {
  return {
    sessionId: crypto.randomUUID(),
    projectDescription,
    approaches: [...approaches],
    results: {},
    createdAt: new Date().toISOString(),
  };
}

/**
 * 접근법 결과를 기록한다 (불변 업데이트).
 * @param {object} session - 평가 세션
 * @param {string} approach - 접근법 이름
 * @param {{ output: string, tokenCount: number, apiCalls: number, durationMs: number, agentCount: number }} result - 결과
 * @returns {object} 업데이트된 세션 (원본 미변경)
 */
export function recordApproachResult(session, approach, result) {
  return {
    ...session,
    results: {
      ...session.results,
      [approach]: { ...result },
    },
  };
}

/**
 * 출력물의 완성도를 평가한다.
 * 키워드/섹션 헤딩 기반 탐지로 아키텍처, 태스크 분해, 기술 스택, 위험 분석, 타임라인을 확인한다.
 * @param {string} output - 접근법 출력물
 * @param {string} _projectDescription - 프로젝트 설명 (향후 확장용)
 * @returns {{ score: number, breakdown: { architecture: boolean, taskBreakdown: boolean, techStack: boolean, riskAnalysis: boolean, timeline: boolean } }}
 */
export function scoreCompleteness(output, _projectDescription) {
  const text = (output || '').toLowerCase();

  const architecture = /architect|아키텍처|시스템\s*설계|system\s*design|구조/.test(text);
  const taskBreakdown = /task|작업\s*(분해|분배|목록)|breakdown|분해|단계|phase|step\s*\d/.test(text);
  const techStack = /tech\s*stack|기술\s*스택|framework|프레임워크|라이브러리|library|stack/.test(text);
  const riskAnalysis = /risk|위험|리스크|challenge|도전|제약|constraint|limitation/.test(text);
  const timeline = /timeline|타임라인|일정|schedule|마일스톤|milestone|sprint|주차|week/.test(text);

  const breakdown = { architecture, taskBreakdown, techStack, riskAnalysis, timeline };
  const trueCount = Object.values(breakdown).filter(Boolean).length;
  const score = Math.round((trueCount / 5) * 100);

  return { score, breakdown };
}

/**
 * 출력물의 기술적 깊이를 평가한다.
 * 특정 라이브러리/프레임워크 언급, 코드 예시, API 설계, 데이터베이스 스키마, 에러 처리 전략을 확인한다.
 * @param {string} output - 접근법 출력물
 * @returns {{ score: number, breakdown: { specificLibraries: boolean, codeExamples: boolean, apiDesign: boolean, databaseSchema: boolean, errorHandling: boolean } }}
 */
export function scoreTechnicalDepth(output) {
  const text = (output || '');
  const lower = text.toLowerCase();

  // 특정 라이브러리/프레임워크 언급 (일반적인 단어가 아닌 구체적 이름)
  const specificLibraries = /react|vue|angular|express|fastify|next\.?js|nest\.?js|django|flask|spring|postgresql|mongodb|redis|docker|kubernetes|webpack|vite|tailwind|prisma|typeorm|sequelize|graphql|grpc/.test(lower);

  // 코드 예시 (마크다운 코드 블록 또는 인라인 코드 패턴)
  const codeExamples = /```[\s\S]*?```|`[^`]+`/.test(text) || /function\s+\w+|const\s+\w+\s*=|import\s+.*from|class\s+\w+/.test(text);

  // API 설계 (엔드포인트, HTTP 메서드, REST/GraphQL 패턴)
  const apiDesign = /api|endpoint|엔드포인트|GET\s+\/|POST\s+\/|PUT\s+\/|DELETE\s+\/|REST|graphql|route|라우트/.test(text);

  // 데이터베이스 스키마 (테이블, 컬럼, 관계, 스키마 키워드)
  const databaseSchema = /schema|스키마|table|테이블|column|컬럼|foreign\s*key|primary\s*key|index|relation|entity|ERD|모델\s*설계/.test(lower);

  // 에러 처리 전략
  const errorHandling = /error\s*handl|에러\s*처리|exception|예외|try\s*[\-/]?\s*catch|fallback|retry|재시도|graceful|circuit\s*breaker|timeout|validation/.test(lower);

  const breakdown = { specificLibraries, codeExamples, apiDesign, databaseSchema, errorHandling };
  const trueCount = Object.values(breakdown).filter(Boolean).length;
  const score = Math.round((trueCount / 5) * 100);

  return { score, breakdown };
}

/**
 * 비용 효율성을 계산한다.
 * @param {{ tokenCount: number }} result - 접근법 결과
 * @param {string} [model='claude'] - 모델 이름 ('claude' | 'openai' | 'gemini')
 * @returns {{ estimatedCost: number, tokensUsed: number, costPerQualityPoint: number }}
 */
export function calculateCostEfficiency(result, model = 'claude') {
  const tokensUsed = result.tokenCount || 0;
  const costRate = COST_PER_TOKEN[model] || COST_PER_TOKEN.claude;
  const estimatedCost = tokensUsed * costRate;

  return {
    estimatedCost,
    tokensUsed,
    costPerQualityPoint: estimatedCost,
  };
}

/**
 * 비용 효율 점수를 정규화한다 (0-100).
 * 비용이 낮을수록 높은 점수. 최대 비용 대비 상대 점수.
 * @param {number} cost - 비용
 * @param {number} maxCost - 세션 내 최대 비용
 * @returns {number} 0-100 점수
 */
function normalizeCostScore(cost, maxCost) {
  if (maxCost === 0) return 100;
  return Math.round((1 - cost / maxCost) * 100);
}

/**
 * 모든 접근법 결과를 비교한다.
 * @param {object} session - 결과가 기록된 평가 세션
 * @returns {{ winner: string, rankings: Array<{ approach: string, completeness: number, technicalDepth: number, costEfficiency: number, overall: number }>, summary: string }}
 */
export function compareApproaches(session) {
  const approaches = Object.keys(session.results);

  if (approaches.length === 0) {
    return { winner: '', rankings: [], summary: '기록된 접근법이 없습니다.' };
  }

  // 각 접근법의 완성도 및 기술 깊이 점수 계산
  const scores = approaches.map(approach => {
    const result = session.results[approach];
    const completeness = scoreCompleteness(result.output, session.projectDescription);
    const technicalDepth = scoreTechnicalDepth(result.output);
    const costInfo = calculateCostEfficiency(result);

    return {
      approach,
      completenessScore: completeness.score,
      technicalDepthScore: technicalDepth.score,
      estimatedCost: costInfo.estimatedCost,
    };
  });

  // 비용 효율 점수 정규화 (비용이 낮을수록 높은 점수)
  const maxCost = Math.max(...scores.map(s => s.estimatedCost));

  const rankings = scores.map(s => {
    const costEfficiency = normalizeCostScore(s.estimatedCost, maxCost);
    const overall = Math.round(
      (s.completenessScore * 0.4) + (s.technicalDepthScore * 0.4) + (costEfficiency * 0.2)
    );

    return {
      approach: s.approach,
      completeness: s.completenessScore,
      technicalDepth: s.technicalDepthScore,
      costEfficiency,
      overall,
    };
  });

  // 종합 점수 내림차순 정렬
  rankings.sort((a, b) => b.overall - a.overall);

  const winner = rankings[0].approach;

  const rankingLines = rankings
    .map((r, i) => `${i + 1}. ${r.approach} (종합: ${r.overall})`)
    .join('\n');

  const summary = `최적 접근법: ${winner}\n\n순위:\n${rankingLines}`;

  return { winner, rankings, summary };
}

/**
 * 마크다운 평가 보고서를 생성한다.
 * @param {object} session - 평가 세션
 * @param {{ winner: string, rankings: Array, summary: string }} comparison - 비교 결과
 * @returns {string} 마크다운 보고서
 */
export function generateEvalReport(session, comparison) {
  const { rankings } = comparison;

  const tableHeader = '| 접근법 | 완성도 | 기술 깊이 | 비용 효율 | 종합 |';
  const tableSeparator = '|--------|--------|-----------|-----------|------|';
  const tableRows = rankings
    .map(r => `| ${r.approach} | ${r.completeness} | ${r.technicalDepth} | ${r.costEfficiency} | ${r.overall} |`)
    .join('\n');

  const detailSections = rankings.map(r => {
    const result = session.results[r.approach];
    const completeness = scoreCompleteness(result.output, session.projectDescription);
    const technicalDepth = scoreTechnicalDepth(result.output);
    const costInfo = calculateCostEfficiency(result);

    const completenessList = Object.entries(completeness.breakdown)
      .map(([key, val]) => `  - ${key}: ${val ? 'O' : 'X'}`)
      .join('\n');

    const depthList = Object.entries(technicalDepth.breakdown)
      .map(([key, val]) => `  - ${key}: ${val ? 'O' : 'X'}`)
      .join('\n');

    return `### ${r.approach}
- 토큰 사용량: ${result.tokenCount || 0}
- API 호출 수: ${result.apiCalls || 0}
- 소요 시간: ${result.durationMs || 0}ms
- 에이전트 수: ${result.agentCount || 0}
- 예상 비용: $${costInfo.estimatedCost.toFixed(6)}

**완성도 (${completeness.score}/100)**
${completenessList}

**기술 깊이 (${technicalDepth.score}/100)**
${depthList}`;
  }).join('\n\n');

  const winner = comparison.winner;
  let recommendation = '';
  if (rankings.length === 1) {
    recommendation = `단일 접근법(${winner})만 평가되었습니다. 비교를 위해 추가 접근법을 기록하세요.`;
  } else {
    const best = rankings[0];
    const second = rankings[1];
    const diff = best.overall - second.overall;
    if (diff > 10) {
      recommendation = `${winner} 접근법이 ${diff}점 차이로 우위입니다. 이 접근법을 권장합니다.`;
    } else {
      recommendation = `${winner} 접근법이 근소한 차이(${diff}점)로 우위입니다. 프로젝트 특성에 따라 선택하세요.`;
    }
  }

  return `# 평가 보고서

## 프로젝트
${session.projectDescription}

## 접근법 비교

${tableHeader}
${tableSeparator}
${tableRows}

## 상세 분석

${detailSections}

## 권장사항

${recommendation}`;
}

/**
 * 단일 프롬프트 베이스라인을 생성한다.
 * 멀티에이전트 팀이 수행하는 동일 범위의 분석을 하나의 프롬프트로 요청한다.
 * @param {string} projectDescription - 프로젝트 설명
 * @returns {string} 베이스라인 프롬프트
 */
export function buildSinglePromptBaseline(projectDescription) {
  return `다음 프로젝트를 분석하고 완전한 기획서를 작성하세요.

## 프로젝트 설명
${projectDescription}

## 분석 요청 항목 (모든 항목을 빠짐없이 포함하세요)

### 1. 아키텍처 설계
- 시스템 구조 (모놀리식/마이크로서비스/서버리스 등)
- 주요 컴포넌트와 데이터 흐름
- 확장성과 유지보수성 고려

### 2. 기술 스택
- 프레임워크, 라이브러리, 데이터베이스 선택과 근거
- 구체적인 버전/도구명 명시

### 3. 작업 분해 (Task Breakdown)
- Phase별 구체적 태스크 목록
- 각 태스크의 담당 역할, 의존관계, 예상 소요시간

### 4. API 설계
- 주요 엔드포인트와 HTTP 메서드
- 요청/응답 형식

### 5. 데이터베이스 스키마
- 주요 테이블/컬렉션 구조
- 관계와 인덱스

### 6. 에러 처리 전략
- 예외 처리 패턴
- 재시도, 폴백, 서킷 브레이커 적용 방안

### 7. 위험 분석
- 기술적 리스크와 대응 방안
- 일정, 리소스, 기술 부채 리스크

### 8. 타임라인
- 마일스톤과 스프린트 계획
- MVP 출시 기준

### 9. 보안 고려사항
- 인증/인가 전략
- 데이터 보호, 입력 검증

### 10. 테스트 전략
- 단위/통합/E2E 테스트 범위
- TDD 적용 기준

## 출력 형식
마크다운으로 구조화하여 작성하세요. 코드 예시를 포함하세요.`;
}

/**
 * 평가 세션을 파일에 저장한다.
 * @param {object} session - 평가 세션
 */
export async function saveEvalSession(session) {
  await ensureDir(evalDir);
  const filePath = resolve(evalDir, `${session.sessionId}.json`);
  await writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');
}

/**
 * 평가 세션을 파일에서 로드한다.
 * @param {string} sessionId - 세션 ID
 * @returns {Promise<object>} 평가 세션
 */
export async function loadEvalSession(sessionId) {
  const filePath = resolve(evalDir, `${sessionId}.json`);
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * 모든 저장된 평가 세션 목록을 반환한다.
 * @returns {Promise<Array<{ sessionId: string, projectDescription: string, createdAt: string, approachCount: number }>>}
 */
export async function listEvalSessions() {
  if (!(await fileExists(evalDir))) return [];

  const files = await readdir(evalDir);
  const sessions = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const filePath = resolve(evalDir, file);
    const content = await readFile(filePath, 'utf-8');
    const session = JSON.parse(content);
    sessions.push({
      sessionId: session.sessionId,
      projectDescription: session.projectDescription,
      createdAt: session.createdAt,
      approachCount: session.approaches.length,
    });
  }

  return sessions;
}
