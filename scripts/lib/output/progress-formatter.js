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
  return `--- Phase ${phase}/${totalPhases} 시작 ---\n태스크 ${safeTasks.length}개 | 담당: ${assignees.join(', ') || '미정'}`;
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
  return `Phase ${phase}/${totalPhases} 완료\n├─ 태스크: ${phaseResult.taskCount}개\n├─ 리뷰: ${phaseResult.reviewCount}건 (critical ${phaseResult.criticalCount})\n└─ 품질: ${status}`;
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

  const lines = [`태스크 (${completedCount}/${safeTasks.length})`];
  for (const task of safeTasks) {
    const icon = safeCompleted.has(task.id) ? '[v]' : '[ ]';
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

  const lines = [`리뷰 (${completedCount}/${safeReviewers.length})`];
  for (const reviewer of safeReviewers) {
    const icon = safeCompleted.has(reviewer) ? '[v]' : '[ ]';
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
    return '품질 게이트 통과 (PASS)';
  }
  const fix = result.fixProgress ? ` → 수정 ${result.fixProgress}` : '';
  return `품질 게이트 실패 (FAIL) (critical ${result.criticalCount})${fix}`;
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
    if (entry.phase === null || entry.phase === undefined) continue;
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
 * 실패 이력을 Phase별 요약 형식으로 포맷팅한다.
 * @param {Array<{timestamp: string, action: string, phase: number, failureSummary?: object, fixAttempt?: number}>} journal - 실행 저널
 * @returns {string} 실패 이력 마크다운
 */
export function formatFailureHistory(journal) {
  if (!Array.isArray(journal) || journal.length === 0) return '실패 이력 없음';

  const failures = journal.filter((e) => e.failureSummary || e.action === 'escalation-response');

  if (failures.length === 0) return '실패 이력 없음';

  const lines = ['실패 이력'];

  // Phase별 그룹핑
  const byPhase = new Map();
  for (const entry of failures) {
    const phase = entry.phase || 0;
    if (!byPhase.has(phase)) byPhase.set(phase, []);
    byPhase.get(phase).push(entry);
  }

  for (const [phase, entries] of byPhase) {
    lines.push(`\nPhase ${phase}:`);
    for (const entry of entries) {
      const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString('ko-KR') : '';
      if (entry.failureSummary) {
        const cats = (entry.failureSummary.categories || []).join(', ');
        lines.push(`├─ [${time}] 품질 게이트 실패: ${entry.failureSummary.issueCount}건 (${cats})`);
      }
      if (entry.action === 'escalation-response') {
        lines.push(`├─ [${time}] 에스컬레이션 처리`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * 토론 진행률을 포맷팅한다.
 * @param {number} round - 현재 라운드
 * @param {number} maxRounds - 최대 라운드
 * @param {number} currentTier - 현재 Tier (1-4)
 * @param {number} totalTiers - 총 Tier 수
 * @param {string[]} tierAgents - 현재 Tier 에이전트 목록
 * @returns {string}
 */
export function formatDiscussionProgress(round, maxRounds, currentTier, totalTiers, tierAgents) {
  const safeAgents = Array.isArray(tierAgents) ? tierAgents : [];
  const barLength = 8;
  const progress = totalTiers > 0 ? (currentTier - 1) / totalTiers : 0;
  const filled = Math.round(progress * barLength);
  const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
  return `[${bar}] 토론 ${round}/${maxRounds} — Tier ${currentTier}/${totalTiers} (${safeAgents.join(', ')})`;
}

/**
 * Tier 내 에이전트 진행 상황을 포맷팅한다.
 * @param {string} tierName - Tier 이름 (예: "전략/요구사항")
 * @param {string[]} completedAgents - 완료된 에이전트
 * @param {string[]} totalAgents - 전체 에이전트
 * @returns {string}
 */
export function formatTierProgress(tierName, completedAgents, totalAgents) {
  const safeCompleted = Array.isArray(completedAgents) ? completedAgents : [];
  const safeTotal = Array.isArray(totalAgents) ? totalAgents : [];
  const lines = [`Tier: ${tierName} (${safeCompleted.length}/${safeTotal.length})`];
  for (const agent of safeTotal) {
    const icon = safeCompleted.includes(agent) ? '[v]' : '[ ]';
    lines.push(`├─ ${icon} ${agent}`);
  }
  return lines.join('\n');
}

/**
 * 수렴 상태를 포맷팅한다.
 * @param {number} approvalRate - 승인율 (0-1)
 * @param {number} threshold - 수렴 임계값 (0-1)
 * @param {string[]} blockers - 블로커 이슈 목록
 * @returns {string}
 */
export function formatConvergenceStatus(approvalRate, threshold, blockers) {
  const percent = Math.round((approvalRate || 0) * 100);
  const thresholdPercent = Math.round((threshold || 0.8) * 100);
  const converged = approvalRate >= threshold;
  const status = converged ? 'CONVERGED' : 'NOT CONVERGED';
  const safeBlockers = Array.isArray(blockers) ? blockers : [];

  let result = `수렴 상태: ${status} (${percent}% / 목표 ${thresholdPercent}%)`;
  if (safeBlockers.length > 0) {
    result += `\n블로커: ${safeBlockers.length}건`;
    for (const blocker of safeBlockers) {
      result += `\n├─ ${blocker}`;
    }
  }
  return result;
}

/**
 * 실행 대시보드를 포맷팅한다.
 * @param {object} project - 프로젝트 정보
 * @returns {string}
 */
export function formatExecutionDashboard(project) {
  if (!project.executionState) {
    return '실행 대기 (시작 전)';
  }

  const { currentPhase, totalPhases, currentAction, journal, phaseResults } =
    project.executionState;
  const lines = [];

  lines.push(formatProgressBar(currentPhase, totalPhases, currentAction));

  const phaseEntries = Array.isArray(phaseResults)
    ? phaseResults
    : phaseResults && typeof phaseResults === 'object'
      ? Object.entries(phaseResults).map(([phase, pr]) => ({ phase: Number(phase), ...pr }))
      : [];

  if (phaseEntries.length > 0) {
    lines.push('');
    for (const pr of phaseEntries) {
      const status = pr.passed || (pr.qualityGate && pr.qualityGate.passed) ? '[PASS]' : '[FAIL]';
      const taskCount = pr.taskCount || (pr.taskResults || []).length || 0;
      lines.push(`${status} Phase ${pr.phase}: 태스크 ${taskCount}개`);
    }
  }

  const eta = estimateRemainingTime(journal || [], currentPhase, totalPhases);
  if (eta) {
    lines.push(`\n약 ${eta.estimatedMinutes}분 남음 (신뢰도: ${eta.confidence})`);
  }

  return lines.join('\n');
}
