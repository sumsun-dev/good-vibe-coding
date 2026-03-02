import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../scripts/cli-utils.js', () => ({
  readStdin: vi.fn(),
  output: vi.fn(),
}));

vi.mock('../../scripts/lib/project-scaffolder.js', () => ({
  setupProjectInfra: vi.fn(),
  appendToClaudeMd: vi.fn(),
}));

vi.mock('../../scripts/lib/github-manager.js', () => ({
  checkGhStatus: vi.fn(),
  createGithubRepo: vi.fn(),
  gitInitAndPush: vi.fn(),
}));

vi.mock('../../scripts/lib/gemini-bridge.js', () => ({
  isGeminiCliInstalled: vi.fn(),
}));

vi.mock('../../scripts/lib/env-checker.js', () => ({
  checkEnvironment: vi.fn(),
}));

vi.mock('../../scripts/lib/update-checker.js', () => ({
  getVersionInfo: vi.fn(),
}));

import { output } from '../../scripts/cli-utils.js';
import { isGeminiCliInstalled } from '../../scripts/lib/gemini-bridge.js';
import { checkEnvironment } from '../../scripts/lib/env-checker.js';
import { checkGhStatus } from '../../scripts/lib/github-manager.js';
import { getVersionInfo } from '../../scripts/lib/update-checker.js';
import { commands } from '../../scripts/handlers/infra.js';

describe('infra handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('check-gh-status', () => {
    it('gh 상태를 출력해야 한다', async () => {
      checkGhStatus.mockReturnValue({ installed: true, authenticated: true, username: 'user' });
      await commands['check-gh-status']();
      expect(output).toHaveBeenCalledWith({ installed: true, authenticated: true, username: 'user' });
    });
  });

  describe('check-gemini-status', () => {
    it('Gemini CLI 설치됨 → installed: true', async () => {
      isGeminiCliInstalled.mockReturnValue(true);
      await commands['check-gemini-status']();
      expect(output).toHaveBeenCalledWith({
        installed: true, authType: 'cli', model: 'gemini-2.0-flash',
      });
    });

    it('Gemini CLI 미설치 → installed: false', async () => {
      isGeminiCliInstalled.mockReturnValue(false);
      await commands['check-gemini-status']();
      expect(output).toHaveBeenCalledWith({
        installed: false, authType: 'cli', model: 'gemini-2.0-flash',
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
        version: '1.0.0', updateAvailable: false, instructions: null,
      });

      await commands['check-version']();
      expect(output).toHaveBeenCalledWith({
        version: '1.0.0', updateAvailable: false, instructions: null,
      });
    });

    it('업데이트 가능 시 instructions 포함', async () => {
      getVersionInfo.mockReturnValue({
        version: '1.0.0', updateAvailable: true, instructions: 'git pull',
      });

      await commands['check-version']();
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({ updateAvailable: true }),
      );
    });
  });
});
