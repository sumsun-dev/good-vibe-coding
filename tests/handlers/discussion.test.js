import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../scripts/cli-utils.js', () => ({
  readStdin: vi.fn(),
  output: vi.fn(),
  parseArgs: vi.fn(),
}));

vi.mock('../../scripts/lib/project/project-manager.js', () => ({
  getProject: vi.fn(),
}));

vi.mock('../../scripts/lib/core/validators.js', () => ({
  notFoundError: vi.fn((msg) => new Error(msg)),
  inputError: vi.fn((msg) => new Error(msg)),
  requireFields: vi.fn((data, fields) => {
    for (const f of fields) {
      if (!(f in data)) throw new Error(`필수 필드 누락: ${f}`);
    }
  }),
}));

vi.mock('../../scripts/lib/engine/discussion-engine.js', () => ({
  buildDiscussionPrompt: vi.fn(),
  buildPlanDocument: vi.fn(),
  buildSingleAgentDiscussionPrompt: vi.fn(),
}));

vi.mock('../../scripts/lib/engine/orchestrator.js', () => ({
  buildAgentAnalysisPrompt: vi.fn(),
  buildSynthesisPrompt: vi.fn(),
  buildReviewPrompt: vi.fn(),
  checkConvergence: vi.fn(),
  groupAgentsForParallelDispatch: vi.fn(),
}));

vi.mock('../../scripts/lib/engine/dispatch-plan-generator.js', () => ({
  buildDiscussionDispatchPlan: vi.fn(),
  buildExecutionDispatchPlan: vi.fn(),
}));

vi.mock('../../scripts/lib/project/prd-generator.js', () => ({
  buildPrdPrompt: vi.fn(),
  parsePrdResult: vi.fn(),
  formatPrdForDisplay: vi.fn(),
}));

vi.mock('../../scripts/lib/engine/acceptance-criteria.js', () => ({
  buildAcceptanceCriteriaPrompt: vi.fn(),
  parseAcceptanceCriteria: vi.fn(),
}));

import { readStdin, output } from '../../scripts/cli-utils.js';
import { buildPlanDocument } from '../../scripts/lib/engine/discussion-engine.js';
import {
  buildSynthesisPrompt,
  checkConvergence,
  groupAgentsForParallelDispatch,
} from '../../scripts/lib/engine/orchestrator.js';
import {
  buildPrdPrompt,
  parsePrdResult,
  formatPrdForDisplay,
} from '../../scripts/lib/project/prd-generator.js';
import { commands } from '../../scripts/handlers/discussion.js';

describe('discussion handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('plan-document', () => {
    it('기획서를 생성하고 출력해야 한다', async () => {
      const doc = '# Plan\n기획서 내용';
      readStdin.mockResolvedValue({ project: { id: 'p1' }, discussions: [{ round: 1 }] });
      buildPlanDocument.mockReturnValue(doc);

      await commands['plan-document']();
      expect(buildPlanDocument).toHaveBeenCalledWith({ id: 'p1' }, [{ round: 1 }]);
      expect(output).toHaveBeenCalledWith({ planDocument: doc });
    });
  });

  describe('synthesis-prompt', () => {
    it('종합 프롬프트를 생성해야 한다', async () => {
      const prompt = '종합 프롬프트';
      readStdin.mockResolvedValue({ project: { id: 'p1' }, agentOutputs: ['o1'], round: 2 });
      buildSynthesisPrompt.mockReturnValue(prompt);

      await commands['synthesis-prompt']();
      expect(buildSynthesisPrompt).toHaveBeenCalledWith({ id: 'p1' }, ['o1'], 2, {});
      expect(output).toHaveBeenCalledWith({ prompt });
    });

    it('ceoFeedback이 있으면 context로 전달해야 한다', async () => {
      const prompt = 'CEO 피드백 반영 프롬프트';
      readStdin.mockResolvedValue({
        project: { id: 'p1' },
        agentOutputs: ['o1'],
        round: 2,
        ceoFeedback: '아키텍처를 변경하세요',
      });
      buildSynthesisPrompt.mockReturnValue(prompt);

      await commands['synthesis-prompt']();
      expect(buildSynthesisPrompt).toHaveBeenCalledWith({ id: 'p1' }, ['o1'], 2, {
        ceoFeedback: '아키텍처를 변경하세요',
      });
      expect(output).toHaveBeenCalledWith({ prompt });
    });
  });

  describe('check-convergence', () => {
    it('수렴 결과를 출력해야 한다', async () => {
      const result = { converged: true, approvalRate: 0.9 };
      readStdin.mockResolvedValue({ reviews: [{ approved: true }] });
      checkConvergence.mockReturnValue(result);

      await commands['check-convergence']();
      expect(output).toHaveBeenCalledWith(result);
    });
  });

  describe('generate-prd-prompt', () => {
    it('PRD 프롬프트를 생성해야 한다', async () => {
      readStdin.mockResolvedValue({
        description: '채팅 앱',
        clarityDimensions: { scope: { score: 0.9 } },
      });
      buildPrdPrompt.mockReturnValue('PRD 프롬프트');

      await commands['generate-prd-prompt']();
      expect(buildPrdPrompt).toHaveBeenCalledWith('채팅 앱', { scope: { score: 0.9 } }, null);
      expect(output).toHaveBeenCalledWith({ prompt: 'PRD 프롬프트' });
    });

    it('codebaseInfo가 있으면 전달해야 한다', async () => {
      const codebaseInfo = { techStack: ['React'] };
      readStdin.mockResolvedValue({
        description: '앱',
        clarityDimensions: {},
        codebaseInfo,
      });
      buildPrdPrompt.mockReturnValue('prompt');

      await commands['generate-prd-prompt']();
      expect(buildPrdPrompt).toHaveBeenCalledWith('앱', {}, codebaseInfo);
    });

    it('필수 필드 누락 시 에러', async () => {
      readStdin.mockResolvedValue({ description: '앱' });
      await expect(commands['generate-prd-prompt']()).rejects.toThrow('clarityDimensions');
    });
  });

  describe('parse-prd', () => {
    it('PRD를 파싱하고 formatted를 반환해야 한다', async () => {
      const prd = { overview: '채팅 앱', coreFeatures: [] };
      readStdin.mockResolvedValue({ rawOutput: '{"overview":"채팅 앱"}' });
      parsePrdResult.mockReturnValue(prd);
      formatPrdForDisplay.mockReturnValue('## 프로젝트 개요\n채팅 앱');

      await commands['parse-prd']();
      expect(parsePrdResult).toHaveBeenCalledWith('{"overview":"채팅 앱"}');
      expect(formatPrdForDisplay).toHaveBeenCalledWith(prd);
      expect(output).toHaveBeenCalledWith({
        prd,
        formatted: '## 프로젝트 개요\n채팅 앱',
      });
    });

    it('필수 필드 누락 시 에러', async () => {
      readStdin.mockResolvedValue({});
      await expect(commands['parse-prd']()).rejects.toThrow('rawOutput');
    });
  });

  describe('group-agents', () => {
    it('팀을 tier별로 그룹화해야 한다', async () => {
      const tiers = [[{ roleId: 'cto' }], [{ roleId: 'frontend' }]];
      readStdin.mockResolvedValue({ team: [{ roleId: 'cto' }, { roleId: 'frontend' }] });
      groupAgentsForParallelDispatch.mockReturnValue(tiers);

      await commands['group-agents']();
      expect(output).toHaveBeenCalledWith({ tiers });
    });
  });
});
