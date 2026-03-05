/**
 * review-engine — 크로스 리뷰 시스템 모듈
 * 작업 실행 후 다른 역할의 에이전트가 결과물을 리뷰한다.
 *
 * 리뷰어 선정은 담당자의 workDomains와 후보의 reviewDomains를 매칭한다.
 * 동일한 도메인 어휘 수준을 사용하여 의미 있는 overlap을 보장한다.
 * fallback: workDomains → reviewDomains → skills.
 */

import { parseJsonObject } from '../core/json-parser.js';
import { config } from '../core/config.js';
import { formatCriteriaForPrompt } from './acceptance-criteria.js';

/** 범용 리뷰 역할: 어떤 작업이든 리뷰 가치가 높은 역할 */
const UNIVERSAL_REVIEWER_ROLES = ['qa', 'security', 'cto'];

/**
 * 태스크 담당자에 따라 리뷰어를 자동 선정한다.
 * 담당자의 workDomains와 후보의 reviewDomains를 매칭하여 도메인 관련성을 평가.
 *
 * 스코어링:
 * 1) 담당자의 workDomains와 리뷰어의 reviewDomains 겹침 수 (도메인 관련성)
 * 2) QA, Security, CTO는 범용 리뷰 역할로 +1 보너스
 *
 * fallback: workDomains → reviewDomains → skills (하위 호환)
 *
 * @param {object} task - 태스크 정보 ({ assignee, ... })
 * @param {Array<object>} team - 팀원 배열 (각 팀원: { roleId, workDomains?, reviewDomains?, skills?, ... })
 * @returns {Array<object>} 선정된 리뷰어 배열
 */
export function selectReviewers(task, team, previousReviewerIds = []) {
  if (!task || !team || team.length === 0) return [];

  const assigneeId = task.assignee;
  const assignee = team.find((m) => m.roleId === assigneeId);
  const assigneeDomains = assignee
    ? assignee.workDomains || assignee.reviewDomains || assignee.skills || []
    : [];

  const candidates = team.filter((m) => m.roleId !== assigneeId);
  if (candidates.length === 0) return [];

  const prevSet = new Set(previousReviewerIds);
  const scored = candidates.map((m) => {
    const reviewDomains = m.reviewDomains || m.skills || [];
    const overlap = assigneeDomains.filter((d) => reviewDomains.includes(d)).length;
    const bonus = UNIVERSAL_REVIEWER_ROLES.includes(m.roleId) ? 1 : 0;
    const fatiguePenalty = prevSet.has(m.roleId) ? 0.5 : 0;
    return { member: m, score: overlap + bonus - fatiguePenalty };
  });

  scored.sort((a, b) => b.score - a.score);

  const minReviewers = candidates.length === 0 ? 0 : config.review.minReviewers;
  const count = Math.max(minReviewers, Math.min(config.review.maxReviewers, scored.length));
  return scored.slice(0, count).map((s) => s.member);
}

/**
 * 리뷰 프롬프트를 생성한다.
 * @param {object} reviewer - 리뷰어 팀원 정보
 * @param {object} task - 태스크 정보
 * @param {string} taskOutput - 태스크 실행 결과물
 * @returns {string} 리뷰 프롬프트
 */
export function buildTaskReviewPrompt(reviewer, task, taskOutput, acceptanceCriteria = null) {
  const reviewDomains = reviewer.reviewDomains || reviewer.skills || [];

  let acSection = '';
  if (acceptanceCriteria && acceptanceCriteria.length > 0) {
    const formatted = formatCriteriaForPrompt(acceptanceCriteria);
    if (formatted && typeof formatted === 'string') {
      acSection = `\n\n## 수락 기준 검증\n${formatted}\n`;
    }
  }

  return `당신은 **${reviewer.displayName}** (${reviewer.role})입니다.
다른 팀원의 작업 결과를 리뷰합니다.

## 당신의 전문 분야
- ${reviewDomains.join(', ')}

## 리뷰 대상 작업
- ID: ${task.id}
- 제목: ${task.title}
- 담당자: ${task.assignee}
- 설명: ${task.description || '(설명 없음)'}

## 작업 결과물
${taskOutput}${acSection}

## 리뷰 지시사항

당신의 전문 분야 관점에서 이 작업 결과를 리뷰하세요.

### 심각도 분류
- **critical**: 버그, 보안, 데이터 유실 위험 (필수 수정)
- **important**: 아키텍처 문제, 누락 기능, 테스트 부족 (권장 수정)
- **minor**: 코드 스타일, 최적화 기회 (참고)

### 출력 형식 (반드시 아래 JSON 형식으로 출력)

\`\`\`json
{
  "verdict": "approve" 또는 "request-changes",
  "issues": [
    {
      "severity": "critical 또는 important 또는 minor",
      "description": "이슈 설명",
      "suggestion": "수정 방안"
    }
  ]
}
\`\`\`

- critical 이슈가 있으면 반드시 verdict를 "request-changes"로 설정`;
}

/**
 * 리뷰 결과를 파싱한다.
 * @param {string} rawReview - 리뷰 결과 원문
 * @returns {{ verdict: string, issues: Array<{severity: string, description: string, suggestion: string}> }}
 */
export function parseTaskReview(rawReview) {
  if (!rawReview || rawReview.trim() === '') {
    return { verdict: 'parse-error', issues: [] };
  }

  const parsed = parseJsonObject(rawReview);
  if (parsed) {
    return {
      verdict: parsed.verdict === 'approve' ? 'approve' : 'request-changes',
      issues: Array.isArray(parsed.issues)
        ? parsed.issues.map((i) => ({
            severity: i.severity || 'minor',
            description: i.description || '',
            suggestion: i.suggestion || '',
          }))
        : [],
    };
  }

  return { verdict: 'parse-error', issues: [] };
}

/**
 * 품질 게이트를 확인한다: critical 0개, important 모두 해결.
 * @param {Array<{verdict: string, issues: Array}>} reviews - 리뷰 결과 배열
 * @returns {{ passed: boolean, criticalCount: number, importantCount: number, summary: string }}
 */
export function checkQualityGate(reviews) {
  if (!reviews || reviews.length === 0) {
    return { passed: false, criticalCount: 0, importantCount: 0, summary: '리뷰 결과 없음' };
  }

  const allIssues = reviews.flatMap((r) => r.issues || []);
  const criticalCount = allIssues.filter((i) => i.severity === 'critical').length;
  const importantCount = allIssues.filter((i) => i.severity === 'important').length;
  const passed = criticalCount === 0;

  const maxImportant = config.review.maxImportantIssues ?? 10;
  let summary;
  if (passed && importantCount === 0) {
    summary = '품질 게이트 통과';
  } else if (passed && importantCount > maxImportant) {
    summary = `품질 게이트 통과 (경고: important ${importantCount}건 — 임계치 ${maxImportant}건 초과, 검토 필요)`;
  } else if (passed) {
    summary = `품질 게이트 통과 (important ${importantCount}건 검토 권장)`;
  } else {
    summary = `품질 게이트 실패: critical ${criticalCount}건 수정 필요`;
  }

  return { passed, criticalCount, importantCount, summary };
}

/**
 * 리뷰 피드백 기반 수정 프롬프트를 생성한다.
 * @param {object} task - 태스크 정보
 * @param {object} implementer - 구현 담당자 팀원 정보
 * @param {Array<{verdict: string, issues: Array}>} reviews - 리뷰 결과 배열
 * @param {object|null} [failureContext=null] - 실패 컨텍스트 (시도 차수, 이전 이력)
 * @returns {string} 수정 프롬프트
 */
export function buildRevisionPrompt(task, implementer, reviews, failureContext = null) {
  if (!reviews || reviews.length === 0) return '';

  const issuesList = reviews
    .flatMap((r) => r.issues || [])
    .filter((i) => i.severity === 'critical' || i.severity === 'important')
    .map(
      (i, idx) =>
        `${idx + 1}. [${i.severity.toUpperCase()}] ${i.description}${i.suggestion ? `\n   수정 방안: ${i.suggestion}` : ''}`,
    )
    .join('\n');

  if (!issuesList) return '';

  let prompt = `당신은 **${implementer.displayName}** (${implementer.role})입니다.

## 수정 대상 작업
- ID: ${task.id}
- 제목: ${task.title}

## 리뷰에서 발견된 이슈

${issuesList}`;

  if (failureContext) {
    if (failureContext.attempt >= failureContext.maxAttempts) {
      prompt += `\n\n**마지막 수정 기회입니다.** 이번에 해결하지 못하면 CEO에게 에스컬레이션됩니다.`;
    }
    prompt += `\n\n## 수정 이력 (시도 ${failureContext.attempt}/${failureContext.maxAttempts})`;
    if (failureContext.previousAttempts && failureContext.previousAttempts.length > 0) {
      prompt += '\n\n### 이전 시도';
      for (const prev of failureContext.previousAttempts) {
        const categories = prev.issues
          ? [...new Set(prev.issues.map((i) => i.category))].join(', ')
          : '없음';
        const issueCount = prev.issues ? prev.issues.length : 0;
        prompt += `\n- 시도 ${prev.attempt}: ${issueCount}건 (카테고리: ${categories})`;
      }
      prompt += '\n\n**이전 시도에서 해결되지 않은 이슈에 주의하세요.**';
    }
    if (failureContext.issues && failureContext.issues.length > 0) {
      const categories = [...new Set(failureContext.issues.map((i) => i.category))];
      prompt += `\n\n### 이슈 카테고리 분포: ${categories.join(', ')}`;
    }
    // CEO 피드백이 있으면 수정 프롬프트에 주입
    if (failureContext.ceoGuidance) {
      prompt += `\n\n## CEO 지침\n\n${failureContext.ceoGuidance}\n\n**위 지침을 최우선으로 반영하여 수정하세요.**`;
    }
  }

  prompt += `

## 수정 지시사항

위 이슈를 모두 수정하세요.
- critical 이슈는 반드시 수정
- important 이슈는 가능한 한 수정
- 수정 후 각 이슈에 대한 해결 방법을 보고`;

  return prompt;
}

/**
 * 강화된 품질 게이트: 텍스트 리뷰 + 실행 검증.
 * @param {Array} reviews - 텍스트 리뷰 결과 배열
 * @param {object|null} executionResult - 실행 검증 결과 (null이면 텍스트만 체크)
 * @returns {{ passed: boolean, criticalCount: number, importantCount: number, executionVerified: boolean|null, summary: string }}
 */
export function checkEnhancedQualityGate(reviews, executionResult = null) {
  const baseResult = checkQualityGate(reviews);

  if (!executionResult || executionResult.verified === null) {
    return { ...baseResult, executionVerified: null };
  }

  const passed = baseResult.passed && executionResult.verified;
  let summary = baseResult.summary;

  if (!executionResult.verified) {
    summary += ` | 실행 검증 실패: ${executionResult.buildResult?.output || 'build failed'}`;
  } else {
    summary += ' | 실행 검증 통과';
  }

  return {
    ...baseResult,
    passed,
    executionVerified: executionResult.verified,
    summary,
  };
}
