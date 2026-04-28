/**
 * agent-shadow-mode — candidate 격리 + 누적 평가 + promote/discard 단위 테스트
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile, readFile } from 'fs/promises';
import { resolve } from 'path';
import {
  setShadowDir,
  saveCandidateOverride,
  loadCandidateOverride,
  loadCandidateProvenance,
  recordProjectResult,
  averageSignals,
  evaluateCandidate,
  promoteCandidate,
  discardCandidate,
  getCandidateState,
  listActiveCandidates,
  DEFAULT_MIN_SHADOW_PROJECTS,
} from '../scripts/lib/agent/agent-shadow-mode.js';
import { setProvenanceDir, loadProvenance } from '../scripts/lib/agent/agent-provenance.js';

const TMP_DIR = resolve('.tmp-test-agent-shadow-mode');

beforeEach(async () => {
  await mkdir(TMP_DIR, { recursive: true });
  setShadowDir(TMP_DIR);
  setProvenanceDir(TMP_DIR);
});

afterEach(async () => {
  await rm(TMP_DIR, { recursive: true, force: true });
});

const SAMPLE_ORIGIN = {
  source: 'project-feedback',
  projectId: 'p-init',
  summary: 'TDD 강제 추가',
};

function fixtureSignals(overrides = {}) {
  return {
    quality: 4,
    time: 2000,
    cost: 0.5,
    retry: 1,
    escalation: 0,
    contribution: 0.8,
    ...overrides,
  };
}

describe('saveCandidateOverride / loadCandidateOverride', () => {
  it('candidate.md 파일을 저장하고 그대로 읽는다', async () => {
    const content = '# CTO Candidate\n\n- TDD 강제';
    await saveCandidateOverride('cto', content, SAMPLE_ORIGIN);

    const loaded = await loadCandidateOverride('cto');
    expect(loaded).toBe(content);
  });

  it('active.md는 영향 없음 (격리)', async () => {
    await writeFile(resolve(TMP_DIR, 'cto.md'), '# CTO ACTIVE', 'utf-8');
    await saveCandidateOverride('cto', '# CTO CANDIDATE', SAMPLE_ORIGIN);

    const active = await readFile(resolve(TMP_DIR, 'cto.md'), 'utf-8');
    expect(active).toBe('# CTO ACTIVE');

    const candidate = await loadCandidateOverride('cto');
    expect(candidate).toBe('# CTO CANDIDATE');
  });

  it('저장과 동시에 candidate provenance에 origin entry 추가', async () => {
    await saveCandidateOverride('cto', '# x', SAMPLE_ORIGIN);
    const prov = await loadCandidateProvenance('cto');
    expect(prov.entries).toHaveLength(1);
    expect(prov.entries[0].source).toBe('project-feedback');
    expect(prov.entries[0].projectId).toBe('p-init');
  });

  it('content가 string이 아니면 거부', async () => {
    await expect(saveCandidateOverride('cto', null, SAMPLE_ORIGIN)).rejects.toThrow('string');
  });

  it('candidate 없으면 loadCandidateOverride는 null', async () => {
    const result = await loadCandidateOverride('cto');
    expect(result).toBeNull();
  });
});

describe('recordProjectResult', () => {
  it("which='candidate' (기본)은 projectResults에 누적", async () => {
    await saveCandidateOverride('cto', '# x', SAMPLE_ORIGIN);
    await recordProjectResult('cto', 'p-1', fixtureSignals());
    await recordProjectResult('cto', 'p-2', fixtureSignals({ quality: 2 }));

    const prov = await loadCandidateProvenance('cto');
    expect(prov.projectResults).toHaveLength(2);
    expect(prov.projectResults[0].projectId).toBe('p-1');
    expect(prov.projectResults[1].projectId).toBe('p-2');
    expect(prov.projectResults[1].signals.quality).toBe(2);
  });

  it("which='active'는 active provenance에 'project-feedback' entry로 추가", async () => {
    await recordProjectResult('cto', 'p-active-1', fixtureSignals(), { which: 'active' });
    const active = await loadProvenance('cto');
    expect(active.entries).toHaveLength(1);
    expect(active.entries[0].source).toBe('project-feedback');
    expect(active.entries[0].signals.quality).toBe(4);
  });

  it('projectId 빈 값 거부', async () => {
    await expect(recordProjectResult('cto', '', fixtureSignals())).rejects.toThrow('projectId');
  });

  it('signals 누락 거부', async () => {
    await expect(recordProjectResult('cto', 'p-1', null)).rejects.toThrow('signals');
  });
});

describe('averageSignals', () => {
  it('빈 배열은 null', () => {
    expect(averageSignals([])).toBeNull();
    expect(averageSignals(null)).toBeNull();
  });

  it('6개 신호 평균 계산', () => {
    const results = [
      {
        signals: { quality: 4, time: 2000, cost: 0.5, retry: 1, escalation: 0, contribution: 0.8 },
      },
      {
        signals: { quality: 2, time: 1000, cost: 0.3, retry: 0, escalation: 1, contribution: 0.6 },
      },
    ];
    expect(averageSignals(results)).toEqual({
      quality: 3,
      time: 1500,
      cost: 0.4,
      retry: 0.5,
      escalation: 0.5,
      contribution: 0.7,
    });
  });

  it('일부 필드 누락 시 0으로 대체', () => {
    const result = averageSignals([{ signals: {} }, { signals: { quality: 4 } }]);
    expect(result.quality).toBe(2);
    expect(result.time).toBe(0);
  });
});

describe('evaluateCandidate', () => {
  it('candidate가 없으면 pending', async () => {
    const result = await evaluateCandidate('cto');
    expect(result.decision).toBe('pending');
    expect(result.projectCount).toBe(0);
  });

  it(`projectCount < minProjects (기본 ${DEFAULT_MIN_SHADOW_PROJECTS})면 pending`, async () => {
    await saveCandidateOverride('cto', '# x', SAMPLE_ORIGIN);
    await recordProjectResult('cto', 'p-1', fixtureSignals());

    const result = await evaluateCandidate('cto');
    expect(result.decision).toBe('pending');
    expect(result.projectCount).toBe(1);
    expect(result.reason).toContain('1 / 최소 3');
  });

  it('active baseline 없고 candidate 누적 충분 → promote', async () => {
    await saveCandidateOverride('cto', '# x', SAMPLE_ORIGIN);
    for (let i = 1; i <= 3; i++) {
      await recordProjectResult('cto', `p-${i}`, fixtureSignals());
    }

    const result = await evaluateCandidate('cto');
    expect(result.decision).toBe('promote');
    expect(result.activeScore).toBeNull();
    expect(result.candidateScore).not.toBeNull();
  });

  it('candidate가 active보다 우수하면 promote', async () => {
    // active baseline: quality 5 (나쁨)
    for (let i = 1; i <= 3; i++) {
      await recordProjectResult('cto', `active-p-${i}`, fixtureSignals({ quality: 5 }), {
        which: 'active',
      });
    }
    // candidate: quality 1 (좋음)
    await saveCandidateOverride('cto', '# x', SAMPLE_ORIGIN);
    for (let i = 1; i <= 3; i++) {
      await recordProjectResult('cto', `cand-p-${i}`, fixtureSignals({ quality: 1 }));
    }

    const result = await evaluateCandidate('cto');
    expect(result.decision).toBe('promote');
    expect(result.candidateScore).toBeGreaterThan(result.activeScore);
  });

  it('candidate가 active보다 열등하면 discard', async () => {
    // active baseline: quality 1 (좋음)
    for (let i = 1; i <= 3; i++) {
      await recordProjectResult('cto', `active-p-${i}`, fixtureSignals({ quality: 1 }), {
        which: 'active',
      });
    }
    // candidate: quality 5 (나쁨)
    await saveCandidateOverride('cto', '# x', SAMPLE_ORIGIN);
    for (let i = 1; i <= 3; i++) {
      await recordProjectResult('cto', `cand-p-${i}`, fixtureSignals({ quality: 5 }));
    }

    const result = await evaluateCandidate('cto');
    expect(result.decision).toBe('discard');
    expect(result.candidateScore).toBeLessThanOrEqual(result.activeScore);
  });

  it('minProjects override가 적용된다', async () => {
    await saveCandidateOverride('cto', '# x', SAMPLE_ORIGIN);
    await recordProjectResult('cto', 'p-1', fixtureSignals());

    const result = await evaluateCandidate('cto', { minProjects: 1 });
    expect(result.decision).not.toBe('pending');
  });
});

describe('promoteCandidate', () => {
  it('candidate.md를 active.md로 교체하고 candidate 파일들 삭제', async () => {
    await writeFile(resolve(TMP_DIR, 'cto.md'), '# OLD ACTIVE', 'utf-8');
    await saveCandidateOverride('cto', '# NEW ACTIVE', SAMPLE_ORIGIN);
    await recordProjectResult('cto', 'p-1', fixtureSignals());

    const result = await promoteCandidate('cto');
    expect(result.promoted).toBe(true);

    const newActive = await readFile(resolve(TMP_DIR, 'cto.md'), 'utf-8');
    expect(newActive).toBe('# NEW ACTIVE');

    const candidate = await loadCandidateOverride('cto');
    expect(candidate).toBeNull();
  });

  it('candidate provenance entries + projectResults를 active로 머지', async () => {
    await saveCandidateOverride('cto', '# x', SAMPLE_ORIGIN);
    await recordProjectResult('cto', 'p-1', fixtureSignals());

    await promoteCandidate('cto');

    const active = await loadProvenance('cto');
    // origin entry 1개 + projectResults가 project-feedback entries로 이전된 1개 → 최소 2개
    expect(active.entries.length).toBeGreaterThanOrEqual(2);
    const inherited = active.entries.find(
      (e) => e.source === 'project-feedback' && (e.summary || '').includes('inherited'),
    );
    expect(inherited).toBeDefined();
    expect(inherited.projectId).toBe('p-1');
    expect(inherited.signals).toBeDefined();
  });

  it('candidate 없으면 promoted=false', async () => {
    const result = await promoteCandidate('cto');
    expect(result.promoted).toBe(false);
  });
});

describe('discardCandidate', () => {
  it('candidate 파일 삭제 (active 보존)', async () => {
    await writeFile(resolve(TMP_DIR, 'cto.md'), '# ACTIVE', 'utf-8');
    await saveCandidateOverride('cto', '# CANDIDATE', SAMPLE_ORIGIN);

    const result = await discardCandidate('cto');
    expect(result.discarded).toBe(true);

    expect(await loadCandidateOverride('cto')).toBeNull();
    const active = await readFile(resolve(TMP_DIR, 'cto.md'), 'utf-8');
    expect(active).toBe('# ACTIVE');
  });

  it('candidate 없으면 discarded=false', async () => {
    const result = await discardCandidate('cto');
    expect(result.discarded).toBe(false);
  });
});

describe('getCandidateState', () => {
  it('candidate 없으면 exists=false', async () => {
    const state = await getCandidateState('cto');
    expect(state).toEqual({ exists: false, projectCount: 0, projectIds: [], entryCount: 0 });
  });

  it('candidate 있으면 누적 정보 반환', async () => {
    await saveCandidateOverride('cto', '# x', SAMPLE_ORIGIN);
    await recordProjectResult('cto', 'p-1', fixtureSignals());
    await recordProjectResult('cto', 'p-2', fixtureSignals());

    const state = await getCandidateState('cto');
    expect(state.exists).toBe(true);
    expect(state.projectCount).toBe(2);
    expect(state.projectIds).toEqual(['p-1', 'p-2']);
    expect(state.entryCount).toBe(1); // origin entry 1개
  });
});

describe('listActiveCandidates', () => {
  it('overrides 디렉토리가 없으면 빈 배열', async () => {
    await rm(TMP_DIR, { recursive: true, force: true });
    const result = await listActiveCandidates();
    expect(result).toEqual([]);
  });

  it('candidate가 없으면 빈 배열', async () => {
    expect(await listActiveCandidates()).toEqual([]);
  });

  it('여러 역할의 candidate를 모두 열거', async () => {
    await saveCandidateOverride('cto', '# cto', SAMPLE_ORIGIN);
    await saveCandidateOverride('qa', '# qa', SAMPLE_ORIGIN);
    await recordProjectResult('cto', 'p-1', fixtureSignals());
    await recordProjectResult('cto', 'p-2', fixtureSignals());

    const result = await listActiveCandidates();
    expect(result).toHaveLength(2);
    const byRole = Object.fromEntries(result.map((r) => [r.roleId, r]));
    expect(byRole.cto.projectCount).toBe(2);
    expect(byRole.qa.projectCount).toBe(0);
  });

  it('잘못된 roleId 패턴의 파일은 무시', async () => {
    await saveCandidateOverride('cto', '# cto', SAMPLE_ORIGIN);
    // 잘못된 패턴의 파일을 직접 만들어도 무시되어야 함
    await writeFile(resolve(TMP_DIR, 'INVALID-Role.candidate.md'), '# x', 'utf-8');

    const result = await listActiveCandidates();
    expect(result).toHaveLength(1);
    expect(result[0].roleId).toBe('cto');
  });

  it('active.md만 있는 역할은 제외 (candidate가 핵심 조건)', async () => {
    await writeFile(resolve(TMP_DIR, 'cto.md'), '# active only', 'utf-8');

    const result = await listActiveCandidates();
    expect(result).toEqual([]);
  });
});

describe('end-to-end shadow lifecycle', () => {
  it('학습 제안 → 3개 프로젝트 dry-run → promote → 다음 학습 제안', async () => {
    // 1. 초기 active 없음
    // 2. 학습 제안 1: candidate 저장
    await saveCandidateOverride('cto', '# v1', {
      source: 'project-feedback',
      projectId: 'p-source',
    });

    // 3. 3개 프로젝트 평가 누적
    await recordProjectResult('cto', 'p-1', fixtureSignals());
    await recordProjectResult('cto', 'p-2', fixtureSignals());
    await recordProjectResult('cto', 'p-3', fixtureSignals());

    // 4. 평가 → promote (active baseline 없음)
    const eval1 = await evaluateCandidate('cto');
    expect(eval1.decision).toBe('promote');

    // 5. promote 실행
    await promoteCandidate('cto');
    expect(await loadCandidateOverride('cto')).toBeNull();

    // 6. 두 번째 학습 제안: 더 나쁜 후보
    await saveCandidateOverride('cto', '# v2 worse', {
      source: 'project-feedback',
      projectId: 'p-source-2',
    });
    await recordProjectResult('cto', 'p-4', fixtureSignals({ quality: 99 }));
    await recordProjectResult('cto', 'p-5', fixtureSignals({ quality: 99 }));
    await recordProjectResult('cto', 'p-6', fixtureSignals({ quality: 99 }));

    // 7. 평가 → discard (active baseline이 더 좋음)
    const eval2 = await evaluateCandidate('cto');
    expect(eval2.decision).toBe('discard');

    // 8. discard 실행
    await discardCandidate('cto');
    const finalActive = await readFile(resolve(TMP_DIR, 'cto.md'), 'utf-8');
    expect(finalActive).toBe('# v1'); // 원래 promote된 버전 그대로
  });
});
