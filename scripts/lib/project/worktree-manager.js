/**
 * worktree-manager — git worktree 기반 격리 작업 공간 관리
 * Phase별 독립 worktree를 생성/삭제하여 코드 충돌을 방지한다.
 * opt-in (config.github.worktreeIsolation), 모든 함수 graceful degradation.
 */

import { execFileSync } from 'child_process';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { rm } from 'fs/promises';

const WORKTREE_DIR = '.gv-worktrees';

/**
 * git worktree가 지원되는 환경인지 확인한다.
 * @param {string} projectDir - 프로젝트 디렉토리
 * @returns {Promise<boolean>}
 */
export async function isWorktreeSupported(projectDir) {
  try {
    execFileSync('git', ['worktree', 'list'], {
      cwd: projectDir,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Phase별 worktree를 생성한다.
 * @param {string} projectDir - 프로젝트 디렉토리
 * @param {object} options
 * @param {number} options.phase - Phase 번호
 * @param {string} options.branchName - 브랜치 이름
 * @returns {Promise<{success: boolean, worktreePath?: string, error?: string, skipped?: boolean}>}
 */
export async function createPhaseWorktree(projectDir, { phase, branchName }) {
  const supported = await isWorktreeSupported(projectDir);
  if (!supported) {
    return { success: false, skipped: true, error: 'git worktree not supported' };
  }

  const worktreePath = resolve(projectDir, WORKTREE_DIR, `phase-${phase}`);

  // 이미 존재하면 재사용
  if (existsSync(worktreePath)) {
    return { success: true, worktreePath };
  }

  try {
    execFileSync('git', ['worktree', 'add', '-b', branchName, worktreePath], {
      cwd: projectDir,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return { success: true, worktreePath };
  } catch {
    // 브랜치가 이미 존재하면 -b 없이 재시도
    try {
      execFileSync('git', ['worktree', 'add', worktreePath, branchName], {
        cwd: projectDir,
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      return { success: true, worktreePath };
    } catch (retryErr) {
      return { success: false, error: retryErr.message };
    }
  }
}

/**
 * Phase worktree를 삭제한다.
 * @param {string} projectDir - 프로젝트 디렉토리
 * @param {object} options
 * @param {number} options.phase - Phase 번호
 * @param {boolean} [options.merge=false] - 삭제 전 메인 브랜치에 머지
 * @returns {Promise<{success: boolean, error?: string, skipped?: boolean}>}
 */
export async function removePhaseWorktree(projectDir, { phase, merge = false }) {
  const worktreePath = resolve(projectDir, WORKTREE_DIR, `phase-${phase}`);

  if (!existsSync(worktreePath)) {
    return { success: false, skipped: true };
  }

  try {
    let mergeSkipped = false;
    let mergeError = null;
    if (merge) {
      // worktree의 브랜치를 현재 브랜치에 머지
      const worktrees = await listWorktrees(projectDir);
      const wt = worktrees.find((w) => w.worktree === worktreePath);
      if (wt && wt.branch) {
        const branchName = wt.branch.replace('refs/heads/', '');
        try {
          execFileSync('git', ['merge', '--no-edit', branchName], {
            cwd: projectDir,
            stdio: 'pipe',
            encoding: 'utf-8',
          });
        } catch (err) {
          mergeSkipped = true;
          mergeError = err.message;
        }
      }
    }

    // worktree 삭제
    execFileSync('git', ['worktree', 'remove', worktreePath, '--force'], {
      cwd: projectDir,
      stdio: 'pipe',
      encoding: 'utf-8',
    });
    return { success: true, mergeSkipped, mergeError };
  } catch {
    // fallback: 디렉토리 직접 삭제 + prune
    try {
      await rm(worktreePath, { recursive: true, force: true });
      execFileSync('git', ['worktree', 'prune'], {
        cwd: projectDir,
        stdio: 'pipe',
        encoding: 'utf-8',
      });
      return { success: true };
    } catch (cleanupErr) {
      return { success: false, error: cleanupErr.message };
    }
  }
}

/**
 * 프로젝트의 worktree 목록을 반환한다.
 * @param {string} projectDir - 프로젝트 디렉토리
 * @returns {Promise<Array<{worktree: string, branch: string}>>}
 */
export async function listWorktrees(projectDir) {
  try {
    const output = execFileSync('git', ['worktree', 'list', '--porcelain'], {
      cwd: projectDir,
      stdio: 'pipe',
      encoding: 'utf-8',
    });

    if (!output.trim()) return [];

    const entries = output.split('\n\n').filter((e) => e.trim());
    return entries.map((entry) => {
      const lines = entry.trim().split('\n');
      const worktreeLine = lines.find((l) => l.startsWith('worktree '));
      const branchLine = lines.find((l) => l.startsWith('branch '));
      return {
        worktree: worktreeLine ? worktreeLine.replace('worktree ', '') : '',
        branch: branchLine ? branchLine.replace('branch ', '') : '',
      };
    });
  } catch {
    return [];
  }
}
