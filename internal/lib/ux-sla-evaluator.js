// ux-sla-evaluator.js — UX 5영역 SLA 품질 평가
// Shell에서 호출: node ux-sla-evaluator.js evaluate <output-file> <sla-target> <min-improvement> [prev-scores-file]
// node ux-sla-evaluator.js dashboard <round-metrics.jsonl>

import { readFileSync } from 'fs';

export const UX_SLA_DIMENSIONS = [
  'flowClarity',
  'errorQuality',
  'guideCompleteness',
  'onboardingFriction',
  'sdkUsability',
];

const DIMENSION_LABELS = {
  flowClarity: '커맨드 플로우 명확성',
  errorQuality: '에러 메시지 품질',
  guideCompleteness: '가이드/문서 완성도',
  onboardingFriction: '온보딩 마찰도',
  sdkUsability: 'SDK 사용성',
};

/**
 * Claude Evaluator 응답에서 JSON 점수 블록 파싱 (3-tier)
 * @param {string} text - Claude 응답 텍스트
 * @returns {{ scores: Record<string, number>, summary: string } | null}
 */
export function parseUxEvaluatorResponse(text) {
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
 * UX SLA 달성 판정
 * @param {Record<string, number>} scores - 5영역 점수 (0-10)
 * @param {number} slaTarget - 목표 점수
 * @returns {{ met: boolean, average: number, belowTarget: string[], aboveTarget: string[] }}
 */
export function checkUxSlaStatus(scores, slaTarget) {
  const dims = UX_SLA_DIMENSIONS.filter((d) => scores[d] !== undefined);
  if (dims.length === 0) {
    return { met: false, average: 0, belowTarget: [...UX_SLA_DIMENSIONS], aboveTarget: [] };
  }

  const sum = dims.reduce((acc, d) => acc + scores[d], 0);
  const average = Math.round((sum / dims.length) * 100) / 100;

  const belowTarget = dims.filter((d) => scores[d] < slaTarget);
  const aboveTarget = dims.filter((d) => scores[d] >= slaTarget);

  return { met: average >= slaTarget, average, belowTarget, aboveTarget };
}

/**
 * 라운드 간 개선폭 계산 + 정체 감지
 * @param {Record<string, number> | null} prev - 이전 라운드 점수
 * @param {Record<string, number>} current - 현재 라운드 점수
 * @param {number} minImprovement - 최소 개선폭
 * @returns {{ improvement: number, stagnant: boolean, dimensionDeltas: Record<string, number> }}
 */
export function calculateUxImprovement(prev, current, minImprovement) {
  if (!prev) {
    return { improvement: 0, stagnant: false, dimensionDeltas: {} };
  }

  const deltas = {};
  let totalDelta = 0;
  let dimCount = 0;

  for (const dim of UX_SLA_DIMENSIONS) {
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
 * UX SLA 미달 영역 피드백 생성
 * @param {{ belowTarget: string[], average: number }} slaStatus
 * @param {Record<string, number>} scores
 * @returns {string}
 */
export function buildUxRoundFeedback(slaStatus, scores) {
  if (!slaStatus.belowTarget || slaStatus.belowTarget.length === 0) {
    return '';
  }

  const lines = ['## UX SLA 미달 영역 피드백', ''];
  lines.push(`현재 평균: ${slaStatus.average}/10`);
  lines.push('');
  lines.push('다음 영역에 집중하세요:');

  for (const dim of slaStatus.belowTarget) {
    const score = scores[dim] ?? 0;
    const label = DIMENSION_LABELS[dim] || dim;
    lines.push(`- **${label}** (${dim}): ${score}/10 — 개선 필요`);
  }

  return lines.join('\n');
}

/**
 * 라운드 히스토리로 UX SLA 대시보드 생성
 * @param {object[]} roundMetrics - 라운드별 메트릭 배열
 * @returns {string} markdown
 */
export function buildUxSlaDashboard(roundMetrics) {
  if (!roundMetrics || roundMetrics.length === 0) {
    return '## UX SLA 대시보드\n\n평가 데이터 없음';
  }

  const lines = ['## UX SLA 대시보드', ''];

  const dimHeaders = UX_SLA_DIMENSIONS.map((d) => DIMENSION_LABELS[d] || d).join(' | ');
  lines.push(`| Round | ${dimHeaders} | 평균 | 달성 |`);
  lines.push(`|-------|${UX_SLA_DIMENSIONS.map(() => '---').join('|')}|------|------|`);

  for (const m of roundMetrics) {
    const dimValues = UX_SLA_DIMENSIONS.map((d) => m.scores?.[d]?.toFixed(1) ?? '-').join(' | ');
    const met = m.met ? 'O' : 'X';
    lines.push(`| ${m.round} | ${dimValues} | ${m.average?.toFixed(1) ?? '-'} | ${met} |`);
  }

  const last = roundMetrics[roundMetrics.length - 1];
  lines.push('');
  lines.push(`**최종 UX SLA**: ${last.average?.toFixed(1)}/10 (${last.met ? '달성' : '미달'})`);
  lines.push(`**총 라운드**: ${roundMetrics.length}`);

  if (last.stagnant) {
    lines.push('**종료 사유**: 개선 정체');
  }

  return lines.join('\n');
}

// ── 내부 헬퍼 ─────────────────────────────────────

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
  for (const dim of UX_SLA_DIMENSIONS) {
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

function parseJsonLines(lines) {
  return lines
    .filter((l) => l.trim())
    .map((l) => tryParseJson(l))
    .filter(Boolean);
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

      const parsed = parseUxEvaluatorResponse(text);
      if (!parsed) {
        console.log(
          JSON.stringify({ met: false, average: 0, stagnant: false, feedback: 'JSON 파싱 실패' }),
        );
        break;
      }

      const slaStatus = checkUxSlaStatus(parsed.scores, slaTarget);

      let prevScores = null;
      if (prevScoresFile) {
        try {
          prevScores = JSON.parse(readFileSync(prevScoresFile, 'utf-8'));
        } catch {
          // 이전 점수 없음
        }
      }

      const improvement = calculateUxImprovement(prevScores, parsed.scores, minImprovement);
      const feedback = buildUxRoundFeedback(slaStatus, parsed.scores);

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
        console.log('## UX SLA 대시보드\n\n평가 데이터 없음');
        break;
      }
      const metrics = parseJsonLines(lines);
      console.log(buildUxSlaDashboard(metrics));
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}
