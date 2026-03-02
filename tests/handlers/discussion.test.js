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

import { readStdin, output } from '../../scripts/cli-utils.js';
import { buildPlanDocument } from '../../scripts/lib/engine/discussion-engine.js';
import { buildSynthesisPrompt, checkConvergence, groupAgentsForParallelDispatch } from '../../scripts/lib/engine/orchestrator.js';
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
      expect(buildSynthesisPrompt).toHaveBeenCalledWith({ id: 'p1' }, ['o1'], 2);
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
