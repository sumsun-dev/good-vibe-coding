import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateBranchName,
  createFeatureBranch,
  getCurrentBranch,
  checkoutBranch,
  pushBranch,
  isGitInitialized,
  hasRemote,
} from '../scripts/lib/project/branch-manager.js';
import { execFileSync } from 'child_process';
import { existsSync } from 'fs';

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

describe('branch-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateBranchName', () => {
    it('timestamp 전략: gv/{slug}-{날짜} 형식을 생성한다', () => {
      const name = generateBranchName('my-project', 'timestamp');
      expect(name).toMatch(/^gv\/my-project-\d{8}-\d{4}$/);
    });

    it('phase 전략: gv/{slug}-phase-{N} 형식을 생성한다', () => {
      const name = generateBranchName('my-project', 'phase', { phase: 2 });
      expect(name).toBe('gv/my-project-phase-2');
    });

    it('custom 전략: 사용자 지정 이름을 사용한다', () => {
      const name = generateBranchName('ignored', 'custom', { customName: 'feature/auth' });
      expect(name).toBe('feature/auth');
    });

    it('기본값은 timestamp 전략이다', () => {
      const name = generateBranchName('test');
      expect(name).toMatch(/^gv\/test-\d{8}-\d{4}$/);
    });

    it('slug를 정규화한다 (공백, 특수문자 제거)', () => {
      const name = generateBranchName('My Project!!', 'phase', { phase: 1 });
      expect(name).toBe('gv/my-project-phase-1');
    });
  });

  describe('isGitInitialized', () => {
    it('.git 디렉토리가 있으면 true를 반환한다', () => {
      existsSync.mockReturnValue(true);
      expect(isGitInitialized('/tmp/proj')).toBe(true);
    });

    it('.git 디렉토리가 없으면 false를 반환한다', () => {
      existsSync.mockReturnValue(false);
      expect(isGitInitialized('/tmp/proj')).toBe(false);
    });
  });

  describe('hasRemote', () => {
    it('remote가 있으면 true를 반환한다', () => {
      execFileSync.mockReturnValue('origin\thttps://github.com/user/repo.git (fetch)\n');
      expect(hasRemote('/tmp/proj')).toBe(true);
    });

    it('remote가 없으면 false를 반환한다', () => {
      execFileSync.mockReturnValue('');
      expect(hasRemote('/tmp/proj')).toBe(false);
    });

    it('git 명령 실패 시 false를 반환한다', () => {
      execFileSync.mockImplementation(() => {
        throw new Error('not a repo');
      });
      expect(hasRemote('/tmp/proj')).toBe(false);
    });
  });

  describe('getCurrentBranch', () => {
    it('현재 브랜치명을 반환한다', () => {
      execFileSync.mockReturnValue('main\n');
      expect(getCurrentBranch('/tmp/proj')).toBe('main');
    });

    it('git 실패 시 null을 반환한다', () => {
      execFileSync.mockImplementation(() => {
        throw new Error('fail');
      });
      expect(getCurrentBranch('/tmp/proj')).toBeNull();
    });
  });

  describe('createFeatureBranch', () => {
    it('feature branch를 생성하고 체크아웃한다', () => {
      existsSync.mockReturnValue(true); // .git exists
      execFileSync.mockReturnValue('');

      const result = createFeatureBranch('/tmp/proj', {
        projectSlug: 'my-app',
        strategy: 'phase',
        context: { phase: 1 },
      });

      expect(result.success).toBe(true);
      expect(result.branchName).toBe('gv/my-app-phase-1');
      expect(execFileSync).toHaveBeenCalledWith(
        'git',
        ['checkout', '-b', 'gv/my-app-phase-1'],
        expect.objectContaining({ cwd: '/tmp/proj' }),
      );
    });

    it('git 미초기화 시 에러를 반환한다', () => {
      existsSync.mockReturnValue(false);

      const result = createFeatureBranch('/tmp/proj', { projectSlug: 'x' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('git');
    });

    it('baseBranch를 지정할 수 있다', () => {
      existsSync.mockReturnValue(true);
      execFileSync.mockReturnValue('');

      createFeatureBranch('/tmp/proj', {
        projectSlug: 'app',
        baseBranch: 'develop',
        strategy: 'phase',
        context: { phase: 1 },
      });

      // checkout baseBranch first, then create new branch
      const calls = execFileSync.mock.calls.map((c) => c[1]);
      expect(calls[0]).toEqual(['checkout', 'develop']);
      expect(calls[1]).toEqual(['checkout', '-b', 'gv/app-phase-1']);
    });
  });

  describe('checkoutBranch', () => {
    it('브랜치를 체크아웃한다', () => {
      execFileSync.mockReturnValue('');
      const result = checkoutBranch('/tmp/proj', 'feature/test');
      expect(result.success).toBe(true);
      expect(execFileSync).toHaveBeenCalledWith(
        'git',
        ['checkout', 'feature/test'],
        expect.objectContaining({ cwd: '/tmp/proj' }),
      );
    });

    it('실패 시 에러를 반환한다', () => {
      execFileSync.mockImplementation(() => {
        throw new Error('no such branch');
      });
      const result = checkoutBranch('/tmp/proj', 'nonexistent');
      expect(result.success).toBe(false);
    });
  });

  describe('pushBranch', () => {
    it('remote가 있으면 push한다', () => {
      execFileSync
        .mockReturnValueOnce('origin\thttps://github.com/user/repo.git (fetch)\n') // hasRemote
        .mockReturnValueOnce(''); // push

      const result = pushBranch('/tmp/proj', 'gv/my-branch');
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(false);
    });

    it('remote가 없으면 skipped를 반환한다', () => {
      execFileSync.mockReturnValueOnce(''); // hasRemote → no remote

      const result = pushBranch('/tmp/proj', 'gv/my-branch');
      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toContain('remote');
    });

    it('push 실패 시 에러를 반환한다', () => {
      execFileSync
        .mockReturnValueOnce('origin\thttps://github.com/user/repo.git (fetch)\n')
        .mockImplementationOnce(() => {
          throw new Error('push failed');
        });

      const result = pushBranch('/tmp/proj', 'gv/branch');
      expect(result.success).toBe(false);
    });
  });
});
