/**
 * journal — append-only 이벤트 로그 (JSONL)
 *
 * project.json에 journal[]을 끼우면 매번 read/write에서 전체를 serialize 해야 한다.
 * 별도 jsonl 파일로 분리하여 append는 O(1), 읽기는 stream 기반으로 가능하게 한다.
 *
 * Phase 2 일반화의 핵심 — 수십~수백 phase의 대규모 프로젝트에서 I/O 폭증 방지.
 *
 * 외부 의존성 0. file-lock으로 직렬화.
 */

import { appendFile, readFile, unlink, writeFile, mkdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { projectsDir } from '../core/app-paths.js';
import { withFileLock } from '../core/file-lock.js';
import { inputError } from '../core/validators.js';

let baseDir = projectsDir();

/**
 * 테스트용 — journal 파일들의 베이스 디렉토리 설정.
 * @param {string} dir
 */
export function setJournalBaseDir(dir) {
  baseDir = dir;
}

function getJournalPath(projectId) {
  return resolve(baseDir, projectId, 'journal.jsonl');
}

function getJournalLockPath(projectId) {
  return resolve(baseDir, '.locks', `${projectId}-journal.lock`);
}

/**
 * 자동 할당 timestamp의 monotonic 보장용. 같은 ms 내 다중 append 시에도
 * 순서가 보존되도록 (now <= last)일 때 last+1로 증가시킨다.
 * 명시 timestamp가 들어오면 그대로 사용한다 (재현/마이그레이션 케이스).
 */
let lastAutoTimestamp = 0;

function normalizeEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    throw inputError('journal entry는 object여야 합니다');
  }
  if (!entry.type || typeof entry.type !== 'string') {
    throw inputError('journal entry는 type 필드가 필요합니다');
  }

  let timestamp;
  if (typeof entry.timestamp === 'number') {
    timestamp = entry.timestamp;
  } else {
    const now = Date.now();
    timestamp = now <= lastAutoTimestamp ? lastAutoTimestamp + 1 : now;
    lastAutoTimestamp = timestamp;
  }

  return { timestamp, ...entry };
}

function parseLines(content) {
  if (!content) return [];
  const lines = content.split('\n');
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') out.push(parsed);
    } catch {
      // 손상된 줄 skip
    }
  }
  return out;
}

async function readRawEntries(projectId) {
  try {
    const content = await readFile(getJournalPath(projectId), 'utf-8');
    return parseLines(content);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

/**
 * journal에 entry를 추가한다 (append-only).
 *
 * @param {string} projectId
 * @param {{ type: string, timestamp?: number, [key: string]: any }} entry
 * @returns {Promise<object>} 정규화된 entry (timestamp 포함)
 */
export async function appendJournalEntry(projectId, entry) {
  const normalized = normalizeEntry(entry);
  const lockPath = getJournalLockPath(projectId);

  return withFileLock(lockPath, async () => {
    const journalPath = getJournalPath(projectId);
    await mkdir(dirname(journalPath), { recursive: true });
    await appendFile(journalPath, JSON.stringify(normalized) + '\n', 'utf-8');
    return normalized;
  });
}

/**
 * journal entry를 읽는다.
 *
 * @param {string} projectId
 * @param {object} [options]
 * @param {string} [options.type] - 특정 type 필터
 * @param {number} [options.since] - 이 timestamp 초과 entry만
 * @param {number} [options.limit] - 최근 N개만 (필터 적용 후)
 * @returns {Promise<Array<object>>}
 */
export async function readJournalEntries(projectId, options = {}) {
  const all = await readRawEntries(projectId);
  let filtered = all;

  if (options.type) {
    filtered = filtered.filter((e) => e.type === options.type);
  }

  if (typeof options.since === 'number') {
    filtered = filtered.filter(
      (e) => typeof e.timestamp === 'number' && e.timestamp > options.since,
    );
  }

  if (typeof options.limit === 'number' && options.limit >= 0) {
    filtered = filtered.slice(-options.limit);
  }

  return filtered;
}

/**
 * journal을 마지막 N entry만 남기고 잘라낸다 (오래된 것 제거).
 *
 * @param {string} projectId
 * @param {number} maxLines
 */
export async function truncateJournalAtSize(projectId, maxLines) {
  if (typeof maxLines !== 'number' || maxLines < 0) {
    throw inputError('maxLines는 0 이상의 숫자여야 합니다');
  }
  const lockPath = getJournalLockPath(projectId);

  return withFileLock(lockPath, async () => {
    const all = await readRawEntries(projectId);
    if (all.length <= maxLines) return;

    const journalPath = getJournalPath(projectId);
    const kept = all.slice(-maxLines);
    const content = kept.map((e) => JSON.stringify(e)).join('\n') + (kept.length > 0 ? '\n' : '');
    await writeFile(journalPath, content, 'utf-8');
  });
}

/**
 * journal 파일을 완전히 제거한다.
 *
 * @param {string} projectId
 */
export async function clearJournal(projectId) {
  const lockPath = getJournalLockPath(projectId);

  return withFileLock(lockPath, async () => {
    try {
      await unlink(getJournalPath(projectId));
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  });
}

/**
 * journal 파일 경로를 반환한다 (테스트/디버깅용).
 * @param {string} projectId
 * @returns {string}
 */
export function getJournalFilePath(projectId) {
  return getJournalPath(projectId);
}
