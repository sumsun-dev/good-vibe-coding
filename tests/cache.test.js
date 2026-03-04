import { describe, it, expect, vi } from 'vitest';
import { LazyCache } from '../scripts/lib/core/cache.js';

describe('LazyCache', () => {
  it('최초 get에서 loader를 호출한다', async () => {
    const loader = vi.fn(async () => ({ data: 'loaded' }));
    const cache = new LazyCache(loader);

    expect(cache.loaded).toBe(false);
    const result = await cache.get();
    expect(result).toEqual({ data: 'loaded' });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(cache.loaded).toBe(true);
  });

  it('두번째 get은 loader를 호출하지 않는다', async () => {
    const loader = vi.fn(async () => 'data');
    const cache = new LazyCache(loader);

    await cache.get();
    await cache.get();
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('clear 후 다시 loader를 호출한다', async () => {
    const loader = vi.fn(async () => 'data');
    const cache = new LazyCache(loader);

    await cache.get();
    cache.clear();
    expect(cache.loaded).toBe(false);
    await cache.get();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('loader가 에러를 던지면 전파한다', async () => {
    const cache = new LazyCache(async () => {
      throw new Error('fail');
    });
    await expect(cache.get()).rejects.toThrow('fail');
    expect(cache.loaded).toBe(false);
  });

  it('동시 get() 호출 시 loader는 한 번만 실행된다', async () => {
    let callCount = 0;
    const loader = vi.fn(async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 50));
      return `result-${callCount}`;
    });
    const cache = new LazyCache(loader);

    const [r1, r2, r3] = await Promise.all([cache.get(), cache.get(), cache.get()]);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(r1).toBe('result-1');
    expect(r2).toBe('result-1');
    expect(r3).toBe('result-1');
  });

  it('동시 get() 중 loader 에러 시 모든 호출에 에러 전파 후 재시도 가능', async () => {
    let attempt = 0;
    const loader = vi.fn(async () => {
      attempt++;
      if (attempt === 1) throw new Error('first fail');
      return 'success';
    });
    const cache = new LazyCache(loader);

    const results = await Promise.allSettled([cache.get(), cache.get()]);
    expect(results[0].status).toBe('rejected');
    expect(results[1].status).toBe('rejected');
    expect(cache.loaded).toBe(false);

    const retryResult = await cache.get();
    expect(retryResult).toBe('success');
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
