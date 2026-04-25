/**
 * llm-pool — LLM 호출 동시성 풀 + 적응형 backpressure
 *
 * 글로벌 동시성 한도와 프로바이더별 한도를 함께 적용한다.
 * 429(rate limit) 신호 시 effective limit를 절반으로 줄였다가
 * cooldown 이후 자동 회복한다.
 *
 * 외부 의존성 0. callLLM 진입점에서 wrap 사용.
 */

const DEFAULTS = {
  maxConcurrent: 10,
  perProvider: {},
  backpressure: {
    halveOnRateLimit: true,
    minConcurrent: 1,
    recoveryMs: 60_000,
  },
};

/**
 * LLM 동시성 풀을 생성한다.
 *
 * @param {object} [options]
 * @param {number} [options.maxConcurrent=10] - 글로벌 최대 동시 실행 수
 * @param {Object<string, number>} [options.perProvider={}] - 프로바이더별 최대 동시 실행 수
 * @param {object} [options.backpressure]
 * @param {boolean} [options.backpressure.halveOnRateLimit=true] - 429 시 effective 한도 절반
 * @param {number} [options.backpressure.minConcurrent=1] - 최소 effective 한도
 * @param {number} [options.backpressure.recoveryMs=60000] - 마지막 429 후 회복까지 대기
 * @returns {{
 *   run: (provider: string, fn: () => Promise<any>) => Promise<any>,
 *   signalRateLimit: (provider: string) => void,
 *   getEffectiveLimit: (provider: string) => number,
 *   getStats: () => object,
 * }}
 */
export function createLLMPool(options = {}) {
  const maxConcurrent = options.maxConcurrent ?? DEFAULTS.maxConcurrent;
  const perProviderConfig = options.perProvider ?? DEFAULTS.perProvider;
  const bp = { ...DEFAULTS.backpressure, ...(options.backpressure || {}) };

  const state = {
    globalInFlight: 0,
    perProviderInFlight: new Map(),
    perProviderEffective: new Map(),
    perProviderLastRateLimit: new Map(),
    waiters: [],
    stats: {
      totalRuns: 0,
      totalErrors: 0,
      byProvider: new Map(),
    },
  };

  function configuredLimit(provider) {
    return perProviderConfig[provider] ?? maxConcurrent;
  }

  function maybeRecover(provider) {
    const reduced = state.perProviderEffective.get(provider);
    if (reduced === undefined) return;
    const lastSignal = state.perProviderLastRateLimit.get(provider) || 0;
    if (bp.recoveryMs > 0 && Date.now() - lastSignal >= bp.recoveryMs) {
      state.perProviderEffective.delete(provider);
      state.perProviderLastRateLimit.delete(provider);
    }
  }

  function effectiveLimit(provider) {
    maybeRecover(provider);
    const reduced = state.perProviderEffective.get(provider);
    return reduced ?? configuredLimit(provider);
  }

  function getInFlight(provider) {
    return state.perProviderInFlight.get(provider) || 0;
  }

  function canAcquire(provider) {
    if (state.globalInFlight >= maxConcurrent) return false;
    return getInFlight(provider) < effectiveLimit(provider);
  }

  function acquire(provider) {
    state.globalInFlight++;
    state.perProviderInFlight.set(provider, getInFlight(provider) + 1);
  }

  function release(provider) {
    state.globalInFlight = Math.max(0, state.globalInFlight - 1);
    state.perProviderInFlight.set(provider, Math.max(0, getInFlight(provider) - 1));
    drain();
  }

  function drain() {
    // backpressure 회복 또는 슬롯 여유로 동시에 여러 waiter가 가용해질 수 있다.
    // 한 번의 drain에서 가능한 모두 깨운다.
    let i = 0;
    while (i < state.waiters.length) {
      const waiter = state.waiters[i];
      if (canAcquire(waiter.provider)) {
        state.waiters.splice(i, 1);
        acquire(waiter.provider);
        waiter.resolve();
      } else {
        i++;
      }
    }
  }

  function recordRun(provider) {
    state.stats.totalRuns++;
    const byP = state.stats.byProvider.get(provider) || { runs: 0, errors: 0 };
    byP.runs++;
    state.stats.byProvider.set(provider, byP);
  }

  function recordError(provider) {
    state.stats.totalErrors++;
    const byP = state.stats.byProvider.get(provider) || { runs: 0, errors: 0 };
    byP.errors++;
    state.stats.byProvider.set(provider, byP);
  }

  async function waitForSlot(provider) {
    if (canAcquire(provider)) {
      acquire(provider);
      return;
    }
    await new Promise((resolve) => {
      state.waiters.push({ provider, resolve });
    });
  }

  return {
    async run(provider, fn) {
      await waitForSlot(provider);
      recordRun(provider);
      try {
        return await fn();
      } catch (err) {
        recordError(provider);
        throw err;
      } finally {
        release(provider);
      }
    },

    signalRateLimit(provider) {
      if (!bp.halveOnRateLimit) return;
      const current = effectiveLimit(provider);
      const next = Math.max(bp.minConcurrent, Math.floor(current / 2));
      state.perProviderEffective.set(provider, next);
      state.perProviderLastRateLimit.set(provider, Date.now());
    },

    getEffectiveLimit(provider) {
      return effectiveLimit(provider);
    },

    getStats() {
      const byProvider = {};
      for (const [k, v] of state.stats.byProvider) {
        byProvider[k] = { ...v };
      }
      return {
        totalRuns: state.stats.totalRuns,
        totalErrors: state.stats.totalErrors,
        inFlight: state.globalInFlight,
        byProvider,
      };
    },
  };
}
