/**
 * project-completion-handler — 프로젝트 종료 시 자동 신호 기록 + 평가 + promote/discard
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, readFile } from 'fs/promises';
import { resolve } from 'path';
import {
  processProjectCompletion,
  formatCompletionSummary,
} from '../scripts/lib/agent/project-completion-handler.js';
import { setOverridesDir, saveAgentOverride } from '../scripts/lib/agent/agent-feedback.js';
import {
  setShadowDir,
  saveCandidateOverride,
  loadCandidateOverride,
  recordProjectResult,
  getCandidateState,
} from '../scripts/lib/agent/agent-shadow-mode.js';
import { setProvenanceDir, loadProvenance } from '../scripts/lib/agent/agent-provenance.js';

const TMP_DIR = resolve('.tmp-test-project-completion-handler');

beforeEach(async () => {
  await mkdir(TMP_DIR, { recursive: true });
  setOverridesDir(TMP_DIR);
  setShadowDir(TMP_DIR);
  setProvenanceDir(TMP_DIR);
});

afterEach(async () => {
  await rm(TMP_DIR, { recursive: true, force: true });
});

/**
 * 테스트용 프로젝트 fixture. team에 명시한 역할들에 대해
 * 각 역할 1개 task + 1개 review + 옵션으로 issue를 부여한다.
 */
function buildProject(projectId, roles, options = {}) {
  const tasks = roles.map((roleId, idx) => ({
    id: `t-${idx}`,
    title: `${roleId} task`,
    assignee: roleId,
    phase: 1,
    status: 'completed',
    reviews: [
      {
        approved: false,
        issues: (options.issuesByRole?.[roleId] || []).map((sev) => ({
          severity: sev,
          description: `${roleId} ${sev} issue`,
        })),
      },
    ],
  }));
  return {
    id: projectId,
    name: 'Sample',
    type: 'cli-app',
    mode: 'quick-build',
    status: 'completed',
    team: roles.map((roleId) => ({ roleId, model: 'sonnet' })),
    tasks,
    metrics: { totalCost: options.cost ?? 0 },
    executionState: {
      journal: options.journal || [],
    },
  };
}

const SAMPLE_ORIGIN = { source: 'project-feedback', projectId: 'p-source' };

describe('processProjectCompletion', () => {
  it('candidate 없는 역할은 skipped 결정', async () => {
    const project = buildProject('p-1', ['cto', 'qa']);
    const summary = await processProjectCompletion(project);

    expect(summary.totals.skipped).toBe(2);
    expect(summary.evaluations.every((e) => e.decision === 'skipped')).toBe(true);
    expect(summary.evaluations.every((e) => e.actionTaken === false)).toBe(true);
  });

  it('candidate 있는 역할은 신호 기록 + 평가 (pending 단계)', async () => {
    await saveCandidateOverride('cto', '# CTO candidate', SAMPLE_ORIGIN);

    const project = buildProject('p-1', ['cto'], {
      issuesByRole: { cto: ['critical'] },
    });
    const summary = await processProjectCompletion(project);

    const cto = summary.evaluations.find((e) => e.roleId === 'cto');
    expect(cto.hadCandidate).toBe(true);
    expect(cto.decision).toBe('pending'); // 1/3
    expect(cto.projectCount).toBe(1);
    expect(cto.signals.quality).toBe(3); // critical * 3
    expect(cto.actionTaken).toBe(false);
  });

  it('3개 프로젝트 누적 후 promote 자동 실행 (active baseline 없음)', async () => {
    await saveCandidateOverride('cto', '# CTO candidate', SAMPLE_ORIGIN);

    for (let i = 1; i <= 3; i++) {
      const project = buildProject(`p-${i}`, ['cto'], {
        issuesByRole: { cto: [] },
      });
      const summary = await processProjectCompletion(project);
      const cto = summary.evaluations[0];
      if (i < 3) {
        expect(cto.decision).toBe('pending');
      } else {
        expect(cto.decision).toBe('promote');
        expect(cto.actionTaken).toBe(true);
      }
    }

    // promote 결과 확인 — active.md가 candidate 내용으로 교체됨
    const active = await readFile(resolve(TMP_DIR, 'cto.md'), 'utf-8');
    expect(active).toBe('# CTO candidate');
    // candidate 파일은 정리됨
    expect(await loadCandidateOverride('cto')).toBeNull();
  });

  it('candidate가 active보다 열등하면 discard 자동 실행', async () => {
    // active baseline: 좋은 신호 (quality 0)
    for (let i = 1; i <= 3; i++) {
      await recordProjectResult(
        'cto',
        `active-p-${i}`,
        { quality: 0, time: 0, cost: 0, retry: 0, escalation: 0, contribution: 1 },
        { which: 'active' },
      );
    }
    // 기존 active.md
    await saveAgentOverride('cto', '# OLD ACTIVE');

    // candidate: 나쁜 신호로 평가될 예정
    await saveCandidateOverride('cto', '# WORSE CANDIDATE', SAMPLE_ORIGIN);

    for (let i = 1; i <= 3; i++) {
      const project = buildProject(`cand-p-${i}`, ['cto'], {
        issuesByRole: { cto: ['critical', 'critical'] },
      });
      await processProjectCompletion(project);
    }

    // candidate 폐기됨, active 보존
    expect(await loadCandidateOverride('cto')).toBeNull();
    const active = await readFile(resolve(TMP_DIR, 'cto.md'), 'utf-8');
    expect(active).toBe('# OLD ACTIVE');
  });

  it('autoApply=false면 결정만 반환하고 파일 변경 안 함', async () => {
    await saveCandidateOverride('cto', '# CTO candidate', SAMPLE_ORIGIN);
    for (let i = 1; i <= 3; i++) {
      const project = buildProject(`p-${i}`, ['cto']);
      const summary = await processProjectCompletion(project, { autoApply: false });
      const cto = summary.evaluations[0];
      if (i === 3) {
        expect(cto.decision).toBe('promote');
        expect(cto.actionTaken).toBe(false); // 실제 적용 안 함
      }
    }

    // candidate.md 그대로 살아있음
    expect(await loadCandidateOverride('cto')).toBe('# CTO candidate');
    // active.md는 생성되지 않음
    const state = await getCandidateState('cto');
    expect(state.projectCount).toBe(3);
  });

  it('minProjects override 적용', async () => {
    await saveCandidateOverride('cto', '# CTO candidate', SAMPLE_ORIGIN);
    const project = buildProject('p-1', ['cto']);
    const summary = await processProjectCompletion(project, { minProjects: 1 });

    expect(summary.evaluations[0].decision).toBe('promote');
  });

  it('여러 역할을 한 번에 처리', async () => {
    await saveCandidateOverride('cto', '# CTO cand', SAMPLE_ORIGIN);
    await saveCandidateOverride('qa', '# QA cand', SAMPLE_ORIGIN);
    // backend는 candidate 없음

    const project = buildProject('p-1', ['cto', 'qa', 'backend']);
    const summary = await processProjectCompletion(project);

    expect(summary.evaluations).toHaveLength(3);
    const byRole = Object.fromEntries(summary.evaluations.map((e) => [e.roleId, e]));
    expect(byRole.cto.hadCandidate).toBe(true);
    expect(byRole.qa.hadCandidate).toBe(true);
    expect(byRole.backend.hadCandidate).toBe(false);
    expect(byRole.backend.decision).toBe('skipped');
  });

  it('promote 후 active provenance에 candidate.projectResults 보존', async () => {
    await saveCandidateOverride('cto', '# new', {
      source: 'project-feedback',
      projectId: 'p-source',
    });
    for (let i = 1; i <= 3; i++) {
      const project = buildProject(`p-${i}`, ['cto'], {
        issuesByRole: { cto: ['important'] },
      });
      await processProjectCompletion(project);
    }

    const prov = await loadProvenance('cto');
    const inheritedFeedback = prov.entries.filter((e) => e.source === 'project-feedback');
    // 누적된 3개 + origin 1개 = 4개 (전부 project-feedback)
    expect(inheritedFeedback.length).toBeGreaterThanOrEqual(3);
  });

  it('project.id 누락 거부', async () => {
    const project = { team: [], tasks: [] };
    await expect(processProjectCompletion(project)).rejects.toThrow('project.id');
  });

  it('null project 거부', async () => {
    await expect(processProjectCompletion(null)).rejects.toThrow('project 객체');
  });
});

describe('formatCompletionSummary', () => {
  it('skipped만 있으면 "활성 candidate 없음" 표시', () => {
    const summary = {
      projectId: 'p-1',
      processedAt: '2026-04-28T00:00:00Z',
      totals: { promoted: 0, discarded: 0, pending: 0, skipped: 2 },
      evaluations: [
        { roleId: 'cto', decision: 'skipped' },
        { roleId: 'qa', decision: 'skipped' },
      ],
    };
    const md = formatCompletionSummary(summary);
    expect(md).toContain('활성 candidate가 있는 역할이 없습니다');
    expect(md).toContain('p-1');
  });

  it('promote/discard/pending 결과를 점수와 함께 표시', () => {
    const summary = {
      projectId: 'p-1',
      processedAt: '2026-04-28T00:00:00Z',
      totals: { promoted: 1, discarded: 1, pending: 1, skipped: 0 },
      evaluations: [
        {
          roleId: 'cto',
          decision: 'promote',
          activeScore: -10,
          candidateScore: -5,
          projectCount: 3,
          reason: 'candidate 우수',
          actionTaken: true,
        },
        {
          roleId: 'qa',
          decision: 'discard',
          activeScore: -2,
          candidateScore: -8,
          projectCount: 3,
          reason: 'candidate 열등',
          actionTaken: true,
        },
        {
          roleId: 'security',
          decision: 'pending',
          activeScore: null,
          candidateScore: null,
          projectCount: 1,
          reason: '1/3',
          actionTaken: false,
        },
      ],
    };
    const md = formatCompletionSummary(summary);
    expect(md).toContain('cto');
    expect(md).toContain('promote');
    expect(md).toContain('candidate -5');
    expect(md).toContain('discard');
    expect(md).toContain('pending');
    expect(md).toContain('promote 1 · discard 1 · pending 1');
  });

  it('빈 summary는 빈 문자열', () => {
    expect(formatCompletionSummary(null)).toBe('');
    expect(formatCompletionSummary({})).toBe('');
  });
});
