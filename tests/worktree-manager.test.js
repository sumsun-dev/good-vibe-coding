import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rm, mkdtemp } from 'fs/promises';
import { join } from 'path';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import {
  createPhaseWorktree,
  removePhaseWorktree,
  isWorktreeSupported,
  listWorktrees,
} from '../scripts/lib/project/worktree-manager.js';

let TMP_DIR;

function initGitRepo(dir) {
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
  execSync('git commit --allow-empty -m "init"', { cwd: dir, stdio: 'pipe' });
}

describe('isWorktreeSupported', () => {
  beforeEach(async () => {
    TMP_DIR = await mkdtemp(join(tmpdir(), 'gv-wt-test-'));
  });

  afterEach(async () => {
    await rm(TMP_DIR, { recursive: true, force: true }).catch(() => {});
  });

  it('git 초기화된 디렉토리에서 true를 반환한다', async () => {
    initGitRepo(TMP_DIR);
    const result = await isWorktreeSupported(TMP_DIR);
    expect(result).toBe(true);
  });

  it('git 미초기화 디렉토리에서 false를 반환한다', async () => {
    const result = await isWorktreeSupported(TMP_DIR);
    expect(result).toBe(false);
  });

  it('존재하지 않는 디렉토리에서 false를 반환한다', async () => {
    const result = await isWorktreeSupported(join(TMP_DIR, 'nonexistent'));
    expect(result).toBe(false);
  });
});

describe('createPhaseWorktree', () => {
  beforeEach(async () => {
    TMP_DIR = await mkdtemp(join(tmpdir(), 'gv-wt-test-'));
  });

  afterEach(async () => {
    try {
      execSync('git worktree prune', { cwd: TMP_DIR, stdio: 'pipe' });
    } catch {
      /* ignore */
    }
    await rm(TMP_DIR, { recursive: true, force: true }).catch(() => {});
  });

  it('git 미초기화 시 skipped를 반환한다', async () => {
    const result = await createPhaseWorktree(TMP_DIR, { phase: 1, branchName: 'test-phase-1' });
    expect(result.skipped).toBe(true);
    expect(result.success).toBe(false);
  });

  it('성공적으로 worktree를 생성한다', async () => {
    initGitRepo(TMP_DIR);
    const result = await createPhaseWorktree(TMP_DIR, { phase: 1, branchName: 'test-phase-1' });
    expect(result.success).toBe(true);
    expect(result.worktreePath).toBeTruthy();
  });

  it('이미 존재하는 worktree는 재사용한다', async () => {
    initGitRepo(TMP_DIR);
    const first = await createPhaseWorktree(TMP_DIR, { phase: 1, branchName: 'test-phase-1' });
    expect(first.success).toBe(true);

    const second = await createPhaseWorktree(TMP_DIR, { phase: 1, branchName: 'test-phase-1' });
    expect(second.success).toBe(true);
    expect(second.worktreePath).toBe(first.worktreePath);
  });
});

describe('removePhaseWorktree', () => {
  beforeEach(async () => {
    TMP_DIR = await mkdtemp(join(tmpdir(), 'gv-wt-test-'));
  });

  afterEach(async () => {
    try {
      execSync('git worktree prune', { cwd: TMP_DIR, stdio: 'pipe' });
    } catch {
      /* ignore */
    }
    await rm(TMP_DIR, { recursive: true, force: true }).catch(() => {});
  });

  it('존재하지 않는 worktree는 skipped를 반환한다', async () => {
    initGitRepo(TMP_DIR);
    const result = await removePhaseWorktree(TMP_DIR, { phase: 99 });
    expect(result.skipped).toBe(true);
  });

  it('worktree를 삭제한다', async () => {
    initGitRepo(TMP_DIR);
    await createPhaseWorktree(TMP_DIR, { phase: 2, branchName: 'test-phase-2' });
    const result = await removePhaseWorktree(TMP_DIR, { phase: 2 });
    expect(result.success).toBe(true);
  });
});

describe('listWorktrees', () => {
  beforeEach(async () => {
    TMP_DIR = await mkdtemp(join(tmpdir(), 'gv-wt-test-'));
  });

  afterEach(async () => {
    try {
      execSync('git worktree prune', { cwd: TMP_DIR, stdio: 'pipe' });
    } catch {
      /* ignore */
    }
    await rm(TMP_DIR, { recursive: true, force: true }).catch(() => {});
  });

  it('빈 출력 시 빈 배열을 반환한다', async () => {
    const result = await listWorktrees(join(TMP_DIR, 'nonexistent'));
    expect(result).toEqual([]);
  });

  it('worktree 목록을 파싱한다', async () => {
    initGitRepo(TMP_DIR);
    await createPhaseWorktree(TMP_DIR, { phase: 1, branchName: 'wt-test-1' });
    const result = await listWorktrees(TMP_DIR);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.some((w) => w.branch && w.branch.includes('wt-test-1'))).toBe(true);
  });
});
