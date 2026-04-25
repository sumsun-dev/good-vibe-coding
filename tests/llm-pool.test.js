import { describe, it, expect, vi } from 'vitest';
import { createLLMPool } from '../scripts/lib/llm/llm-pool.js';

function defer() {
  let resolveFn;
  let rejectFn;
  const promise = new Promise((res, rej) => {
    resolveFn = res;
    rejectFn = rej;
  });
  return { promise, resolve: resolveFn, reject: rejectFn };
}

describe('createLLMPool — 글로벌 동시성 제어', () => {
  it('maxConcurrent 슬롯 수 만큼만 동시에 실행된다', async () => {
    const pool = createLLMPool({ maxConcurrent: 2 });
    const inFlight = { count: 0, max: 0 };
    const deferreds = [defer(), defer(), defer(), defer()];

    const tasks = deferreds.map((d, i) =>
      pool.run('claude', async () => {
        inFlight.count++;
        if (inFlight.count > inFlight.max) inFlight.max = inFlight.count;
        await d.promise;
        inFlight.count--;
        return i;
      }),
    );

    // 잠시 기다려 첫 두 개가 in-flight 상태에 들어가게 함
    await new Promise((r) => setTimeout(r, 10));
    expect(inFlight.count).toBe(2);

    deferreds[0].resolve();
    await new Promise((r) => setTimeout(r, 10));
    expect(inFlight.count).toBe(2);

    deferreds[1].resolve();
    deferreds[2].resolve();
    deferreds[3].resolve();
    const results = await Promise.all(tasks);
    expect(results).toEqual([0, 1, 2, 3]);
    expect(inFlight.max).toBe(2);
  });

  it('태스크가 throw 해도 슬롯이 해제된다', async () => {
    const pool = createLLMPool({ maxConcurrent: 1 });
    await expect(
      pool.run('claude', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    // 다음 작업이 대기 없이 시작되는지 확인
    const result = await pool.run('claude', async () => 'ok');
    expect(result).toBe('ok');
  });
});

describe('createLLMPool — 프로바이더별 한도', () => {
  it('프로바이더별 maxConcurrent를 별도로 적용한다', async () => {
    const pool = createLLMPool({
      maxConcurrent: 10,
      perProvider: { claude: 1, openai: 1 },
    });
    const counts = { claude: 0, openai: 0 };
    const max = { claude: 0, openai: 0 };
    const deferreds = [defer(), defer(), defer(), defer()];

    const tasks = [
      pool.run('claude', async () => {
        counts.claude++;
        max.claude = Math.max(max.claude, counts.claude);
        await deferreds[0].promise;
        counts.claude--;
      }),
      pool.run('claude', async () => {
        counts.claude++;
        max.claude = Math.max(max.claude, counts.claude);
        await deferreds[1].promise;
        counts.claude--;
      }),
      pool.run('openai', async () => {
        counts.openai++;
        max.openai = Math.max(max.openai, counts.openai);
        await deferreds[2].promise;
        counts.openai--;
      }),
      pool.run('openai', async () => {
        counts.openai++;
        max.openai = Math.max(max.openai, counts.openai);
        await deferreds[3].promise;
        counts.openai--;
      }),
    ];

    await new Promise((r) => setTimeout(r, 10));
    // claude 1개, openai 1개만 동시 실행
    expect(counts.claude).toBe(1);
    expect(counts.openai).toBe(1);

    deferreds.forEach((d) => d.resolve());
    await Promise.all(tasks);

    expect(max.claude).toBe(1);
    expect(max.openai).toBe(1);
  });

  it('글로벌 한도가 프로바이더 한도보다 작으면 글로벌이 우선', async () => {
    const pool = createLLMPool({
      maxConcurrent: 1,
      perProvider: { claude: 5, openai: 5 },
    });
    let inFlight = 0;
    let maxInFlight = 0;
    const deferreds = [defer(), defer(), defer()];

    const tasks = [
      pool.run('claude', async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await deferreds[0].promise;
        inFlight--;
      }),
      pool.run('openai', async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await deferreds[1].promise;
        inFlight--;
      }),
      pool.run('gemini', async () => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await deferreds[2].promise;
        inFlight--;
      }),
    ];

    await new Promise((r) => setTimeout(r, 10));
    expect(inFlight).toBe(1);

    deferreds.forEach((d) => d.resolve());
    await Promise.all(tasks);
    expect(maxInFlight).toBe(1);
  });
});

describe('createLLMPool — 적응형 backpressure', () => {
  it('429 신호 시 effective maxConcurrent를 감소시킨다', async () => {
    const pool = createLLMPool({
      maxConcurrent: 4,
      perProvider: { claude: 4 },
      backpressure: { halveOnRateLimit: true, minConcurrent: 1 },
    });

    // 처음에는 4 슬롯
    expect(pool.getEffectiveLimit('claude')).toBe(4);

    pool.signalRateLimit('claude');
    expect(pool.getEffectiveLimit('claude')).toBe(2);

    pool.signalRateLimit('claude');
    expect(pool.getEffectiveLimit('claude')).toBe(1);

    pool.signalRateLimit('claude');
    expect(pool.getEffectiveLimit('claude')).toBe(1); // minConcurrent에서 멈춤
  });

  it('cooldown 후 effective limit가 회복된다', async () => {
    vi.useFakeTimers();
    try {
      const pool = createLLMPool({
        maxConcurrent: 4,
        perProvider: { claude: 4 },
        backpressure: { halveOnRateLimit: true, minConcurrent: 1, recoveryMs: 1000 },
      });
      pool.signalRateLimit('claude');
      expect(pool.getEffectiveLimit('claude')).toBe(2);

      vi.advanceTimersByTime(1000);
      expect(pool.getEffectiveLimit('claude')).toBe(4);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('createLLMPool — drain 다중 깨우기 (backpressure 회복)', () => {
  it('cooldown 후 effective limit가 회복되면 대기 중인 여러 waiter가 한 번에 깨어난다', async () => {
    vi.useFakeTimers();
    try {
      const pool = createLLMPool({
        maxConcurrent: 4,
        perProvider: { claude: 4 },
        backpressure: { halveOnRateLimit: true, minConcurrent: 1, recoveryMs: 100 },
      });

      // claude를 1로 줄임 → effective=1
      pool.signalRateLimit('claude');
      pool.signalRateLimit('claude');
      pool.signalRateLimit('claude');
      expect(pool.getEffectiveLimit('claude')).toBe(1);

      const deferreds = [defer(), defer(), defer(), defer()];
      let started = 0;
      const tasks = deferreds.map((d) =>
        pool.run('claude', async () => {
          started++;
          await d.promise;
        }),
      );

      await vi.advanceTimersByTimeAsync(0);
      expect(started).toBe(1); // effective=1이라 1개만 실행

      // recoveryMs 경과 → effective 회복 + drain이 여러 waiter 동시 깨움
      await vi.advanceTimersByTimeAsync(150);

      // 첫 번째 작업이 끝나면 drain이 호출되어 회복된 슬롯 모두 사용
      deferreds[0].resolve();
      await vi.advanceTimersByTimeAsync(0);

      // started가 4 (전부 깨어남) — drain의 다중 깨우기 검증
      expect(started).toBe(4);

      deferreds[1].resolve();
      deferreds[2].resolve();
      deferreds[3].resolve();
      await Promise.all(tasks);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('createLLMPool — 통계', () => {
  it('getStats() — inFlight, totalRuns, totalErrors', async () => {
    const pool = createLLMPool({ maxConcurrent: 2 });
    await pool.run('claude', async () => 'ok');
    await pool.run('claude', async () => 'ok');
    await expect(
      pool.run('claude', async () => {
        throw new Error('x');
      }),
    ).rejects.toThrow();

    const stats = pool.getStats();
    expect(stats.totalRuns).toBe(3);
    expect(stats.totalErrors).toBe(1);
    expect(stats.inFlight).toBe(0);
    expect(stats.byProvider.claude.runs).toBe(3);
    expect(stats.byProvider.claude.errors).toBe(1);
  });
});
