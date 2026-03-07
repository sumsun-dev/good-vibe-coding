/**
 * evolution-engine — 프로젝트 레벨 자가 진화 오케스트레이션
 *
 * 진화 조건:
 * 1. overallScore < targetScore (기본 80)
 * 2. generation < maxGenerations (기본 3)
 * 3. 이전 세대 대비 개선폭 >= minImprovement (기본 5), 첫 세대는 무시
 */

import { config } from '../core/config.js';

/**
 * 프로젝트가 진화해야 하는지 판단한다 (pure).
 * @param {object|null} project - 프로젝트 객체
 * @returns {{ evolve: boolean, reason: string }}
 */
export function shouldEvolve(project) {
  if (!project) return { evolve: false, reason: '프로젝트가 없습니다' };

  const { targetScore, maxGenerations, minImprovement } = config.evolution;
  const generation = project.generation || 1;
  const history = project.evolutionHistory || [];
  const qualityMetrics = project.qualityMetrics;

  if (!qualityMetrics || typeof qualityMetrics.score !== 'number') {
    return { evolve: false, reason: '품질 점수가 없습니다' };
  }

  const score = qualityMetrics.score;

  // 조건 1: 점수가 목표치 이상이면 진화 불필요
  if (score >= targetScore) {
    return { evolve: false, reason: `품질 점수(${score})가 목표치(${targetScore}) 이상입니다` };
  }

  // 조건 2: 세대 한도 초과
  if (generation >= maxGenerations) {
    return {
      evolve: false,
      reason: `세대 한도(${maxGenerations})에 도달했습니다 (현재: ${generation})`,
    };
  }

  // 조건 3: 개선폭 부족 (2세대 이상인 경우만 체크)
  if (history.length >= 2) {
    const prevScore = history[history.length - 1].score;
    const prevPrevScore = history[history.length - 2].score;
    const recentImprovement = prevScore - prevPrevScore;
    if (recentImprovement < minImprovement) {
      return {
        evolve: false,
        reason: `최근 개선폭(${recentImprovement})이 최소치(${minImprovement}) 미만입니다`,
      };
    }
  }

  return {
    evolve: true,
    reason: `품질 점수(${score})가 목표치(${targetScore}) 미달, 세대 ${generation}/${maxGenerations}`,
  };
}

/**
 * Phase별 이슈를 역할별로 집계하여 진화 피드백을 생성한다 (pure).
 * @param {object|null} project - 프로젝트 객체
 * @param {object} qualityScore - calculateOverallQuality 결과
 * @returns {Array<{roleId: string, feedback: string}>}
 */
export function buildEvolutionFeedback(project, qualityScore) {
  if (!project) return [];

  const team = project.team || [];
  const tasks = project.tasks || [];
  const state = project.executionState;

  if (!state || !state.phaseResults) return [];

  // 역할별 이슈 수집
  const roleIssues = {};
  for (const member of team) {
    roleIssues[member.roleId] = [];
  }

  // 사전 인덱싱: review → assignee 매핑 (O(N) 1회)
  const reviewToAssignee = new Map();
  const tasksByRole = new Map();
  for (const task of tasks) {
    if (task.reviews) {
      for (const r of task.reviews) {
        reviewToAssignee.set(r, task.assignee);
      }
    }
    const roleId = task.assignee;
    if (!tasksByRole.has(roleId)) tasksByRole.set(roleId, []);
    tasksByRole.get(roleId).push(task);
  }

  // Phase별 리뷰에서 이슈 추출
  for (const [, phaseResult] of Object.entries(state.phaseResults)) {
    const reviews = phaseResult.reviews || [];
    for (const review of reviews) {
      const issues = (review.issues || []).filter(
        (i) => i.severity === 'critical' || i.severity === 'important',
      );
      if (issues.length === 0) continue;

      // 이슈를 관련 역할에 매핑 (O(1) 룩업)
      const assignee = reviewToAssignee.get(review);
      if (assignee && roleIssues[assignee]) {
        roleIssues[assignee].push(...issues);
      }

      // Phase 리뷰의 이슈를 각 리뷰어에 연결하지 못하면 전체 팀에 배분
      for (const member of team) {
        const memberTasks = tasksByRole.get(member.roleId) || [];
        const memberHasIssues = memberTasks.some(
          (t) => t.reviews && t.reviews.some((r) => (r.issues || []).length > 0),
        );
        if (memberHasIssues && roleIssues[member.roleId].length === 0) {
          roleIssues[member.roleId].push(...issues);
        }
      }
    }
  }

  // 이슈가 있는 역할만 피드백 생성
  const feedbackList = [];
  for (const [roleId, issues] of Object.entries(roleIssues)) {
    if (issues.length === 0) continue;

    const issuesByCategory = {};
    for (const issue of issues) {
      const cat = issue.category || issue.severity || 'general';
      if (!issuesByCategory[cat]) issuesByCategory[cat] = [];
      issuesByCategory[cat].push(issue.description);
    }

    let feedback = `# 진화 피드백 (세대 ${project.generation || 1})\n\n`;
    feedback += `품질 점수: ${qualityScore.score}/100\n\n`;
    feedback += `## 개선 포인트\n\n`;

    for (const [category, descriptions] of Object.entries(issuesByCategory)) {
      feedback += `### ${category}\n`;
      for (const desc of descriptions) {
        feedback += `- ${desc}\n`;
      }
      feedback += '\n';
    }

    feedbackList.push({ roleId, feedback });
  }

  return feedbackList;
}

/**
 * 프로젝트에 새 세대를 기록한다 (pure, 원본 불변).
 * @param {object} project - 프로젝트 객체
 * @param {object} qualityScore - { score, phaseScores }
 * @returns {object} 업데이트된 프로젝트 (새 객체)
 */
export function recordGeneration(project, qualityScore) {
  const generation = project.generation || 1;
  const history = [...(project.evolutionHistory || [])];

  history.push({
    generation,
    score: qualityScore.score,
    phaseScores: qualityScore.phaseScores || {},
    timestamp: new Date().toISOString(),
  });

  return {
    ...project,
    generation: generation + 1,
    evolutionHistory: history,
    qualityMetrics: qualityScore,
  };
}
