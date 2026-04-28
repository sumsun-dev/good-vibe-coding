/**
 * project-initializer — 통합 셋업 (folder + optional GitHub + Good Vibe project entry).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../scripts/lib/project/project-scaffolder.js', () => ({
  setupProjectInfra: vi.fn(),
  appendToClaudeMd: vi.fn(),
}));

vi.mock('../scripts/lib/project/github-manager.js', () => ({
  createGithubRepo: vi.fn(),
  gitInitAndPush: vi.fn(),
  checkGhStatus: vi.fn(),
}));

vi.mock('../scripts/lib/project/project-manager.js', () => ({
  createProject: vi.fn(),
}));

import { setupProjectInfra } from '../scripts/lib/project/project-scaffolder.js';
import { createGithubRepo, gitInitAndPush } from '../scripts/lib/project/github-manager.js';
import { createProject } from '../scripts/lib/project/project-manager.js';
import { initProject, slugifyName } from '../scripts/lib/project/project-initializer.js';

describe('slugifyName', () => {
  it('한글 + 영어 혼합을 슬러그로 변환 (한글은 제거됨)', () => {
    expect(slugifyName('GitHub AI 트렌딩 봇')).toBe('github-ai');
  });

  it('영어 카멜케이스 + 공백', () => {
    expect(slugifyName('My Cool Project')).toBe('my-cool-project');
  });

  it('빈 문자열 → 기본값 반환', () => {
    expect(slugifyName('')).toBe('untitled-project');
  });

  it('특수문자 제거', () => {
    expect(slugifyName('test/proj@v1!')).toBe('test-proj-v1');
  });

  it('연속 하이픈 정규화', () => {
    expect(slugifyName('a -- b')).toBe('a-b');
  });

  it('한글/이모지만 있어 정제 후 짧으면 폴백', () => {
    expect(slugifyName('🎯')).toBe('untitled-project');
    expect(slugifyName('한글')).toBe('untitled-project');
    expect(slugifyName('a')).toBe('untitled-project');
  });
});

describe('initProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupProjectInfra.mockResolvedValue({
      files: [{ path: '/proj/package.json', written: true }],
      projectDir: '/proj',
      ci: null,
    });
    createProject.mockResolvedValue({
      id: 'proj-123',
      name: 'Test Project',
      type: 'cli-tool',
      status: 'planning',
    });
    createGithubRepo.mockReturnValue({
      success: true,
      url: 'https://github.com/me/test-project',
      error: null,
    });
    gitInitAndPush.mockReturnValue({ success: true, error: null });
  });

  it('GitHub 없이 로컬만 셋업', async () => {
    const result = await initProject({
      name: 'Test Project',
      type: 'cli-tool',
      description: 'desc',
      targetDir: '/proj',
      github: 'none',
    });
    expect(setupProjectInfra).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Test Project', targetDir: '/proj' }),
    );
    expect(createGithubRepo).not.toHaveBeenCalled();
    expect(gitInitAndPush).not.toHaveBeenCalled();
    expect(createProject).toHaveBeenCalledWith(
      'Test Project',
      'cli-tool',
      'desc',
      expect.objectContaining({ infraPath: '/proj', githubUrl: null }),
    );
    expect(result.githubUrl).toBeNull();
    expect(result.projectId).toBe('proj-123');
    expect(result.infraPath).toBe('/proj');
  });

  it('GitHub private 옵션 → repo 생성 + push 진행', async () => {
    const result = await initProject({
      name: 'Test Project',
      type: 'cli-tool',
      description: 'desc',
      targetDir: '/proj',
      github: 'private',
    });
    expect(createGithubRepo).toHaveBeenCalledWith(
      'test-project',
      expect.objectContaining({ visibility: 'private', description: 'desc' }),
    );
    expect(gitInitAndPush).toHaveBeenCalledWith('/proj', 'https://github.com/me/test-project');
    expect(result.githubUrl).toBe('https://github.com/me/test-project');
  });

  it('GitHub public 옵션 → visibility=public 전달', async () => {
    await initProject({
      name: 'Public Project',
      type: 'cli-tool',
      targetDir: '/proj',
      github: 'public',
    });
    expect(createGithubRepo).toHaveBeenCalledWith(
      'public-project',
      expect.objectContaining({ visibility: 'public' }),
    );
  });

  it('GitHub repo 생성 실패 → 로컬은 유지하고 githubUrl=null + warning 포함', async () => {
    createGithubRepo.mockReturnValue({
      success: false,
      url: null,
      error: 'name already exists',
    });
    const result = await initProject({
      name: 'Test Project',
      targetDir: '/proj',
      github: 'private',
    });
    expect(result.githubUrl).toBeNull();
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringMatching(/GitHub repo 생성 실패/)]),
    );
    expect(createProject).toHaveBeenCalled(); // 프로젝트는 여전히 생성
    expect(gitInitAndPush).not.toHaveBeenCalled();
  });

  it('git push 실패 → repo URL은 유지 + push 실패 warning', async () => {
    gitInitAndPush.mockReturnValue({ success: false, error: 'permission denied' });
    const result = await initProject({
      name: 'Test Project',
      targetDir: '/proj',
      github: 'private',
    });
    expect(result.githubUrl).toBe('https://github.com/me/test-project');
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringMatching(/git push 실패/)]),
    );
  });

  it('필수 필드 누락 → throw', async () => {
    await expect(initProject({ targetDir: '/proj' })).rejects.toThrow(/name/);
    await expect(initProject({ name: 'X' })).rejects.toThrow(/targetDir/);
  });

  it('잘못된 github 옵션 → throw', async () => {
    await expect(initProject({ name: 'X', targetDir: '/proj', github: 'invalid' })).rejects.toThrow(
      /github/,
    );
  });

  it('type 기본값 = "cli-tool"', async () => {
    await initProject({ name: 'X', targetDir: '/proj' });
    expect(createProject).toHaveBeenCalledWith('X', 'cli-tool', undefined, expect.any(Object));
  });
});
