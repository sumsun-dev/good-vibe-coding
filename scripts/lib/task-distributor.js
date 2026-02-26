/**
 * task-distributor — 작업 분배 및 에이전트 실행 프롬프트 생성 모듈
 */

/**
 * 기획서를 분석하여 작업 목록을 추출하는 프롬프트를 생성한다.
 * @param {object} project - 프로젝트 정보
 * @param {string} planDocument - 기획서 마크다운
 * @returns {string} 작업 분배 프롬프트
 */
export function buildTaskDistributionPrompt(project, planDocument) {
  return `다음 프로젝트의 기획서를 분석하여 구체적인 작업 목록을 JSON 배열로 생성하세요.

## 프로젝트 정보
- 이름: ${project.name}
- 유형: ${project.type}
- 설명: ${project.description}

## 기획서
${planDocument}

## 출력 형식

JSON 배열로 출력하세요. 각 작업 객체:
\`\`\`json
[
  {
    "id": "task-1",
    "title": "작업 제목",
    "assignee": "역할ID (cto, backend, frontend 등)",
    "description": "상세 설명",
    "phase": 1,
    "dependencies": [],
    "status": "pending"
  }
]
\`\`\`

규칙:
- phase는 실행 순서 (1이 먼저)
- dependencies는 선행 작업 ID 배열
- assignee는 역할 ID (소문자)`;
}

/**
 * 작업 목록 출력을 파싱한다.
 * @param {string} rawOutput - 작업 목록 원문 (JSON 또는 JSON 포함 텍스트)
 * @returns {Array<object>} 작업 배열
 */
export function parseTaskList(rawOutput) {
  if (!rawOutput || rawOutput.trim() === '') return [];

  // JSON 직접 파싱 시도
  try {
    const parsed = JSON.parse(rawOutput.trim());
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // JSON 블록 추출 시도
  }

  // ```json ... ``` 블록 추출
  const jsonBlockMatch = rawOutput.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1].trim());
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // 파싱 실패
    }
  }

  // [ ... ] 패턴 추출
  const arrayMatch = rawOutput.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // 파싱 실패
    }
  }

  return [];
}

/**
 * 개별 작업 실행 프롬프트를 생성한다.
 * @param {object} task - 작업 객체
 * @param {object} teamMember - 담당 팀원 정보
 * @returns {string} 실행 프롬프트
 */
export function buildExecutionPrompt(task, teamMember) {
  let prompt = `당신은 ${teamMember.emoji} **${teamMember.displayName}** (${teamMember.role})입니다.

## 당신의 성격
- 특성: ${teamMember.trait}
- 말투: ${teamMember.speakingStyle}
- 전문 분야: ${(teamMember.skills || []).join(', ')}

## 작업
- ID: ${task.id}
- 제목: ${task.title}
- 설명: ${task.description || '(상세 설명 없음)'}

## 지시사항
위 작업을 당신의 역할과 성격에 맞게 수행하세요.
결과를 명확하게 보고하세요.`;

  return prompt;
}

/**
 * 작업 실행 계획을 생성한다 (phase별 그룹핑 + 의존관계).
 * @param {Array<object>} tasks - 작업 배열
 * @param {Array<object>} team - 팀원 배열
 * @returns {{ phases: Array<{phase: number, tasks: Array}>, dependencies: object }}
 */
/**
 * 실행 계획에 리뷰 페이즈를 추가한다.
 * 각 실행 phase 뒤에 리뷰 phase를 삽입한다.
 * @param {Array<object>} tasks - 작업 배열
 * @param {Array<object>} team - 팀원 배열
 * @returns {{ phases: Array<{type: string, phase: number, tasks: Array}>, dependencies: object }}
 */
export function buildExecutionPlanWithReviews(tasks, team) {
  const basePlan = buildExecutionPlan(tasks, team);
  const phasesWithReviews = [];

  for (const phase of basePlan.phases) {
    phasesWithReviews.push({ type: 'execute', phase: phase.phase, tasks: phase.tasks });
    phasesWithReviews.push({
      type: 'review',
      phase: phase.phase,
      tasks: phase.tasks.map(t => ({
        ...t,
        reviewType: 'cross-review',
      })),
    });
  }

  return { phases: phasesWithReviews, dependencies: basePlan.dependencies };
}

export function buildExecutionPlan(tasks, team) {
  const phaseMap = new Map();
  const dependencies = {};

  for (const task of tasks) {
    const phase = task.phase || 1;
    if (!phaseMap.has(phase)) phaseMap.set(phase, []);
    phaseMap.get(phase).push(task);

    if (task.dependencies && task.dependencies.length > 0) {
      dependencies[task.id] = task.dependencies;
    }
  }

  const phases = Array.from(phaseMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([phase, phaseTasks]) => ({ phase, tasks: phaseTasks }));

  return { phases, dependencies };
}
