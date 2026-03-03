/**
 * agent-optimizer — 에이전트 중복/효율 최적화 모듈
 * 에이전트 출력 유사도 분석, 기여도 추적, 최적 팀 추천을 담당한다.
 */

import { config } from '../core/config.js';

/** 범용 리뷰어 roleId 목록 (항상 유지 대상) */
const UNIVERSAL_REVIEWERS = ['qa', 'security', 'cto'];

/**
 * 텍스트를 n-gram 집합으로 변환한다.
 * @param {string} text - 원본 텍스트
 * @param {number} n - n-gram 크기 (기본 2 = bigram)
 * @returns {Set<string>} n-gram 집합
 */
function extractNgrams(text, n = 2) {
  const normalized = (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const ngrams = new Set();
  for (let i = 0; i <= normalized.length - n; i++) {
    ngrams.add(normalized.slice(i, i + n));
  }
  return ngrams;
}

/**
 * 두 에이전트 출력 간 Jaccard 유사도를 계산한다 (bigram 기반).
 * @param {string} outputA - 에이전트 A의 출력
 * @param {string} outputB - 에이전트 B의 출력
 * @returns {number} 0-1 사이의 유사도 점수
 */
export function measureOutputSimilarity(outputA, outputB) {
  const ngramsA = extractNgrams(outputA);
  const ngramsB = extractNgrams(outputB);

  if (ngramsA.size === 0 && ngramsB.size === 0) {
    return 1.0;
  }
  if (ngramsA.size === 0 || ngramsB.size === 0) {
    return 0;
  }

  let intersectionSize = 0;
  for (const gram of ngramsA) {
    if (ngramsB.has(gram)) {
      intersectionSize++;
    }
  }

  const unionSize = ngramsA.size + ngramsB.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

/**
 * 에이전트 출력 배열에서 중복 에이전트 쌍을 탐지한다.
 * @param {Array<{roleId: string, output: string}>} agentOutputs - 에이전트 출력 배열
 * @param {number} [threshold=0.7] - 유사도 임계값
 * @returns {Array<{roleId: string, similarTo: string, similarity: number}>} 중복 쌍 배열
 */
export function detectRedundantAgents(
  agentOutputs,
  threshold = config.similarity.redundancyThreshold,
) {
  if (!agentOutputs || agentOutputs.length < 2) {
    return [];
  }

  const redundant = [];

  for (let i = 0; i < agentOutputs.length; i++) {
    for (let j = i + 1; j < agentOutputs.length; j++) {
      const similarity = measureOutputSimilarity(agentOutputs[i].output, agentOutputs[j].output);

      if (similarity > threshold) {
        redundant.push({
          roleId: agentOutputs[j].roleId,
          similarTo: agentOutputs[i].roleId,
          similarity,
        });
      }
    }
  }

  return redundant;
}

/**
 * 특정 역할의 리뷰 기여도를 분석한다.
 * @param {string} roleId - 역할 ID
 * @param {Array<{approved: boolean, issues: Array<{severity: string, description: string}>}>} reviews - 리뷰 이력
 * @returns {{ roleId: string, uniqueIssues: number, emptyReviews: number, criticalsCaught: number, contributionScore: number }}
 */
export function trackRoleContribution(roleId, reviews) {
  if (!reviews || reviews.length === 0) {
    return {
      roleId,
      uniqueIssues: 0,
      emptyReviews: 0,
      criticalsCaught: 0,
      contributionScore: 0,
    };
  }

  let uniqueIssues = 0;
  let emptyReviews = 0;
  let criticalsCaught = 0;

  for (const review of reviews) {
    const issues = review.issues || [];
    if (issues.length === 0 && review.approved) {
      emptyReviews++;
    }
    uniqueIssues += issues.length;
    criticalsCaught += issues.filter((i) => i.severity === 'critical').length;
  }

  // contributionScore: critical 이슈는 3점, 일반 이슈는 1점, empty 리뷰는 -0.5점
  const totalReviews = reviews.length;
  const rawScore = criticalsCaught * 3 + (uniqueIssues - criticalsCaught) + emptyReviews * -0.5;
  const contributionScore = totalReviews > 0 ? Math.max(0, rawScore / totalReviews) : 0;

  return {
    roleId,
    uniqueIssues,
    emptyReviews,
    criticalsCaught,
    contributionScore,
  };
}

/**
 * 유사도 분석 + 기여도 데이터를 기반으로 최적 팀을 추천한다.
 * @param {Array<{roleId: string, output: string}>} agentOutputs - 에이전트 출력 배열
 * @param {Array<{roleId: string, contributionScore: number}>} roleContributions - 역할별 기여도
 * @param {number} [teamSize] - 목표 팀 크기 (미지정 시 자동)
 * @returns {{ keep: string[], remove: string[], reasoning: string[] }}
 */
export function recommendOptimalTeam(agentOutputs, roleContributions, teamSize) {
  if (!agentOutputs || agentOutputs.length === 0) {
    return { keep: [], remove: [], reasoning: ['에이전트 출력 데이터가 없습니다.'] };
  }

  const allRoleIds = agentOutputs.map((a) => a.roleId);
  const contributionMap = new Map(
    (roleContributions || []).map((c) => [c.roleId, c.contributionScore]),
  );
  const redundancies = detectRedundantAgents(agentOutputs);
  const redundantSet = new Set(redundancies.map((r) => r.roleId));

  const keep = [];
  const remove = [];
  const reasoning = [];

  // 범용 리뷰어는 항상 유지 (단, 기여도가 낮으면 경고)
  for (const roleId of allRoleIds) {
    const isUniversal = UNIVERSAL_REVIEWERS.includes(roleId);
    const isRedundant = redundantSet.has(roleId);
    const contribution = contributionMap.get(roleId) ?? 0;

    if (isUniversal) {
      keep.push(roleId);
      if (contribution < config.similarity.contributionThreshold) {
        reasoning.push(
          `${roleId}: 범용 리뷰어로 유지하지만 기여도가 낮습니다 (${contribution.toFixed(2)}).`,
        );
      }
    } else if (isRedundant) {
      const pair = redundancies.find((r) => r.roleId === roleId);
      if (contribution < config.similarity.contributionThreshold) {
        remove.push(roleId);
        reasoning.push(
          `${roleId}: ${pair.similarTo}와 유사도 ${pair.similarity.toFixed(2)}이고 기여도가 낮아 제거를 권장합니다.`,
        );
      } else {
        keep.push(roleId);
        reasoning.push(
          `${roleId}: ${pair.similarTo}와 유사하지만 기여도가 높아 유지합니다 (${contribution.toFixed(2)}).`,
        );
      }
    } else {
      keep.push(roleId);
    }
  }

  // teamSize 제약 적용
  if (teamSize && keep.length > teamSize) {
    const nonUniversal = keep
      .filter((id) => !UNIVERSAL_REVIEWERS.includes(id))
      .sort((a, b) => (contributionMap.get(a) ?? 0) - (contributionMap.get(b) ?? 0));

    while (keep.length > teamSize && nonUniversal.length > 0) {
      const removed = nonUniversal.shift();
      const idx = keep.indexOf(removed);
      if (idx !== -1) {
        keep.splice(idx, 1);
        remove.push(removed);
        reasoning.push(`${removed}: 팀 크기 제약 (${teamSize})에 의해 제거됨.`);
      }
    }
  }

  return { keep, remove, reasoning };
}

/**
 * 최적화 분석 결과를 사람이 읽기 쉬운 마크다운 보고서로 생성한다.
 * @param {{ keep: string[], remove: string[], reasoning: string[] }} recommendations - 최적화 추천 결과
 * @returns {string} 마크다운 보고서
 */
export function buildOptimizationReport(recommendations) {
  if (!recommendations) {
    return '# 에이전트 최적화 보고서\n\n분석 데이터가 없습니다.';
  }

  const { keep = [], remove = [], reasoning = [] } = recommendations;

  let report = '# 에이전트 최적화 보고서\n\n';

  report += '## 요약\n\n';
  report += `- 유지: ${keep.length}개 에이전트\n`;
  report += `- 제거 권장: ${remove.length}개 에이전트\n\n`;

  if (keep.length > 0) {
    report += '## 유지 에이전트\n\n';
    for (const roleId of keep) {
      report += `- **${roleId}**\n`;
    }
    report += '\n';
  }

  if (remove.length > 0) {
    report += '## 제거 권장 에이전트\n\n';
    for (const roleId of remove) {
      report += `- **${roleId}**\n`;
    }
    report += '\n';
  }

  if (reasoning.length > 0) {
    report += '## 상세 분석\n\n';
    for (const reason of reasoning) {
      report += `- ${reason}\n`;
    }
    report += '\n';
  }

  return report;
}
