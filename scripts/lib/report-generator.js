/**
 * report-generator — 프로젝트 보고서 생성 모듈
 */

/**
 * 전체 프로젝트 보고서를 생성한다.
 * @param {object} project - 프로젝트 전체 데이터
 * @returns {string} 보고서 마크다운
 */
export function generateReport(project) {
  const stats = generateProjectStats(project);
  const roleSummaries = project.team
    .map(member => {
      const memberTasks = project.tasks.filter(t => t.assignee === member.roleId);
      return generateRoleSummary(member, memberTasks);
    })
    .join('\n\n');

  let report = `# 프로젝트 보고서: ${project.name}

## 개요
- 프로젝트: ${project.name} (${project.type})
- 팀원: ${project.team.length}명
- 작업: ${stats.totalTasks}개 (완료: ${stats.completed})
- 모드: ${project.mode}
- 상태: ${project.status}

## 팀원별 기여

${roleSummaries}

## 기획서

${project.discussion.planDocument || '(기획서 없음)'}

## 작업 통계

| 역할 | 작업 수 |
|------|---------|
${Object.entries(stats.byRole).map(([role, count]) => `| ${role} | ${count} |`).join('\n')}`;

  return report;
}

/**
 * 역할별 요약을 생성한다.
 * @param {object} teamMember - 팀원 정보
 * @param {Array<object>} tasks - 해당 팀원의 작업 배열
 * @returns {string} 역할 요약 마크다운
 */
export function generateRoleSummary(teamMember, tasks) {
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const taskList = tasks.length > 0
    ? tasks.map(t => `  - ${t.title} (${t.status})`).join('\n')
    : '  - (담당 작업 없음)';

  return `### ${teamMember.emoji} ${teamMember.displayName} (${teamMember.role})
- 담당 작업: ${tasks.length}개 (완료: ${completedCount})
${taskList}`;
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
    byRole[task.assignee] = (byRole[task.assignee] || 0) + 1;
  }

  return {
    totalTasks: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    byRole,
  };
}
