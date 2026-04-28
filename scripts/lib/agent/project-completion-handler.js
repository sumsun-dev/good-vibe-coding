/**
 * project-completion-handler — 자가발전 통합 (A-2/A-3)
 *
 * 프로젝트가 'completed'로 전이될 때 호출되어 다음 흐름을 자동화한다:
 *
 *   1. 역할별 성과 추출 (extractAgentPerformance)
 *   2. 6개 학습 신호 계산 (extractAllSignals)
 *   3. 각 역할의 candidate가 있으면 recordProjectResult로 신호 누적
 *   4. evaluateCandidate 호출 → promote / discard / pending 결정
 *   5. promote 시 active 교체, discard 시 candidate 폐기
 *   6. CEO 노출용 summary 반환
 *
 * candidate 평가는 active.md에는 손대지 않으므로(saveCandidateOverride 격리),
 * 기존 실행 루프에는 sideeffect 없이 통합 가능. 호출 시점은 호출자가 결정.
 */

import { extractAgentPerformance } from './agent-feedback.js';
import { extractAllSignals } from './agent-performance.js';
import {
  getCandidateState,
  recordProjectResult,
  evaluateCandidate,
  promoteCandidate,
  discardCandidate,
} from './agent-shadow-mode.js';
import { inputError } from '../core/validators.js';

/**
 * @typedef {Object} CandidateEvaluationResult
 * @property {string} roleId
 * @property {boolean} hadCandidate - 평가 시점에 candidate가 있었는지
 * @property {object} signals - 이 프로젝트의 6개 신호
 * @property {'promote' | 'discard' | 'pending' | 'skipped'} decision
 *   skipped: candidate 자체가 없어서 평가 생략
 * @property {string} reason
 * @property {number} projectCount
 * @property {number | null} activeScore
 * @property {number | null} candidateScore
 * @property {boolean} actionTaken - promote/discard가 실제 실행됐는지
 */

/**
 * @typedef {Object} CompletionSummary
 * @property {string} projectId
 * @property {string} processedAt - ISO 8601
 * @property {CandidateEvaluationResult[]} evaluations
 * @property {{ promoted: number, discarded: number, pending: number, skipped: number }} totals
 */

/**
 * 프로젝트 완료 처리. team의 모든 역할에 대해 신호를 기록하고 candidate를 평가한다.
 *
 * @param {object} project - 프로젝트 데이터 (team, tasks, executionState, metrics 포함)
 * @param {{
 *   minProjects?: number,
 *   weights?: object,
 *   autoApply?: boolean,
 * }} [options]
 *   - minProjects: evaluateCandidate 임계 (기본 3)
 *   - weights: computeAggregateScore 가중치
 *   - autoApply: true면 promote/discard를 실제 실행 (기본 true).
 *       false면 결정만 반환하고 파일 변경 안 함 → CEO가 직접 처리하는 모드.
 * @returns {Promise<CompletionSummary>}
 */
export async function processProjectCompletion(project, options = {}) {
  if (!project || typeof project !== 'object') {
    throw inputError('project 객체가 필요합니다');
  }
  const projectId = project.id;
  if (typeof projectId !== 'string' || !projectId) {
    throw inputError('project.id가 필요합니다');
  }

  const autoApply = options.autoApply !== false;
  const evalOptions = {};
  if (typeof options.minProjects === 'number') evalOptions.minProjects = options.minProjects;
  if (options.weights) evalOptions.weights = options.weights;

  const performances = extractAgentPerformance(project);
  const evaluations = [];

  for (const performance of performances) {
    const roleId = performance.roleId;
    const signals = extractAllSignals(project, performance);
    const state = await getCandidateState(roleId);

    if (!state.exists) {
      evaluations.push({
        roleId,
        hadCandidate: false,
        signals,
        decision: 'skipped',
        reason: 'candidate 없음 — 평가 생략',
        projectCount: 0,
        activeScore: null,
        candidateScore: null,
        actionTaken: false,
      });
      continue;
    }

    // 신호 누적 (이 프로젝트는 dry-run 평가 대상)
    await recordProjectResult(roleId, projectId, signals);

    // 평가
    const result = await evaluateCandidate(roleId, evalOptions);
    let actionTaken = false;
    if (autoApply) {
      if (result.decision === 'promote') {
        await promoteCandidate(roleId);
        actionTaken = true;
      } else if (result.decision === 'discard') {
        await discardCandidate(roleId);
        actionTaken = true;
      }
    }

    evaluations.push({
      roleId,
      hadCandidate: true,
      signals,
      decision: result.decision,
      reason: result.reason,
      projectCount: result.projectCount,
      activeScore: result.activeScore,
      candidateScore: result.candidateScore,
      actionTaken,
    });
  }

  const totals = { promoted: 0, discarded: 0, pending: 0, skipped: 0 };
  for (const e of evaluations) {
    if (e.decision === 'promote') totals.promoted++;
    else if (e.decision === 'discard') totals.discarded++;
    else if (e.decision === 'pending') totals.pending++;
    else if (e.decision === 'skipped') totals.skipped++;
  }

  return {
    projectId,
    processedAt: new Date().toISOString(),
    evaluations,
    totals,
  };
}

/**
 * CompletionSummary를 사람 읽기 좋은 마크다운으로 포맷한다 (CEO 노출용).
 * @param {CompletionSummary} summary
 * @returns {string}
 */
export function formatCompletionSummary(summary) {
  if (!summary || !summary.evaluations) return '';
  const lines = [
    `# 자가발전 학습 평가 — ${summary.projectId}`,
    '',
    `평가 시각: ${summary.processedAt}`,
    '',
    `**요약**: promote ${summary.totals.promoted} · discard ${summary.totals.discarded} · pending ${summary.totals.pending} · skipped ${summary.totals.skipped}`,
    '',
  ];

  const active = summary.evaluations.filter((e) => e.decision !== 'skipped');
  if (active.length === 0) {
    lines.push('활성 candidate가 있는 역할이 없습니다.');
    return lines.join('\n');
  }

  lines.push('## 역할별 결정', '');
  for (const e of active) {
    const scores =
      e.activeScore !== null && e.candidateScore !== null
        ? ` (active ${e.activeScore.toFixed(3)} · candidate ${e.candidateScore.toFixed(3)})`
        : e.candidateScore !== null
          ? ` (candidate ${e.candidateScore.toFixed(3)}, active baseline 없음)`
          : '';
    const action = e.actionTaken ? ' ✅' : '';
    lines.push(`- **${e.roleId}** — ${e.decision}${scores}${action}`);
    lines.push(`  - 누적 ${e.projectCount}개 프로젝트 · ${e.reason}`);
  }
  return lines.join('\n');
}
