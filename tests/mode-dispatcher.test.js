/**
 * mode-dispatcher 단위 테스트.
 * 활성 프로젝트의 mode/status에 따라 적절한 흐름으로 분기하는지 검증.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../scripts/lib/engine/plan-only-runner.js', () => ({
  runPlanOnly: vi.fn(),
}));

import { runActiveProjectFlow } from '../scripts/lib/engine/mode-dispatcher.js';
import { runPlanOnly } from '../scripts/lib/engine/plan-only-runner.js';

const baseProject = {
  id: 'proj-test-001',
  name: 'test-project',
  type: 'web-app',
  description: 'test description',
  status: 'planning',
  mode: 'plan-only',
  team: [],
  discussion: { rounds: [], planDocument: '' },
};

describe('mode-dispatcher — runActiveProjectFlow', () => {
  beforeEach(() => {
    runPlanOnly.mockReset();
    runPlanOnly.mockResolvedValue({
      finalState: 'approved',
      rounds: 1,
      converged: true,
      planDocument: '## stub plan',
    });
  });

  it('status가 planning이 아니면 inputError', async () => {
    const project = { ...baseProject, status: 'approved' };
    await expect(runActiveProjectFlow(project)).rejects.toThrow(/planning/);
  });

  it('mode가 plan-only이면 plan-only-runner를 호출한다', async () => {
    const result = await runActiveProjectFlow(baseProject, { useLLM: false });
    expect(runPlanOnly).toHaveBeenCalledOnce();
    expect(runPlanOnly).toHaveBeenCalledWith(
      baseProject,
      expect.objectContaining({ useLLM: false }),
    );
    expect(result.finalState).toBe('approved');
  });

  it('mode가 plan-execute이면 후속 PR 안내 에러', async () => {
    const project = { ...baseProject, mode: 'plan-execute' };
    await expect(runActiveProjectFlow(project)).rejects.toThrow(/plan-execute.*후속/);
  });

  it('mode가 quick-build이면 후속 PR 안내 에러', async () => {
    const project = { ...baseProject, mode: 'quick-build' };
    await expect(runActiveProjectFlow(project)).rejects.toThrow(/quick-build.*후속/);
  });

  it('알 수 없는 mode면 inputError', async () => {
    const project = { ...baseProject, mode: 'unknown-mode' };
    await expect(runActiveProjectFlow(project)).rejects.toThrow(/알 수 없는 mode/);
  });

  it('opts(useLLM, callLLM, journal)을 plan-only-runner로 그대로 전달한다', async () => {
    const callLLM = vi.fn();
    const journal = vi.fn();
    await runActiveProjectFlow(baseProject, { useLLM: true, callLLM, journal });
    expect(runPlanOnly).toHaveBeenCalledWith(
      baseProject,
      expect.objectContaining({ useLLM: true, callLLM, journal }),
    );
  });
});
