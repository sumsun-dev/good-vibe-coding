/**
 * progress-formatter — 실행 진행률 표시 유틸리티
 * plan-execute / quick-build 모드에서 Phase 진행, ETA 등을 포맷팅한다.
 */

/**
 * Phase 시작 메시지를 포맷팅한다.
 * @param {number} phase - 현재 Phase 번호
 * @param {number} totalPhases - 총 Phase 수
 * @param {Array<{title: string, assignee: string}>} tasks - Phase 태스크 목록
 * @returns {string}
 */
export function formatPhaseStart(phase, totalPhases, tasks) {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const assignees = [...new Set(safeTasks.map((t) => t.assignee).filter(Boolean))];
  return `━━━ Phase ${phase}/${totalPhases} 시작 ━━━\n📋 태스크 ${safeTasks.length}개 | 담당: ${assignees.join(', ') || '미정'}`;
}

/**
 * Phase 완료 메시지를 포맷팅한다.
 * @param {number} phase
 * @param {number} totalPhases
 * @param {{ taskCount: number, reviewCount: number, criticalCount: number, passed: boolean }} phaseResult
 * @returns {string}
 */
export function formatPhaseComplete(phase, totalPhases, phaseResult) {
  const status = phaseResult.passed ? 'PASS' : 'FAIL';
  return `✅ Phase ${phase}/${totalPhases} 완료\n├─ 태스크: ${phaseResult.taskCount}개\n├─ 리뷰: ${phaseResult.reviewCount}건 (critical ${phaseResult.criticalCount})\n└─ 품질: ${status}`;
}

/**
 * 태스크 진행 상황을 포맷팅한다.
 * @param {Array<{id: string, title: string, assignee: string}>} tasks
 * @param {string[]} completedIds
 * @returns {string}
 */
export function formatTaskProgress(tasks, completedIds) {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeCompleted = new Set(Array.isArray(completedIds) ? completedIds : []);
  const completedCount = safeTasks.filter((t) => safeCompleted.has(t.id)).length;

  const lines = [`🔨 태스크 (${completedCount}/${safeTasks.length})`];
  for (const task of safeTasks) {
    const icon = safeCompleted.has(task.id) ? '✅' : '⏳';
    lines.push(`├─ ${icon} ${task.title} (${task.assignee})`);
  }
  return lines.join('\n');
}

/**
 * 리뷰 진행 상황을 포맷팅한다.
 * @param {string[]} reviewers - 전체 리뷰어 목록
 * @param {string[]} completedReviewers - 완료된 리뷰어
 * @returns {string}
 */
export function formatReviewProgress(reviewers, completedReviewers) {
  const safeReviewers = Array.isArray(reviewers) ? reviewers : [];
  const safeCompleted = new Set(Array.isArray(completedReviewers) ? completedReviewers : []);
  const completedCount = safeReviewers.filter((r) => safeCompleted.has(r)).length;

  const lines = [`🔍 리뷰 (${completedCount}/${safeReviewers.length})`];
  for (const reviewer of safeReviewers) {
    const icon = safeCompleted.has(reviewer) ? '✅' : '⏳';
    lines.push(`├─ ${icon} ${reviewer}`);
  }
  return lines.join('\n');
}

/**
 * 품질 게이트 결과를 포맷팅한다.
 * @param {{ passed: boolean, criticalCount: number, fixProgress?: string }} result
 * @returns {string}
 */
export function formatQualityGateResult(result) {
  if (result.passed) {
    return '✅ 품질 게이트 통과 (PASS)';
  }
  const fix = result.fixProgress ? ` → 수정 ${result.fixProgress}` : '';
  return `⚠️ 품질 게이트 실패 (FAIL) (critical ${result.criticalCount})${fix}`;
}

/**
 * 진행률 바를 포맷팅한다.
 * @param {number} currentPhase
 * @param {number} totalPhases
 * @param {string} phaseStep - 현재 action (execute-tasks, review 등)
 * @returns {string}
 */
export function formatProgressBar(currentPhase, totalPhases, phaseStep) {
  const barLength = 12;
  const progress = totalPhases > 0 ? (currentPhase - 1) / totalPhases : 0;
  const filled = Math.round(progress * barLength);
  const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
  const percent = Math.round(progress * 100);
  const label = phaseStep || '';
  return `[${bar}] Phase ${currentPhase}/${totalPhases} (${percent}%) — ${label}`;
}

/**
 * 남은 시간을 추정한다.
 * @param {Array<{action: string, timestamp: number, phase?: number}>} journal
 * @param {number} currentPhase
 * @param {number} totalPhases
 * @returns {{ estimatedMinutes: number, confidence: string, basedOnPhases: number } | null}
 */
export function estimateRemainingTime(journal, currentPhase, totalPhases) {
  if (!Array.isArray(journal) || journal.length === 0) return null;

  const buildContextEntries = journal.filter((e) => e.action === 'build-context');
  if (buildContextEntries.length === 0) return null;

  const phases = new Map();
  for (const entry of journal) {
    if (entry.phase == null) continue;
    const ts = Number(entry.timestamp);
    if (isNaN(ts)) continue;
    if (!phases.has(entry.phase)) {
      phases.set(entry.phase, { first: ts, last: ts });
    } else {
      const p = phases.get(entry.phase);
      if (ts < p.first) p.first = ts;
      if (ts > p.last) p.last = ts;
    }
  }

  const completedPhases = [...phases.entries()]
    .filter(([ph]) => ph < currentPhase)
    .filter(([ph]) => buildContextEntries.some((e) => e.phase === ph));

  if (completedPhases.length === 0) return null;

  const totalMs = completedPhases.reduce((sum, [, times]) => sum + (times.last - times.first), 0);
  const avgMs = totalMs / completedPhases.length;
  const remainingPhases = totalPhases - currentPhase + 1;
  const estimatedMinutes = (avgMs * remainingPhases) / 60000;

  let confidence = 'low';
  if (completedPhases.length >= 2) confidence = 'medium';

  return {
    estimatedMinutes: Math.max(1, Math.round(estimatedMinutes)),
    confidence,
    basedOnPhases: completedPhases.length,
  };
}

/**
 * 실행 대시보드를 포맷팅한다.
 * @param {object} project - 프로젝트 정보
 * @returns {string}
 */
export function formatExecutionDashboard(project) {
  if (!project.executionState) {
    return '⏸️ 실행 대기 (시작 전)';
  }

  const { currentPhase, totalPhases, currentAction, journal, phaseResults } =
    project.executionState;
  const lines = [];

  lines.push(formatProgressBar(currentPhase, totalPhases, currentAction));

  const phaseEntries = Array.isArray(phaseResults)
    ? phaseResults
    : (phaseResults && typeof phaseResults === 'object')
      ? Object.entries(phaseResults).map(([phase, pr]) => ({ phase: Number(phase), ...pr }))
      : [];

  if (phaseEntries.length > 0) {
    lines.push('');
    for (const pr of phaseEntries) {
      const status = pr.passed || (pr.qualityGate && pr.qualityGate.passed) ? '✅' : '❌';
      const taskCount = pr.taskCount || (pr.taskResults || []).length || 0;
      lines.push(`${status} Phase ${pr.phase}: 태스크 ${taskCount}개`);
    }
  }

  const eta = estimateRemainingTime(journal || [], currentPhase, totalPhases);
  if (eta) {
    lines.push(`\n⏱️ 약 ${eta.estimatedMinutes}분 남음 (신뢰도: ${eta.confidence})`);
  }

  return lines.join('\n');
}
