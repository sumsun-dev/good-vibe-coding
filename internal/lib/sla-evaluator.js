// sla-evaluator.js — 7영역 SLA 품질 평가 (Round Loop용)
// Shell에서 호출: node sla-evaluator.js evaluate <output-file> <sla-target> <min-improvement> [prev-scores-file]
// node sla-evaluator.js dashboard <round-metrics.jsonl>

import { readFileSync } from 'fs';

export const SLA_DIMENSIONS = [
  'architecture',
  'safety',
  'promptQuality',
  'reflection',
  'errorHandling',
  'testCoverage',
  'docConsistency',
];

/**
 * Claude Evaluator 응답에서 JSON 점수 블록 파싱 (3-tier)
 * @param {string} text - Claude 응답 텍스트
 * @returns {{ scores: Record<string, number>, summary: string } | null}
 */
export function parseEvaluatorResponse(text) {
  if (!text || typeof text !== 'string') return null;

  // Tier 1: 직접 JSON.parse
  const parsed = tryParseJson(text.trim());
  if (parsed) return validateScores(parsed);

  // Tier 2: ```json ... ``` 블록 추출
  const jsonBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (jsonBlockMatch) {
    const blockParsed = tryParseJson(jsonBlockMatch[1].trim());
    if (blockParsed) return validateScores(blockParsed);
  }

  // Tier 3: {"scores": 패턴 찾기
  const scoresMatch = text.match(/\{"scores"\s*:\s*\{[\s\S]*?\}\s*(?:,[\s\S]*?)?\}/);
  if (scoresMatch) {
    const scoreParsed = tryParseJson(scoresMatch[0]);
    if (scoreParsed) return validateScores(scoreParsed);
  }

  return null;
}

/**
 * SLA 달성 판정
 * @param {Record<string, number>} scores - 7영역 점수 (0-10)
 * @param {number} slaTarget - 목표 점수
 * @returns {{ met: boolean, average: number, belowTarget: string[], aboveTarget: string[] }}
 */
export function checkSlaStatus(scores, slaTarget) {
  const dims = SLA_DIMENSIONS.filter((d) => scores[d] !== undefined);
  if (dims.length === 0) {
    return { met: false, average: 0, belowTarget: [...SLA_DIMENSIONS], aboveTarget: [] };
  }

  const sum = dims.reduce((acc, d) => acc + scores[d], 0);
  const average = Math.round((sum / dims.length) * 100) / 100;

  const belowTarget = dims.filter((d) => scores[d] < slaTarget);
  const aboveTarget = dims.filter((d) => scores[d] >= slaTarget);

  return {
    met: average >= slaTarget,
    average,
    belowTarget,
    aboveTarget,
  };
}

/**
 * 라운드 간 개선폭 계산 + 정체 감지
 * @param {Record<string, number> | null} prev - 이전 라운드 점수
 * @param {Record<string, number>} current - 현재 라운드 점수
 * @param {number} minImprovement - 최소 개선폭
 * @returns {{ improvement: number, stagnant: boolean, dimensionDeltas: Record<string, number> }}
 */
export function calculateImprovement(prev, current, minImprovement) {
  if (!prev) {
    return { improvement: 0, stagnant: false, dimensionDeltas: {} };
  }

  const deltas = {};
  let totalDelta = 0;
  let dimCount = 0;

  for (const dim of SLA_DIMENSIONS) {
    if (current[dim] !== undefined && prev[dim] !== undefined) {
      const delta = current[dim] - prev[dim];
      deltas[dim] = Math.round(delta * 100) / 100;
      totalDelta += delta;
      dimCount++;
    }
  }

  const improvement = dimCount > 0 ? Math.round((totalDelta / dimCount) * 100) / 100 : 0;
  const stagnant = improvement < minImprovement;

  return { improvement, stagnant, dimensionDeltas: deltas };
}

/**
 * SLA 미달 영역 피드백 생성 (다음 라운드 Improver에 주입)
 * @param {{ belowTarget: string[], average: number }} slaStatus
 * @param {Record<string, number>} scores
 * @returns {string}
 */
export function buildRoundFeedback(slaStatus, scores) {
  if (!slaStatus.belowTarget || slaStatus.belowTarget.length === 0) {
    return '';
  }

  const lines = ['## SLA 미달 영역 피드백', ''];
  lines.push(`현재 평균: ${slaStatus.average}/10`);
  lines.push('');
  lines.push('다음 영역에 집중하세요:');

  for (const dim of slaStatus.belowTarget) {
    const score = scores[dim] ?? 0;
    const label = dimensionLabel(dim);
    lines.push(`- **${label}** (${dim}): ${score}/10 — 개선 필요`);
  }

  return lines.join('\n');
}

/**
 * 라운드 메트릭 구조화
 * @param {object} params
 * @returns {object}
 */
export function buildRoundMetrics({
  round,
  scores,
  slaStatus,
  improvement = null,
  issueCount = 0,
  commitCount = 0,
}) {
  return {
    round,
    scores: { ...scores },
    average: slaStatus.average,
    met: slaStatus.met,
    belowTarget: slaStatus.belowTarget,
    improvement: improvement?.improvement ?? null,
    stagnant: improvement?.stagnant ?? false,
    issueCount,
    commitCount,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 라운드 히스토리로 SLA 대시보드 생성
 * @param {object[]} roundMetrics - 라운드별 메트릭 배열
 * @returns {string} markdown
 */
export function buildSlaDashboard(roundMetrics) {
  if (!roundMetrics || roundMetrics.length === 0) {
    return '## SLA 대시보드\n\n평가 데이터 없음';
  }

  const lines = ['## SLA 대시보드', ''];

  // 헤더
  const dimHeaders = SLA_DIMENSIONS.map((d) => dimensionLabel(d)).join(' | ');
  lines.push(`| Round | ${dimHeaders} | 평균 | 달성 |`);
  lines.push(`|-------|${SLA_DIMENSIONS.map(() => '---').join('|')}|------|------|`);

  // 행
  for (const m of roundMetrics) {
    const dimValues = SLA_DIMENSIONS.map((d) => m.scores?.[d]?.toFixed(1) ?? '-').join(' | ');
    const met = m.met ? 'O' : 'X';
    lines.push(`| ${m.round} | ${dimValues} | ${m.average?.toFixed(1) ?? '-'} | ${met} |`);
  }

  // 최종 요약
  const last = roundMetrics[roundMetrics.length - 1];
  lines.push('');
  lines.push(`**최종 SLA**: ${last.average?.toFixed(1)}/10 (${last.met ? '달성' : '미달'})`);
  lines.push(`**총 라운드**: ${roundMetrics.length}`);

  if (last.stagnant) {
    lines.push('**종료 사유**: 개선 정체');
  }

  return lines.join('\n');
}

// ── 내부 헬퍼 ─────────────────────────────────────

function parseJsonLines(lines) {
  return lines
    .filter((l) => l.trim())
    .map((l) => tryParseJson(l))
    .filter(Boolean);
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function validateScores(obj) {
  if (!obj || typeof obj !== 'object') return null;
  if (!obj.scores || typeof obj.scores !== 'object') return null;

  const scores = {};
  for (const dim of SLA_DIMENSIONS) {
    const val = obj.scores[dim];
    if (typeof val === 'number' && val >= 0 && val <= 10) {
      scores[dim] = val;
    }
  }

  if (Object.keys(scores).length === 0) return null;

  return {
    scores,
    summary: typeof obj.summary === 'string' ? obj.summary : '',
  };
}

function dimensionLabel(dim) {
  const labels = {
    architecture: 'Architecture',
    safety: 'Safety',
    promptQuality: 'Prompt Quality',
    reflection: 'Reflection',
    errorHandling: 'Error Handling',
    testCoverage: 'Test Coverage',
    docConsistency: 'Doc Consistency',
  };
  return labels[dim] || dim;
}

// ── CLI 진입점 ─────────────────────────────────────
if (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
) {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case 'evaluate': {
      const [outputFile, slaTargetStr, minImprovementStr, prevScoresFile] = args;
      const parsedTarget = parseFloat(slaTargetStr);
      const slaTarget = Number.isFinite(parsedTarget) ? parsedTarget : 7.0;
      const parsedImprovement = parseFloat(minImprovementStr);
      const minImprovement = Number.isFinite(parsedImprovement) ? parsedImprovement : 0.3;

      let text;
      try {
        text = readFileSync(outputFile, 'utf-8');
      } catch {
        console.log(JSON.stringify({ met: false, average: 0, stagnant: false, feedback: '' }));
        break;
      }

      const parsed = parseEvaluatorResponse(text);
      if (!parsed) {
        console.log(
          JSON.stringify({ met: false, average: 0, stagnant: false, feedback: 'JSON 파싱 실패' }),
        );
        break;
      }

      const slaStatus = checkSlaStatus(parsed.scores, slaTarget);

      let prevScores = null;
      if (prevScoresFile) {
        try {
          prevScores = JSON.parse(readFileSync(prevScoresFile, 'utf-8'));
        } catch {
          // 이전 점수 없음 → 첫 라운드
        }
      }

      const improvement = calculateImprovement(prevScores, parsed.scores, minImprovement);
      const feedback = buildRoundFeedback(slaStatus, parsed.scores);

      console.log(
        JSON.stringify({
          ...slaStatus,
          scores: parsed.scores,
          summary: parsed.summary,
          improvement: improvement.improvement,
          stagnant: improvement.stagnant,
          dimensionDeltas: improvement.dimensionDeltas,
          feedback,
        }),
      );
      break;
    }
    case 'dashboard': {
      const [metricsFile] = args;
      let lines;
      try {
        lines = readFileSync(metricsFile, 'utf-8').trim().split('\n');
      } catch {
        console.log('## SLA 대시보드\n\n평가 데이터 없음');
        break;
      }
      const metrics = parseJsonLines(lines);
      console.log(buildSlaDashboard(metrics));
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}
