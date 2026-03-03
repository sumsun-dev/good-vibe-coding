/**
 * report-generator — 프로젝트 보고서 생성 모듈
 */

import { getCostSummary, getAgentPerformanceSummary } from '../project/project-metrics.js';

/**
 * 전체 프로젝트 보고서를 생성한다.
 * @param {object} project - 프로젝트 전체 데이터
 * @returns {string} 보고서 마크다운
 */
function generateOverviewSection(project, stats, team) {
  return `# 프로젝트 보고서: ${project.name}

## 개요
- 프로젝트: ${project.name} (${project.type})
- 팀원: ${team.length}명
- 작업: ${stats.totalTasks}개 (완료: ${stats.completed})
- 모드: ${project.mode}
- 상태: ${project.status}`;
}

function generateTeamSection(team, tasks) {
  const roleSummaries = team
    .map((member) => {
      const memberTasks = tasks.filter((t) => t.assignee === member.roleId);
      return generateRoleSummary(member, memberTasks);
    })
    .join('\n\n');

  return `## 팀원별 기여

${roleSummaries}`;
}

function generatePlanSection(project) {
  return `## 기획서

${project.discussion.planDocument || '(기획서 없음)'}`;
}

function generateStatsTable(stats) {
  return `## 작업 통계

| 역할 | 작업 수 |
|------|---------|
${Object.entries(stats.byRole)
  .map(([role, count]) => `| ${role} | ${count} |`)
  .join('\n')}`;
}

function generateCostSection(project) {
  if (!project.metrics) return '';

  const costSummary = getCostSummary(project.metrics);
  const contributions = {};
  for (const member of project.team) {
    const memberTasks = project.tasks.filter((t) => t.assignee === member.roleId);
    const completedRatio =
      memberTasks.length > 0
        ? memberTasks.filter((t) => t.status === 'completed').length / memberTasks.length
        : 0;
    contributions[member.roleId] = Math.round(completedRatio * 100) / 100;
  }
  const agentPerf = getAgentPerformanceSummary(project.metrics, contributions);

  let section = `\n\n## 비용/성능

| 항목 | 값 |
|------|-----|
| 총 비용 | $${costSummary.totalCostUsd.toFixed(4)} |
| 입력 토큰 | ${costSummary.totalInputTokens.toLocaleString()} |
| 출력 토큰 | ${costSummary.totalOutputTokens.toLocaleString()} |`;

  if (agentPerf.length > 0) {
    section +=
      '\n\n### 에이전트 기여도\n\n| 역할 | 호출 수 | 비용 | 기여도 |\n|------|---------|------|--------|\n';
    section += agentPerf
      .sort((a, b) => b.contributionScore - a.contributionScore)
      .map(
        (a) =>
          `| ${a.roleId} | ${a.callCount} | $${a.costUsd.toFixed(4)} | ${(a.contributionScore * 100).toFixed(0)}% |`,
      )
      .join('\n');
  }

  return section;
}

export function generateReport(project) {
  const stats = generateProjectStats(project);
  const team = project.team || [];
  const tasks = project.tasks || [];

  let report = generateOverviewSection(project, stats, team);
  report += '\n\n' + generateTeamSection(team, tasks);
  report += '\n\n' + generatePlanSection(project);
  report += '\n\n' + generateStatsTable(stats);

  const executionSection = generateExecutionSummary(project);
  if (executionSection) {
    report += '\n\n' + executionSection;
  }

  report += generateCostSection(project);

  return report;
}

/**
 * 역할별 요약을 생성한다.
 * @param {object} teamMember - 팀원 정보
 * @param {Array<object>} tasks - 해당 팀원의 작업 배열
 * @returns {string} 역할 요약 마크다운
 */
export function generateRoleSummary(teamMember, tasks) {
  const completedCount = tasks.filter((t) => t.status === 'completed').length;
  const taskList =
    tasks.length > 0
      ? tasks.map((t) => `  - ${t.title} (${t.status})`).join('\n')
      : '  - (담당 작업 없음)';

  return `### ${teamMember.emoji} ${teamMember.displayName} (${teamMember.role})
- 담당 작업: ${tasks.length}개 (완료: ${completedCount})
${taskList}`;
}

/**
 * Phase별 실행 기록을 생성한다.
 * @param {object} project - 프로젝트 전체 데이터
 * @returns {string|null} 실행 기록 마크다운 또는 null
 */
export function generateExecutionSummary(project) {
  const state = project.executionState;
  if (!state || !state.phaseResults || typeof state.phaseResults !== 'object') return null;

  const phases = Object.keys(state.phaseResults);
  if (phases.length === 0) return null;

  let section = `## 실행 기록\n\n| Phase | 태스크 | 리뷰 | 품질게이트 | 수정시도 |\n|-------|--------|------|-----------|---------|`;

  for (const phase of phases) {
    const pr = state.phaseResults[phase];
    const taskCount = (pr.taskResults || []).length;
    const reviews = pr.reviews || [];
    const criticalCount = reviews.reduce(
      (sum, r) => sum + (r.issues || []).filter((i) => i.severity === 'critical').length,
      0,
    );
    const gate = pr.qualityGate;
    const gateStatus = gate ? (gate.passed ? 'PASS' : 'FAIL') : '-';
    const fixAttempts = (state.journal || []).filter(
      (j) => j.phase === Number(phase) && j.action === 'fix',
    ).length;

    section += `\n| ${phase} | ${taskCount}개 | ${reviews.length}건 (critical ${criticalCount}) | ${gateStatus} | ${fixAttempts}회 |`;
  }

  // 타임라인 (journal 기반)
  const journal = state.journal || [];
  if (journal.length > 0) {
    section += '\n\n### 실행 타임라인\n';
    for (const entry of journal) {
      const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString('ko-KR') : '';
      section += `\n- ${time} Phase ${entry.phase}: ${entry.action}${entry.fixAttempt ? ` (시도 ${entry.fixAttempt})` : ''}`;
    }
  }

  return section;
}

/**
 * 프로젝트 통계를 생성한다.
 * @param {object} project - 프로젝트 전체 데이터
 * @returns {{ totalTasks: number, completed: number, byRole: object }}
 */
export function generateProjectStats(project) {
  const tasks = project.tasks || [];
  const byRole = {};

  for (const task of tasks) {
    const assignee = task.assignee || 'unassigned';
    byRole[assignee] = (byRole[assignee] || 0) + 1;
  }

  return {
    totalTasks: tasks.length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    byRole,
  };
}
