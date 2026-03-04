/**
 * acceptance-criteria — 수락 기준 생성/검증 모듈
 * 기획서 기반으로 측정 가능한 수락 기준을 자동 생성하고 리뷰 결과와 대조한다.
 */

import { parseJsonArray } from '../core/json-parser.js';

/**
 * 기획서 기반으로 수락 기준 생성 프롬프트를 만든다.
 * @param {string} planDocument - 기획서 마크다운
 * @param {object} projectContext - 프로젝트 컨텍스트 (name, type 등)
 * @returns {string} LLM 프롬프트
 */
export function buildAcceptanceCriteriaPrompt(planDocument, projectContext) {
  if (!planDocument || planDocument.trim() === '') return '';

  return `다음 기획서를 분석하여 측정 가능한 수락 기준(Acceptance Criteria)을 생성하세요.

## 프로젝트 정보
- 이름: ${projectContext.name || ''}
- 유형: ${projectContext.type || ''}

## 기획서
${planDocument}

## 수락 기준 작성 규칙

각 기준은 다음을 포함해야 합니다:
1. **id**: 고유 ID (ac-1, ac-2, ...)
2. **description**: 구체적이고 측정 가능한 기준 설명
3. **measurementMethod**: 검증 방법
   - \`review\`: 리뷰어가 코드/결과물 확인
   - \`test\`: 테스트 통과 여부
   - \`build\`: 빌드 성공 여부
   - \`manual\`: 수동 확인 필요
4. **targetValue**: 목표값 또는 검증 조건

## 출력 형식 (반드시 JSON 배열)

\`\`\`json
[
  {
    "id": "ac-1",
    "description": "수락 기준 설명",
    "measurementMethod": "review",
    "targetValue": "검증 조건"
  }
]
\`\`\`

규칙:
- 5-15개 사이로 생성
- 모호한 기준 금지 (예: "잘 동작함" [X] → "로그인 시 JWT 토큰 반환" [O])
- 각 주요 기능에 최소 1개 기준`;
}

/**
 * LLM 출력을 수락 기준 객체 배열로 파싱한다.
 * @param {string} rawOutput - LLM 출력 원문
 * @returns {Array<object>} AC 객체 배열
 */
export function parseAcceptanceCriteria(rawOutput) {
  if (!rawOutput || rawOutput.trim() === '') return [];

  const parsed = parseJsonArray(rawOutput);
  if (!parsed || parsed.length === 0) return [];

  return parsed.map((item, idx) => ({
    id: item.id || `ac-${idx + 1}`,
    description: item.description || '',
    measurementMethod: ['review', 'test', 'build', 'manual'].includes(item.measurementMethod)
      ? item.measurementMethod
      : 'review',
    targetValue: item.targetValue || '',
    status: item.status || 'pending',
  }));
}

/**
 * 리뷰 결과와 수락 기준을 대조하여 pass/fail 판정한다.
 * @param {Array<object>} reviews - 리뷰 결과 배열 ({ verdict, issues })
 * @param {Array<object>} criteria - 수락 기준 배열
 * @returns {{ allPassed: boolean, results: Array<object>, summary: string }}
 */
export function checkAcceptanceCriteria(reviews, criteria) {
  if (!criteria || criteria.length === 0) {
    return { allPassed: true, results: [], summary: '수락 기준 없음' };
  }

  if (!reviews || reviews.length === 0) {
    return {
      allPassed: false,
      results: criteria.map((c) => ({ ...c, status: 'pending' })),
      summary: '리뷰 결과 없음',
    };
  }

  const hasCritical = reviews.some((r) => (r.issues || []).some((i) => i.severity === 'critical'));
  const allApproved = reviews.every((r) => r.verdict === 'approve');
  const allPassed = allApproved && !hasCritical;

  const results = criteria.map((c) => ({
    ...c,
    status: allPassed ? 'passed' : 'pending',
  }));

  const passedCount = results.filter((r) => r.status === 'passed').length;
  const summary = allPassed
    ? `수락 기준 ${passedCount}/${criteria.length}개 통과`
    : `수락 기준 미충족 (critical 이슈 또는 미승인 리뷰 존재)`;

  return { allPassed, results, summary };
}

/**
 * 수락 기준을 리뷰 프롬프트에 삽입할 마크다운으로 포맷한다.
 * @param {Array<object>} criteria - 수락 기준 배열
 * @returns {string} 마크다운 문자열
 */
export function formatCriteriaForPrompt(criteria) {
  if (!criteria || criteria.length === 0) return '';

  return `### 수락 기준 검증 체크리스트

${criteria
  .map((c) => {
    const check = c.status === 'passed' ? '[x]' : '[ ]';
    return `- ${check} **${c.id}**: ${c.description} (검증: ${c.measurementMethod}, 목표: ${c.targetValue})`;
  })
  .join('\n')}

각 기준에 대해 통과 여부를 판단하고, 미충족 시 이유를 기술하세요.`;
}
