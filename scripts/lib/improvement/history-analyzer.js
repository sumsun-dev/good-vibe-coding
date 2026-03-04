// history-analyzer.js — history.jsonl 읽기/쓰기/요약 (Node.js 버전)
// Shell에서 호출: node history-analyzer.js <command> [args...]

import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

/**
 * 히스토리 엔트리 1줄(JSONL)을 생성
 * @param {object} params
 * @returns {string} JSON 라인 1줄
 */
export function buildHistoryEntry({
  date,
  issues = 0,
  categories = [],
  approved = null,
  fixCycles = 0,
  prUrl = null,
  stopReason = null,
  totalRounds = 1,
  slaScore = null,
}) {
  return JSON.stringify({
    date,
    issues: Number(issues) || 0,
    categories: Array.isArray(categories) ? categories : [],
    approved: approved === true || approved === 'true' ? true : approved === false || approved === 'false' ? false : null,
    fixCycles: Number(fixCycles) || 0,
    mergedAt: null,
    prUrl: prUrl && prUrl !== 'null' ? prUrl : null,
    stopReason: stopReason && stopReason !== '' ? stopReason : null,
    totalRounds: Number(totalRounds) || 1,
    slaScore: slaScore !== null && slaScore !== undefined && slaScore !== 'null' ? Number(slaScore) || null : null,
  });
}

/**
 * JSONL 파일에서 엔트리 배열을 읽기
 * @param {string} filePath
 * @returns {object[]}
 */
export function readEntries(filePath) {
  let content;
  try {
    content = readFileSync(filePath, 'utf-8').trim();
  } catch {
    return [];
  }
  if (!content) return [];
  return content
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * 최근 N일 이내의 엔트리만 필터링
 * @param {object[]} entries
 * @param {number} days
 * @returns {object[]}
 */
export function readRecentEntries(entries, days = 7) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return entries.filter((e) => e.date >= cutoffStr);
}

/**
 * 히스토리 요약 텍스트 생성 (Improver 프롬프트용)
 * @param {object[]} entries - 최근 엔트리 배열
 * @param {object} options
 * @param {number} [options.historyDays=7]
 * @returns {string}
 */
export function buildHistorySummary(entries, { historyDays = 7 } = {}) {
  if (!entries || entries.length === 0) {
    return '실행 이력 없음 (첫 실행)';
  }

  const lines = [];
  lines.push('## 최근 실행 이력', '');

  let totalIssues = 0;
  let approvedCount = 0;
  let noFindingCount = 0;
  const categoryCounts = {};

  for (const entry of entries) {
    totalIssues += entry.issues || 0;

    if (Array.isArray(entry.categories)) {
      for (const cat of entry.categories) {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      }
    }

    if (entry.approved === true) approvedCount++;
    if ((entry.issues || 0) === 0) noFindingCount++;

    const statusText = buildStatusText(entry);
    const catDisplay = JSON.stringify(entry.categories || []);
    const slaInfo = entry.slaScore ? ` (SLA: ${entry.slaScore}/10, ${entry.totalRounds || 1}R)` : '';
    lines.push(`- ${entry.date}: ${entry.issues || 0}건 ${catDisplay} → ${statusText}${slaInfo}`);
  }

  lines.push('', '## 개선 방향 참고', '');

  const totalRuns = entries.length;
  lines.push(`- 최근 ${historyDays}일간 ${totalRuns}회 실행, 총 ${totalIssues}건 발견`);
  if (approvedCount > 0) {
    lines.push(`- 승인율: ${approvedCount}/${totalRuns}`);
  }

  // 카테고리별 빈도
  const sortedCats = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
  if (sortedCats.length > 0) {
    lines.push('', '카테고리별 발견 빈도:');
    for (const [cat, count] of sortedCats) {
      lines.push(`  - ${cat}: ${count}건`);
    }
  }

  // SLA 추이
  const slaEntries = entries.filter((e) => e.slaScore);
  if (slaEntries.length > 0) {
    lines.push('', 'SLA 추이:');
    const slaLine = slaEntries
      .map((e) => `${e.date}: ${e.slaScore}/10 (${e.totalRounds || 1} rounds)`)
      .join(', ');
    lines.push(`  ${slaLine}`);
  }

  // 이번 실행 지침
  lines.push('', '## 이번 실행 지침', '');

  if (sortedCats.length > 0) {
    const [topCat, topCount] = sortedCats[0];
    lines.push(`- ${topCat} 이슈가 가장 많습니다 (${topCount}건). 이 영역에 집중하세요.`);

    const knownCategories = ['quality', 'security', 'performance'];
    for (const kcat of knownCategories) {
      if (!categoryCounts[kcat]) {
        lines.push(`- 최근 ${kcat} 이슈가 발견되지 않았습니다. 이 영역을 재탐색하세요.`);
      }
    }
  }

  if (totalRuns >= 2) {
    const approvalPct = Math.floor((approvedCount * 100) / totalRuns);
    if (approvalPct < 50) {
      lines.push(`- 리뷰 통과율이 낮습니다 (${approvedCount}/${totalRuns}). 수정 품질에 집중하세요.`);
    }
  }

  if (noFindingCount >= 3) {
    lines.push(
      `- 최근 발견 없음 ${noFindingCount}회 — 분석 범위를 확장하고 새로운 관점으로 탐색하세요.`,
    );
  }

  return lines.join('\n');
}

function buildStatusText(entry) {
  if ((entry.issues || 0) === 0) return '발견 없음';

  if (entry.approved === true) {
    if (entry.mergedAt) return '승인, 머지됨';
    return '승인';
  }

  if (entry.approved === false) {
    const cycles = entry.fixCycles || 0;
    switch (entry.stopReason) {
      case 'no_progress':
        return `${cycles}회 수정 후 중단 (진행 없음)`;
      case 'max_cycles':
        return `${cycles}회 수정 후 중단 (안전장치)`;
      case 'time_limit':
        return `${cycles}회 수정 후 중단 (시간 제한)`;
      default:
        return `${cycles}회 수정 후 미승인`;
    }
  }

  return '진행 중';
}

/**
 * mergedAt === null && prUrl 존재하는 엔트리의 merge 상태를 확인
 * @param {object[]} entries
 * @param {function} ghPrViewFn - (prNumber) => 'MERGED'|'OPEN'|...
 * @returns {object[]} 업데이트된 엔트리 배열
 */
export function checkMergeStatus(entries, ghPrViewFn) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return entries.map((entry) => {
    if (entry.mergedAt !== null) return entry;
    if (!entry.prUrl) return entry;
    if (entry.date < cutoffStr) return entry;

    const prNumber = entry.prUrl.match(/\/(\d+)$/)?.[1];
    if (!prNumber || !/^\d+$/.test(prNumber)) return entry;

    const state = ghPrViewFn(prNumber);
    if (state === 'MERGED') {
      return { ...entry, mergedAt: new Date().toISOString().slice(0, 19).replace('T', ' ') };
    }
    return entry;
  });
}

// CLI 진입점
if (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
) {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case 'append': {
      const [file, date, issues, categories, approved, fixCycles, prUrl, stopReason, totalRounds, slaScore] = args;
      const line = buildHistoryEntry({
        date,
        issues: Number(issues),
        categories: categories ? JSON.parse(categories) : [],
        approved: approved === 'true' ? true : approved === 'false' ? false : null,
        fixCycles: Number(fixCycles),
        prUrl: prUrl === 'null' ? null : prUrl,
        stopReason: stopReason || null,
        totalRounds: Number(totalRounds) || 1,
        slaScore: slaScore && slaScore !== 'null' ? Number(slaScore) : null,
      });
      mkdirSync(dirname(file), { recursive: true });
      appendFileSync(file, line + '\n');
      break;
    }
    case 'summary': {
      const [file, days] = args;
      const entries = readEntries(file);
      const recent = readRecentEntries(entries, Number(days) || 7);
      const summary = buildHistorySummary(recent, { historyDays: Number(days) || 7 });
      console.log(summary);
      break;
    }
    case 'update-merged': {
      const [file] = args;
      const entries = readEntries(file);
      // DI: CLI에서는 실제 gh 호출
      const { execSync } = await import('child_process');
      const ghPrViewFn = (prNumber) => {
        // Shell injection 방지: 정수만 허용
        const safeNumber = parseInt(prNumber, 10);
        if (Number.isNaN(safeNumber) || safeNumber <= 0) return 'UNKNOWN';
        try {
          const ghTimeout = parseInt(process.env.GH_TIMEOUT, 10) || 15_000;
          return execSync(`gh pr view ${safeNumber} --json state --jq '.state'`, {
            encoding: 'utf-8',
            timeout: ghTimeout,
          }).trim();
        } catch {
          return 'UNKNOWN';
        }
      };
      const updated = checkMergeStatus(entries, ghPrViewFn);
      const hasChanges = JSON.stringify(entries) !== JSON.stringify(updated);
      if (hasChanges) {
        writeFileSync(file, updated.map((e) => JSON.stringify(e)).join('\n') + '\n');
        console.log('히스토리 머지 상태 업데이트 완료');
      }
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}
