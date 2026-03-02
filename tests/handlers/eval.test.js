import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../scripts/cli-utils.js', () => ({
  readStdin: vi.fn(),
  output: vi.fn(),
  parseArgs: vi.fn(),
}));

vi.mock('../../scripts/lib/engine/eval-engine.js', () => ({
  createEvalSession: vi.fn(),
  recordApproachResult: vi.fn(),
  compareApproaches: vi.fn(),
  generateEvalReport: vi.fn(),
  saveEvalSession: vi.fn(),
  loadEvalSession: vi.fn(),
  listEvalSessions: vi.fn(),
  buildSinglePromptBaseline: vi.fn(),
}));

vi.mock('../../scripts/lib/agent/complexity-analyzer.js', () => ({
  buildComplexityAnalysisPrompt: vi.fn(),
  parseComplexityAnalysis: vi.fn(),
  getDefaultsForComplexity: vi.fn(),
}));

vi.mock('../../scripts/lib/core/validators.js', () => ({
  inputError: vi.fn((msg) => new Error(msg)),
}));

import { readStdin, output, parseArgs } from '../../scripts/cli-utils.js';
import { createEvalSession, compareApproaches, loadEvalSession } from '../../scripts/lib/engine/eval-engine.js';
import { parseComplexityAnalysis, getDefaultsForComplexity } from '../../scripts/lib/agent/complexity-analyzer.js';
import { commands } from '../../scripts/handlers/eval.js';

describe('eval handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('eval-create', () => {
    it('평가 세션을 생성해야 한다', async () => {
      const session = { id: 'eval-1', approaches: ['a', 'b'] };
      readStdin.mockResolvedValue({ projectDescription: '테스트', approaches: ['a', 'b'] });
      createEvalSession.mockReturnValue(session);

      await commands['eval-create']();
      expect(createEvalSession).toHaveBeenCalledWith('테스트', ['a', 'b']);
      expect(output).toHaveBeenCalledWith(session);
    });
  });

  describe('eval-compare', () => {
    it('세션 비교 결과를 출력해야 한다', async () => {
      const session = { id: 'eval-1' };
      const comparison = { winner: 'a' };
      parseArgs.mockReturnValue({ 'session-id': 'eval-1' });
      loadEvalSession.mockResolvedValue(session);
      compareApproaches.mockReturnValue(comparison);

      await commands['eval-compare']();
      expect(loadEvalSession).toHaveBeenCalledWith('eval-1');
      expect(output).toHaveBeenCalledWith(comparison);
    });

    it('session-id 없으면 에러를 던져야 한다', async () => {
      parseArgs.mockReturnValue({});
      await expect(commands['eval-compare']()).rejects.toThrow();
    });
  });

  describe('parse-complexity', () => {
    it('복잡도 분석 결과를 파싱해야 한다', async () => {
      const result = { level: 'medium', score: 5 };
      readStdin.mockResolvedValue({ rawOutput: '{"level": "medium"}' });
      parseComplexityAnalysis.mockReturnValue(result);

      await commands['parse-complexity']();
      expect(output).toHaveBeenCalledWith(result);
    });
  });

  describe('complexity-defaults', () => {
    it('복잡도 레벨에 맞는 기본값을 출력해야 한다', async () => {
      const defaults = { teamSize: 3, mode: 'plan-execute' };
      parseArgs.mockReturnValue({ level: 'medium' });
      getDefaultsForComplexity.mockReturnValue(defaults);

      await commands['complexity-defaults']();
      expect(getDefaultsForComplexity).toHaveBeenCalledWith('medium');
      expect(output).toHaveBeenCalledWith(defaults);
    });
  });
});
