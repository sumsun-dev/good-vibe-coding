/**
 * quality-evaluator — Phase별 + 프로젝트 전체 품질 점수 산출 모듈
 *
 * 점수 공식:
 * phaseScore = max(0, min(100,
 *   100 - (criticalCount × 20) - (importantCount × 5)
 *       - (fixAttempts × 10) - (buildFailed ? 30 : 0)
 * ))
 */

import { config } from '../core/config.js';

/**
 * Phase 결과에서 품질 점수를 계산한다 (pure).
 * @param {object|null} phaseResult - Phase 결과 (reviews, qualityGate)
 * @param {number} [fixAttempts=0] - 수정 시도 횟수
 * @returns {{ score: number, metrics: object }}
 */
export function calculatePhaseQuality(phaseResult, fixAttempts = 0) {
  if (!phaseResult || typeof phaseResult !== 'object') {
    return {
      score: 100,
      metrics: { criticalCount: 0, importantCount: 0, fixAttempts: 0, buildFailed: false },
    };
  }

  const reviews = phaseResult.reviews || [];
  const allIssues = reviews.flatMap((r) => r.issues || []);

  const criticalCount = allIssues.filter((i) => i.severity === 'critical').length;
  const importantCount = allIssues.filter((i) => i.severity === 'important').length;
  const buildFailed = phaseResult.qualityGate ? !phaseResult.qualityGate.passed : false;

  const { criticalPenalty, importantPenalty, fixAttemptPenalty, buildFailurePenalty } =
    config.quality;

  const rawScore =
    100 -
    criticalCount * criticalPenalty -
    importantCount * importantPenalty -
    fixAttempts * fixAttemptPenalty -
    (buildFailed ? buildFailurePenalty : 0);

  const score = Math.max(0, Math.min(100, rawScore));

  return {
    score,
    metrics: {
      criticalCount,
      importantCount,
      fixAttempts,
      buildFailed,
    },
  };
}

/**
 * 프로젝트 전체 품질 점수를 계산한다 (pure).
 * 전체 점수 = Phase 점수의 가중 평균 (첫 Phase 30%, 나머지 균등 분배).
 * @param {object} project - 프로젝트 객체
 * @returns {{ score: number, phaseScores: object, trend: string|null, improvement: number|null }}
 */
export function calculateOverallQuality(project) {
  const state = project.executionState;
  if (!state || !state.phaseResults || Object.keys(state.phaseResults).length === 0) {
    return { score: 0, phaseScores: {}, trend: null, improvement: null };
  }

  const journal = state.journal || [];
  const phaseScores = {};

  for (const [phaseStr, phaseResult] of Object.entries(state.phaseResults)) {
    const phase = Number(phaseStr);
    const fixCount = journal.filter((j) => j.phase === phase && j.action === 'fix').length;
    const { score } = calculatePhaseQuality(phaseResult, fixCount);
    phaseScores[phase] = score;
  }

  const phases = Object.keys(phaseScores)
    .map(Number)
    .sort((a, b) => a - b);
  const firstPhaseWeight = config.quality.firstPhaseWeight;

  let overallScore;
  if (phases.length === 1) {
    overallScore = phaseScores[phases[0]];
  } else {
    const restWeight = (1 - firstPhaseWeight) / (phases.length - 1);
    overallScore = Math.round(
      phases.reduce((sum, phase, idx) => {
        const weight = idx === 0 ? firstPhaseWeight : restWeight;
        return sum + phaseScores[phase] * weight;
      }, 0),
    );
  }

  // 트렌드 계산
  const history = project.evolutionHistory || [];
  let trend = null;
  let improvement = null;

  if (history.length > 0) {
    const lastGen = history[history.length - 1];
    improvement = overallScore - lastGen.score;
    if (improvement > 0) trend = 'improving';
    else if (improvement < 0) trend = 'declining';
    else trend = 'stable';
  }

  return { score: overallScore, phaseScores, trend, improvement };
}

/**
 * 마크다운 품질 대시보드를 생성한다 (pure).
 * @param {object} project - 프로젝트 객체
 * @returns {string} 마크다운 문자열
 */
export function buildQualityDashboard(project) {
  const state = project.executionState;
  if (!state || !state.phaseResults || Object.keys(state.phaseResults).length === 0) {
    return '## 품질 대시보드\n\n품질 데이터가 없습니다.';
  }

  const quality = calculateOverallQuality(project);
  const { score, phaseScores, trend, improvement } = quality;

  const trendArrow =
    trend === 'improving'
      ? ` ⬆️ (+${improvement})`
      : trend === 'declining'
        ? ` ⬇️ (${improvement})`
        : trend === 'stable'
          ? ' ➡️ (±0)'
          : '';

  let dashboard = `## 품질 대시보드\n\n📊 품질 점수: ${score}/100${trendArrow}\n`;

  // Phase별 점수
  const phaseEntries = Object.entries(phaseScores).sort(([a], [b]) => Number(a) - Number(b));

  if (phaseEntries.length > 0) {
    dashboard += '\nPhase별: ';
    dashboard += phaseEntries.map(([p, s]) => `Phase ${p}: ${s}`).join(' | ');
    dashboard += '\n';
  }

  // 세대별 추이
  const history = project.evolutionHistory || [];
  if (history.length > 0) {
    dashboard += '\n세대별: ';
    dashboard += history.map((h) => `Gen ${h.generation}: ${h.score}`).join(' → ');
    dashboard += ` → Gen ${history.length + 1}: ${score}`;
    if (improvement !== null) {
      dashboard += ` (${improvement >= 0 ? '+' : ''}${improvement})`;
    }
    dashboard += '\n';
  }

  return dashboard;
}
