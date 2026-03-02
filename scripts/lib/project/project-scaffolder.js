import { resolve } from 'path';
import { readFile } from 'fs/promises';
import { ensureDir, safeWriteFile, writeFiles, fileExists } from '../core/file-writer.js';
import { renderTemplate } from './template-engine.js';
import { inputError } from '../core/validators.js';

const GITIGNORE_TEMPLATES = {
  'next-js': `node_modules/
.next/
out/
.env
.env.local
.env.*.local
*.log
.DS_Store
coverage/
`,
  'react-node': `node_modules/
dist/
build/
.env
.env.local
*.log
.DS_Store
coverage/
`,
  'python-fastapi': `__pycache__/
*.py[cod]
*$py.class
.env
.venv/
venv/
*.egg-info/
dist/
build/
.coverage
htmlcov/
`,
  default: `node_modules/
dist/
.env
.env.local
*.log
.DS_Store
coverage/
`,
};

const DEFAULT_AGENTS = {
  'code-reviewer': `# Code Reviewer

코드 리뷰를 담당합니다.

## 역할
- 코드 품질 검토
- 버그 및 보안 이슈 탐지
- 개선 사항 제안

## 리뷰 기준
- 가독성, 유지보수성
- 에러 처리
- 성능
- 보안
`,
  'tdd-coach': `# TDD Coach

테스트 주도 개발을 가이드합니다.

## 역할
- 테스트 전략 수립
- 실패 테스트 먼저 작성 (RED)
- 최소 구현 (GREEN)
- 리팩토링 (REFACTOR)

## 원칙
- 테스트 없이 프로덕션 코드 금지
- 한 번에 하나의 실패 테스트
- 최소한의 코드로 통과
`,
};

/**
 * 기술 스택에 맞는 .gitignore 내용을 반환한다.
 * @param {string} techStack - 기술 스택 식별자
 * @returns {string} .gitignore 내용
 */
export function buildGitignore(techStack) {
  const key = (techStack || '').toLowerCase().replace(/\s+/g, '-');
  return GITIGNORE_TEMPLATES[key] || GITIGNORE_TEMPLATES.default;
}

/**
 * 기본 프로젝트 에이전트 파일 목록을 반환한다.
 * @param {string} techStack - 기술 스택 (현재 미사용, 확장용)
 * @returns {Array<{path: string, content: string}>} 에이전트 파일 배열
 */
export function buildProjectAgents(_techStack) {
  return Object.entries(DEFAULT_AGENTS).map(([name, content]) => ({
    path: `.claude/agents/${name}.md`,
    content,
  }));
}

/**
 * 프로젝트 CLAUDE.md를 렌더링한다.
 * @param {object} options - 프로젝트 옵션
 * @param {string} options.name - 프로젝트명
 * @param {string} options.description - 프로젝트 설명
 * @param {string} options.techStack - 기술 스택
 * @returns {Promise<string>} 렌더링된 CLAUDE.md 내용
 */
export async function buildProjectClaudeMd(options) {
  const { name, description, techStack } = options;
  return renderTemplate('project-claude-md.hbs', { name, description, techStack });
}

/**
 * 프로젝트 README.md를 렌더링한다.
 * @param {object} options - 프로젝트 옵션
 * @param {string} options.name - 프로젝트명
 * @param {string} options.description - 프로젝트 설명
 * @param {string} options.techStack - 기술 스택
 * @returns {Promise<string>} 렌더링된 README.md 내용
 */
export async function buildProjectReadme(options) {
  const { name, description, techStack } = options;
  return renderTemplate('project-readme.hbs', { name, description, techStack });
}

/**
 * 프로젝트 인프라를 생성한다.
 * 폴더, CLAUDE.md, README.md, .gitignore, .claude/agents/ 를 생성.
 * @param {object} options - 프로젝트 옵션
 * @param {string} options.name - 프로젝트명
 * @param {string} options.description - 프로젝트 설명
 * @param {string} options.techStack - 기술 스택
 * @param {string} [options.targetDir] - 대상 디렉토리 (기본: ~/projects/{name})
 * @returns {Promise<{files: Array<{path: string, written: boolean}>, projectDir: string}>}
 */
export async function setupProjectInfra(options) {
  const { name, description, techStack, targetDir } = options;

  if (!name || typeof name !== 'string') {
    throw inputError('name 필드가 필요합니다');
  }

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const projectDir = targetDir || resolve(process.env.HOME || process.env.USERPROFILE, 'projects', slug);

  await ensureDir(projectDir);

  const claudeMd = await buildProjectClaudeMd({ name, description, techStack });
  const readme = await buildProjectReadme({ name, description, techStack });
  const gitignore = buildGitignore(techStack);
  const agents = buildProjectAgents(techStack);

  const goodVibeReadme = `# .good-vibe/

이 디렉토리는 팀 공유 설정을 저장합니다.

## 구조

- \`agent-overrides/\` — 프로젝트 레벨 에이전트 오버라이드 (.md 파일)

## 사용법

에이전트 오버라이드를 프로젝트 레벨에 저장하면 팀원 모두가 동일한 설정을 공유합니다.
이 디렉토리를 git에 커밋하여 팀과 공유하세요.
`;

  const filesToWrite = [
    { path: resolve(projectDir, 'CLAUDE.md'), content: claudeMd },
    { path: resolve(projectDir, 'README.md'), content: readme },
    { path: resolve(projectDir, '.gitignore'), content: gitignore },
    { path: resolve(projectDir, '.good-vibe', 'README.md'), content: goodVibeReadme },
    ...agents.map(a => ({ path: resolve(projectDir, a.path), content: a.content })),
  ];

  const results = await writeFiles(filesToWrite);

  return {
    files: results.map(r => ({ path: r.path, written: r.written })),
    projectDir,
  };
}

/**
 * 기존 CLAUDE.md의 플레이스홀더 섹션에 내용을 추가한다.
 * <!-- {sectionName} --> 패턴을 찾아 content로 교체.
 * @param {string} claudeMdPath - CLAUDE.md 파일 경로
 * @param {string} sectionName - 섹션 이름 (예: 'architecture-placeholder')
 * @param {string} content - 추가할 내용
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function appendToClaudeMd(claudeMdPath, sectionName, content) {
  if (!(await fileExists(claudeMdPath))) {
    return { success: false, error: 'CLAUDE.md 파일을 찾을 수 없습니다' };
  }

  const existing = await readFile(claudeMdPath, 'utf-8');
  const placeholder = `<!-- ${sectionName} -->`;

  if (!existing.includes(placeholder)) {
    return { success: false, error: `플레이스홀더를 찾을 수 없습니다: ${placeholder}` };
  }

  const updated = existing.replace(placeholder, content);
  await safeWriteFile(claudeMdPath, updated, { overwrite: true, backup: true });

  return { success: true };
}
