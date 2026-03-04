// review-parser.js — 리뷰 본문 파싱 + Claude exit code 해석
// Shell에서 호출: node review-parser.js <command> [args...]

import { readFileSync } from 'fs';

/**
 * 텍스트에서 [MUST] 태그 개수를 카운트
 * @param {string} text - 리뷰 본문 텍스트
 * @returns {number}
 */
export function countMustIssues(text) {
  if (!text || typeof text !== 'string') return 0;
  return (text.match(/\[MUST\]/g) || []).length;
}

/**
 * 리뷰 본문에서 리뷰 상태를 파싱
 * @param {string} body - 리뷰 본문
 * @returns {'APPROVED'|'CHANGES_REQUESTED'|'UNKNOWN'}
 */
export function parseReviewStatusFromBody(body) {
  if (!body || typeof body !== 'string') return 'UNKNOWN';
  if (/\[APPROVED\]/.test(body)) return 'APPROVED';
  if (/\[CHANGES_REQUESTED\]/.test(body)) return 'CHANGES_REQUESTED';
  if (/\[MUST\]/.test(body)) return 'CHANGES_REQUESTED';
  return 'UNKNOWN';
}

/**
 * Claude 세션 exit code를 사람이 읽을 수 있는 문자열로 변환
 * @param {number|string} code - exit code
 * @returns {string}
 */
export function interpretClaudeExit(code) {
  const n = Number(code);
  if (Number.isNaN(n)) return 'error:NaN';
  if (n === 0) return 'success';
  if (n === 124) return 'timeout';
  if (n === 137) return 'killed';
  return `error:${n}`;
}

// CLI 진입점
if (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
) {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case 'count-must': {
      const file = args[0];
      if (!file) {
        console.log('0');
        break;
      }
      try {
        const text = readFileSync(file, 'utf-8');
        console.log(String(countMustIssues(text)));
      } catch {
        console.log('0');
      }
      break;
    }
    case 'parse-status': {
      const body = args[0] || '';
      console.log(parseReviewStatusFromBody(body));
      break;
    }
    case 'interpret-exit': {
      console.log(interpretClaudeExit(args[0]));
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}
