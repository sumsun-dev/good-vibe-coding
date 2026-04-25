/**
 * file-lock — 파일 시스템 기반 분산 락
 *
 * 멀티 프로세스 안전. atomic O_EXCL create + PID/timestamp 기록 + stale 감지.
 * 같은 프로세스 내에서는 reentrant (카운터 기반).
 *
 * 외부 의존성 0. proper-lockfile 같은 패키지 대신 자체 구현.
 */

import { open, unlink, readFile, writeFile, stat, mkdir } from 'fs/promises';
import { dirname } from 'path';

const DEFAULTS = {
  timeoutMs: 10_000,
  retryMs: 50,
  staleMs: 60_000,
};

/** 같은 프로세스 내 reentrant 카운터: Map<lockPath, { count: number, owner: symbol }> */
const reentrantCounts = new Map();

/** 같은 프로세스 내 직렬화 큐: Map<lockPath, Promise<void>> */
const inProcessQueue = new Map();

function isProcessAlive(pid) {
  if (typeof pid !== 'number' || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if (err.code === 'ESRCH') return false;
    if (err.code === 'EPERM') return true;
    return false;
  }
}

async function readLockMeta(lockPath) {
  try {
    const raw = await readFile(lockPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function isStale(lockPath, staleMs) {
  const meta = await readLockMeta(lockPath);
  if (!meta) return false;

  // 같은 PID는 stale 아님 (reentrant는 다른 경로로 처리)
  if (meta.pid === process.pid) return false;

  // 다른 PID가 죽었으면 stale
  if (!isProcessAlive(meta.pid)) return true;

  // PID 살아있어도 너무 오래됐으면 stale (hung process)
  if (typeof meta.acquiredAt !== 'number') return true;
  if (Date.now() - meta.acquiredAt > staleMs) return true;

  return false;
}

async function tryWriteLockfile(lockPath) {
  let handle;
  try {
    await mkdir(dirname(lockPath), { recursive: true });
    handle = await open(lockPath, 'wx');
    const meta = { pid: process.pid, acquiredAt: Date.now() };
    await handle.write(JSON.stringify(meta));
    await handle.close();
    return true;
  } catch (err) {
    if (handle) {
      try {
        await handle.close();
      } catch {
        // close 실패는 무시
      }
    }
    if (err.code === 'EEXIST') return false;
    throw err;
  }
}

async function forceUnlink(lockPath) {
  try {
    await unlink(lockPath);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

/**
 * 파일 락을 획득한다.
 *
 * - 같은 프로세스 reentrant: 카운터 증가만
 * - 다른 프로세스: O_EXCL로 lockfile 시도, 실패 시 stale 검사 후 retry
 * - timeout 초과 시 에러
 *
 * @param {string} lockPath - 락 파일 경로
 * @param {object} [options]
 * @param {number} [options.timeoutMs=10000] - 획득 타임아웃
 * @param {number} [options.retryMs=50] - 재시도 간격
 * @param {number} [options.staleMs=60000] - stale 판정 임계 (acquiredAt 기준)
 * @returns {Promise<{ lockPath: string, owner: symbol }>}
 */
export async function acquireFileLock(lockPath, options = {}) {
  const opts = { ...DEFAULTS, ...options };

  // 같은 프로세스 reentrant: 이미 가지고 있으면 카운터만 증가
  const existing = reentrantCounts.get(lockPath);
  if (existing) {
    existing.count++;
    return { lockPath, owner: existing.owner, reentrant: true };
  }

  const owner = Symbol('file-lock-owner');
  const deadline = Date.now() + opts.timeoutMs;

  while (Date.now() <= deadline) {
    if (await tryWriteLockfile(lockPath)) {
      reentrantCounts.set(lockPath, { count: 1, owner });
      return { lockPath, owner, reentrant: false };
    }

    // 점유된 상태 — stale 검사
    if (await isStale(lockPath, opts.staleMs)) {
      await forceUnlink(lockPath);
      continue; // 즉시 재시도
    }

    await new Promise((r) => setTimeout(r, opts.retryMs));
  }

  const meta = await readLockMeta(lockPath);
  const holder = meta
    ? `pid=${meta.pid}, acquiredAt=${new Date(meta.acquiredAt).toISOString()}`
    : 'unknown';
  throw new Error(`file lock 획득 실패: ${lockPath} (${holder}, timeout=${opts.timeoutMs}ms)`);
}

/**
 * 파일 락을 해제한다.
 * @param {{ lockPath: string, owner: symbol, reentrant?: boolean }} handle
 */
export async function releaseFileLock(handle) {
  if (!handle || !handle.lockPath) return;
  const { lockPath, owner } = handle;

  const entry = reentrantCounts.get(lockPath);
  if (!entry || entry.owner !== owner) return;

  entry.count--;
  if (entry.count > 0) return;

  reentrantCounts.delete(lockPath);
  await forceUnlink(lockPath);
}

/**
 * 락 안에서 fn을 실행한다. 동일 프로세스 동시 호출은 직렬화된다.
 * @template T
 * @param {string} lockPath
 * @param {() => Promise<T>} fn
 * @param {object} [options]
 * @returns {Promise<T>}
 */
export async function withFileLock(lockPath, fn, options = {}) {
  // In-process 직렬화: 같은 lockPath의 동시 호출이 reentrant로 들어가지 않게
  const prev = inProcessQueue.get(lockPath) || Promise.resolve();
  let releaseQueue;
  const queuePromise = new Promise((r) => {
    releaseQueue = r;
  });
  inProcessQueue.set(lockPath, queuePromise);

  await prev;
  try {
    const handle = await acquireFileLock(lockPath, options);
    try {
      return await fn();
    } finally {
      await releaseFileLock(handle);
    }
  } finally {
    releaseQueue();
    if (inProcessQueue.get(lockPath) === queuePromise) {
      inProcessQueue.delete(lockPath);
    }
  }
}

/**
 * 락 디렉토리가 존재하는지 확인한다 (테스트/디버깅용).
 * @param {string} lockPath
 * @returns {Promise<object|null>} lockfile meta 또는 null
 */
export async function inspectLock(lockPath) {
  try {
    await stat(lockPath);
    return await readLockMeta(lockPath);
  } catch {
    return null;
  }
}

/**
 * 테스트용 — reentrant 상태를 초기화한다.
 */
export function _resetForTesting() {
  reentrantCounts.clear();
  inProcessQueue.clear();
}

// writeFile은 fs/promises에서 import했지만 내부에서 사용하지 않음.
// future: lockfile에 추가 메타 기록 시 사용.
void writeFile;
