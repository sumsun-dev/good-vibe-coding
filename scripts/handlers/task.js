/**
 * handlers/task — 프로젝트 태스크 관리 + TDD 커맨드
 */
import { readStdin, output } from '../cli-utils.js';
import {
  addDiscussionRound, addTaskReviews, updateTaskStatus,
  saveTaskOutput, addTaskMaterializationResult,
} from '../lib/project-manager.js';
import {
  buildTddExecutionPrompt, isCodeTask, buildPhaseContext,
} from '../lib/task-distributor.js';
import { requireFields } from '../lib/validators.js';

export const commands = {
  'add-discussion-round': async () => {
    const data = await readStdin();
    requireFields(data, ['id', 'roundData']);
    const project = await addDiscussionRound(data.id, data.roundData);
    output(project);
  },

  'add-task-reviews': async () => {
    const data = await readStdin();
    requireFields(data, ['id', 'taskId', 'reviews']);
    const project = await addTaskReviews(data.id, data.taskId, data.reviews);
    output(project);
  },

  'update-task-status': async () => {
    const data = await readStdin();
    requireFields(data, ['id', 'taskId', 'status']);
    const project = await updateTaskStatus(data.id, data.taskId, data.status);
    output(project);
  },

  'save-task-output': async () => {
    const data = await readStdin();
    requireFields(data, ['id', 'taskId']);
    const project = await saveTaskOutput(data.id, data.taskId, data.output, { maxLines: data.maxLines });
    output(project);
  },

  'add-task-materialization': async () => {
    const data = await readStdin();
    const project = await addTaskMaterializationResult(data.id, data.taskId, data.materializeResult);
    output(project);
  },

  'build-phase-context': async () => {
    const data = await readStdin();
    const context = buildPhaseContext(data.completedTasks, { maxLinesPerTask: data.maxLinesPerTask });
    output({ phaseContext: context });
  },

  'tdd-execution-prompt': async () => {
    const data = await readStdin();
    const prompt = buildTddExecutionPrompt(data.task, data.teamMember, data.context || {});
    output({ prompt });
  },

  'is-code-task': async () => {
    const data = await readStdin();
    const result = isCodeTask(data.task);
    output({ isCodeTask: result });
  },
};
