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
  requireFields: vi.fn((data, fields) => {
    for (const f of fields) {
      if (data[f] === undefined || data[f] === null) {
        throw new Error(`필수 필드 누락: ${f}`);
      }
    }
  }),
}));

import { readStdin, output, parseArgs } from '../../scripts/cli-utils.js';
import {
  createEvalSession,
  recordApproachResult,
  compareApproaches,
  generateEvalReport,
  saveEvalSession,
  loadEvalSession,
  listEvalSessions,
  buildSinglePromptBaseline,
} from '../../scripts/lib/engine/eval-engine.js';
import {
  buildComplexityAnalysisPrompt,
  parseComplexityAnalysis,
  getDefaultsForComplexity,
} from '../../scripts/lib/agent/complexity-analyzer.js';
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

  describe('eval-record', () => {
    it('접근법 결과를 기록해야 한다', async () => {
      const session = { id: 'eval-1', results: {} };
      const updated = { id: 'eval-1', results: { a: { output: 'test' } } };
      readStdin.mockResolvedValue({ sessionId: 'eval-1', approach: 'a', result: { output: 'test' } });
      loadEvalSession.mockResolvedValue(session);
      recordApproachResult.mockReturnValue(updated);
      saveEvalSession.mockResolvedValue(undefined);

      await commands['eval-record']();
      expect(loadEvalSession).toHaveBeenCalledWith('eval-1');
      expect(recordApproachResult).toHaveBeenCalledWith(session, 'a', { output: 'test' });
      expect(saveEvalSession).toHaveBeenCalledWith(updated);
      expect(output).toHaveBeenCalledWith(updated);
    });

    it('필수 필드 누락 시 에러를 던져야 한다', async () => {
      readStdin.mockResolvedValue({ sessionId: 'eval-1' });
      await expect(commands['eval-record']()).rejects.toThrow();
    });
  });

  describe('eval-report', () => {
    it('평가 보고서를 생성해야 한다', async () => {
      const session = { id: 'eval-1' };
      const comparison = { winner: 'a', rankings: [] };
      const report = '# 평가 보고서';
      parseArgs.mockReturnValue({ 'session-id': 'eval-1' });
      loadEvalSession.mockResolvedValue(session);
      compareApproaches.mockReturnValue(comparison);
      generateEvalReport.mockReturnValue(report);

      await commands['eval-report']();
      expect(loadEvalSession).toHaveBeenCalledWith('eval-1');
      expect(generateEvalReport).toHaveBeenCalledWith(session, comparison);
      expect(output).toHaveBeenCalledWith({ report });
    });

    it('session-id 없으면 에러를 던져야 한다', async () => {
      parseArgs.mockReturnValue({});
      await expect(commands['eval-report']()).rejects.toThrow();
    });
  });

  describe('eval-list', () => {
    it('저장된 세션 목록을 반환해야 한다', async () => {
      const sessions = [{ sessionId: 'eval-1' }, { sessionId: 'eval-2' }];
      listEvalSessions.mockResolvedValue(sessions);

      await commands['eval-list']();
      expect(listEvalSessions).toHaveBeenCalled();
      expect(output).toHaveBeenCalledWith(sessions);
    });
  });

  describe('eval-baseline-prompt', () => {
    it('베이스라인 프롬프트를 생성해야 한다', async () => {
      readStdin.mockResolvedValue({ description: '테스트 프로젝트' });
      buildSinglePromptBaseline.mockReturnValue('프롬프트 내용');

      await commands['eval-baseline-prompt']();
      expect(buildSinglePromptBaseline).toHaveBeenCalledWith('테스트 프로젝트');
      expect(output).toHaveBeenCalledWith({ prompt: '프롬프트 내용' });
    });

    it('필수 필드 누락 시 에러를 던져야 한다', async () => {
      readStdin.mockResolvedValue({});
      await expect(commands['eval-baseline-prompt']()).rejects.toThrow();
    });
  });

  describe('complexity-analysis', () => {
    it('복잡도 분석 프롬프트를 생성해야 한다', async () => {
      readStdin.mockResolvedValue({ description: '복잡한 프로젝트' });
      buildComplexityAnalysisPrompt.mockReturnValue('분석 프롬프트');

      await commands['complexity-analysis']();
      expect(buildComplexityAnalysisPrompt).toHaveBeenCalledWith('복잡한 프로젝트');
      expect(output).toHaveBeenCalledWith({ prompt: '분석 프롬프트' });
    });

    it('필수 필드 누락 시 에러를 던져야 한다', async () => {
      readStdin.mockResolvedValue({});
      await expect(commands['complexity-analysis']()).rejects.toThrow();
    });
  });
});
