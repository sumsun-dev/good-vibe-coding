import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  setBaseDir,
  getProject,
  createProject,
  updateProjectStatus,
} from '../scripts/lib/project/project-manager.js';
import { setJournalBaseDir } from '../scripts/lib/project/journal.js';

let tmpDir;

function writeRawProject(id, projectData) {
  const dir = join(tmpDir, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'project.json'), JSON.stringify(projectData, null, 2));
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'gvc-pm-journal-'));
  setBaseDir(tmpDir);
  setJournalBaseDir(tmpDir);
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('getProject — journal hydration', () => {
  it('jsonl이 있으면 state.journal에 복원된다', async () => {
    writeRawProject('proj-jsonl', { id: 'proj-jsonl', executionState: {} });
    const jsonlPath = join(tmpDir, 'proj-jsonl', 'journal.jsonl');
    writeFileSync(
      jsonlPath,
      [
        JSON.stringify({ type: 'phase-start', phase: 1, timestamp: 1000 }),
        JSON.stringify({ type: 'task-complete', taskId: 'a', timestamp: 1100 }),
      ].join('\n') + '\n',
    );

    const project = await getProject('proj-jsonl');
    expect(project.executionState.journal).toHaveLength(2);
    expect(project.executionState.journal[0].type).toBe('phase-start');
    expect(project.executionState.journal[1].type).toBe('task-complete');
  });

  it('jsonl 없고 project.json에 journal[] 있으면 그것 그대로 사용 (legacy)', async () => {
    writeRawProject('proj-legacy', {
      id: 'proj-legacy',
      executionState: {
        journal: [{ type: 'old-entry', timestamp: 5000 }],
      },
    });

    const project = await getProject('proj-legacy');
    expect(project.executionState.journal).toHaveLength(1);
    expect(project.executionState.journal[0].type).toBe('old-entry');
  });

  it('jsonl이 우선 — project.json에 journal[] 있어도 jsonl 사용', async () => {
    writeRawProject('proj-both', {
      id: 'proj-both',
      executionState: {
        journal: [{ type: 'stale-from-json', timestamp: 1 }],
      },
    });
    const jsonlPath = join(tmpDir, 'proj-both', 'journal.jsonl');
    writeFileSync(jsonlPath, JSON.stringify({ type: 'fresh-from-jsonl', timestamp: 2 }) + '\n');

    const project = await getProject('proj-both');
    expect(project.executionState.journal).toHaveLength(1);
    expect(project.executionState.journal[0].type).toBe('fresh-from-jsonl');
  });

  it('executionState 자체가 없으면 hydration이 executionState를 만들지 않는다', async () => {
    writeRawProject('proj-no-state', { id: 'proj-no-state' });
    const project = await getProject('proj-no-state');
    // jsonl 없으니 executionState는 없는 채로 유지
    expect(project.executionState).toBeUndefined();
  });

  it('jsonl 있으면 executionState 자동 생성', async () => {
    writeRawProject('proj-auto-state', { id: 'proj-auto-state' });
    const jsonlPath = join(tmpDir, 'proj-auto-state', 'journal.jsonl');
    writeFileSync(jsonlPath, JSON.stringify({ type: 'a', timestamp: 1 }) + '\n');

    const project = await getProject('proj-auto-state');
    expect(project.executionState).toBeDefined();
    expect(project.executionState.journal).toHaveLength(1);
  });
});

describe('write — journal jsonl sync + project.json strip', () => {
  it('createProject는 journal 필드 없이 project.json 저장', async () => {
    const project = await createProject('test', 'web-app', '설명');
    const raw = JSON.parse(readFileSync(join(tmpDir, project.id, 'project.json'), 'utf-8'));
    // 새 프로젝트는 executionState 없으니 journal도 없음
    expect(raw.executionState?.journal).toBeUndefined();
  });

  it('updateProjectStatus 후 jsonl sync 동작 (legacy → 자동 이전)', async () => {
    // 마이그레이션 안 한 프로젝트 시뮬레이션
    writeRawProject('legacy', {
      id: 'legacy',
      name: 'Legacy',
      type: 'web-app',
      description: '',
      mode: 'plan-only',
      status: 'planning',
      modifyHistory: [],
      team: [],
      discussion: { rounds: [], planDocument: '' },
      tasks: [],
      report: null,
      feedback: [],
      pullRequests: [],
      executionState: {
        journal: [
          { type: 'old-1', timestamp: 1 },
          { type: 'old-2', timestamp: 2 },
        ],
      },
    });

    // 어떤 write라도 발생하면 jsonl sync + strip
    await updateProjectStatus('legacy', 'approved');

    // jsonl에 2 entries 적힘
    const jsonlPath = join(tmpDir, 'legacy', 'journal.jsonl');
    expect(existsSync(jsonlPath)).toBe(true);
    const lines = readFileSync(jsonlPath, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(2);

    // project.json엔 journal 필드 빠짐
    const raw = JSON.parse(readFileSync(join(tmpDir, 'legacy', 'project.json'), 'utf-8'));
    expect(raw.executionState?.journal).toBeUndefined();
  });

  it('연속 write 시 delta만 append (중복 방지)', async () => {
    writeRawProject('delta', {
      id: 'delta',
      name: 'Delta',
      type: 'web-app',
      description: '',
      mode: 'plan-only',
      status: 'planning',
      modifyHistory: [],
      team: [],
      discussion: { rounds: [], planDocument: '' },
      tasks: [],
      report: null,
      feedback: [],
      pullRequests: [],
      executionState: { journal: [{ type: 'a', timestamp: 1 }] },
    });

    await updateProjectStatus('delta', 'approved');

    const jsonlPath = join(tmpDir, 'delta', 'journal.jsonl');
    let lines = readFileSync(jsonlPath, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(1);

    // 두 번째 status update — journal 변경 없음
    // updateProjectStatus가 read → mutate → write이므로
    // hydration된 journal(jsonl 1개)가 다시 mutate 함수에 들어가고
    // delta sync는 0이어야 (이미 1개 있고 length 동일)
    const allowedNext = (current) => (current === 'approved' ? 'planning' : 'approved');
    void allowedNext;
    // 'approved' → 'planning' 전이 허용
    await updateProjectStatus('delta', 'planning');

    lines = readFileSync(jsonlPath, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(1); // 중복 append 안 됨
  });
});
