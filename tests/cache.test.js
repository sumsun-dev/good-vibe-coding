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
    const cache = new LazyCache(async () => { throw new Error('fail'); });
    await expect(cache.get()).rejects.toThrow('fail');
    expect(cache.loaded).toBe(false);
  });
});
