import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../scripts/cli-utils.js', () => ({
  readStdin: vi.fn(),
  output: vi.fn(),
  outputOk: vi.fn(),
  parseArgs: vi.fn(),
}));

vi.mock('../../scripts/lib/project/project-manager.js', () => ({
  getProject: vi.fn(),
  recordMetrics: vi.fn(),
}));

vi.mock('../../scripts/lib/core/validators.js', () => ({
  inputError: vi.fn((msg) => new Error(msg)),
  notFoundError: vi.fn((msg) => new Error(msg)),
}));

vi.mock('../../scripts/lib/project/project-metrics.js', () => ({
  getCostSummary: vi.fn(),
  buildMetricsDashboard: vi.fn(),
}));

import { readStdin, output, outputOk, parseArgs } from '../../scripts/cli-utils.js';
import { getProject, recordMetrics } from '../../scripts/lib/project/project-manager.js';
import { getCostSummary, buildMetricsDashboard } from '../../scripts/lib/project/project-metrics.js';
import { commands } from '../../scripts/handlers/metrics.js';

describe('metrics handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('record-metrics', () => {
    it('메트릭을 기록하고 결과를 출력해야 한다', async () => {
      const metrics = { cost: 0.5, tokens: 1000 };
      readStdin.mockResolvedValue({ id: 'p1', cost: 0.5, tokens: 1000 });
      recordMetrics.mockResolvedValue({ metrics });

      await commands['record-metrics']();
      expect(recordMetrics).toHaveBeenCalledWith('p1', { id: 'p1', cost: 0.5, tokens: 1000 });
      expect(outputOk).toHaveBeenCalledWith({ metrics });
    });

    it('id 없으면 에러를 던져야 한다', async () => {
      readStdin.mockResolvedValue({});
      await expect(commands['record-metrics']()).rejects.toThrow();
    });
  });

  describe('project-metrics', () => {
    it('프로젝트 대시보드를 출력해야 한다', async () => {
      const project = { id: 'p1', metrics: { cost: 1.0 } };
      const dashboard = '## Dashboard\n- cost: $1.00';
      parseArgs.mockReturnValue({ id: 'p1' });
      getProject.mockResolvedValue(project);
      buildMetricsDashboard.mockReturnValue(dashboard);

      await commands['project-metrics']();
      expect(output).toHaveBeenCalledWith({ dashboard, metrics: { cost: 1.0 } });
    });

    it('프로젝트가 없으면 에러를 던져야 한다', async () => {
      parseArgs.mockReturnValue({ id: 'p1' });
      getProject.mockResolvedValue(null);
      await expect(commands['project-metrics']()).rejects.toThrow();
    });
  });

  describe('cost-summary', () => {
    it('비용 요약을 출력해야 한다', async () => {
      const project = { id: 'p1', metrics: { cost: 2.0 } };
      const summary = { total: 2.0 };
      parseArgs.mockReturnValue({ id: 'p1' });
      getProject.mockResolvedValue(project);
      getCostSummary.mockReturnValue(summary);

      await commands['cost-summary']();
      expect(getCostSummary).toHaveBeenCalledWith({ cost: 2.0 });
      expect(output).toHaveBeenCalledWith(summary);
    });
  });
});
