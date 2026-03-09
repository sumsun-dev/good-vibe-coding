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
  setProviderEnabled: vi.fn(),
  listConnectedProviders: vi.fn(),
  loadProvidersConfig: vi.fn(),
  saveProvidersConfig: vi.fn(),
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

vi.mock('../../scripts/lib/llm/gemini-bridge.js', () => ({
  isGeminiCliInstalled: vi.fn(() => true),
}));

import { readStdin, output, outputOk } from '../../scripts/cli-utils.js';
import {
  connectGeminiCli,
  removeAuth,
  setProviderEnabled,
  listConnectedProviders,
  loadProvidersConfig,
  saveProvidersConfig,
  getProviderStatus,
} from '../../scripts/lib/llm/auth-manager.js';
import { resolveReviewAssignments } from '../../scripts/lib/engine/cross-model-strategy.js';
import { verifyConnection } from '../../scripts/lib/llm/llm-provider.js';
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

  describe('update-provider-meta', () => {
    it('meta 객체를 providers 설정에 저장해야 한다', async () => {
      readStdin.mockResolvedValue({ meta: { geminiOffered: true } });
      loadProvidersConfig.mockResolvedValue({
        defaultProvider: 'claude',
        reviewStrategy: 'single',
        providers: { claude: { enabled: true } },
      });
      saveProvidersConfig.mockResolvedValue(undefined);

      await commands['update-provider-meta']();
      expect(saveProvidersConfig).toHaveBeenCalledWith({
        defaultProvider: 'claude',
        reviewStrategy: 'single',
        providers: { claude: { enabled: true } },
        meta: { geminiOffered: true },
      });
      expect(outputOk).toHaveBeenCalledWith({ meta: { geminiOffered: true } });
    });

    it('기존 meta에 병합해야 한다', async () => {
      readStdin.mockResolvedValue({ meta: { newKey: 'value' } });
      loadProvidersConfig.mockResolvedValue({
        defaultProvider: 'claude',
        reviewStrategy: 'single',
        providers: {},
        meta: { geminiOffered: true },
      });
      saveProvidersConfig.mockResolvedValue(undefined);

      await commands['update-provider-meta']();
      expect(saveProvidersConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          meta: { geminiOffered: true, newKey: 'value' },
        }),
      );
    });

    it('meta가 없으면 에러를 발생시켜야 한다', async () => {
      readStdin.mockResolvedValue({});
      await expect(commands['update-provider-meta']()).rejects.toThrow('meta');
    });
  });

  describe('connect (cli)', () => {
    it('verify 성공 시 outputOk를 호출해야 한다', async () => {
      readStdin.mockResolvedValue({ provider: 'gemini', authType: 'cli' });
      connectGeminiCli.mockResolvedValue({ type: 'cli' });
      verifyConnection.mockResolvedValue({ connected: true, model: 'gemini-2.5-pro' });

      await commands['connect']();

      expect(connectGeminiCli).toHaveBeenCalled();
      expect(verifyConnection).toHaveBeenCalledWith('gemini');
      expect(outputOk).toHaveBeenCalledWith({ providerId: 'gemini', type: 'cli' });
    });

    it('verify 실패 시 removeAuth + setProviderEnabled로 롤백하고 에러를 던져야 한다', async () => {
      readStdin.mockResolvedValue({ provider: 'gemini', authType: 'cli' });
      connectGeminiCli.mockResolvedValue({ type: 'cli' });
      verifyConnection.mockResolvedValue({ connected: false, error: '인증 만료' });

      await expect(commands['connect']()).rejects.toThrow('Gemini CLI 인증 실패');
      expect(removeAuth).toHaveBeenCalledWith('gemini');
      expect(setProviderEnabled).toHaveBeenCalledWith('gemini', false);
      expect(outputOk).not.toHaveBeenCalled();
    });

    it('skipVerify: true 시 verify를 호출하지 않아야 한다', async () => {
      readStdin.mockResolvedValue({ provider: 'gemini', authType: 'cli', skipVerify: true });
      connectGeminiCli.mockResolvedValue({ type: 'cli' });

      await commands['connect']();

      expect(verifyConnection).not.toHaveBeenCalled();
      expect(outputOk).toHaveBeenCalledWith({ providerId: 'gemini', type: 'cli' });
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
