import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { acquireFileLock, releaseFileLock, withFileLock } from '../scripts/lib/core/file-lock.js';

let tmpDir;
let lockPath;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'gvc-lock-'));
  lockPath = join(tmpDir, '.lock');
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('acquireFileLock / releaseFileLock', () => {
  it('획득 후 lockfile이 존재하고, 해제 후 사라진다', async () => {
    const handle = await acquireFileLock(lockPath);
    expect(existsSync(lockPath)).toBe(true);
    await releaseFileLock(handle);
    expect(existsSync(lockPath)).toBe(false);
  });

  it('lockfile에는 PID와 timestamp가 JSON으로 기록된다', async () => {
    const handle = await acquireFileLock(lockPath);
    const { readFileSync } = await import('fs');
    const content = JSON.parse(readFileSync(lockPath, 'utf-8'));
    expect(content.pid).toBe(process.pid);
    expect(typeof content.acquiredAt).toBe('number');
    await releaseFileLock(handle);
  });

  it('같은 프로세스에서 재진입(reentrant)이 가능하다 — 카운트 기반', async () => {
    const handle1 = await acquireFileLock(lockPath);
    const handle2 = await acquireFileLock(lockPath);
    expect(existsSync(lockPath)).toBe(true);

    await releaseFileLock(handle2);
    expect(existsSync(lockPath)).toBe(true); // 첫 락은 살아있음

    await releaseFileLock(handle1);
    expect(existsSync(lockPath)).toBe(false);
  });

  it('이미 점유된 락은 retry 후 timeout 시 에러를 던진다', async () => {
    // 살아있는 다른 프로세스 흉내 (ppid는 거의 항상 alive — vitest 부모)
    writeFileSync(lockPath, JSON.stringify({ pid: process.ppid, acquiredAt: Date.now() }));

    await expect(
      acquireFileLock(lockPath, { timeoutMs: 200, retryMs: 50, staleMs: 60_000 }),
    ).rejects.toThrow(/lock/i);
  });

  it('stale lock (죽은 PID 또는 staleMs 초과)은 강제 해제된다', async () => {
    // staleMs를 매우 짧게 + 매우 오래된 timestamp
    writeFileSync(lockPath, JSON.stringify({ pid: 999999, acquiredAt: Date.now() - 1_000_000 }));

    const handle = await acquireFileLock(lockPath, {
      timeoutMs: 1000,
      retryMs: 50,
      staleMs: 500,
    });

    const { readFileSync } = await import('fs');
    const content = JSON.parse(readFileSync(lockPath, 'utf-8'));
    expect(content.pid).toBe(process.pid);
    await releaseFileLock(handle);
  });
});

describe('withFileLock', () => {
  it('fn이 락 안에서 실행되고, 정상 종료 시 락이 해제된다', async () => {
    const result = await withFileLock(lockPath, async () => {
      expect(existsSync(lockPath)).toBe(true);
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(existsSync(lockPath)).toBe(false);
  });

  it('fn이 throw 해도 락이 해제된다', async () => {
    await expect(
      withFileLock(lockPath, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(existsSync(lockPath)).toBe(false);
  });

  it('동일 프로세스 동시 호출 시 직렬화된다', async () => {
    const order = [];
    const t1 = withFileLock(lockPath, async () => {
      order.push('t1-start');
      await new Promise((r) => setTimeout(r, 50));
      order.push('t1-end');
    });
    const t2 = withFileLock(lockPath, async () => {
      order.push('t2-start');
      order.push('t2-end');
    });
    await Promise.all([t1, t2]);
    expect(order).toEqual(['t1-start', 't1-end', 't2-start', 't2-end']);
  });
});
