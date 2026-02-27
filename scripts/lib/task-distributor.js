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

/**
 * 태스크가 코드 출력이 필요한 태스크인지 판별한다.
 * @param {object} task - 태스크 객체
 * @returns {boolean}
 */
export function isCodeTask(task) {
  if (!task) return false;

  const engineerRoles = ['backend', 'frontend', 'fullstack', 'devops', 'data'];

  if (task.assignee && engineerRoles.includes(task.assignee)) {
    return true;
  }

  const codeKeywords = [
    '구현', '개발', '코딩',
    'implement', 'develop', 'code', 'build', 'create',
    'api', 'endpoint', 'component', 'function', 'module',
    'class', 'service', 'controller', 'middleware', 'route',
    'schema', 'migration', 'test', 'spec',
  ];

  const searchText = `${task.title || ''} ${task.description || ''}`.toLowerCase();

  return codeKeywords.some((keyword) => searchText.includes(keyword));
}

/**
 * TDD 방식의 실행 프롬프트를 생성한다.
 * RED → GREEN → REFACTOR 사이클을 지시한다.
 * @param {object} task - 태스크 객체
 * @param {object} teamMember - 담당 팀원 정보
 * @param {object} context - 추가 컨텍스트
 * @param {string} [context.projectType] - 프로젝트 유형
 * @param {string} [context.testFramework] - 테스트 프레임워크 (기본: 'vitest')
 * @returns {string} TDD 실행 프롬프트
 */
export function buildTddExecutionPrompt(task, teamMember, context = {}) {
  const testFramework = context.testFramework || 'vitest';

  let prompt = `당신은 ${teamMember.emoji} **${teamMember.displayName}** (${teamMember.role})입니다.

## 당신의 성격
- 특성: ${teamMember.trait}
- 말투: ${teamMember.speakingStyle}
- 전문 분야: ${(teamMember.skills || []).join(', ')}

## 작업
- ID: ${task.id}
- 제목: ${task.title}
- 설명: ${task.description || '(상세 설명 없음)'}

## TDD 실행 지침

### Phase 1: RED — 실패하는 테스트 작성
- 먼저 기대하는 동작을 테스트로 작성하세요
- 테스트 프레임워크: ${testFramework}
- 테스트 파일은 반드시 \`.test.js\` 접미사를 사용하세요
- 이 시점에서 테스트는 반드시 실패해야 합니다

### Phase 2: GREEN — 최소 구현
- 테스트를 통과하는 최소한의 코드만 작성하세요
- 불필요한 기능을 추가하지 마세요 (YAGNI)

### Phase 3: REFACTOR — 리팩토링
- 코드 품질을 개선하세요
- 테스트는 계속 통과해야 합니다

## 출력 규칙 (필수)
- 모든 코드 블록에 **반드시 파일명을 포함**하세요
  - 형식: \`\`\`javascript src/파일명.js
- 테스트 파일: \`\`\`javascript src/파일명.test.js 또는 tests/파일명.test.js
- 설정 파일: \`\`\`json package.json
- 각 Phase의 결과를 순서대로 보고하세요`;

  if (context.projectType) {
    prompt += `\n\n## 프로젝트 힌트\n- 프로젝트 유형: ${context.projectType}`;
  }

  return prompt;
}
