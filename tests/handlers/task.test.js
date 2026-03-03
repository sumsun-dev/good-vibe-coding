import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../scripts/cli-utils.js', () => ({
  readStdin: vi.fn(),
  output: vi.fn(),
}));

vi.mock('../../scripts/lib/project/project-manager.js', () => ({
  addDiscussionRound: vi.fn(),
  addTaskReviews: vi.fn(),
  updateTaskStatus: vi.fn(),
  saveTaskOutput: vi.fn(),
  addTaskMaterializationResult: vi.fn(),
}));

vi.mock('../../scripts/lib/engine/task-distributor.js', () => ({
  buildTddExecutionPrompt: vi.fn(),
  isCodeTask: vi.fn(),
  buildPhaseContext: vi.fn(),
}));

vi.mock('../../scripts/lib/core/validators.js', () => ({
  requireFields: vi.fn(),
}));

import { readStdin, output } from '../../scripts/cli-utils.js';
import { addDiscussionRound, addTaskReviews } from '../../scripts/lib/project/project-manager.js';
import { isCodeTask, buildPhaseContext } from '../../scripts/lib/engine/task-distributor.js';
import { commands } from '../../scripts/handlers/task.js';

describe('task handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('add-discussion-round', () => {
    it('토론 라운드를 추가하고 프로젝트를 출력해야 한다', async () => {
      const project = { id: 'p1', discussions: [{ round: 1 }] };
      readStdin.mockResolvedValue({ id: 'p1', roundData: { round: 1, outputs: [] } });
      addDiscussionRound.mockResolvedValue(project);

      await commands['add-discussion-round']();
      expect(addDiscussionRound).toHaveBeenCalledWith('p1', { round: 1, outputs: [] });
      expect(output).toHaveBeenCalledWith(project);
    });
  });

  describe('add-task-reviews', () => {
    it('태스크 리뷰를 추가해야 한다', async () => {
      const project = { id: 'p1' };
      readStdin.mockResolvedValue({ id: 'p1', taskId: 't1', reviews: [{ approved: true }] });
      addTaskReviews.mockResolvedValue(project);

      await commands['add-task-reviews']();
      expect(addTaskReviews).toHaveBeenCalledWith('p1', 't1', [{ approved: true }]);
      expect(output).toHaveBeenCalledWith(project);
    });
  });

  describe('build-phase-context', () => {
    it('페이즈 컨텍스트를 빌드하고 출력해야 한다', async () => {
      readStdin.mockResolvedValue({ completedTasks: [{ id: 't1', output: 'done' }] });
      buildPhaseContext.mockReturnValue('Phase 1 요약');

      await commands['build-phase-context']();
      expect(buildPhaseContext).toHaveBeenCalledWith([{ id: 't1', output: 'done' }], {
        maxLinesPerTask: undefined,
      });
      expect(output).toHaveBeenCalledWith({ phaseContext: 'Phase 1 요약' });
    });
  });

  describe('is-code-task', () => {
    it('코드 태스크 여부를 판별해야 한다', async () => {
      readStdin.mockResolvedValue({ task: { assignee: { roleId: 'backend' } } });
      isCodeTask.mockReturnValue(true);

      await commands['is-code-task']();
      expect(output).toHaveBeenCalledWith({ isCodeTask: true });
    });
  });
});
