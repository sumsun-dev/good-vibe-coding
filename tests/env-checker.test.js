import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('child_process', async () => ({
  execFileSync: vi.fn(),
}));

vi.mock('../scripts/lib/github-manager.js', () => ({
  checkGhStatus: vi.fn(),
}));

vi.mock('../scripts/lib/gemini-bridge.js', () => ({
  isGeminiCliInstalled: vi.fn(),
}));

import { execFileSync } from 'child_process';
import { checkGhStatus } from '../scripts/lib/github-manager.js';
import { isGeminiCliInstalled } from '../scripts/lib/gemini-bridge.js';
import {
  checkCommand,
  checkNodeVersion,
  compareVersions,
  checkEnvironment,
} from '../scripts/lib/env-checker.js';

describe('env-checker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkCommand', () => {
    it('설치된 커맨드의 버전을 반환해야 한다', () => {
      execFileSync.mockReturnValue('v20.10.0\n');
      const result = checkCommand('node', ['--version']);
      expect(result.installed).toBe(true);
      expect(result.version).toBe('20.10.0');
    });

    it('버전 패턴이 없으면 원본 출력을 반환해야 한다', () => {
      execFileSync.mockReturnValue('some-output\n');
      const result = checkCommand('mycmd');
      expect(result.installed).toBe(true);
      expect(result.version).toBe('some-output');
    });

    it('없는 커맨드는 installed: false', () => {
      execFileSync.mockImplementation(() => { throw new Error('not found'); });
      const result = checkCommand('nonexistent');
      expect(result.installed).toBe(false);
      expect(result.version).toBeNull();
    });
  });

  describe('compareVersions', () => {
    it('같은 버전은 0', () => {
      expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    });

    it('a > b이면 1', () => {
      expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
    });

    it('a < b이면 -1', () => {
      expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
    });

    it('길이가 다른 버전도 비교 가능', () => {
      expect(compareVersions('1.2', '1.2.0')).toBe(0);
      expect(compareVersions('1.2.1', '1.2')).toBe(1);
    });

    it('패치 버전 비교', () => {
      expect(compareVersions('18.0.0', '18.0.0')).toBe(0);
      expect(compareVersions('20.10.0', '18.0.0')).toBe(1);
      expect(compareVersions('16.0.0', '18.0.0')).toBe(-1);
    });
  });

  describe('checkNodeVersion', () => {
    it('Node 20이면 meetsMinimum: true (기본 18+)', () => {
      execFileSync.mockReturnValue('v20.10.0\n');
      const result = checkNodeVersion('18.0.0');
      expect(result.installed).toBe(true);
      expect(result.version).toBe('20.10.0');
      expect(result.meetsMinimum).toBe(true);
    });

    it('Node 16이면 meetsMinimum: false (기본 18+)', () => {
      execFileSync.mockReturnValue('v16.0.0\n');
      const result = checkNodeVersion('18.0.0');
      expect(result.installed).toBe(true);
      expect(result.meetsMinimum).toBe(false);
    });

    it('Node 미설치 시 전부 false', () => {
      execFileSync.mockImplementation(() => { throw new Error(); });
      const result = checkNodeVersion();
      expect(result.installed).toBe(false);
      expect(result.meetsMinimum).toBe(false);
    });

    it('minVersion 생략 시 기본값 18.0.0', () => {
      execFileSync.mockReturnValue('v18.0.0\n');
      const result = checkNodeVersion();
      expect(result.meetsMinimum).toBe(true);
    });
  });

  describe('checkEnvironment', () => {
    it('node 18+, npm, git 있으면 healthy: true', () => {
      execFileSync
        .mockReturnValueOnce('v20.10.0\n')          // node --version
        .mockReturnValueOnce('10.2.0\n')             // npm --version
        .mockReturnValueOnce('git version 2.40.0\n') // git --version
        .mockReturnValueOnce('4.7.8\n');             // handlebars version

      checkGhStatus.mockReturnValue({ installed: true, authenticated: true, username: 'user' });
      isGeminiCliInstalled.mockReturnValue(true);

      const result = checkEnvironment();
      expect(result.healthy).toBe(true);
      expect(result.node.meetsMinimum).toBe(true);
      expect(result.npm.installed).toBe(true);
      expect(result.git.installed).toBe(true);
      expect(result.gh.installed).toBe(true);
      expect(result.gemini.installed).toBe(true);
      expect(result.handlebars.installed).toBe(true);
    });

    it('node가 오래되면 healthy: false', () => {
      execFileSync
        .mockReturnValueOnce('v16.0.0\n')
        .mockReturnValueOnce('8.0.0\n')
        .mockReturnValueOnce('git version 2.40.0\n')
        .mockReturnValueOnce('4.7.8\n');

      checkGhStatus.mockReturnValue({ installed: false, authenticated: false, username: null });
      isGeminiCliInstalled.mockReturnValue(false);

      const result = checkEnvironment();
      expect(result.healthy).toBe(false);
      expect(result.node.meetsMinimum).toBe(false);
    });

    it('gh/gemini 없어도 healthy 가능 (선택 도구)', () => {
      execFileSync
        .mockReturnValueOnce('v20.0.0\n')
        .mockReturnValueOnce('10.0.0\n')
        .mockReturnValueOnce('git version 2.40.0\n')
        .mockImplementationOnce(() => { throw new Error(); }); // handlebars 없음

      checkGhStatus.mockReturnValue({ installed: false, authenticated: false, username: null });
      isGeminiCliInstalled.mockReturnValue(false);

      const result = checkEnvironment();
      expect(result.healthy).toBe(true);
      expect(result.gh.installed).toBe(false);
      expect(result.gemini.installed).toBe(false);
      expect(result.handlebars.installed).toBe(false);
    });
  });
});
