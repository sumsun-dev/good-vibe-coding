import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../scripts/cli-utils.js', () => ({
  readStdin: vi.fn(),
  output: vi.fn(),
  outputOk: vi.fn(),
}));

vi.mock('../../scripts/lib/core/validators.js', () => ({
  requireFields: vi.fn(),
  requireArray: vi.fn(),
}));

vi.mock('../../scripts/lib/agent/recommendation-engine.js', () => ({
  recommendSetup: vi.fn(),
  formatRecommendations: vi.fn(),
  getCatalog: vi.fn(),
}));

vi.mock('../../scripts/lib/agent/setup-installer.js', () => ({
  listInstalled: vi.fn(),
  installItems: vi.fn(),
  formatInstallResults: vi.fn(),
}));

import { readStdin, output, outputOk } from '../../scripts/cli-utils.js';
import { recommendSetup, formatRecommendations, getCatalog } from '../../scripts/lib/agent/recommendation-engine.js';
import { listInstalled, installItems, formatInstallResults } from '../../scripts/lib/agent/setup-installer.js';
import { commands } from '../../scripts/handlers/recommendation.js';

describe('recommendation handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recommend-setup', () => {
    it('추천 결과를 포맷팅하여 출력해야 한다', async () => {
      readStdin.mockResolvedValue({ projectType: 'web', complexity: 'medium', description: '웹 앱' });
      listInstalled.mockResolvedValue({ skills: [], agents: [] });
      const recs = { skills: [{ id: 's1' }], agents: [] };
      recommendSetup.mockResolvedValue(recs);
      formatRecommendations.mockReturnValue('추천 목록');

      await commands['recommend-setup']();
      expect(recommendSetup).toHaveBeenCalledWith(expect.objectContaining({
        projectType: 'web', complexity: 'medium', description: '웹 앱',
      }));
      expect(output).toHaveBeenCalledWith(expect.objectContaining({ formatted: '추천 목록' }));
    });
  });

  describe('install-setup', () => {
    it('선택 항목을 설치하고 결과를 출력해야 한다', async () => {
      readStdin.mockResolvedValue({ items: ['s1'] });
      getCatalog.mockResolvedValue({ skills: [{ id: 's1', name: 'skill1' }], agents: [] });
      const results = [{ id: 's1', installed: true }];
      installItems.mockResolvedValue(results);
      formatInstallResults.mockReturnValue('설치 완료');

      await commands['install-setup']();
      expect(installItems).toHaveBeenCalledWith([{ id: 's1', name: 'skill1' }]);
      expect(outputOk).toHaveBeenCalledWith({ results, formatted: '설치 완료' });
    });
  });

  describe('list-installed', () => {
    it('설치된 항목을 출력해야 한다', async () => {
      const installed = { skills: ['s1'], agents: ['a1'] };
      listInstalled.mockResolvedValue(installed);

      await commands['list-installed']();
      expect(output).toHaveBeenCalledWith(installed);
    });
  });

  describe('recommendation-catalog', () => {
    it('카탈로그를 출력해야 한다', async () => {
      const catalog = { skills: [{ id: 's1' }], agents: [{ id: 'a1' }] };
      getCatalog.mockResolvedValue(catalog);

      await commands['recommendation-catalog']();
      expect(output).toHaveBeenCalledWith(catalog);
    });
  });
});
