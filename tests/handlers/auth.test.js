import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../scripts/cli-utils.js', () => ({
  readStdin: vi.fn(),
  output: vi.fn(),
  outputOk: vi.fn(),
}));

vi.mock('../../scripts/lib/core/validators.js', () => ({
  inputError: vi.fn((msg) => new Error(msg)),
}));

vi.mock('../../scripts/lib/llm/auth-manager.js', () => ({
  connectWithApiKey: vi.fn(),
  connectGeminiCli: vi.fn(),
  removeAuth: vi.fn(),
  listConnectedProviders: vi.fn(),
  loadProvidersConfig: vi.fn(),
  setReviewStrategy: vi.fn(),
  getProviderStatus: vi.fn(),
}));

vi.mock('../../scripts/lib/engine/cross-model-strategy.js', () => ({
  resolveReviewAssignments: vi.fn(),
  executeCrossModelReviews: vi.fn(),
  summarizeCrossModelResults: vi.fn(),
}));

vi.mock('../../scripts/lib/llm/llm-provider.js', () => ({
  verifyConnection: vi.fn(),
}));

import { readStdin, output } from '../../scripts/cli-utils.js';
import { listConnectedProviders, getProviderStatus } from '../../scripts/lib/llm/auth-manager.js';
import { resolveReviewAssignments } from '../../scripts/lib/engine/cross-model-strategy.js';
import { commands } from '../../scripts/handlers/auth.js';

describe('auth handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('providers', () => {
    it('프로바이더 상태를 출력해야 한다', async () => {
      const status = {
        defaultProvider: 'claude',
        reviewStrategy: 'single',
        providers: { claude: { enabled: true } },
      };
      getProviderStatus.mockResolvedValue(status);

      await commands['providers']();
      expect(output).toHaveBeenCalledWith(status);
    });
  });

  describe('connected-providers', () => {
    it('연결된 프로바이더 목록을 출력해야 한다', async () => {
      const connected = [{ providerId: 'claude', type: 'api-key', connectedAt: '2026-01-01' }];
      listConnectedProviders.mockResolvedValue(connected);

      await commands['connected-providers']();
      expect(output).toHaveBeenCalledWith(connected);
    });
  });

  describe('resolve-review-assignments', () => {
    it('리뷰 할당을 해석하고 출력해야 한다', async () => {
      const reviewers = [{ roleId: 'qa' }];
      const config = { providers: { claude: { enabled: true } } };
      const assignments = [{ roleId: 'qa', provider: 'claude' }];
      readStdin.mockResolvedValue({ reviewers, providerConfig: config });
      resolveReviewAssignments.mockResolvedValue(assignments);

      await commands['resolve-review-assignments']();
      expect(resolveReviewAssignments).toHaveBeenCalledWith(reviewers, config);
      expect(output).toHaveBeenCalledWith({ assignments });
    });
  });
});
