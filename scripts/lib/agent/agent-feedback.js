/**
 * agent-feedback — 에이전트 피드백 시스템
 * 프로젝트 결과를 분석하여 에이전트 .md 수정안을 자동 제안하고,
 * 승인된 수정을 오버라이드 파일로 저장한다.
 */

import { readFile, writeFile, stat } from 'fs/promises';
import { resolve } from 'path';
import { ensureDir, fileExists, listFilesByExtension } from '../core/file-writer.js';
import { parseJsonArray } from '../core/json-parser.js';
import { validateRoleId, assertWithinRoot } from '../core/validators.js';
import { agentOverridesDir, projectsDir } from '../core/app-paths.js';
import { buildSectioned, toMarkdownList } from '../core/prompt-builder.js';

const DEFAULT_OVERRIDES_DIR = agentOverridesDir();
let overridesDir = DEFAULT_OVERRIDES_DIR;

/**
 * 테스트용 오버라이드 디렉토리를 설정한다.
 * @param {string} dir - 새 디렉토리
 */
export function setOverridesDir(dir) {
  overridesDir = dir;
}

/**
 * 프로젝트 결과에서 에이전트별 성과 데이터를 추출한다.
 * @param {object} project - 프로젝트 데이터
 * @returns {Array<{roleId: string, tasks: Array, reviews: Array, issues: Array}>}
 */
export function extractAgentPerformance(project) {
  const team = project.team || [];
  const tasks = project.tasks || [];

  const tasksByAssignee = new Map();
  for (const t of tasks) {
    if (!t.assignee) continue;
    if (!tasksByAssignee.has(t.assignee)) tasksByAssignee.set(t.assignee, []);
    tasksByAssignee.get(t.assignee).push(t);
  }

  return team.map((member) => {
    const roleId = member.roleId;

    const memberTasks = (tasksByAssignee.get(roleId) || []).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      reviewResults: t.reviews || [],
    }));

    const reviews = memberTasks.flatMap((t) => t.reviewResults);

    const issues = reviews
      .flatMap((r) => r.issues || [])
      .filter((i) => i.severity === 'critical' || i.severity === 'important');

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
  const taskList = toMarkdownList(performance.tasks, (t) => `${t.title} (${t.status})`).replace(
    '- (없음)',
    '- (담당 작업 없음)',
  );

  const issueList = toMarkdownList(
    performance.issues,
    (i) => `[${i.severity}] ${i.description}`,
  ).replace('- (없음)', '- (이슈 없음)');

  const reviewList = toMarkdownList(
    performance.reviews,
    (r) => `${r.approved ? '승인' : '수정 요청'}: ${r.feedback || ''}`,
  ).replace('- (없음)', '- (리뷰 없음)');

  const intro = `다음은 "${roleId}" 에이전트의 프로젝트 수행 결과입니다.
이 결과를 바탕으로 에이전트의 .md 파일을 어떻게 개선하면 좋을지 제안해주세요.`;

  return buildSectioned(intro, [
    { title: '현재 에이전트 설정', content: `\`\`\`markdown\n${currentAgentMd}\n\`\`\`` },
    {
      title: '프로젝트 수행 결과',
      content: `### 담당 작업\n${taskList}\n\n### 리뷰 결과\n${reviewList}\n\n### 발견된 이슈\n${issueList}`,
    },
    {
      title: '제안 형식',
      content: `반드시 아래 JSON 배열 형식으로 응답하세요:
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
- 제안은 에이전트의 행동을 직접 개선하는 것이어야 합니다`,
    },
  ]);
}

/**
 * 분석 결과 텍스트에서 수정 제안을 파싱한다.
 * @param {string} analysisText - Task tool 분석 결과 텍스트
 * @returns {Array<{section: string, current: string, suggested: string, reason: string}>}
 */
export function parseImprovementSuggestions(analysisText) {
  if (!analysisText || analysisText.trim() === '') return [];

  const parsed = parseJsonArray(analysisText);
  if (parsed.length > 0) return normalizeSuggestions(parsed);

  return [];
}

/**
 * 제안 배열을 정규화한다.
 * @param {Array} suggestions - 원본 제안 배열
 * @returns {Array<{section: string, current: string, suggested: string, reason: string}>}
 */
function normalizeSuggestions(suggestions) {
  return suggestions
    .filter((s) => s && typeof s === 'object' && s.suggested)
    .map((s) => ({
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
  const files = await listFilesByExtension(overridesDir, '.md');
  if (files.length === 0) return [];

  const results = await Promise.all(
    files.map(async (file) => {
      const roleId = file.slice(0, -3);
      const filePath = resolve(overridesDir, file);
      const fileStat = await stat(filePath);
      return { roleId, updatedAt: fileStat.mtime.toISOString() };
    }),
  );

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

/**
 * 피드백 리스트를 자동으로 오버라이드 파일에 적용한다.
 * 기존 오버라이드가 있으면 .bak으로 백업 후 덮어쓴다.
 * @param {Array<{roleId: string, feedback: string}>|null} feedbackList - 피드백 배열
 */
export async function autoApplyFeedback(feedbackList) {
  if (!feedbackList || feedbackList.length === 0) return;

  await ensureDir(overridesDir);

  await Promise.all(
    feedbackList
      .filter(({ feedback }) => feedback)
      .map(async ({ roleId, feedback }) => {
        const filePath = resolve(overridesDir, `${roleId}.md`);
        const bakPath = `${filePath}.bak`;

        if (await fileExists(filePath)) {
          const existing = await readFile(filePath, 'utf-8');
          await writeFile(bakPath, existing, 'utf-8');
        }

        await writeFile(filePath, feedback, 'utf-8');
      }),
  );
}

/**
 * 여러 프로젝트에서 동일 역할의 이슈 패턴을 집계한다.
 * 3회 이상 반복된 카테고리를 "반복 패턴"으로 추출한다.
 * @param {string} roleId - 역할 ID
 * @param {Array<object>} projects - 프로젝트 배열 (team, tasks 포함)
 * @param {number} [minRepeat=3] - 반복 패턴 최소 횟수
 * @returns {{ patterns: Array<{category: string, count: number, examples: string[]}>, totalProjects: number }}
 */
export function aggregateCrossProjectFeedback(roleId, projects, minRepeat = 3) {
  if (!roleId || !Array.isArray(projects) || projects.length === 0) {
    return { patterns: [], totalProjects: 0 };
  }

  const categoryMap = new Map();

  for (const project of projects) {
    const team = project.team || [];
    if (!team.some((m) => m.roleId === roleId)) continue;

    const tasks = (project.tasks || []).filter((t) => t.assignee === roleId);
    const issues = tasks
      .flatMap((t) => t.reviews || [])
      .flatMap((r) => r.issues || [])
      .filter((i) => i.severity === 'critical' || i.severity === 'important');

    for (const issue of issues) {
      const category = issue.category || issue.severity || 'unknown';
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { count: 0, examples: [] });
      }
      const entry = categoryMap.get(category);
      entry.count += 1;
      if (entry.examples.length < 3) {
        entry.examples.push(issue.description || '');
      }
    }
  }

  const patterns = [...categoryMap.entries()]
    .filter(([, data]) => data.count >= minRepeat)
    .map(([category, data]) => ({
      category,
      count: data.count,
      examples: data.examples,
    }))
    .sort((a, b) => b.count - a.count);

  return { patterns, totalProjects: projects.length };
}

/**
 * 크로스프로젝트 패턴을 오버라이드 마크다운으로 변환한다.
 * @param {Array<{category: string, count: number, examples: string[]}>} patterns
 * @returns {string} 마크다운 텍스트
 */
export function formatCrossProjectPatterns(patterns) {
  if (!patterns || patterns.length === 0) return '';

  let md = '### 반복 패턴 주의 (크로스프로젝트 분석)\n\n';
  md += '아래 카테고리의 이슈가 여러 프로젝트에서 반복되었습니다. 특별히 주의하세요.\n\n';

  for (const { category, count, examples } of patterns) {
    md += `- **${category}** (${count}회 반복)\n`;
    for (const ex of examples) {
      if (ex) md += `  - ${ex}\n`;
    }
  }

  return md;
}

// --- 프로젝트 레벨 오버라이드 ---

const PROJECT_OVERRIDES_SUBDIR = '.good-vibe/agent-overrides';

/**
 * 프로젝트 레벨 에이전트 오버라이드를 저장한다.
 * @param {string} projectDir - 프로젝트 디렉토리 경로
 * @param {string} roleId - 역할 ID
 * @param {string} content - 오버라이드 마크다운 내용
 */
export async function saveProjectOverride(projectDir, roleId, content) {
  validateRoleId(roleId);
  assertWithinRoot(resolve(projectDir), projectsDir(), 'projectDir');
  const dir = resolve(projectDir, PROJECT_OVERRIDES_SUBDIR);
  await ensureDir(dir);
  const filePath = resolve(dir, `${roleId}.md`);
  await writeFile(filePath, content, 'utf-8');
}

/**
 * 프로젝트 레벨 에이전트 오버라이드를 로드한다.
 * @param {string} projectDir - 프로젝트 디렉토리 경로
 * @param {string} roleId - 역할 ID
 * @returns {Promise<string|null>} 오버라이드 내용 (없으면 null)
 */
export async function loadProjectOverride(projectDir, roleId) {
  validateRoleId(roleId);
  assertWithinRoot(resolve(projectDir), projectsDir(), 'projectDir');
  const filePath = resolve(projectDir, PROJECT_OVERRIDES_SUBDIR, `${roleId}.md`);
  if (!(await fileExists(filePath))) return null;
  return readFile(filePath, 'utf-8');
}

/**
 * 프로젝트 레벨 에이전트 오버라이드 목록을 반환한다.
 * @param {string} projectDir - 프로젝트 디렉토리 경로
 * @returns {Promise<Array<{roleId: string, updatedAt: string}>>}
 */
export async function listProjectOverrides(projectDir) {
  assertWithinRoot(resolve(projectDir), projectsDir(), 'projectDir');
  const dir = resolve(projectDir, PROJECT_OVERRIDES_SUBDIR);
  const files = await listFilesByExtension(dir, '.md');
  if (files.length === 0) return [];

  const results = await Promise.all(
    files.map(async (file) => {
      const roleId = file.slice(0, -3);
      const filePath = resolve(dir, file);
      const fileStat = await stat(filePath);
      return { roleId, updatedAt: fileStat.mtime.toISOString() };
    }),
  );

  return results;
}

/**
 * 다중 소스 오버라이드를 병합한다 (user → project 순서, project가 더 높은 우선순위).
 * @param {string} baseMd - 기본 에이전트 .md 내용
 * @param {Array<{source: string, content: string}>} overrides - 오버라이드 배열
 * @returns {string} 병합된 최종 .md 텍스트
 */
export function mergeAgentWithOverrides(baseMd, overrides) {
  if (!overrides || overrides.length === 0) return baseMd || '';
  if (!baseMd) baseMd = '';

  let result = baseMd.trimEnd();

  // user 오버라이드 먼저, project 오버라이드가 나중에 (더 높은 우선순위)
  const sorted = [...overrides].sort((a, b) => {
    const order = { user: 0, project: 1 };
    return (order[a.source] ?? 0) - (order[b.source] ?? 0);
  });

  for (const override of sorted) {
    if (!override.content) continue;
    const label = override.source === 'project' ? '프로젝트' : '사용자';
    result += `\n\n## 오버라이드 (${label} 피드백 기반)\n\n${override.content.trim()}`;
  }

  return result;
}
