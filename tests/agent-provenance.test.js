/**
 * agent-provenance — origin 메타데이터 CRUD 단위 테스트
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile, readFile } from 'fs/promises';
import { resolve } from 'path';
import {
  setProvenanceDir,
  validateProvenanceEntry,
  loadProvenance,
  saveProvenance,
  appendProvenanceEntry,
  removeProvenanceEntry,
  clearProvenance,
  formatProvenance,
} from '../scripts/lib/agent/agent-provenance.js';

const TMP_DIR = resolve('.tmp-test-agent-provenance');

beforeEach(async () => {
  await mkdir(TMP_DIR, { recursive: true });
  setProvenanceDir(TMP_DIR);
});

afterEach(async () => {
  await rm(TMP_DIR, { recursive: true, force: true });
});

function provenancePath(roleId) {
  return resolve(TMP_DIR, `${roleId}.provenance.json`);
}

describe('validateProvenanceEntry', () => {
  it("source='project-feedback'에 projectId 필수", () => {
    expect(() => validateProvenanceEntry({ source: 'project-feedback' })).toThrow('projectId');
  });

  it("source='cross-project-pattern'에 projectIds + pattern 필수", () => {
    expect(() =>
      validateProvenanceEntry({ source: 'cross-project-pattern', projectIds: [] }),
    ).toThrow('projectIds');
    expect(() =>
      validateProvenanceEntry({
        source: 'cross-project-pattern',
        projectIds: ['p-1'],
      }),
    ).toThrow('pattern');
  });

  it("source='manual'은 추가 필드 없이도 통과", () => {
    const result = validateProvenanceEntry({ source: 'manual', summary: 'CEO 직접 추가' });
    expect(result.source).toBe('manual');
    expect(result.id).toMatch(/^ent-[a-f0-9]{12}$/);
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('알 수 없는 source 거부', () => {
    expect(() => validateProvenanceEntry({ source: 'unknown' })).toThrow('유효하지 않은 source');
  });

  it('id/timestamp가 명시되면 그대로 사용', () => {
    const result = validateProvenanceEntry({
      source: 'manual',
      id: 'ent-fixed-id',
      timestamp: '2026-04-01T00:00:00Z',
    });
    expect(result.id).toBe('ent-fixed-id');
    expect(result.timestamp).toBe('2026-04-01T00:00:00Z');
  });
});

describe('loadProvenance', () => {
  it('파일 없으면 빈 entries 반환', async () => {
    const file = await loadProvenance('cto');
    expect(file).toEqual({ roleId: 'cto', revision: '', lastUpdated: '', entries: [] });
  });

  it('정상 파일을 그대로 읽는다', async () => {
    const data = {
      roleId: 'cto',
      revision: '2.0.0-rc.1',
      lastUpdated: '2026-04-27T10:00:00Z',
      entries: [
        {
          id: 'ent-001',
          source: 'manual',
          timestamp: '2026-04-27T10:00:00Z',
          summary: '초기 추가',
        },
      ],
    };
    await writeFile(provenancePath('cto'), JSON.stringify(data), 'utf-8');

    const file = await loadProvenance('cto');
    expect(file.roleId).toBe('cto');
    expect(file.revision).toBe('2.0.0-rc.1');
    expect(file.entries).toHaveLength(1);
    expect(file.entries[0].source).toBe('manual');
  });

  it('손상된 JSON은 빈 구조로 graceful', async () => {
    await writeFile(provenancePath('cto'), '{ this is not json', 'utf-8');
    const file = await loadProvenance('cto');
    expect(file.entries).toEqual([]);
  });

  it('잘못된 roleId 거부', async () => {
    await expect(loadProvenance('../../../etc/passwd')).rejects.toThrow('유효하지 않은 roleId');
  });
});

describe('saveProvenance', () => {
  it('전체 파일을 덮어쓴다', async () => {
    await saveProvenance({
      roleId: 'qa',
      revision: 'r1',
      lastUpdated: '2026-04-01T00:00:00Z',
      entries: [
        {
          id: 'ent-x',
          source: 'manual',
          timestamp: '2026-04-01T00:00:00Z',
        },
      ],
    });

    const raw = await readFile(provenancePath('qa'), 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed.roleId).toBe('qa');
    expect(parsed.entries).toHaveLength(1);
  });

  it('lastUpdated가 비어있으면 자동 채움', async () => {
    await saveProvenance({ roleId: 'qa', entries: [] });
    const file = await loadProvenance('qa');
    expect(file.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('appendProvenanceEntry', () => {
  it('첫 entry 추가 시 파일 생성', async () => {
    const saved = await appendProvenanceEntry(
      'cto',
      {
        source: 'project-feedback',
        projectId: 'weather-bot-2025-12-abc',
        signals: { quality: 4, time: 2000, cost: 0.5, retry: 1, escalation: 1, contribution: 1 },
        summary: 'TDD 강제 추가',
      },
      { revision: '2.0.0-rc.1' },
    );

    expect(saved.id).toMatch(/^ent-[a-f0-9]{12}$/);
    expect(saved.signals.quality).toBe(4);

    const file = await loadProvenance('cto');
    expect(file.revision).toBe('2.0.0-rc.1');
    expect(file.entries).toHaveLength(1);
    expect(file.entries[0].id).toBe(saved.id);
  });

  it('기존 entries 보존하며 append', async () => {
    await appendProvenanceEntry('cto', {
      source: 'manual',
      summary: 'first',
    });
    await appendProvenanceEntry('cto', {
      source: 'manual',
      summary: 'second',
    });

    const file = await loadProvenance('cto');
    expect(file.entries).toHaveLength(2);
    expect(file.entries[0].summary).toBe('first');
    expect(file.entries[1].summary).toBe('second');
  });

  it('signals 필드를 그대로 보존 (agent-performance 통합 지점)', async () => {
    const signals = {
      quality: 0,
      time: 5000,
      cost: 0.12,
      retry: 0,
      escalation: 0,
      contribution: 1,
    };
    await appendProvenanceEntry('qa', {
      source: 'project-feedback',
      projectId: 'p-1',
      signals,
    });

    const file = await loadProvenance('qa');
    expect(file.entries[0].signals).toEqual(signals);
  });

  it('cross-project-pattern entry 추가', async () => {
    await appendProvenanceEntry('qa', {
      source: 'cross-project-pattern',
      projectIds: ['p-1', 'p-2', 'p-3'],
      pattern: 'edge-case-coverage',
      repeatCount: 3,
    });

    const file = await loadProvenance('qa');
    expect(file.entries[0].source).toBe('cross-project-pattern');
    expect(file.entries[0].projectIds).toEqual(['p-1', 'p-2', 'p-3']);
    expect(file.entries[0].pattern).toBe('edge-case-coverage');
  });
});

describe('removeProvenanceEntry', () => {
  it('id로 entry 제거', async () => {
    const a = await appendProvenanceEntry('cto', { source: 'manual', summary: 'a' });
    const b = await appendProvenanceEntry('cto', { source: 'manual', summary: 'b' });

    const result = await removeProvenanceEntry('cto', a.id);
    expect(result).toEqual({ removed: true, remaining: 1 });

    const file = await loadProvenance('cto');
    expect(file.entries).toHaveLength(1);
    expect(file.entries[0].id).toBe(b.id);
  });

  it('존재하지 않는 id는 removed=false', async () => {
    await appendProvenanceEntry('cto', { source: 'manual' });
    const result = await removeProvenanceEntry('cto', 'ent-nonexistent');
    expect(result.removed).toBe(false);
  });

  it('빈 entryId 거부', async () => {
    await expect(removeProvenanceEntry('cto', '')).rejects.toThrow('entryId');
  });
});

describe('clearProvenance', () => {
  it('파일 삭제', async () => {
    await appendProvenanceEntry('cto', { source: 'manual' });
    const result = await clearProvenance('cto');
    expect(result.deleted).toBe(true);

    const file = await loadProvenance('cto');
    expect(file.entries).toEqual([]);
  });

  it('파일이 없으면 deleted=false', async () => {
    const result = await clearProvenance('cto');
    expect(result.deleted).toBe(false);
  });
});

describe('formatProvenance', () => {
  it('빈 file은 "학습 이력 없음" 표시', () => {
    const md = formatProvenance({ roleId: 'cto', entries: [] });
    expect(md).toContain('학습 이력 — cto');
    expect(md).toContain('학습 이력 없음');
  });

  it('null/잘못된 입력은 빈 문자열', () => {
    expect(formatProvenance(null)).toBe('');
    expect(formatProvenance('not object')).toBe('');
  });

  it('project-feedback entry에 projectId + signals 표시', () => {
    const file = {
      roleId: 'cto',
      revision: '2.0.0-rc.1',
      lastUpdated: '2026-04-28T00:00:00Z',
      entries: [
        {
          id: 'ent-001',
          source: 'project-feedback',
          projectId: 'proj-abc',
          timestamp: '2026-04-20T10:00:00Z',
          summary: 'TDD 강제',
          signals: { quality: 4, time: 2000, cost: 0.5, retry: 1, escalation: 0, contribution: 1 },
        },
      ],
    };
    const md = formatProvenance(file);
    expect(md).toContain('ent-001');
    expect(md).toContain('project-feedback');
    expect(md).toContain('proj-abc');
    expect(md).toContain('TDD 강제');
    expect(md).toContain('quality=4');
    expect(md).toContain('time=2000');
    expect(md).toContain('--revert=');
  });

  it('cross-project-pattern entry에 patterns + repeatCount 표시', () => {
    const file = {
      roleId: 'qa',
      entries: [
        {
          id: 'ent-002',
          source: 'cross-project-pattern',
          projectIds: ['p-1', 'p-2', 'p-3'],
          pattern: 'edge-case-coverage',
          repeatCount: 3,
          timestamp: '2026-04-25T15:00:00Z',
        },
      ],
    };
    const md = formatProvenance(file);
    expect(md).toContain('cross-project-pattern');
    expect(md).toContain('edge-case-coverage');
    expect(md).toContain('반복 3회');
    expect(md).toContain('p-1, p-2, p-3');
  });

  it('candidateState exists=true면 활성 candidate 섹션 표시', () => {
    const file = { roleId: 'cto', entries: [] };
    const md = formatProvenance(file, {
      candidateState: { exists: true, projectCount: 2, projectIds: ['p-a', 'p-b'] },
    });
    expect(md).toContain('활성 candidate (평가 중)');
    expect(md).toContain('누적 2개 프로젝트');
    expect(md).toContain('p-a, p-b');
    expect(md).toContain('--discard-candidate');
  });

  it('candidateState exists=false면 활성 candidate 섹션 생략', () => {
    const file = { roleId: 'cto', entries: [] };
    const md = formatProvenance(file, { candidateState: { exists: false } });
    expect(md).not.toContain('활성 candidate');
  });

  it('소수점 신호는 toFixed(3)으로 포맷', () => {
    const md = formatProvenance({
      roleId: 'cto',
      entries: [
        {
          id: 'e-1',
          source: 'manual',
          signals: {
            quality: 0,
            time: 0,
            cost: 0.123456,
            retry: 0,
            escalation: 0,
            contribution: 0.5,
          },
        },
      ],
    });
    expect(md).toContain('cost=0.123');
  });
});

describe('persistence — 마크다운 override와 독립', () => {
  it('provenance.json만 손상돼도 override.md는 영향 없음', async () => {
    await writeFile(resolve(TMP_DIR, 'cto.md'), '# CTO Override', 'utf-8');
    await writeFile(provenancePath('cto'), 'CORRUPTED', 'utf-8');

    const file = await loadProvenance('cto');
    expect(file.entries).toEqual([]); // graceful

    // override.md는 그대로
    const md = await readFile(resolve(TMP_DIR, 'cto.md'), 'utf-8');
    expect(md).toBe('# CTO Override');
  });
});
