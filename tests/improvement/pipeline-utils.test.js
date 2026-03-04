import { describe, it, expect, afterEach } from 'vitest';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  retryCommand,
  shouldEmergencyStop,
  clearEmergencyStop,
} from '../../internal/lib/pipeline-utils.js';

describe('pipeline-utils', () => {
  describe('retryCommand', () => {
    it('성공하는 명령은 1회만 실행한다', () => {
      const result = retryCommand('echo hello', { maxRetries: 3 });
      expect(result).toBe('hello');
    });

    it('성공 시 stdout을 반환한다', () => {
      const result = retryCommand('echo test_output');
      expect(result).toBe('test_output');
    });

    it('최대 횟수 초과 시 에러를 throw한다', () => {
      expect(() =>
        retryCommand('git status --nonexistent-flag-xyz', { maxRetries: 1, baseDelay: 10 }),
      ).toThrow();
    });

    it('허용되지 않은 명령은 즉시 에러를 throw한다', () => {
      expect(() =>
        retryCommand('rm -rf /', { maxRetries: 1, baseDelay: 10 }),
      ).toThrow(/허용되지 않은 명령/);
    });

    it('허용된 명령 프리픽스만 실행한다', () => {
      expect(() => retryCommand('curl http://example.com')).toThrow(/허용되지 않은 명령/);
      expect(() => retryCommand('echo hello')).not.toThrow();
    });
  });

  describe('shouldEmergencyStop', () => {
    const testStopFile = join(tmpdir(), `gv-test-stop-${Date.now()}`);

    afterEach(() => {
      try {
        unlinkSync(testStopFile);
      } catch {
        // ignore
      }
    });

    it('파일이 있으면 true를 반환한다', () => {
      writeFileSync(testStopFile, 'stop');
      expect(shouldEmergencyStop(testStopFile)).toBe(true);
    });

    it('파일이 없으면 false를 반환한다', () => {
      expect(shouldEmergencyStop(testStopFile)).toBe(false);
    });
  });

  describe('clearEmergencyStop', () => {
    const testStopFile = join(tmpdir(), `gv-test-clear-${Date.now()}`);

    it('파일을 삭제한다', () => {
      writeFileSync(testStopFile, 'stop');
      clearEmergencyStop(testStopFile);
      expect(shouldEmergencyStop(testStopFile)).toBe(false);
    });

    it('파일이 없어도 에러를 throw하지 않는다', () => {
      expect(() => clearEmergencyStop(testStopFile)).not.toThrow();
    });
  });
});
