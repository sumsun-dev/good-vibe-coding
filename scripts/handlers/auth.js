/**
 * handlers/auth — 멀티 모델 프로바이더 인증 + 크로스 모델 리뷰 커맨드
 */
import { readStdin, output, outputOk } from '../cli-utils.js';
import { inputError } from '../lib/core/validators.js';
import {
  connectWithApiKey, connectGeminiCli, removeAuth, listConnectedProviders,
  loadProvidersConfig, setReviewStrategy, getProviderStatus,
} from '../lib/llm/auth-manager.js';
import {
  resolveReviewAssignments, executeCrossModelReviews,
  summarizeCrossModelResults,
} from '../lib/engine/cross-model-strategy.js';
import { verifyConnection } from '../lib/llm/llm-provider.js';

const [,, , ...args] = process.argv;

export const commands = {
  'connect': async () => {
    const data = await readStdin();
    const providerId = data.provider || args[0];
    if (!providerId) throw inputError('프로바이더 ID가 필요합니다');

    if (data.authType === 'cli') {
      if (providerId !== 'gemini') {
        throw inputError('CLI 인증은 현재 gemini만 지원합니다');
      }
      const { isGeminiCliInstalled } = await import('../lib/llm/gemini-bridge.js');
      if (!isGeminiCliInstalled()) {
        throw inputError('Gemini CLI가 설치되지 않았습니다. `npm install -g @google/gemini-cli` 로 설치하세요.');
      }
      const auth = await connectGeminiCli();
      outputOk({ providerId, type: auth.type });
    } else {
      const auth = await connectWithApiKey(providerId, data.apiKey);
      outputOk({ providerId, type: auth.type });
    }
  },

  'disconnect': async () => {
    const data = await readStdin();
    const providerId = data.provider || args[0];
    if (!providerId) throw inputError('프로바이더 ID가 필요합니다');
    await removeAuth(providerId);
    outputOk({ providerId });
  },

  'providers': async () => {
    const status = await getProviderStatus();
    output(status);
  },

  'connected-providers': async () => {
    const connected = await listConnectedProviders();
    output(connected);
  },

  'set-review-strategy': async () => {
    const data = await readStdin();
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
    const config = data.providerConfig || await loadProvidersConfig();
    const assignments = await resolveReviewAssignments(data.reviewers, config);
    const results = await executeCrossModelReviews(assignments, data.task, data.taskOutput);
    const summary = summarizeCrossModelResults(results);
    output({ results, summary });
  },

  'resolve-review-assignments': async () => {
    const data = await readStdin();
    const config = data.providerConfig || await loadProvidersConfig();
    const assignments = await resolveReviewAssignments(data.reviewers, config);
    output({ assignments });
  },

  'gemini-review': async () => {
    const data = await readStdin();
    const { buildTaskReviewPrompt, parseTaskReview } = await import('../lib/engine/review-engine.js');
    const { callGeminiCli } = await import('../lib/llm/gemini-bridge.js');
    const prompt = buildTaskReviewPrompt(data.reviewer, data.task, data.taskOutput);
    const response = callGeminiCli(prompt, { model: data.model });
    const review = parseTaskReview(response.text);
    output({ reviewer: data.reviewer, provider: 'gemini', model: response.model, review, tokenCount: response.tokenCount });
  },
};
