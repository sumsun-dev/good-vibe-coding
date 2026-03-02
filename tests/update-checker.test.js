import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return { ...actual, readFileSync: vi.fn() };
});

vi.mock('child_process', async () => {
  const actual = await vi.importActual('child_process');
  return { ...actual, execFileSync: vi.fn() };
});

import { readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { getCurrentVersion, checkForUpdates, getVersionInfo } from '../scripts/lib/update-checker.js';

describe('update-checker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCurrentVersion', () => {
    it('package.json에서 버전을 읽어야 한다', () => {
      readFileSync.mockReturnValue(JSON.stringify({ version: '1.2.3' }));
      expect(getCurrentVersion()).toBe('1.2.3');
    });
  });

  describe('checkForUpdates', () => {
    it('local != remote이면 updateAvailable: true', () => {
      execFileSync
        .mockReturnValueOnce('')
        .mockReturnValueOnce('abc123\n')
        .mockReturnValueOnce('def456\n');

      const result = checkForUpdates();
      expect(result.updateAvailable).toBe(true);
      expect(result.local).toBe('abc123');
      expect(result.remote).toBe('def456');
    });

    it('local == remote이면 updateAvailable: false', () => {
      execFileSync
        .mockReturnValueOnce('')
        .mockReturnValueOnce('abc123\n')
        .mockReturnValueOnce('abc123\n');

      const result = checkForUpdates();
      expect(result.updateAvailable).toBe(false);
    });

    it('upstream 브랜치 없으면 updateAvailable: false', () => {
      execFileSync
        .mockReturnValueOnce('')
        .mockReturnValueOnce('abc123\n')
        .mockImplementationOnce(() => { throw new Error('no upstream'); });

      const result = checkForUpdates();
      expect(result.updateAvailable).toBe(false);
      expect(result.local).toBe('abc123');
      expect(result.remote).toBeNull();
    });

    it('git fetch 실패 시 updateAvailable: false', () => {
      execFileSync.mockImplementation(() => { throw new Error('not a git repo'); });

      const result = checkForUpdates();
      expect(result.updateAvailable).toBe(false);
      expect(result.local).toBeNull();
    });
  });

  describe('getVersionInfo', () => {
    it('업데이트 없으면 instructions null', () => {
      readFileSync.mockReturnValue(JSON.stringify({ version: '1.0.0' }));
      execFileSync
        .mockReturnValueOnce('')
        .mockReturnValueOnce('abc\n')
        .mockReturnValueOnce('abc\n');

      const result = getVersionInfo();
      expect(result.version).toBe('1.0.0');
      expect(result.updateAvailable).toBe(false);
      expect(result.instructions).toBeNull();
    });

    it('업데이트 있으면 instructions 포함', () => {
      readFileSync.mockReturnValue(JSON.stringify({ version: '1.0.0' }));
      execFileSync
        .mockReturnValueOnce('')
        .mockReturnValueOnce('abc\n')
        .mockReturnValueOnce('def\n');

      const result = getVersionInfo();
      expect(result.updateAvailable).toBe(true);
      expect(result.instructions).toContain('git pull');
    });
  });
});
