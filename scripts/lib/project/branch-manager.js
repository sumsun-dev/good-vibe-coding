/**
 * branch-manager — feature branch 생성/관리
 *
 * 실행 시작 시 feature branch를 생성하고, Phase 커밋을 해당 branch에 수행한다.
 * GitHub가 없어도 로컬 branch 기능은 동작하며, push는 graceful skip.
 */

import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * branch 이름을 생성한다 (pure).
 * @param {string} projectSlug - 프로젝트 slug
 * @param {'timestamp'|'phase'|'custom'} [strategy='timestamp'] - 네이밍 전략
 * @param {object} [context={}] - 추가 컨텍스트
 * @param {number} [context.phase] - Phase 번호 (phase 전략용)
 * @param {string} [context.customName] - 커스텀 이름 (custom 전략용)
 * @returns {string} branch 이름
 */
export function generateBranchName(projectSlug, strategy = 'timestamp', context = {}) {
  const slug = normalizeSlug(projectSlug);

  switch (strategy) {
    case 'phase':
      return `gv/${slug}-phase-${context.phase || 1}`;

    case 'custom':
      return context.customName || `gv/${slug}`;

    case 'timestamp':
    default: {
      const now = new Date();
      const ts = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
        '-',
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0'),
      ].join('');
      return `gv/${slug}-${ts}`;
    }
  }
}

/**
 * .git 디렉토리 존재 여부를 확인한다.
 * @param {string} projectDir
 * @returns {boolean}
 */
export function isGitInitialized(projectDir) {
  return existsSync(join(projectDir, '.git'));
}

/**
 * remote 설정 여부를 확인한다.
 * @param {string} projectDir
 * @returns {boolean}
 */
export function hasRemote(projectDir) {
  try {
    const output = execFileSync('git', ['remote', '-v'], {
      cwd: projectDir,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return output.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * 현재 branch를 조회한다.
 * @param {string} projectDir
 * @returns {string|null}
 */
export function getCurrentBranch(projectDir) {
  try {
    const output = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: projectDir,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return output.trim() || null;
  } catch {
    return null;
  }
}

/**
 * feature branch를 생성하고 체크아웃한다.
 * @param {string} projectDir
 * @param {object} options
 * @param {string} options.projectSlug
 * @param {string} [options.baseBranch] - 베이스 브랜치 (지정 시 먼저 체크아웃)
 * @param {'timestamp'|'phase'|'custom'} [options.strategy='timestamp']
 * @param {object} [options.context] - generateBranchName 컨텍스트
 * @returns {{success: boolean, branchName: string|null, error: string|null}}
 */
export function createFeatureBranch(projectDir, options = {}) {
  const { projectSlug, baseBranch, strategy = 'timestamp', context = {} } = options;

  if (!isGitInitialized(projectDir)) {
    return {
      success: false,
      branchName: null,
      error: 'git이 초기화되지 않았습니다. git init을 먼저 실행하세요.',
    };
  }

  const branchName = generateBranchName(projectSlug, strategy, context);
  const opts = { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' };
  const originalBranch = getCurrentBranch(projectDir);

  try {
    if (baseBranch) {
      execFileSync('git', ['checkout', baseBranch], opts);
    }
    execFileSync('git', ['checkout', '-b', branchName], opts);
    return { success: true, branchName, error: null };
  } catch (err) {
    // 실패 시 원래 branch로 복원 시도
    if (originalBranch) {
      try {
        execFileSync('git', ['checkout', originalBranch], opts);
      } catch {
        /* ignore */
      }
    }
    const message = err.stderr ? err.stderr.toString() : err.message;
    return { success: false, branchName: null, error: message };
  }
}

/**
 * 브랜치를 체크아웃한다.
 * @param {string} projectDir
 * @param {string} branchName
 * @returns {{success: boolean, error: string|null}}
 */
export function checkoutBranch(projectDir, branchName) {
  try {
    execFileSync('git', ['checkout', branchName], {
      cwd: projectDir,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return { success: true, error: null };
  } catch (err) {
    const message = err.stderr ? err.stderr.toString() : err.message;
    return { success: false, error: message };
  }
}

/**
 * 브랜치를 remote에 push한다. remote가 없으면 graceful skip.
 * @param {string} projectDir
 * @param {string} branchName
 * @returns {{success: boolean, skipped: boolean, reason: string|null, error: string|null}}
 */
export function pushBranch(projectDir, branchName) {
  if (!hasRemote(projectDir)) {
    return { success: true, skipped: true, reason: 'remote가 설정되지 않았습니다', error: null };
  }

  try {
    execFileSync('git', ['push', '-u', 'origin', branchName], {
      cwd: projectDir,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return { success: true, skipped: false, reason: null, error: null };
  } catch (err) {
    const message = err.stderr ? err.stderr.toString() : err.message;
    return { success: false, skipped: false, reason: null, error: message };
  }
}

/**
 * slug를 정규화한다 (내부 헬퍼).
 */
function normalizeSlug(raw) {
  return (raw || 'project')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
