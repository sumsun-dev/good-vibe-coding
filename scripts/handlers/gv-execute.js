/**
 * handlers/gv-execute — v2 작업 실행 진입점.
 *
 * 두 가지 흐름:
 *  1. 활성 프로젝트 mode 분기 — projectId 전달 + project.status === 'planning'이면
 *     mode-dispatcher로 위임. plan-only는 다라운드 토론 → planDocument → status:approved.
 *  2. task-graph standalone — projectId 없거나 status가 planning이 아니면
 *     기존 task-graph-runner 흐름 (5개 task type, placeholder/LLM action).
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
import { runActiveProjectFlow } from '../lib/engine/mode-dispatcher.js';

function buildJournalCallback(events) {
  return (entry) => {
    const stateLabel = entry.state ?? '?';
    const eventLabel = entry.event ? ` → ${entry.event}` : '';
    const reasonLabel = entry.reason ? ` (${entry.reason})` : '';
    events.push({
      type: entry.type,
      timestamp: new Date().toISOString(),
      description: `${stateLabel}${eventLabel}${reasonLabel}`,
    });
  };
}

function renderModeFlowPanel(project, result) {
  const heading = `## ⚙️ /gv ${project.mode} · ${result.finalState}`;
  const lines = [
    heading,
    '',
    `- 프로젝트: ${project.name} (${project.type})`,
    `- 라운드: ${result.rounds}`,
    `- 수렴: ${result.converged ? '예' : '아니오'}`,
  ];
  if (result.finalState === 'approved') {
    lines.push('- 다음: `/gv:execute` 재실행으로 approved → executing 진입 (후속 PR)');
  } else if (result.finalState === 'maxRounds') {
    lines.push('- 안내: 최대 라운드 도달, status는 `planning` 유지');
  }
  return lines.join('\n');
}

async function runActiveFlow(data, project, events, journalCb) {
  const useLLM = data.useLLM === true;
  const result = await runActiveProjectFlow(project, {
    useLLM,
    callLLM: useLLM ? callLLMWithFallback : undefined,
    journal: journalCb,
    maxRounds: data.maxRounds,
  });

  events.push({
    type: 'mode-flow',
    timestamp: new Date().toISOString(),
    description: `${project.mode} → ${result.finalState} (rounds=${result.rounds})`,
  });

  return {
    success: result.finalState === 'approved',
    finalState: result.finalState,
    rounds: result.rounds,
    converged: result.converged,
    panel: renderModeFlowPanel(project, result),
    history: [],
    completionSummary: null,
    evaluationError: null,
  };
}

async function runTaskGraphFlow(data, taskRoute, events, journalCb) {
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

  return {
    success: result.success,
    finalState: result.finalState,
    steps: result.steps,
    reason: result.reason,
    history: result.history,
    panel,
    completionSummary,
    evaluationError,
  };
}

export const commands = {
  'gv-execute': async () => {
    const data = (await readStdin()) || {};
    const events = [];
    const journalCb = buildJournalCallback(events);

    if (data.projectId) {
      const project = await getProject(data.projectId);
      // 프로젝트가 있고 planning 상태일 때만 mode 흐름 진입.
      // not found / 다른 상태는 task-graph 흐름으로 fallback (evaluateOnComplete graceful 보존).
      if (project && project.status === 'planning') {
        const result = await runActiveFlow(data, project, events, journalCb);
        output(result);
        return;
      }
    }

    const taskRoute = data.taskRoute;
    if (!taskRoute || typeof taskRoute !== 'object' || !taskRoute.taskType) {
      throw inputError('taskRoute(taskType 포함)가 필요합니다');
    }
    const result = await runTaskGraphFlow(data, taskRoute, events, journalCb);
    output(result);
  },
};
