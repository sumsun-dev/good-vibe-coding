/**
 * handlers/dispatch — v2 단일 진입점 라우팅.
 *
 * `/gv <자연어>` 슬래시가 호출. dispatchInput으로 카테고리를 결정하고
 * 메인 세션이 다음 액션을 안내할 수 있도록 풍부한 결과를 반환한다.
 *
 * 정책:
 * - status/resume/modify: 기존 v1 흐름 안내 (Phase A 호환 유지)
 * - task: 5개 작업 유형별 다음 액션 안내 (Phase B-4에서 실제 그래프 실행과 통합)
 * - modify인데 hasProject=false면 task로 downgrade (PRD §6 dispatchInput JSDoc 정책)
 */

import { readStdin, output } from '../cli-utils.js';
import { dispatchInput } from '../lib/core/nl-router.js';
import { routeTask } from '../lib/engine/task-router.js';

export const commands = {
  'gv-dispatch': async () => {
    const data = (await readStdin()) || {};
    const input = typeof data.input === 'string' ? data.input : '';
    // boolean이 아니면 undefined로 정규화 — task-router/dispatchInput이 기본값(true) 적용
    const hasGitRepo = typeof data.hasGitRepo === 'boolean' ? data.hasGitRepo : undefined;
    const hasProject = Boolean(data.hasProject);

    let result = dispatchInput(input, { hasGitRepo });

    // modify인데 프로젝트가 없으면 task로 downgrade
    // TODO(Phase B-4): dispatchInput이 modify일 때 taskRoute도 함께 반환하면 routeTask 중복 호출 제거
    if (result.category === 'modify' && !hasProject) {
      result = { category: 'task', taskRoute: routeTask(input, { hasGitRepo }) };
    }

    const needsProjectSetup =
      result.category === 'task' &&
      (result.taskRoute?.taskType === 'code' || result.taskRoute?.taskType === 'plan') &&
      !hasProject &&
      !result.taskRoute?.escalateForConfirm;

    output({
      category: result.category,
      taskRoute: result.taskRoute || null,
      needsProjectSetup,
      nextActions: buildNextActions(result, { hasProject, needsProjectSetup }),
    });
  },
};

function buildNextActions(result, ctx) {
  switch (result.category) {
    case 'status':
      return ['/gv:status로 현재 프로젝트 상태를 확인하세요'];
    case 'resume':
      return ['/gv:resume으로 중단된 작업을 재개하세요'];
    case 'modify':
      return ctx.hasProject
        ? ['/gv 수정 요청을 자연어로 입력하면 task로 라우팅됩니다 (예: "이 함수 리팩토링해줘")']
        : [];
    case 'task':
      return buildTaskActions(result.taskRoute, ctx);
    default:
      return [];
  }
}

function buildTaskActions(taskRoute, ctx = {}) {
  if (!taskRoute) return [];
  if (taskRoute.escalateForConfirm) {
    const reason = (taskRoute.warnings && taskRoute.warnings[0]) || '입력이 모호합니다';
    return [`확인 필요: ${reason}. 입력을 좀 더 구체적으로 작성해주세요`];
  }

  const messages = {
    code: '코드 작업으로 분류됨. 자체 검증 + 리뷰 흐름으로 진행됩니다',
    plan: '대형 기획 작업으로 분류됨. 토론 → 승인 → 실행 흐름이 적용됩니다',
    research: '리서치 작업으로 분류됨. 병렬 조사 + 크로스 리뷰로 진행됩니다',
    review: '리뷰 작업으로 분류됨. diff 분석 + 도메인 전문가 리뷰로 진행됩니다',
    ask: '질의 작업으로 분류됨. 코드베이스 기반 단일 답변으로 처리됩니다',
  };

  const intent = taskRoute.taskType === 'code' && taskRoute.intent ? ` (${taskRoute.intent})` : '';

  const actions = [`${messages[taskRoute.taskType] || '작업으로 분류됨'}${intent}`];

  if (ctx.needsProjectSetup) {
    actions.push(
      '활성 프로젝트가 없습니다. /gv-init 으로 폴더 + (선택) GitHub repo + Good Vibe 프로젝트를 한 번에 셋업하세요',
    );
  }

  return actions;
}
