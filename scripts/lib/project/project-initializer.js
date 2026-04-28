/**
 * project-initializer — 신규 프로젝트 통합 셋업.
 *
 * 폴더 scaffold + 옵션 GitHub repo 생성/push + Good Vibe 프로젝트 엔트리 생성을 한 번에 묶어
 * `/gv-init` 흐름과 SDK 양쪽에서 동일한 진입점을 제공한다. GitHub 단계는 부분 실패하더라도
 * 로컬 프로젝트는 유지하고 warnings 배열에 사유를 기록한다.
 */

import { setupProjectInfra } from './project-scaffolder.js';
import { createGithubRepo, gitInitAndPush } from './github-manager.js';
import { createProject } from './project-manager.js';
import { inputError } from '../core/validators.js';

const VALID_GITHUB = ['none', 'private', 'public'];

/**
 * 프로젝트 이름을 슬러그로 변환한다.
 * 한글/특수문자 제거 → 공백/구분자 → 하이픈 → 연속 하이픈 정규화.
 * @param {string} name - 프로젝트 이름
 * @returns {string} 슬러그 (빈 입력은 'untitled-project')
 */
export function slugifyName(name) {
  if (!name || typeof name !== 'string') return 'untitled-project';
  const slug = name
    .toLowerCase()
    .replace(/[^\u0061-\u007a\u0030-\u0039]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  // 한글/이모지/CJK 만 있는 입력은 ASCII 정제 후 빈 문자열이 되거나
  // 의미 없는 1글자만 남을 수 있어 폴백 처리.
  return slug.length >= 2 ? slug : 'untitled-project';
}

/**
 * 신규 프로젝트를 한 번에 셋업한다.
 * @param {object} opts
 * @param {string} opts.name - 프로젝트 이름 (필수)
 * @param {string} opts.targetDir - 폴더 절대 경로 (필수)
 * @param {string} [opts.type='cli-tool'] - 프로젝트 유형
 * @param {string} [opts.description] - 설명
 * @param {string} [opts.techStack] - 기술 스택 힌트 (scaffold에 전달)
 * @param {'none'|'private'|'public'} [opts.github='none'] - GitHub repo 옵션
 * @param {string} [opts.mode] - Good Vibe 모드 (plan-only/plan-execute/quick-build)
 * @returns {Promise<{projectId, project, infraPath, githubUrl, files, ci, warnings}>}
 */
export async function initProject(opts = {}) {
  const {
    name,
    type = 'cli-tool',
    description,
    targetDir,
    techStack,
    github = 'none',
    mode,
  } = opts;

  if (!name) throw inputError('name이 필요합니다');
  if (!targetDir) throw inputError('targetDir이 필요합니다');
  if (!VALID_GITHUB.includes(github)) {
    throw inputError(`github은 ${VALID_GITHUB.join(' / ')} 중 하나여야 합니다`);
  }

  const warnings = [];

  const infraResult = await setupProjectInfra({
    name,
    description,
    techStack: techStack || type,
    targetDir,
    mode,
  });

  let githubUrl = null;
  if (github === 'private' || github === 'public') {
    const repoSlug = slugifyName(name);
    // createGithubRepo / gitInitAndPush 는 execFileSync 기반 동기 함수 (github-manager.js).
    // 의도적으로 await 없음.
    const repoResult = createGithubRepo(repoSlug, {
      visibility: github,
      description,
    });
    if (repoResult.success) {
      githubUrl = repoResult.url;
      const pushResult = gitInitAndPush(infraResult.projectDir, githubUrl);
      if (!pushResult.success) {
        warnings.push(`git push 실패: ${pushResult.error || '알 수 없음'}`);
      }
    } else {
      warnings.push(`GitHub repo 생성 실패: ${repoResult.error || '알 수 없음'}`);
    }
  }

  const project = await createProject(name, type, description, {
    mode,
    infraPath: infraResult.projectDir,
    githubUrl,
  });

  return {
    projectId: project.id,
    project,
    infraPath: infraResult.projectDir,
    githubUrl,
    files: infraResult.files,
    ci: infraResult.ci,
    warnings,
  };
}
