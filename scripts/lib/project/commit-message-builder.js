/**
 * commit-message-builder — conventional commit 메시지 생성
 *
 * Phase 커밋을 `feat(phase-1): API 라우터 구현` 형식으로 개선한다.
 * 모든 함수는 pure function (I/O 없음).
 */

import { config } from '../core/config.js';
import { truncateText } from '../core/text-utils.js';

const FIX_KEYWORDS = ['fix', 'bug', '수정', '버그', 'hotfix', 'patch'];
const TEST_KEYWORDS = ['test', '테스트', 'spec', 'coverage'];
const REFACTOR_KEYWORDS = ['refactor', '리팩토링', 'cleanup', '정리'];
const TEST_ROLES = ['qa'];
const MAX_SUBJECT_LENGTH = config.commit.maxSubjectLength;

/**
 * 태스크와 Phase 정보로 커밋 타입을 결정한다 (pure).
 * @param {Array<{assignedTo?: string, title?: string}>} tasks - 태스크 배열
 * @param {number} phase - 현재 Phase 번호
 * @param {number} totalPhases - 전체 Phase 수
 * @returns {'feat'|'fix'|'test'|'refactor'|'chore'}
 */
export function resolveCommitType(tasks, phase, totalPhases) {
  if (!tasks || tasks.length === 0) return 'feat';

  const titles = tasks.map((t) => (t.title || '').toLowerCase()).join(' ');
  const allTestRoles = tasks.every((t) => TEST_ROLES.includes((t.assignedTo || '').toLowerCase()));

  if (FIX_KEYWORDS.some((kw) => titles.includes(kw))) return 'fix';
  if (allTestRoles) return 'test';
  if (TEST_KEYWORDS.some((kw) => titles.includes(kw) && !titles.includes('구현'))) return 'test';
  if (REFACTOR_KEYWORDS.some((kw) => titles.includes(kw))) return 'refactor';
  if (phase === totalPhases && totalPhases > 1) return 'chore';

  return 'feat';
}

/**
 * 태스크 실행자 기반 Co-authored-by 라인을 생성한다 (pure).
 * @param {Array<{assignedTo?: string}>} tasks - 태스크 배열
 * @param {Array<{roleId?: string, name?: string}>} team - 팀 배열
 * @returns {string[]} Co-authored-by 라인 배열
 */
export function buildCoAuthoredBy(tasks, _team) {
  if (!tasks || tasks.length === 0) return [];

  const uniqueRoles = [...new Set(tasks.map((t) => t.assignedTo).filter(Boolean))];
  return uniqueRoles.map((roleId) => {
    return `Co-authored-by: ${roleId} (AI) <noreply@good-vibe.dev>`;
  });
}

/**
 * 커밋 바디를 생성한다 (pure).
 * @param {Array<{id?: string, assignedTo?: string, title?: string}>} tasks
 * @param {object} [qualityGate] - 품질 게이트 결과
 * @returns {string}
 */
export function buildCommitBody(tasks, qualityGate) {
  if (!tasks || tasks.length === 0) return '';

  const lines = ['Tasks:'];
  for (const t of tasks) {
    lines.push(
      `- [${t.id || 'unknown'}] ${t.assignedTo || 'unassigned'}: ${t.title || 'untitled'}`,
    );
  }

  if (qualityGate) {
    const reviewCount = (qualityGate.reviews || []).length;
    const critical = qualityGate.criticalCount ?? 0;
    lines.push('');
    lines.push(`Quality: ${reviewCount} reviews, ${critical} critical`);
  }

  return lines.join('\n');
}

/**
 * 전체 커밋 메시지를 조합한다 (pure).
 * @param {object} options
 * @param {number} options.phase - Phase 번호
 * @param {Array} options.tasks - 태스크 배열
 * @param {object} options.project - 프로젝트 객체
 * @param {Array} options.team - 팀 배열
 * @param {number} options.totalPhases - 전체 Phase 수
 * @param {object} [options.qualityGate] - 품질 게이트 결과
 * @returns {string} 커밋 메시지
 */
export function buildCommitMessage(options) {
  const { phase, tasks = [], team = [], totalPhases = 1, qualityGate } = options;

  const type = resolveCommitType(tasks, phase, totalPhases);
  const scope = `phase-${phase}`;
  const summary = buildSummaryLine(tasks);

  const prefix = `${type}(${scope}): `;
  const maxSummaryLen = MAX_SUBJECT_LENGTH - prefix.length;
  const truncatedSummary = truncateText(summary, maxSummaryLen);

  const parts = [`${prefix}${truncatedSummary}`];

  const body = buildCommitBody(tasks, qualityGate);
  if (body) {
    parts.push('');
    parts.push(body);
  }

  const coAuthored = buildCoAuthoredBy(tasks, team);
  if (coAuthored.length > 0) {
    parts.push('');
    parts.push(coAuthored.join('\n'));
  }

  return parts.join('\n');
}

/**
 * 태스크 제목들을 요약 라인으로 조합한다 (내부 헬퍼).
 * @param {Array<{title?: string}>} tasks
 * @returns {string}
 */
function buildSummaryLine(tasks) {
  if (!tasks || tasks.length === 0) return 'Phase 완료';

  const titles = tasks.map((t) => t.title || 'untitled').filter(Boolean);
  if (titles.length === 0) return 'Phase 완료';
  if (titles.length === 1) return titles[0];

  const joined = titles.slice(0, 2).join(' 및 ');
  if (titles.length > 2) return `${joined} 외 ${titles.length - 2}건`;
  return joined;
}
