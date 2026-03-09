import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../scripts/cli-utils.js', () => ({
  readStdin: vi.fn(),
  output: vi.fn(),
}));

vi.mock('../../scripts/lib/project/project-scaffolder.js', () => ({
  setupProjectInfra: vi.fn(),
  appendToClaudeMd: vi.fn(),
}));

vi.mock('../../scripts/lib/project/github-manager.js', () => ({
  checkGhStatus: vi.fn(),
  createGithubRepo: vi.fn(),
  gitInitAndPush: vi.fn(),
}));

vi.mock('../../scripts/lib/llm/gemini-bridge.js', () => ({
  isGeminiCliInstalled: vi.fn(),
}));

vi.mock('../../scripts/lib/output/env-checker.js', () => ({
  checkEnvironment: vi.fn(),
}));

vi.mock('../../scripts/lib/output/update-checker.js', () => ({
  getVersionInfo: vi.fn(),
}));

vi.mock('../../scripts/lib/core/settings-manager.js', () => ({
  readSettings: vi.fn(),
  addPermission: vi.fn(),
}));

vi.mock('../../scripts/lib/core/onboarding-generator.js', () => ({
  buildOnboardingData: vi.fn(),
  renderOnboardingFiles: vi.fn(),
}));

vi.mock('../../scripts/lib/core/preset-loader.js', () => ({
  loadPreset: vi.fn(),
  mergePresets: vi.fn(),
}));

vi.mock('../../scripts/lib/core/file-writer.js', () => ({
  safeWriteFile: vi.fn(),
  ensureDir: vi.fn(),
}));

import { readStdin, output } from '../../scripts/cli-utils.js';
import { isGeminiCliInstalled } from '../../scripts/lib/llm/gemini-bridge.js';
import { checkEnvironment } from '../../scripts/lib/output/env-checker.js';
import { checkGhStatus } from '../../scripts/lib/project/github-manager.js';
import { getVersionInfo } from '../../scripts/lib/output/update-checker.js';
import { readSettings, addPermission } from '../../scripts/lib/core/settings-manager.js';
import {
  buildOnboardingData,
  renderOnboardingFiles,
} from '../../scripts/lib/core/onboarding-generator.js';
import { loadPreset, mergePresets } from '../../scripts/lib/core/preset-loader.js';
import { safeWriteFile } from '../../scripts/lib/core/file-writer.js';
import { commands } from '../../scripts/handlers/infra.js';

describe('infra handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('check-gh-status', () => {
    it('gh 상태를 출력해야 한다', async () => {
      checkGhStatus.mockReturnValue({ installed: true, authenticated: true, username: 'user' });
      await commands['check-gh-status']();
      expect(output).toHaveBeenCalledWith({
        installed: true,
        authenticated: true,
        username: 'user',
      });
    });
  });

  describe('check-gemini-status', () => {
    it('Gemini CLI 설치됨 → installed: true', async () => {
      isGeminiCliInstalled.mockReturnValue(true);
      await commands['check-gemini-status']();
      expect(output).toHaveBeenCalledWith({
        installed: true,
        authType: 'cli',
        model: 'gemini-2.0-flash',
      });
    });

    it('Gemini CLI 미설치 → installed: false', async () => {
      isGeminiCliInstalled.mockReturnValue(false);
      await commands['check-gemini-status']();
      expect(output).toHaveBeenCalledWith({
        installed: false,
        authType: 'cli',
        model: 'gemini-2.0-flash',
      });
    });
  });

  describe('check-environment', () => {
    it('환경 체크 결과를 출력해야 한다', async () => {
      const mockResult = {
        node: { installed: true, version: '20.10.0', meetsMinimum: true },
        npm: { installed: true, version: '10.2.0' },
        git: { installed: true, version: '2.40.0' },
        gh: { installed: true, authenticated: true, username: 'user' },
        gemini: { installed: true },
        handlebars: { installed: true, version: '4.7.8' },
        healthy: true,
      };
      checkEnvironment.mockReturnValue(mockResult);

      await commands['check-environment']();
      expect(output).toHaveBeenCalledWith(mockResult);
    });
  });

  describe('check-version', () => {
    it('버전 정보를 출력해야 한다', async () => {
      getVersionInfo.mockReturnValue({
        version: '1.0.0',
        updateAvailable: false,
        instructions: null,
      });

      await commands['check-version']();
      expect(output).toHaveBeenCalledWith({
        version: '1.0.0',
        updateAvailable: false,
        instructions: null,
      });
    });

    it('업데이트 가능 시 instructions 포함', async () => {
      getVersionInfo.mockReturnValue({
        version: '1.0.0',
        updateAvailable: true,
        instructions: 'git pull',
      });

      await commands['check-version']();
      expect(output).toHaveBeenCalledWith(expect.objectContaining({ updateAvailable: true }));
    });
  });

  describe('read-settings', () => {
    it('설정을 읽어서 출력한다', async () => {
      readSettings.mockResolvedValue({ permissions: { allow: ['Bash(git *)'] } });

      await commands['read-settings']();

      expect(readSettings).toHaveBeenCalled();
      expect(output).toHaveBeenCalledWith({ permissions: { allow: ['Bash(git *)'] } });
    });
  });

  describe('add-permission', () => {
    it('패턴을 추가하고 결과를 출력한다', async () => {
      readStdin.mockResolvedValue({ pattern: 'Bash(node * cli.js *)' });
      addPermission.mockResolvedValue({ added: true, alreadyExists: false });

      await commands['add-permission']();

      expect(addPermission).toHaveBeenCalledWith('Bash(node * cli.js *)');
      expect(output).toHaveBeenCalledWith({ added: true, alreadyExists: false });
    });
  });

  describe('generate-onboarding', () => {
    it('roles로 온보딩 데이터를 생성한다', async () => {
      const mockPreset = { name: 'developer', displayName: '개발자' };
      readStdin.mockResolvedValue({ roles: ['developer'] });
      loadPreset.mockResolvedValue(mockPreset);
      mergePresets.mockReturnValue(mockPreset);
      buildOnboardingData.mockReturnValue({ roleName: '개발자' });
      renderOnboardingFiles.mockResolvedValue({
        claudeMd: '# Claude Code',
        coreRules: '# Core Rules',
      });

      await commands['generate-onboarding']();

      expect(loadPreset).toHaveBeenCalledWith('roles', 'developer');
      expect(mergePresets).toHaveBeenCalled();
      expect(buildOnboardingData).toHaveBeenCalled();
      expect(renderOnboardingFiles).toHaveBeenCalledWith({ roleName: '개발자' });
      expect(output).toHaveBeenCalledWith({
        claudeMd: '# Claude Code',
        coreRules: '# Core Rules',
      });
    });

    it('복수 역할 + 스택을 지원한다', async () => {
      const devPreset = { name: 'developer', displayName: '개발자' };
      const pmPreset = { name: 'pm', displayName: 'PM / 기획자' };
      const stackPreset = { name: 'nextjs-supabase', displayName: 'Next.js + Supabase' };
      const merged = { ...devPreset, stackRules: ['rule1'] };

      readStdin.mockResolvedValue({
        roles: ['developer', 'pm'],
        stack: 'nextjs-supabase',
      });
      loadPreset.mockImplementation((cat, name) => {
        if (cat === 'roles' && name === 'developer') return Promise.resolve(devPreset);
        if (cat === 'roles' && name === 'pm') return Promise.resolve(pmPreset);
        if (cat === 'stacks' && name === 'nextjs-supabase') return Promise.resolve(stackPreset);
        return Promise.resolve({});
      });
      mergePresets.mockReturnValue(merged);
      buildOnboardingData.mockReturnValue({ roleName: '개발자 + PM / 기획자' });
      renderOnboardingFiles.mockResolvedValue({
        claudeMd: '# MD',
        coreRules: '# Rules',
      });

      await commands['generate-onboarding']();

      expect(loadPreset).toHaveBeenCalledTimes(3);
      expect(output).toHaveBeenCalledWith({ claudeMd: '# MD', coreRules: '# Rules' });
    });
  });

  describe('write-onboarding', () => {
    it('CLAUDE.md와 core.md를 쓴다', async () => {
      readStdin.mockResolvedValue({
        claudeMd: '# Claude Code',
        coreRules: '# Core Rules',
      });
      safeWriteFile.mockResolvedValue({ written: true });

      await commands['write-onboarding']();

      expect(safeWriteFile).toHaveBeenCalledTimes(2);
      expect(output).toHaveBeenCalledWith(expect.objectContaining({ written: expect.any(Array) }));
    });
  });
});
