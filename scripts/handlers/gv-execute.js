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
import { callLLMWithFallback } from '../lib/llm/llm-fallback.js';
import { inputError } from '../lib/core/validators.js';
import { getProject } from '../lib/project/project-manager.js';
import { processProjectCompletion } from '../lib/agent/project-completion-handler.js';

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

    // useLLM: 입력으로 명시적 활성화. 기본은 placeholder (외부 LLM 의존 회피).
    // 활성화 시 callLLMWithFallback을 명시적으로 주입 (의도 명시 + 추적 용이).
    const useLLM = data.useLLM === true;
    const actions = defaultActions(
      taskRoute.taskType,
      useLLM ? { useLLM: true, callLLM: callLLMWithFallback } : {},
    );

    const result = await runGraph(taskRoute, {
      actions,
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

    // 자가발전 자동 평가 (옵트인) — 그래프 success + projectId 명시 시
    // processProjectCompletion 인-프로세스 호출. 평가 실패는 grace 처리하여
    // 그래프 결과를 깨뜨리지 않는다 (try/catch + 응답에 evaluationError 필드).
    let completionSummary = null;
    let evaluationError = null;
    if (data.evaluateOnComplete === true && result.success && data.projectId) {
      try {
        const project = await getProject(data.projectId);
        if (project) {
          completionSummary = await processProjectCompletion(project, {
            autoApply: data.autoApplyShadow !== false,
            minProjects: data.minShadowProjects,
          });
        } else {
          evaluationError = `project not found: ${data.projectId}`;
        }
      } catch (err) {
        evaluationError = err.message;
      }
    }

    output({
      success: result.success,
      finalState: result.finalState,
      steps: result.steps,
      reason: result.reason,
      history: result.history,
      panel,
      completionSummary,
      evaluationError,
    });
  },
};
