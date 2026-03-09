/**
 * handlers/auth — 멀티 모델 프로바이더 인증 + 크로스 모델 리뷰 커맨드
 */
import { readStdin, output, outputOk } from '../cli-utils.js';
import { inputError, requireFields } from '../lib/core/validators.js';
import {
  connectWithApiKey,
  connectGeminiCli,
  removeAuth,
  setProviderEnabled,
  listConnectedProviders,
  loadProvidersConfig,
  saveProvidersConfig,
  setReviewStrategy,
  getProviderStatus,
} from '../lib/llm/auth-manager.js';
import {
  resolveReviewAssignments,
  executeCrossModelReviews,
  summarizeCrossModelResults,
} from '../lib/engine/cross-model-strategy.js';
import { verifyConnection } from '../lib/llm/llm-provider.js';

const [, , , ...args] = process.argv;

export const commands = {
  connect: async () => {
    const data = await readStdin();
    const providerId = data.provider || args[0];
    if (!providerId) throw inputError('프로바이더 ID가 필요합니다');

    if (data.authType === 'cli') {
      if (providerId !== 'gemini') {
        throw inputError('CLI 인증은 현재 gemini만 지원합니다');
      }
      const { isGeminiCliInstalled } = await import('../lib/llm/gemini-bridge.js');
      if (!isGeminiCliInstalled()) {
        throw inputError(
          'Gemini CLI가 설치되지 않았습니다. `npm install -g @google/gemini-cli` 로 설치하세요.',
        );
      }
      const auth = await connectGeminiCli();

      if (!data.skipVerify) {
        const verification = await verifyConnection(providerId);
        if (!verification.connected) {
          await removeAuth(providerId);
          await setProviderEnabled(providerId, false);
          throw inputError(
            "Gemini CLI 인증 실패: 로그인이 필요합니다. 터미널에서 'gemini' 를 실행하여 Google 로그인하세요.",
          );
        }
      }

      outputOk({ providerId, type: auth.type });
    } else {
      const auth = await connectWithApiKey(providerId, data.apiKey);
      outputOk({ providerId, type: auth.type });
    }
  },

  disconnect: async () => {
    const data = await readStdin();
    const providerId = data.provider || args[0];
    if (!providerId) throw inputError('프로바이더 ID가 필요합니다');
    await removeAuth(providerId);
    outputOk({ providerId });
  },

  providers: async () => {
    const status = await getProviderStatus();
    output(status);
  },

  'connected-providers': async () => {
    const connected = await listConnectedProviders();
    output(connected);
  },

  'set-review-strategy': async () => {
    const data = await readStdin();
    requireFields(data, ['strategy']);
    await setReviewStrategy(data.strategy);
    outputOk({ strategy: data.strategy });
  },

  'verify-provider': async () => {
    const data = await readStdin();
    const providerId = data.provider || args[0];
    const result = await verifyConnection(providerId);
    output(result);
  },

  'cross-model-review': async () => {
    const data = await readStdin();
    requireFields(data, ['reviewers', 'task', 'taskOutput']);
    const providerConfig = data.providerConfig || (await loadProvidersConfig());
    const assignments = await resolveReviewAssignments(data.reviewers, providerConfig);
    const results = await executeCrossModelReviews(assignments, data.task, data.taskOutput);
    const summary = summarizeCrossModelResults(results);
    output({ results, summary });
  },

  'resolve-review-assignments': async () => {
    const data = await readStdin();
    const config = data.providerConfig || (await loadProvidersConfig());
    const assignments = await resolveReviewAssignments(data.reviewers, config);
    output({ assignments });
  },

  'update-provider-meta': async () => {
    const data = await readStdin();
    const meta = data.meta;
    if (!meta || typeof meta !== 'object') throw inputError('meta 객체가 필요합니다');
    const config = await loadProvidersConfig();
    const updated = { ...config, meta: { ...config.meta, ...meta } };
    await saveProvidersConfig(updated);
    outputOk({ meta: updated.meta });
  },

  'gemini-review': async () => {
    const data = await readStdin();
    requireFields(data, ['reviewer', 'task', 'taskOutput']);
    const { buildTaskReviewPrompt, parseTaskReview } =
      await import('../lib/engine/review-engine.js');
    const { callGeminiCli } = await import('../lib/llm/gemini-bridge.js');
    const prompt = buildTaskReviewPrompt(data.reviewer, data.task, data.taskOutput);
    const response = callGeminiCli(prompt, { model: data.model });
    const review = parseTaskReview(response.text);
    output({
      reviewer: data.reviewer,
      provider: 'gemini',
      model: response.model,
      review,
      tokenCount: response.tokenCount,
    });
  },
};
