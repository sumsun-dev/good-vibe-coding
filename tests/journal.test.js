import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  appendJournalEntry,
  readJournalEntries,
  truncateJournalAtSize,
  clearJournal,
  setJournalBaseDir,
} from '../scripts/lib/project/journal.js';

let tmpDir;
const projectId = 'test-project-2026-04';

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'gvc-journal-'));
  setJournalBaseDir(tmpDir);
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('appendJournalEntry / readJournalEntries', () => {
  it('빈 journal에 entry를 추가하고 읽을 수 있다', async () => {
    await appendJournalEntry(projectId, { type: 'phase-start', phase: 1 });
    const entries = await readJournalEntries(projectId);
    expect(entries).toHaveLength(1);
    expect(entries[0].type).toBe('phase-start');
    expect(entries[0].phase).toBe(1);
    expect(typeof entries[0].timestamp).toBe('number');
  });

  it('파일이 없으면 빈 배열을 반환한다', async () => {
    const entries = await readJournalEntries(projectId);
    expect(entries).toEqual([]);
  });

  it('여러 entry를 순서대로 보존한다', async () => {
    await appendJournalEntry(projectId, { type: 'a' });
    await appendJournalEntry(projectId, { type: 'b' });
    await appendJournalEntry(projectId, { type: 'c' });
    const entries = await readJournalEntries(projectId);
    expect(entries.map((e) => e.type)).toEqual(['a', 'b', 'c']);
  });

  it('동시 append가 직렬화되어 모든 entry가 보존된다', async () => {
    const tasks = Array.from({ length: 20 }, (_, i) =>
      appendJournalEntry(projectId, { type: 'event', seq: i }),
    );
    await Promise.all(tasks);
    const entries = await readJournalEntries(projectId);
    expect(entries).toHaveLength(20);
    const seqs = entries.map((e) => e.seq).sort((a, b) => a - b);
    expect(seqs).toEqual([...Array(20).keys()]);
  });

  it('손상된 줄(invalid JSON)은 건너뛴다', async () => {
    await appendJournalEntry(projectId, { type: 'good-1' });
    const journalPath = join(tmpDir, projectId, 'journal.jsonl');
    const fs = await import('fs/promises');
    await fs.appendFile(journalPath, 'INVALID JSON LINE\n');
    await appendJournalEntry(projectId, { type: 'good-2' });

    const entries = await readJournalEntries(projectId);
    expect(entries.map((e) => e.type)).toEqual(['good-1', 'good-2']);
  });

  it('빈 줄은 건너뛴다', async () => {
    await appendJournalEntry(projectId, { type: 'a' });
    const journalPath = join(tmpDir, projectId, 'journal.jsonl');
    const fs = await import('fs/promises');
    await fs.appendFile(journalPath, '\n\n');
    await appendJournalEntry(projectId, { type: 'b' });

    const entries = await readJournalEntries(projectId);
    expect(entries.map((e) => e.type)).toEqual(['a', 'b']);
  });
});

describe('readJournalEntries 옵션', () => {
  beforeEach(async () => {
    await appendJournalEntry(projectId, { type: 'a', seq: 0 });
    await appendJournalEntry(projectId, { type: 'b', seq: 1 });
    await appendJournalEntry(projectId, { type: 'a', seq: 2 });
    await appendJournalEntry(projectId, { type: 'c', seq: 3 });
  });

  it('limit 옵션은 가장 최근 N개만 반환한다', async () => {
    const entries = await readJournalEntries(projectId, { limit: 2 });
    expect(entries.map((e) => e.seq)).toEqual([2, 3]);
  });

  it('type 필터로 특정 type entry만 반환한다', async () => {
    const entries = await readJournalEntries(projectId, { type: 'a' });
    expect(entries.map((e) => e.seq)).toEqual([0, 2]);
  });

  it('since (timestamp) 필터로 그 이후 entry만 반환한다', async () => {
    const all = await readJournalEntries(projectId);
    const sinceTs = all[1].timestamp;
    const entries = await readJournalEntries(projectId, { since: sinceTs });
    expect(entries.map((e) => e.seq)).toEqual([2, 3]);
  });
});

describe('truncateJournalAtSize', () => {
  it('maxLines를 초과한 오래된 entry를 제거한다', async () => {
    for (let i = 0; i < 10; i++) {
      await appendJournalEntry(projectId, { type: 'event', seq: i });
    }
    await truncateJournalAtSize(projectId, 3);

    const entries = await readJournalEntries(projectId);
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.seq)).toEqual([7, 8, 9]);
  });

  it('maxLines 미만이면 변경 없음', async () => {
    await appendJournalEntry(projectId, { type: 'a' });
    await appendJournalEntry(projectId, { type: 'b' });
    await truncateJournalAtSize(projectId, 10);

    const entries = await readJournalEntries(projectId);
    expect(entries).toHaveLength(2);
  });

  it('파일이 없어도 에러 없음', async () => {
    await expect(truncateJournalAtSize('nonexistent', 5)).resolves.not.toThrow();
  });
});

describe('clearJournal', () => {
  it('journal 파일을 삭제한다', async () => {
    await appendJournalEntry(projectId, { type: 'a' });
    const journalPath = join(tmpDir, projectId, 'journal.jsonl');
    expect(existsSync(journalPath)).toBe(true);

    await clearJournal(projectId);
    expect(existsSync(journalPath)).toBe(false);
  });

  it('파일이 없어도 에러 없음', async () => {
    await expect(clearJournal('nonexistent')).resolves.not.toThrow();
  });
});

describe('appendJournalEntry — entry 정규화', () => {
  it('timestamp가 자동 추가된다', async () => {
    const before = Date.now();
    await appendJournalEntry(projectId, { type: 'x' });
    const after = Date.now();
    const entries = await readJournalEntries(projectId);
    expect(entries[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(entries[0].timestamp).toBeLessThanOrEqual(after);
  });

  it('명시적 timestamp가 있으면 그대로 사용한다', async () => {
    await appendJournalEntry(projectId, { type: 'x', timestamp: 12345 });
    const entries = await readJournalEntries(projectId);
    expect(entries[0].timestamp).toBe(12345);
  });

  it('type 필드는 필수다', async () => {
    // 어차피 외부 입력이라 검증
    writeFileSync;
    await expect(appendJournalEntry(projectId, {})).rejects.toThrow(/type/i);
  });
});
