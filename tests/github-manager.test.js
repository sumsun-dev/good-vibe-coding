import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkGhStatus, createGithubRepo, gitInitAndPush, commitPhase, MINIMAL_GITIGNORE } from '../scripts/lib/github-manager.js';
import { execFileSync } from 'child_process';
import { existsSync, writeFileSync } from 'fs';

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

describe('github-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkGhStatus', () => {
    it('gh가 설치되고 인증된 경우 정보를 반환한다', () => {
      execFileSync
        .mockReturnValueOnce(Buffer.from('/usr/local/bin/gh'))
        .mockReturnValueOnce('Logged in to github.com account testuser');

      const result = checkGhStatus();
      expect(result.installed).toBe(true);
      expect(result.authenticated).toBe(true);
      expect(result.username).toBe('testuser');
    });

    it('gh가 미설치된 경우를 처리한다', () => {
      execFileSync.mockImplementationOnce(() => {
        throw new Error('not found');
      });

      const result = checkGhStatus();
      expect(result.installed).toBe(false);
      expect(result.authenticated).toBe(false);
      expect(result.username).toBeNull();
    });

    it('gh가 설치됐지만 미인증인 경우를 처리한다', () => {
      execFileSync
        .mockReturnValueOnce(Buffer.from('/usr/local/bin/gh'))
        .mockImplementationOnce(() => {
          const err = new Error('not logged in');
          err.stderr = Buffer.from('You are not logged in');
          throw err;
        });

      const result = checkGhStatus();
      expect(result.installed).toBe(true);
      expect(result.authenticated).toBe(false);
      expect(result.username).toBeNull();
    });

    it('stderr에서 인증 정보를 파싱한다', () => {
      execFileSync
        .mockReturnValueOnce(Buffer.from('/usr/local/bin/gh'))
        .mockImplementationOnce(() => {
          const err = new Error('');
          err.stderr = Buffer.from('Logged in to github.com account stderrUser');
          throw err;
        });

      const result = checkGhStatus();
      expect(result.installed).toBe(true);
      expect(result.authenticated).toBe(true);
      expect(result.username).toBe('stderrUser');
    });
  });

  describe('createGithubRepo', () => {
    it('public 저장소를 생성한다', () => {
      execFileSync.mockReturnValueOnce('https://github.com/user/my-repo');

      const result = createGithubRepo('my-repo', { visibility: 'public' });
      expect(result.success).toBe(true);
      expect(result.url).toBe('https://github.com/user/my-repo');

      expect(execFileSync).toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining(['--public']),
        expect.any(Object)
      );
    });

    it('private 저장소를 기본으로 생성한다', () => {
      execFileSync.mockReturnValueOnce('https://github.com/user/my-repo');

      createGithubRepo('my-repo');
      expect(execFileSync).toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining(['--private']),
        expect.any(Object)
      );
    });

    it('설명을 포함하여 생성한다', () => {
      execFileSync.mockReturnValueOnce('https://github.com/user/my-repo');

      createGithubRepo('my-repo', { description: 'A test repo' });
      expect(execFileSync).toHaveBeenCalledWith(
        'gh',
        expect.arrayContaining(['--description', 'A test repo']),
        expect.any(Object)
      );
    });

    it('repoName이 없으면 에러를 반환한다', () => {
      const result = createGithubRepo('');
      expect(result.success).toBe(false);
      expect(result.error).toContain('repoName이 필요합니다');
    });

    it('gh 명령 실패 시 에러를 반환한다', () => {
      execFileSync.mockImplementationOnce(() => {
        const err = new Error('failed');
        err.stderr = Buffer.from('Repository already exists');
        throw err;
      });

      const result = createGithubRepo('existing-repo');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Repository already exists');
    });
  });

  describe('gitInitAndPush', () => {
    it('git init부터 push까지 순서대로 실행한다', () => {
      execFileSync.mockReturnValue('');

      const result = gitInitAndPush('/tmp/my-project', 'https://github.com/user/repo.git');
      expect(result.success).toBe(true);

      const calls = execFileSync.mock.calls.map(c => [c[0], c[1]]);
      expect(calls).toEqual([
        ['git', ['init']],
        ['git', ['add', '.']],
        ['git', ['commit', '-m', 'Initial commit']],
        ['git', ['remote', 'add', 'origin', 'https://github.com/user/repo.git']],
        ['git', ['push', '-u', 'origin', 'main']],
      ]);

      expect(execFileSync.mock.calls[0][2].cwd).toBe('/tmp/my-project');
    });

    it('projectDir이 없으면 에러를 반환한다', () => {
      const result = gitInitAndPush('', 'https://github.com/user/repo.git');
      expect(result.success).toBe(false);
      expect(result.error).toContain('projectDir이 필요합니다');
    });

    it('remoteUrl이 없으면 에러를 반환한다', () => {
      const result = gitInitAndPush('/tmp/proj', '');
      expect(result.success).toBe(false);
      expect(result.error).toContain('remoteUrl이 필요합니다');
    });

    it('git 명령 실패 시 에러를 반환한다', () => {
      execFileSync.mockImplementationOnce(() => {
        const err = new Error('git failed');
        err.stderr = Buffer.from('fatal: not a git repository');
        throw err;
      });

      const result = gitInitAndPush('/tmp/fail', 'https://github.com/user/repo.git');
      expect(result.success).toBe(false);
      expect(result.error).toContain('fatal');
    });
  });

  describe('commitPhase', () => {
    it('.gitignore가 없으면 자동 생성 후 커밋한다', () => {
      existsSync.mockReturnValue(false);
      execFileSync.mockReturnValue('');

      const result = commitPhase('/tmp/project', 1);

      expect(result.success).toBe(true);
      expect(writeFileSync).toHaveBeenCalledWith(
        '/tmp/project/.gitignore',
        MINIMAL_GITIGNORE,
        'utf-8'
      );
      expect(execFileSync).toHaveBeenCalledWith('git', ['add', '-A'], expect.any(Object));
      expect(execFileSync).toHaveBeenCalledWith(
        'git', ['commit', '-m', 'Phase 1 완료', '--allow-empty'], expect.any(Object)
      );
    });

    it('.gitignore가 이미 있으면 건드리지 않는다', () => {
      existsSync.mockReturnValue(true);
      execFileSync.mockReturnValue('');

      const result = commitPhase('/tmp/project', 2);

      expect(result.success).toBe(true);
      expect(writeFileSync).not.toHaveBeenCalled();
    });

    it('MINIMAL_GITIGNORE에 .env와 node_modules가 포함되어 있다', () => {
      expect(MINIMAL_GITIGNORE).toContain('.env');
      expect(MINIMAL_GITIGNORE).toContain('node_modules/');
      expect(MINIMAL_GITIGNORE).toContain('*.pem');
      expect(MINIMAL_GITIGNORE).toContain('*.key');
    });

    it('커스텀 커밋 메시지를 사용한다', () => {
      existsSync.mockReturnValue(true);
      execFileSync.mockReturnValue('');

      commitPhase('/tmp/project', 1, 'Phase 1: API 구현');

      expect(execFileSync).toHaveBeenCalledWith(
        'git', ['commit', '-m', 'Phase 1: API 구현', '--allow-empty'], expect.any(Object)
      );
    });

    it('projectDir이 없으면 에러를 반환한다', () => {
      const result = commitPhase('', 1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('projectDir이 필요합니다');
    });

    it('phase가 없으면 에러를 반환한다', () => {
      const result = commitPhase('/tmp/project');
      expect(result.success).toBe(false);
      expect(result.error).toContain('phase가 필요합니다');
    });

    it('git 명령 실패 시 에러를 반환한다', () => {
      existsSync.mockReturnValue(true);
      execFileSync.mockImplementationOnce(() => {
        const err = new Error('git failed');
        err.stderr = Buffer.from('fatal: not a git repository');
        throw err;
      });

      const result = commitPhase('/tmp/fail', 1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('fatal');
    });
  });
});
