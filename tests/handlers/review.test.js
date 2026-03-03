import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../scripts/cli-utils.js', () => ({
  readStdin: vi.fn(),
  output: vi.fn(),
}));

vi.mock('../../scripts/lib/engine/review-engine.js', () => ({
  selectReviewers: vi.fn(),
  buildTaskReviewPrompt: vi.fn(),
  checkQualityGate: vi.fn(),
  buildRevisionPrompt: vi.fn(),
  checkEnhancedQualityGate: vi.fn(),
}));

vi.mock('../../scripts/lib/engine/execution-verifier.js', () => ({
  verifyExecution: vi.fn(),
}));

vi.mock('../../scripts/lib/agent/agent-optimizer.js', () => ({
  detectRedundantAgents: vi.fn(),
  recommendOptimalTeam: vi.fn(),
  buildOptimizationReport: vi.fn(),
}));

vi.mock('../../scripts/lib/project/project-manager.js', () => ({
  getProject: vi.fn(),
}));

import { readStdin, output } from '../../scripts/cli-utils.js';
import {
  selectReviewers,
  checkQualityGate,
  checkEnhancedQualityGate,
} from '../../scripts/lib/engine/review-engine.js';
import {
  detectRedundantAgents,
  recommendOptimalTeam,
  buildOptimizationReport,
} from '../../scripts/lib/agent/agent-optimizer.js';
import { commands } from '../../scripts/handlers/review.js';

describe('review handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('select-reviewers', () => {
    it('리뷰어를 선정하고 출력해야 한다', async () => {
      const reviewers = [{ roleId: 'qa' }, { roleId: 'security' }];
      readStdin.mockResolvedValue({
        task: { id: 't1', domains: ['api'] },
        team: [{ roleId: 'qa' }],
      });
      selectReviewers.mockReturnValue(reviewers);

      await commands['select-reviewers']();
      expect(output).toHaveBeenCalledWith({ reviewers });
    });
  });

  describe('check-quality-gate', () => {
    it('품질 게이트 결과를 출력해야 한다', async () => {
      const result = { passed: true, criticalCount: 0 };
      readStdin.mockResolvedValue({ reviews: [{ approved: true }] });
      checkQualityGate.mockReturnValue(result);

      await commands['check-quality-gate']();
      expect(output).toHaveBeenCalledWith(result);
    });
  });

  describe('enhanced-quality-gate', () => {
    it('강화 품질 게이트 결과를 출력해야 한다', async () => {
      const result = { passed: true, reviewPassed: true, buildPassed: true };
      readStdin.mockResolvedValue({ reviews: [], executionResult: { success: true } });
      checkEnhancedQualityGate.mockReturnValue(result);

      await commands['enhanced-quality-gate']();
      expect(checkEnhancedQualityGate).toHaveBeenCalledWith([], { success: true });
      expect(output).toHaveBeenCalledWith(result);
    });
  });

  describe('analyze-efficiency', () => {
    it('에이전트 효율 분석을 출력해야 한다', async () => {
      const redundancies = [];
      const recommendations = { keep: ['cto'], remove: [] };
      const report = '최적화 보고서';
      readStdin.mockResolvedValue({
        agentOutputs: ['o1'],
        roleContributions: [{ roleId: 'cto', contributionScore: 5 }],
        teamSize: 3,
      });
      detectRedundantAgents.mockReturnValue(redundancies);
      recommendOptimalTeam.mockReturnValue(recommendations);
      buildOptimizationReport.mockReturnValue(report);

      await commands['analyze-efficiency']();
      expect(output).toHaveBeenCalledWith({ redundancies, recommendations, report });
    });
  });
});
