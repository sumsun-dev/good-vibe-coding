/**
 * plan-only-runner 단위 테스트.
 * 다라운드 토론 → 수렴 시 planDocument 저장 + status: approved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../scripts/lib/project/project-manager.js', () => ({
  getProject: vi.fn(),
  setProjectTeam: vi.fn(async (id, team) => ({ id, team })),
  setProjectPlan: vi.fn(async (id, plan) => ({ id, discussion: { planDocument: plan } })),
  updateProjectStatus: vi.fn(async (id, status) => ({ id, status })),
  addDiscussionRound: vi.fn(async (id, round) => ({ id, round })),
}));

vi.mock('../scripts/lib/agent/team-builder.js', () => ({
  getOptimizedTeam: vi.fn(async () => ({
    roles: ['cto', 'po', 'qa', 'security', 'fullstack'],
    optional: [],
  })),
  buildTeam: vi.fn(async (roleIds) =>
    roleIds.map((roleId) => ({
      roleId,
      displayName: roleId.toUpperCase(),
      role: roleId,
      trait: 'analytical',
      speakingStyle: 'concise',
      skills: [roleId],
      model: 'haiku',
      discussionPriority: roleId === 'cto' ? 1 : roleId === 'po' ? 2 : 5,
    })),
  ),
}));

import {
  setProjectTeam,
  setProjectPlan,
  updateProjectStatus,
  addDiscussionRound,
} from '../scripts/lib/project/project-manager.js';
import { getOptimizedTeam, buildTeam } from '../scripts/lib/agent/team-builder.js';
import { runPlanOnly } from '../scripts/lib/engine/plan-only-runner.js';

const baseProject = {
  id: 'proj-test-001',
  name: 'test',
  type: 'telegram-bot',
  description: 'AI repo radar bot',
  status: 'planning',
  mode: 'plan-only',
  team: [],
  discussion: { rounds: [], planDocument: '' },
};

beforeEach(() => {
  setProjectTeam.mockClear();
  setProjectPlan.mockClear();
  updateProjectStatus.mockClear();
  addDiscussionRound.mockClear();
  getOptimizedTeam.mockClear();
  buildTeam.mockClear();
});

describe('plan-only-runner — placeholder 모드', () => {
  it('useLLM=false: 1라운드만 돌고 즉시 수렴 → finalState: approved', async () => {
    const result = await runPlanOnly(baseProject, { useLLM: false });

    expect(result.finalState).toBe('approved');
    expect(result.rounds).toBe(1);
    expect(result.converged).toBe(true);
    expect(addDiscussionRound).toHaveBeenCalledTimes(1);
    expect(setProjectPlan).toHaveBeenCalledOnce();
    expect(updateProjectStatus).toHaveBeenCalledWith(baseProject.id, 'approved');
  });

  it('useLLM=false: 팀이 비어있으면 자동 구성한다', async () => {
    await runPlanOnly(baseProject, { useLLM: false });
    expect(getOptimizedTeam).toHaveBeenCalledWith(baseProject.type, 'complex');
    expect(buildTeam).toHaveBeenCalled();
    expect(setProjectTeam).toHaveBeenCalledOnce();
  });

  it('useLLM=false: 팀이 이미 있으면 재구성하지 않는다', async () => {
    const project = {
      ...baseProject,
      team: [{ roleId: 'cto', displayName: 'CTO', role: 'cto', discussionPriority: 1 }],
    };
    await runPlanOnly(project, { useLLM: false });
    expect(getOptimizedTeam).not.toHaveBeenCalled();
    expect(buildTeam).not.toHaveBeenCalled();
    expect(setProjectTeam).not.toHaveBeenCalled();
  });
});

describe('plan-only-runner — useLLM 모드', () => {
  function makeCallLLM(reviewsByRound) {
    let agentCall = 0;
    let reviewCall = 0;
    let round = 1;
    return vi.fn(async (provider, prompt, options) => {
      const text = options?.systemMessage || prompt || '';
      if (text.includes('종합') || text.includes('synthesis') || text.includes('통합 기획서')) {
        return { text: `## 라운드 ${round} 종합 기획서`, model: 'haiku', tokenCount: 50 };
      }
      if (text.includes('리뷰') || text.includes('review')) {
        const reviews = reviewsByRound[round - 1] || [];
        const idx = reviewCall % reviews.length;
        reviewCall += 1;
        const review = reviews[idx];
        if (reviewCall >= reviews.length) {
          round += 1;
          reviewCall = 0;
        }
        return { text: JSON.stringify(review), model: 'haiku', tokenCount: 30 };
      }
      agentCall += 1;
      return { text: `agent ${agentCall} analysis`, model: 'haiku', tokenCount: 20 };
    });
  }

  it('1라운드에 모든 reviewer가 approved → 즉시 수렴', async () => {
    const callLLM = makeCallLLM([
      [
        { approved: true, feedback: 'ok', issues: [] },
        { approved: true, feedback: 'ok', issues: [] },
        { approved: true, feedback: 'ok', issues: [] },
      ],
    ]);

    const result = await runPlanOnly(baseProject, { useLLM: true, callLLM });

    expect(result.finalState).toBe('approved');
    expect(result.rounds).toBe(1);
    expect(result.converged).toBe(true);
    expect(updateProjectStatus).toHaveBeenCalledWith(baseProject.id, 'approved');
  });

  it('라운드 1 critical 실패 → 라운드 2 수렴', async () => {
    const callLLM = makeCallLLM([
      [
        {
          approved: false,
          feedback: 'block',
          issues: [{ severity: 'critical', description: 'missing auth' }],
        },
        { approved: false, feedback: 'block', issues: [] },
        { approved: false, feedback: 'block', issues: [] },
      ],
      [
        { approved: true, feedback: 'fixed', issues: [] },
        { approved: true, feedback: 'fixed', issues: [] },
        { approved: true, feedback: 'fixed', issues: [] },
      ],
    ]);

    const result = await runPlanOnly(baseProject, { useLLM: true, callLLM });

    expect(result.finalState).toBe('approved');
    expect(result.rounds).toBe(2);
    expect(addDiscussionRound).toHaveBeenCalledTimes(2);
  });

  it('maxRounds 도달해도 수렴 못 하면 finalState: maxRounds, status는 planning 유지', async () => {
    const failedReview = {
      approved: false,
      feedback: 'still blocking',
      issues: [{ severity: 'critical', description: 'still missing' }],
    };
    const callLLM = makeCallLLM([
      [failedReview, failedReview, failedReview],
      [failedReview, failedReview, failedReview],
      [failedReview, failedReview, failedReview],
    ]);

    const result = await runPlanOnly(baseProject, { useLLM: true, callLLM, maxRounds: 3 });

    expect(result.finalState).toBe('maxRounds');
    expect(result.rounds).toBe(3);
    expect(result.converged).toBe(false);
    expect(addDiscussionRound).toHaveBeenCalledTimes(3);
    expect(updateProjectStatus).not.toHaveBeenCalled();
    expect(setProjectPlan).not.toHaveBeenCalled();
  });

  it('callLLM 누락 시 inputError', async () => {
    await expect(runPlanOnly(baseProject, { useLLM: true })).rejects.toThrow(/callLLM/);
  });
});

describe('plan-only-runner — 엣지 케이스', () => {
  it('buildTeam이 빈 배열을 반환하면 inputError', async () => {
    buildTeam.mockResolvedValueOnce([]);
    await expect(runPlanOnly(baseProject, { useLLM: false })).rejects.toThrow(
      /팀을 구성할 수 없습니다/,
    );
  });
});

describe('plan-only-runner — provider 옵션', () => {
  it('opts.provider가 명시되면 callLLM에 그 provider로 호출한다', async () => {
    const callLLM = vi.fn(async (provider) => {
      if (provider !== 'gemini') throw new Error(`expected gemini, got ${provider}`);
      return { text: JSON.stringify({ approved: true, feedback: 'ok', issues: [] }), model: 'g' };
    });

    const result = await runPlanOnly(baseProject, {
      useLLM: true,
      callLLM,
      provider: 'gemini',
    });

    expect(result.finalState).toBe('approved');
    // 모든 호출이 gemini로 갔는지 검증
    for (const call of callLLM.mock.calls) {
      expect(call[0]).toBe('gemini');
    }
  });

  it('claude 외 provider면 callLLM의 model 옵션이 undefined로 전달된다', async () => {
    const callLLM = vi.fn(async () => ({
      text: JSON.stringify({ approved: true, feedback: 'ok', issues: [] }),
      model: 'gemini-2.5-flash',
    }));

    await runPlanOnly(baseProject, {
      useLLM: true,
      callLLM,
      provider: 'gemini',
    });

    for (const call of callLLM.mock.calls) {
      expect(call[2].model).toBeUndefined();
    }
  });

  it('provider 미지정 시 claude가 기본값', async () => {
    const callLLM = vi.fn(async () => ({
      text: JSON.stringify({ approved: true, feedback: 'ok', issues: [] }),
      model: 'haiku',
    }));

    await runPlanOnly(baseProject, { useLLM: true, callLLM });

    for (const call of callLLM.mock.calls) {
      expect(call[0]).toBe('claude');
    }
  });
});
