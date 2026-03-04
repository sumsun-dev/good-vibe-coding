// issue-manager.js — 이슈 검증, closes 연결, stale 정리, 라운드 간 추적
// Shell에서 호출: node issue-manager.js verify-all <run-dir> <round>

import { readFileSync } from 'fs';
import { basename } from 'path';

/**
 * Phase 1 후 실제 생성된 이슈 검증 (expected vs gh issue list)
 * @param {object} params
 * @param {number[]} params.expectedIssues - issues-created.txt에서 읽은 이슈 번호
 * @param {function} params.ghIssueFn - (label) => number[] (gh issue list mock)
 * @returns {{ verified: number[], missing: number[], unexpected: number[] }}
 */
export function verifyCreatedIssues({ expectedIssues = [], ghIssueFn }) {
  const actualIssues = ghIssueFn('automated,improvement');
  const expectedSet = new Set(expectedIssues);
  const actualSet = new Set(actualIssues);

  const verified = expectedIssues.filter((n) => actualSet.has(n));
  const missing = expectedIssues.filter((n) => !actualSet.has(n));
  const unexpected = actualIssues.filter((n) => !expectedSet.has(n));

  return { verified, missing, unexpected };
}

/**
 * PR body에서 closes #N 패턴 추출 → 실제 이슈와 매칭
 * @param {object} params
 * @param {string} params.prBody - PR 본문
 * @param {number[]} params.createdIssues - 생성된 이슈 번호들
 * @returns {{ linked: number[], unlinked: number[], orphaned: number[] }}
 */
export function verifyClosesLinks({ prBody = '', createdIssues = [] }) {
  const pattern = /(?:closes?|fixes?|resolves?)\s+#(\d+)/gi;
  const linkedNumbers = new Set();
  let match;
  while ((match = pattern.exec(prBody)) !== null) {
    linkedNumbers.add(parseInt(match[1], 10));
  }

  const createdSet = new Set(createdIssues);
  const linked = createdIssues.filter((n) => linkedNumbers.has(n));
  const unlinked = createdIssues.filter((n) => !linkedNumbers.has(n));
  const orphaned = [...linkedNumbers].filter((n) => !createdSet.has(n));

  return { linked, unlinked, orphaned };
}

/**
 * N일 이상 열린 automated 이슈 식별
 * @param {object} params
 * @param {number} params.staleDays - stale 기준 일수
 * @param {function} params.ghIssueFn - () => [{ number, title, createdAt }]
 * @returns {Array<{ number: number, title: string, daysOpen: number }>}
 */
export function findStaleIssues({ staleDays = 14, ghIssueFn }) {
  const issues = ghIssueFn();
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;

  return issues
    .map((issue) => {
      const createdMs = new Date(issue.createdAt).getTime();
      const daysOpen = Math.floor((now - createdMs) / msPerDay);
      return { number: issue.number, title: issue.title, daysOpen };
    })
    .filter((issue) => issue.daysOpen >= staleDays);
}

/**
 * 이슈 본문에서 파일 경로 추출
 * @param {string} body - 이슈 본문
 * @returns {string[]}
 */
export function extractFilePathsFromBody(body) {
  if (!body || typeof body !== 'string') return [];

  const paths = new Set();

  // 패턴 1: `scripts/lib/foo.js` (백틱 내)
  const backtickPattern = /`([a-zA-Z0-9_./-]+\.[a-zA-Z]+)`/g;
  let match;
  while ((match = backtickPattern.exec(body)) !== null) {
    if (match[1].includes('/') || match[1].includes('.')) {
      paths.add(match[1]);
    }
  }

  // 패턴 2: - 파일: scripts/lib/foo.js 또는 파일 경로: scripts/lib/foo.js
  const labelPattern = /(?:파일|path|file)[:\s]+([a-zA-Z0-9_./-]+\.[a-zA-Z]+)/gi;
  while ((match = labelPattern.exec(body)) !== null) {
    paths.add(match[1]);
  }

  return [...paths];
}

/**
 * 이슈 본문 파일경로 vs PR diff → 해결 여부 판정
 * @param {object} params
 * @param {Array<{ number: number, body: string }>} params.issues
 * @param {string} params.diffText - git diff 출력
 * @returns {Array<{ issueNumber: number, filesMatched: string[], resolved: boolean }>}
 */
export function verifyIssueResolution({ issues = [], diffText = '' }) {
  const changedFiles = extractChangedFilesFromDiff(diffText);

  return issues.map((issue) => {
    const issuePaths = extractFilePathsFromBody(issue.body);
    const filesMatched = issuePaths.filter((p) =>
      changedFiles.some((cf) => cf === p || cf.endsWith(`/${p}`) || p.endsWith(`/${cf}`) || basename(cf) === basename(p)),
    );
    return {
      issueNumber: issue.number,
      filesMatched,
      resolved: issuePaths.length > 0 && filesMatched.length > 0,
    };
  });
}

/**
 * 라운드 간 이슈 추적 (이전 라운드 이슈 → 현재 라운드에서 해결 확인)
 * @param {object} params
 * @param {number[]} params.previousRoundIssues - 이전 라운드 이슈 번호
 * @param {number[]} params.currentRoundIssues - 현재 라운드 이슈 번호
 * @param {string} params.diffText - 현재 라운드 diff
 * @returns {{ resolved: number[], stillOpen: number[], newIssues: number[] }}
 */
export function trackCrossRoundIssues({ previousRoundIssues = [], currentRoundIssues = [], diffText = '' }) {
  const prevSet = new Set(previousRoundIssues);
  const currentSet = new Set(currentRoundIssues);

  // PR diff의 closes 패턴에서 해결된 이슈 추출
  const closedInDiff = new Set();
  const pattern = /(?:closes?|fixes?|resolves?)\s+#(\d+)/gi;
  let match;
  while ((match = pattern.exec(diffText)) !== null) {
    closedInDiff.add(parseInt(match[1], 10));
  }

  const resolved = previousRoundIssues.filter((n) => closedInDiff.has(n) || !currentSet.has(n));
  const stillOpen = previousRoundIssues.filter((n) => !closedInDiff.has(n) && currentSet.has(n));
  const newIssues = currentRoundIssues.filter((n) => !prevSet.has(n));

  return { resolved, stillOpen, newIssues };
}

// ── 내부 헬퍼 ─────────────────────────────────────

function extractChangedFilesFromDiff(diffText) {
  if (!diffText) return [];
  const files = new Set();
  const pattern = /^(?:diff --git a\/|[+-]{3} [ab]\/)(.+?)(?:\s|$)/gm;
  let match;
  while ((match = pattern.exec(diffText)) !== null) {
    files.add(match[1]);
  }
  return [...files];
}

// ── CLI 진입점 ─────────────────────────────────────
if (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
) {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case 'verify-all': {
      const [runDir, roundStr] = args;
      const round = parseInt(roundStr, 10) || 1;

      // issues-created.txt 읽기
      let expectedIssues = [];
      try {
        expectedIssues = readFileSync(`${runDir}/issues-created.txt`, 'utf-8')
          .trim()
          .split('\n')
          .filter((l) => l.trim())
          .map((l) => parseInt(l.trim(), 10))
          .filter((n) => !Number.isNaN(n));
      } catch {
        // 파일 없음
      }

      const { execSync } = await import('child_process');

      // gh issue list 래퍼
      const ghIssueFn = (label) => {
        try {
          const output = execSync(
            `gh issue list --label "${label}" --state open --json number --jq '.[].number'`,
            { encoding: 'utf-8', timeout: 10_000 },
          ).trim();
          return output
            .split('\n')
            .filter((l) => l.trim())
            .map((l) => parseInt(l.trim(), 10))
            .filter((n) => !Number.isNaN(n));
        } catch {
          return [];
        }
      };

      const verifyResult = verifyCreatedIssues({ expectedIssues, ghIssueFn });

      // PR body에서 closes 링크 검증
      let prBody = '';
      try {
        const prNumberStr = readFileSync(`${runDir}/pr-number`, 'utf-8').trim();
        const prNum = parseInt(prNumberStr, 10);
        if (!Number.isNaN(prNum) && prNum > 0) {
          const rawBody = execSync(`gh pr view ${prNum} --json body --jq '.body'`, {
            encoding: 'utf-8',
            timeout: 15_000,
          }).trim();
          prBody = rawBody || '';
        }
      } catch {
        // PR 없음 또는 gh CLI 에러
      }

      const closesResult = verifyClosesLinks({ prBody, createdIssues: expectedIssues });

      const result = {
        round,
        verification: verifyResult,
        closesLinks: closesResult,
      };

      console.log(JSON.stringify(result, null, 2));
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}
