import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  migrateProjectJournal,
  migrateAllJournals,
} from '../scripts/lib/project/journal-migration.js';
import { setBaseDir } from '../scripts/lib/project/project-manager.js';
import { setJournalBaseDir } from '../scripts/lib/project/journal.js';

let tmpDir;

function createProject(id, projectData) {
  const dir = join(tmpDir, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'project.json'), JSON.stringify(projectData, null, 2));
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'gvc-migrate-'));
  setBaseDir(tmpDir);
  setJournalBaseDir(tmpDir);
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('migrateProjectJournal — 단일 프로젝트', () => {
  it('executionState.journal[]을 jsonl로 이전한다', async () => {
    createProject('proj-a', {
      id: 'proj-a',
      executionState: {
        journal: [
          { type: 'phase-start', phase: 1, timestamp: 1000 },
          { type: 'task-complete', taskId: 'a', timestamp: 1100 },
        ],
      },
    });

    const result = await migrateProjectJournal('proj-a');
    expect(result.migrated).toBe(true);
    expect(result.entriesCount).toBe(2);

    // jsonl 파일 생성 확인
    const jsonlPath = join(tmpDir, 'proj-a', 'journal.jsonl');
    expect(existsSync(jsonlPath)).toBe(true);
    const lines = readFileSync(jsonlPath, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).type).toBe('phase-start');
    expect(JSON.parse(lines[1]).type).toBe('task-complete');

    // project.json에서 journal 필드 제거 확인
    const projectAfter = JSON.parse(readFileSync(join(tmpDir, 'proj-a', 'project.json'), 'utf-8'));
    expect(projectAfter.executionState.journal).toBeUndefined();
  });

  it('이미 jsonl이 있으면 skip', async () => {
    createProject('proj-b', {
      id: 'proj-b',
      executionState: { journal: [{ type: 'a', timestamp: 1 }] },
    });
    const dir = join(tmpDir, 'proj-b');
    writeFileSync(join(dir, 'journal.jsonl'), JSON.stringify({ type: 'existing' }) + '\n');

    const result = await migrateProjectJournal('proj-b');
    expect(result.migrated).toBe(false);
    expect(result.reason).toMatch(/이미|already/i);

    // jsonl은 그대로
    const lines = readFileSync(join(tmpDir, 'proj-b', 'journal.jsonl'), 'utf-8')
      .trim()
      .split('\n');
    expect(JSON.parse(lines[0]).type).toBe('existing');
  });

  it('journal이 없거나 비어있으면 skip', async () => {
    createProject('proj-c', { id: 'proj-c', executionState: {} });
    const result = await migrateProjectJournal('proj-c');
    expect(result.migrated).toBe(false);
    expect(result.entriesCount).toBe(0);
  });

  it('executionState 자체가 없으면 skip', async () => {
    createProject('proj-d', { id: 'proj-d' });
    const result = await migrateProjectJournal('proj-d');
    expect(result.migrated).toBe(false);
  });

  it('dry-run 모드는 파일을 변경하지 않는다', async () => {
    createProject('proj-e', {
      id: 'proj-e',
      executionState: {
        journal: [{ type: 'phase-start', phase: 1, timestamp: 1 }],
      },
    });

    const result = await migrateProjectJournal('proj-e', { dryRun: true });
    expect(result.migrated).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.entriesCount).toBe(1);

    expect(existsSync(join(tmpDir, 'proj-e', 'journal.jsonl'))).toBe(false);
    const projectAfter = JSON.parse(readFileSync(join(tmpDir, 'proj-e', 'project.json'), 'utf-8'));
    expect(projectAfter.executionState.journal).toHaveLength(1);
  });

  it('손상된 entry는 skip하고 valid만 이전 + 보고', async () => {
    createProject('proj-f', {
      id: 'proj-f',
      executionState: {
        journal: [
          { type: 'good', timestamp: 1 },
          'invalid-entry-string',
          { /* type 누락 */ data: 'x', timestamp: 2 },
          { type: 'good2', timestamp: 3 },
        ],
      },
    });

    const result = await migrateProjectJournal('proj-f');
    expect(result.migrated).toBe(true);
    expect(result.entriesCount).toBe(2);
    expect(result.skippedCount).toBe(2);

    const lines = readFileSync(join(tmpDir, 'proj-f', 'journal.jsonl'), 'utf-8')
      .trim()
      .split('\n');
    expect(lines).toHaveLength(2);
  });
});

describe('migrateAllJournals — 일괄 마이그레이션', () => {
  it('모든 프로젝트를 순회하며 마이그레이션', async () => {
    createProject('p1', {
      id: 'p1',
      executionState: { journal: [{ type: 'a', timestamp: 1 }] },
    });
    createProject('p2', {
      id: 'p2',
      executionState: { journal: [{ type: 'b', timestamp: 2 }] },
    });
    createProject('p3', { id: 'p3' }); // journal 없음

    const result = await migrateAllJournals();
    expect(result.totalProjects).toBe(3);
    expect(result.migratedCount).toBe(2);
    expect(result.skippedCount).toBe(1);
    expect(result.failedCount).toBe(0);
  });

  it('손상된 프로젝트는 graceful skip (failedCount 증가)', async () => {
    const dir = join(tmpDir, 'corrupt');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'project.json'), '{ invalid json');

    createProject('healthy', {
      id: 'healthy',
      executionState: { journal: [{ type: 'a', timestamp: 1 }] },
    });

    const result = await migrateAllJournals();
    expect(result.totalProjects).toBe(2);
    expect(result.migratedCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].projectId).toBe('corrupt');
  });

  it('dry-run 일괄 모드', async () => {
    createProject('p1', {
      id: 'p1',
      executionState: { journal: [{ type: 'a', timestamp: 1 }] },
    });

    const result = await migrateAllJournals({ dryRun: true });
    expect(result.migratedCount).toBe(1);
    expect(result.dryRun).toBe(true);
    expect(existsSync(join(tmpDir, 'p1', 'journal.jsonl'))).toBe(false);
  });
});
