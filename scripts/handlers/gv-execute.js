/**
 * handlers/gv-execute — v2 작업 실행 진입점.
 *
 * Phase B-4a (이 PR): task-graph-runner를 placeholder action으로 호출하고
 * 패널 markdown + 결과 JSON을 반환. 실제 LLM 통합은 후속 PR.
 */

import { readStdin, output } from '../cli-utils.js';
import { runGraph, DEFAULT_MAX_STEPS } from '../lib/engine/task-graph-runner.js';
import { defaultActions } from '../lib/engine/task-graph-actions.js';
import { selectGraph } from '../lib/engine/task-graph-presets.js';
import { renderPanel } from '../lib/output/claude-panel-renderer.js';
import { inputError } from '../lib/core/validators.js';

export const commands = {
  'gv-execute': async () => {
    const data = (await readStdin()) || {};
    const taskRoute = data.taskRoute;
    if (!taskRoute || typeof taskRoute !== 'object' || !taskRoute.taskType) {
      throw inputError('taskRoute(taskType 포함)가 필요합니다');
    }

    const events = [];
    const journalCb = (entry) => {
      const stateLabel = entry.state ?? '?';
      const eventLabel = entry.event ? ` → ${entry.event}` : '';
      const reasonLabel = entry.reason ? ` (${entry.reason})` : '';
      events.push({
        type: entry.type,
        timestamp: new Date().toISOString(),
        description: `${stateLabel}${eventLabel}${reasonLabel}`,
      });
    };

    const result = await runGraph(taskRoute, {
      actions: defaultActions(taskRoute.taskType),
      journal: journalCb,
      maxSteps: DEFAULT_MAX_STEPS,
    });

    const graph = selectGraph(taskRoute.taskType);
    const panel = renderPanel({
      taskType: taskRoute.taskType,
      currentState: result.finalState,
      graphStates: graph.allStates(),
      costUsd: 0,
      tokens: 0,
      recentEvents: events,
    });

    output({
      success: result.success,
      finalState: result.finalState,
      steps: result.steps,
      reason: result.reason,
      history: result.history,
      panel,
    });
  },
};
