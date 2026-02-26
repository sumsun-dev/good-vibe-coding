/**
 * agent-feedback — 에이전트 피드백 시스템
 * 프로젝트 결과를 분석하여 에이전트 .md 수정안을 자동 제안하고,
 * 승인된 수정을 오버라이드 파일로 저장한다.
 */

import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { resolve } from 'path';
import { ensureDir, fileExists } from './file-writer.js';

const DEFAULT_OVERRIDES_DIR = resolve(
  process.env.HOME || process.env.USERPROFILE,
  '.claude', 'good-vibe', 'agent-overrides'
);
let overridesDir = DEFAULT_OVERRIDES_DIR;

/**
 * 테스트용 오버라이드 디렉토리를 설정한다.
 * @param {string} dir - 새 디렉토리
 */
export function setOverridesDir(dir) {
  overridesDir = dir;
}

/**
 * roleId를 검증한다 (경로 순회 방지).
 * @param {string} roleId - 역할 ID
 * @returns {string} 검증된 roleId
 */
function validateRoleId(roleId) {
  if (!roleId || typeof roleId !== 'string') {
    throw new Error('roleId는 비어있지 않은 문자열이어야 합니다');
  }
  if (/[\/\\]/.test(roleId) || roleId.includes('..')) {
    throw new Error(`유효하지 않은 roleId: ${roleId}`);
  }
  return roleId;
}

/**
 * 프로젝트 결과에서 에이전트별 성과 데이터를 추출한다.
 * @param {object} project - 프로젝트 데이터
 * @returns {Array<{roleId: string, tasks: Array, reviews: Array, issues: Array}>}
 */
export function extractAgentPerformance(project) {
  const team = project.team || [];
  const tasks = project.tasks || [];

  return team.map(member => {
    const roleId = member.roleId;

    const memberTasks = tasks
      .filter(t => t.assignee === roleId)
      .map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        reviewResults: t.reviews || [],
      }));

    const reviews = memberTasks.flatMap(t => t.reviewResults);

    const issues = reviews
      .flatMap(r => (r.issues || []))
      .filter(i => i.severity === 'critical' || i.severity === 'important');

    return { roleId, tasks: memberTasks, reviews, issues };
  });
}

/**
 * 성과 데이터를 바탕으로 에이전트 개선 프롬프트를 생성한다.
 * @param {string} roleId - 역할 ID
 * @param {object} performance - extractAgentPerformance의 개별 항목
 * @param {string} currentAgentMd - 현재 에이전트 .md 내용
 * @returns {string} 개선 분석 프롬프트
 */
export function buildImprovementPrompt(roleId, performance, currentAgentMd) {
  const taskSummary = performance.tasks.length > 0
    ? performance.tasks.map(t => `- ${t.title} (${t.status})`).join('\n')
    : '- (담당 작업 없음)';

  const issueSummary = performance.issues.length > 0
    ? performance.issues.map(i => `- [${i.severity}] ${i.description}`).join('\n')
    : '- (이슈 없음)';

  const reviewSummary = performance.reviews.length > 0
    ? performance.reviews.map(r => {
        const verdict = r.approved ? '승인' : '수정 요청';
        const feedback = r.feedback || '';
        return `- ${verdict}: ${feedback}`;
      }).join('\n')
    : '- (리뷰 없음)';

  return `다음은 "${roleId}" 에이전트의 프로젝트 수행 결과입니다.
이 결과를 바탕으로 에이전트의 .md 파일을 어떻게 개선하면 좋을지 제안해주세요.

## 현재 에이전트 설정
\`\`\`markdown
${currentAgentMd}
\`\`\`

## 프로젝트 수행 결과

### 담당 작업
${taskSummary}

### 리뷰 결과
${reviewSummary}

### 발견된 이슈
${issueSummary}

## 제안 형식

반드시 아래 JSON 배열 형식으로 응답하세요:
\`\`\`json
[
  {
    "section": "수정할 섹션 이름",
    "current": "현재 내용 (없으면 빈 문자열)",
    "suggested": "제안하는 내용",
    "reason": "수정 이유"
  }
]
\`\`\`

규칙:
- 프로젝트 결과에서 드러난 구체적 문제점만 다루세요
- 이슈가 없다면 빈 배열을 반환하세요
- 제안은 에이전트의 행동을 직접 개선하는 것이어야 합니다`;
}

/**
 * 분석 결과 텍스트에서 수정 제안을 파싱한다.
 * @param {string} analysisText - Task tool 분석 결과 텍스트
 * @returns {Array<{section: string, current: string, suggested: string, reason: string}>}
 */
export function parseImprovementSuggestions(analysisText) {
  if (!analysisText || analysisText.trim() === '') return [];

  // JSON 직접 파싱
  try {
    const parsed = JSON.parse(analysisText.trim());
    if (Array.isArray(parsed)) return normalizeSuggestions(parsed);
  } catch {
    // JSON 블록 추출 시도
  }

  // ```json ... ``` 블록 추출
  const jsonBlockMatch = analysisText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1].trim());
      if (Array.isArray(parsed)) return normalizeSuggestions(parsed);
    } catch {
      // 파싱 실패
    }
  }

  // [ ... ] 패턴 추출 (마지막 ] 에서 역방향 탐색)
  const lastBracket = analysisText.lastIndexOf(']');
  if (lastBracket !== -1) {
    const firstBracket = analysisText.lastIndexOf('[', lastBracket);
    if (firstBracket !== -1) {
      try {
        const parsed = JSON.parse(analysisText.slice(firstBracket, lastBracket + 1));
        if (Array.isArray(parsed)) return normalizeSuggestions(parsed);
      } catch {
        // 파싱 실패
      }
    }
  }

  return [];
}

/**
 * 제안 배열을 정규화한다.
 * @param {Array} suggestions - 원본 제안 배열
 * @returns {Array<{section: string, current: string, suggested: string, reason: string}>}
 */
function normalizeSuggestions(suggestions) {
  return suggestions
    .filter(s => s && typeof s === 'object' && s.suggested)
    .map(s => ({
      section: s.section || '',
      current: s.current || '',
      suggested: s.suggested || '',
      reason: s.reason || '',
    }));
}

/**
 * 에이전트 오버라이드를 저장한다.
 * @param {string} roleId - 역할 ID
 * @param {string} content - 오버라이드 마크다운 내용
 */
export async function saveAgentOverride(roleId, content) {
  validateRoleId(roleId);
  await ensureDir(overridesDir);
  const filePath = resolve(overridesDir, `${roleId}.md`);
  await writeFile(filePath, content, 'utf-8');
}

/**
 * 에이전트 오버라이드를 로드한다.
 * @param {string} roleId - 역할 ID
 * @returns {Promise<string|null>} 오버라이드 내용 (없으면 null)
 */
export async function loadAgentOverride(roleId) {
  validateRoleId(roleId);
  const filePath = resolve(overridesDir, `${roleId}.md`);
  if (!(await fileExists(filePath))) return null;
  return readFile(filePath, 'utf-8');
}

/**
 * 모든 에이전트 오버라이드 목록을 반환한다.
 * @returns {Promise<Array<{roleId: string, updatedAt: string}>>}
 */
export async function listAgentOverrides() {
  if (!(await fileExists(overridesDir))) return [];

  const files = await readdir(overridesDir);
  const results = [];

  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const roleId = file.slice(0, -3);
    const filePath = resolve(overridesDir, file);
    const fileStat = await stat(filePath);
    results.push({
      roleId,
      updatedAt: fileStat.mtime.toISOString(),
    });
  }

  return results;
}

/**
 * 에이전트 기본 .md와 오버라이드를 병합한다.
 * 오버라이드 내용은 기본 .md 뒤에 "## 오버라이드" 섹션으로 추가된다.
 * @param {string} baseMd - 기본 에이전트 .md 내용
 * @param {string} overrideMd - 오버라이드 내용
 * @returns {string} 병합된 최종 .md 텍스트
 */
export function mergeAgentWithOverride(baseMd, overrideMd) {
  if (!overrideMd) return baseMd;
  if (!baseMd) return overrideMd;

  return `${baseMd.trimEnd()}

## 오버라이드 (프로젝트 피드백 기반)

${overrideMd.trim()}`;
}
