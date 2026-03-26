import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../scripts/cli-utils.js', () => ({
  readStdin: vi.fn(),
  output: vi.fn(),
}));

vi.mock('../../scripts/lib/engine/code-materializer.js', () => ({
  materializeCode: vi.fn(),
  materializeBatch: vi.fn(),
  extractMaterializableBlocks: vi.fn(),
}));

vi.mock('../../scripts/lib/engine/execution-verifier.js', () => ({
  verifyAndMaterialize: vi.fn(),
}));

vi.mock('../../scripts/lib/project/github-manager.js', () => ({
  commitPhase: vi.fn(),
  commitPhaseEnhanced: vi.fn(),
}));

import { readStdin, output } from '../../scripts/cli-utils.js';
import {
  materializeCode,
  extractMaterializableBlocks,
} from '../../scripts/lib/engine/code-materializer.js';
import { verifyAndMaterialize } from '../../scripts/lib/engine/execution-verifier.js';
import { commitPhase, commitPhaseEnhanced } from '../../scripts/lib/project/github-manager.js';
import { commands } from '../../scripts/handlers/build.js';

describe('build handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('materialize-code', () => {
    it('코드 구체화 결과를 출력해야 한다', async () => {
      const result = { totalBlocks: 2, materializedCount: 2 };
      readStdin.mockResolvedValue({
        taskOutput: '```js\nconsole.log("hi")\n```',
        projectDir: '/tmp/p',
      });
      materializeCode.mockResolvedValue(result);

      await commands['materialize-code']();
      expect(materializeCode).toHaveBeenCalledWith('```js\nconsole.log("hi")\n```', '/tmp/p', {});
      expect(output).toHaveBeenCalledWith(result);
    });
  });

  describe('verify-and-materialize', () => {
    it('빌드 검증 후 구체화 결과를 출력해야 한다', async () => {
      const result = { verified: true, materializedCount: 1 };
      readStdin.mockResolvedValue({ taskOutput: 'code', task: { id: 't1' }, projectDir: '/tmp/p' });
      verifyAndMaterialize.mockResolvedValue(result);

      await commands['verify-and-materialize']();
      expect(verifyAndMaterialize).toHaveBeenCalledWith('code', { id: 't1' }, '/tmp/p', {});
      expect(output).toHaveBeenCalledWith(result);
    });
  });

  describe('extract-materializable-blocks', () => {
    it('마크다운에서 코드 블록을 추출해야 한다', async () => {
      const blocks = [{ filename: 'app.js', content: 'code' }];
      readStdin.mockResolvedValue({ taskOutput: '```js app.js\ncode\n```' });
      extractMaterializableBlocks.mockReturnValue(blocks);

      await commands['extract-materializable-blocks']();
      expect(output).toHaveBeenCalledWith({ blocks });
    });
  });

  describe('commit-phase', () => {
    it('페이즈 커밋 결과를 출력해야 한다', async () => {
      const result = { committed: true, hash: 'abc123' };
      readStdin.mockResolvedValue({ projectDir: '/tmp/p', phase: 'phase-1', message: 'init' });
      commitPhase.mockReturnValue(result);

      await commands['commit-phase']();
      expect(commitPhase).toHaveBeenCalledWith('/tmp/p', 'phase-1', 'init');
      expect(output).toHaveBeenCalledWith(result);
    });
  });

  describe('commit-phase-enhanced', () => {
    it('강화 커밋 결과를 출력해야 한다', async () => {
      const result = { committed: true };
      readStdin.mockResolvedValue({
        projectDir: '/tmp/p',
        phase: 1,
        tasks: [],
        project: { name: 'test' },
        team: [],
      });
      commitPhaseEnhanced.mockReturnValue(result);

      await commands['commit-phase-enhanced']();
      expect(output).toHaveBeenCalledWith(result);
    });
  });

  describe('requireFields 검증 (#15)', () => {
    it('materialize-code: taskOutput 누락 시 INPUT_ERROR', async () => {
      readStdin.mockResolvedValue({ projectDir: '/tmp/p' });
      await expect(commands['materialize-code']()).rejects.toThrow('taskOutput');
    });

    it('materialize-code: projectDir 누락 시 INPUT_ERROR', async () => {
      readStdin.mockResolvedValue({ taskOutput: 'code' });
      await expect(commands['materialize-code']()).rejects.toThrow('projectDir');
    });

    it('materialize-batch: taskOutputs 누락 시 INPUT_ERROR', async () => {
      readStdin.mockResolvedValue({ projectDir: '/tmp/p' });
      await expect(commands['materialize-batch']()).rejects.toThrow('taskOutputs');
    });

    it('verify-and-materialize: task 누락 시 INPUT_ERROR', async () => {
      readStdin.mockResolvedValue({ taskOutput: 'code', projectDir: '/tmp/p' });
      await expect(commands['verify-and-materialize']()).rejects.toThrow('task');
    });

    it('commit-phase: phase 누락 시 INPUT_ERROR', async () => {
      readStdin.mockResolvedValue({ projectDir: '/tmp/p' });
      await expect(commands['commit-phase']()).rejects.toThrow('phase');
    });

    it('extract-materializable-blocks: taskOutput 누락 시 INPUT_ERROR', async () => {
      readStdin.mockResolvedValue({});
      await expect(commands['extract-materializable-blocks']()).rejects.toThrow('taskOutput');
    });

    it('commit-phase-enhanced: team 누락 시 INPUT_ERROR', async () => {
      readStdin.mockResolvedValue({
        projectDir: '/tmp/p',
        phase: 1,
        tasks: [],
        project: {},
      });
      await expect(commands['commit-phase-enhanced']()).rejects.toThrow('team');
    });
  });
});
