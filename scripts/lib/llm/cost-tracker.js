/**
 * cost-tracker — LLM 호출 비용 메터링 + 예산 추적
 *
 * 토큰 사용량을 프로바이더별 가격표로 USD 환산.
 * Phase 3 일반화의 핵심 — oh-my-claudecode Ecomode 같은 비용 가시화.
 *
 * 외부 의존성 0. callLLM에서 호출하면 자동 누적.
 */

/**
 * 프로바이더별 가격표 (USD per million tokens).
 *
 * 출처: 각 프로바이더 공식 가격 (2026-04 기준).
 * 가격이 자주 바뀌므로 업데이트 필요.
 */
export const PROVIDER_PRICING = Object.freeze({
  claude: Object.freeze({
    // alias
    opus: {
      inputPerMillion: 15,
      outputPerMillion: 75,
      cacheReadPerMillion: 1.5,
      cacheWritePerMillion: 18.75,
    },
    sonnet: {
      inputPerMillion: 3,
      outputPerMillion: 15,
      cacheReadPerMillion: 0.3,
      cacheWritePerMillion: 3.75,
    },
    haiku: {
      inputPerMillion: 1,
      outputPerMillion: 5,
      cacheReadPerMillion: 0.1,
      cacheWritePerMillion: 1.25,
    },
    // 정식 모델 ID
    'claude-opus-4-7': {
      inputPerMillion: 15,
      outputPerMillion: 75,
      cacheReadPerMillion: 1.5,
      cacheWritePerMillion: 18.75,
    },
    'claude-sonnet-4-6': {
      inputPerMillion: 3,
      outputPerMillion: 15,
      cacheReadPerMillion: 0.3,
      cacheWritePerMillion: 3.75,
    },
    'claude-haiku-4-5-20251001': {
      inputPerMillion: 1,
      outputPerMillion: 5,
      cacheReadPerMillion: 0.1,
      cacheWritePerMillion: 1.25,
    },
  }),
  openai: Object.freeze({
    'gpt-4o': { inputPerMillion: 2.5, outputPerMillion: 10 },
    'gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
    'gpt-5': { inputPerMillion: 5, outputPerMillion: 20 },
  }),
  gemini: Object.freeze({
    'gemini-2.0-flash': { inputPerMillion: 0.1, outputPerMillion: 0.4 },
    'gemini-2.0-pro': { inputPerMillion: 1.25, outputPerMillion: 5 },
  }),
});

/**
 * 토큰 사용량을 비용으로 환산한다 (USD).
 *
 * @param {string} provider
 * @param {string} model
 * @param {{ inputTokens?: number, outputTokens?: number, cacheReadInputTokens?: number, cacheCreationInputTokens?: number }} usage
 * @returns {number} 비용 (USD)
 */
/** 미등록 모델 1회만 경고 (반복 노이즈 방지). */
const _warnedUnknownModels = new Set();

export function estimateCost(provider, model, usage = {}) {
  const providerTable = PROVIDER_PRICING[provider];
  if (!providerTable) {
    const key = `${provider}/__provider__`;
    if (!_warnedUnknownModels.has(key)) {
      _warnedUnknownModels.add(key);
      process.stderr.write(`[cost-tracker] 가격표 미등록 프로바이더: ${provider} (cost=0 처리)\n`);
    }
    return 0;
  }
  const pricing = providerTable[model];
  if (!pricing) {
    const key = `${provider}/${model}`;
    if (!_warnedUnknownModels.has(key)) {
      _warnedUnknownModels.add(key);
      process.stderr.write(
        `[cost-tracker] 가격표 미등록 모델: ${provider}/${model} (cost=0 처리, PROVIDER_PRICING 갱신 필요)\n`,
      );
    }
    return 0;
  }

  const input = (usage.inputTokens || 0) / 1_000_000;
  const output = (usage.outputTokens || 0) / 1_000_000;
  const cacheRead = (usage.cacheReadInputTokens || 0) / 1_000_000;
  const cacheWrite = (usage.cacheCreationInputTokens || 0) / 1_000_000;

  let cost = input * pricing.inputPerMillion + output * pricing.outputPerMillion;
  if (pricing.cacheReadPerMillion !== undefined) {
    cost += cacheRead * pricing.cacheReadPerMillion;
  }
  if (pricing.cacheWritePerMillion !== undefined) {
    cost += cacheWrite * pricing.cacheWritePerMillion;
  }
  return cost;
}

/**
 * 비용 추적기를 생성한다.
 *
 * @param {object} [options]
 * @param {number} [options.budgetUsd] - 누적 예산 한도 (USD). 초과 시 isOverBudget=true
 * @param {(info: { totalCost: number, budgetUsd: number }) => void} [options.onBudgetExceeded] - 예산 초과 시점 콜백 (1회)
 * @returns {{
 *   record: (call: { provider: string, model: string, inputTokens?: number, outputTokens?: number, cacheReadInputTokens?: number, cacheCreationInputTokens?: number }) => void,
 *   getStats: () => object,
 *   reset: () => void,
 * }}
 */
export function createCostTracker(options = {}) {
  const budgetUsd = options.budgetUsd;
  const onBudgetExceeded = options.onBudgetExceeded;

  let totalCalls = 0;
  let totalCost = 0;
  let cacheHitTokens = 0;
  let cacheCreationTokens = 0;
  let totalUncachedInputTokens = 0;
  const byProvider = new Map();
  const byModel = new Map();
  let budgetExceededFired = false;

  function bumpProvider(provider, call, cost) {
    const entry = byProvider.get(provider) || {
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
    };
    entry.calls++;
    entry.inputTokens += call.inputTokens || 0;
    entry.outputTokens += call.outputTokens || 0;
    entry.cost += cost;
    byProvider.set(provider, entry);
  }

  function bumpModel(model, call, cost) {
    const entry = byModel.get(model) || {
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
    };
    entry.calls++;
    entry.inputTokens += call.inputTokens || 0;
    entry.outputTokens += call.outputTokens || 0;
    entry.cost += cost;
    byModel.set(model, entry);
  }

  return {
    record(call) {
      const cost = estimateCost(call.provider, call.model, call);
      totalCalls++;
      totalCost += cost;
      cacheHitTokens += call.cacheReadInputTokens || 0;
      cacheCreationTokens += call.cacheCreationInputTokens || 0;
      totalUncachedInputTokens += call.inputTokens || 0;
      bumpProvider(call.provider, call, cost);
      bumpModel(call.model, call, cost);

      if (
        budgetUsd !== undefined &&
        totalCost > budgetUsd &&
        !budgetExceededFired &&
        typeof onBudgetExceeded === 'function'
      ) {
        budgetExceededFired = true;
        try {
          onBudgetExceeded({ totalCost, budgetUsd });
        } catch {
          // 콜백 에러는 무시 (모니터링 채널만 영향)
        }
      }
    },

    getStats() {
      // billable input = 캐시 read + 캐시 write(creation) + uncached
      // hitRate는 read / billable. write도 실제 청구되므로 분모에 포함.
      const cacheTotal = cacheHitTokens + cacheCreationTokens + totalUncachedInputTokens;
      const hitRate = cacheTotal > 0 ? cacheHitTokens / cacheTotal : 0;

      const stats = {
        totalCalls,
        totalCost,
        byProvider: {},
        byModel: {},
        cacheStats: {
          hitTokens: cacheHitTokens,
          creationTokens: cacheCreationTokens,
          hitRate,
        },
        isOverBudget: budgetUsd !== undefined && totalCost > budgetUsd,
        budgetRemainingUsd: budgetUsd !== undefined ? budgetUsd - totalCost : null,
      };

      for (const [k, v] of byProvider) stats.byProvider[k] = { ...v };
      for (const [k, v] of byModel) stats.byModel[k] = { ...v };
      return stats;
    },

    reset() {
      totalCalls = 0;
      totalCost = 0;
      cacheHitTokens = 0;
      cacheCreationTokens = 0;
      totalUncachedInputTokens = 0;
      byProvider.clear();
      byModel.clear();
      budgetExceededFired = false;
    },
  };
}
