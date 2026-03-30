/**
 * task-distributor — 작업 분배 및 에이전트 실행 프롬프트 생성 모듈
 */

import { parseJsonArray } from '../core/json-parser.js';
import { config } from '../core/config.js';
import { truncateLines } from '../core/text-utils.js';

/** 영어 키워드 regex 사전 컴파일 캐시 (lazy init) */
const COMPILED_KEYWORD_REGEXPS = new Map();

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
  return parseJsonArray(rawOutput);
}

/**
 * 개별 작업 실행 프롬프트를 생성한다.
 * @param {object} task - 작업 객체
 * @param {object} teamMember - 담당 팀원 정보
 * @param {object} [context={}] - 추가 컨텍스트
 * @param {string} [context.planExcerpt] - 기획 결정사항
 * @param {string} [context.phaseContext] - 이전 Phase 결과 요약
 * @returns {string} 실행 프롬프트
 */
export function buildExecutionPrompt(task, teamMember, context = {}) {
  let prompt = `당신은 **${teamMember.displayName}** (${teamMember.role})입니다.

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
결과를 명확하게 보고하세요.

## 결과 보고 규격 (필수)

### 구현 요약
- 무엇을 만들었는지 1-3문장으로 설명

### 핵심 파일
- 생성/수정한 주요 파일과 각각의 역할

### 외부 서비스 및 환경변수
- 외부 API/서비스를 사용하면 목록 제공:
  - 환경변수명: 설명 (발급 URL)
  - 예: TELEGRAM_BOT_TOKEN: 텔레그램 봇 토큰 (https://t.me/botfather)
- 외부 서비스가 없으면 "없음"으로 표기

### 실행 방법
- 결과물을 실행/확인하는 구체적 방법

### 커스터마이징 포인트
- 사용자가 수정할 만한 부분과 방법
  - 예: "뉴스 소스 변경 → src/config.js의 NEWS_SOURCES 수정"`;

  if (isCodeTask(task)) {
    prompt += `\n\n## 구현 전 탐색 (Search Before Building)\n\n구현을 시작하기 전에 반드시 다음을 수행하세요:\n1. 프로젝트 내 기존 코드에서 유사한 패턴, 함수, 모듈을 검색하세요\n2. 이미 존재하는 유틸리티나 헬퍼가 있다면 재사용하세요\n3. 새로 만들기 전에 기존 코드와 일관된 패턴을 따르세요`;
  }

  if (context.planExcerpt) {
    prompt += `\n\n## 기획 결정사항\n${context.planExcerpt}`;
  }

  if (context.phaseContext) {
    prompt += `\n\n## 이전 Phase 결과\n${context.phaseContext}`;
  }

  if (context.phaseGuidance) {
    prompt += `\n\n## CEO 지침 (이번 Phase)\n\n${context.phaseGuidance}\n\n**위 지침을 최우선으로 반영하세요.**`;
  }

  if (context.consultationEnabled) {
    prompt += `\n\n## 전문가 상담\n다른 역할에게 질문이 필요하면:\n\`[CONSULT:역할ID]: 질문\`\n(최대 1개, 선택사항)`;
  }

  if (context.allowedPaths && context.allowedPaths.length > 0) {
    prompt += `\n\n## 편집 범위 제한\n\n이 Phase에서는 다음 경로의 파일만 수정하세요:\n${context.allowedPaths.map((p) => `- ${p}`).join('\n')}\n\n위 경로 외의 파일은 읽기만 가능합니다. 수정이 필요하면 리뷰에서 별도 요청하세요.`;
  }

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
      tasks: phase.tasks.map((t) => ({
        ...t,
        reviewType: 'cross-review',
      })),
    });
  }

  return {
    phases: phasesWithReviews,
    dependencies: basePlan.dependencies,
    phaseDependencies: basePlan.phaseDependencies,
    parallelGroups: basePlan.parallelGroups,
  };
}

export function buildExecutionPlan(tasks, _team) {
  const phaseMap = new Map();
  const dependencies = {};

  // 태스크 ID → Phase 번호 매핑 (의존성 추론용)
  const taskPhaseMap = {};

  for (const task of tasks) {
    const phase = task.phase || 1;
    if (!phaseMap.has(phase)) phaseMap.set(phase, []);
    phaseMap.get(phase).push(task);

    taskPhaseMap[task.id] = phase;

    if (task.dependencies && task.dependencies.length > 0) {
      dependencies[task.id] = task.dependencies;
    }
  }

  const phases = Array.from(phaseMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([phase, phaseTasks]) => ({ phase, tasks: phaseTasks }));

  // Phase 간 의존성 추론: 태스크 의존성에서 Phase 의존성을 도출
  const phaseDependencies = {};
  for (const [taskId, depTaskIds] of Object.entries(dependencies)) {
    const taskPhase = taskPhaseMap[taskId];
    if (taskPhase === undefined) continue;

    for (const depTaskId of depTaskIds) {
      const depPhase = taskPhaseMap[depTaskId];
      if (depPhase === undefined || depPhase === taskPhase) continue;

      if (!phaseDependencies[taskPhase]) phaseDependencies[taskPhase] = [];
      if (!phaseDependencies[taskPhase].includes(depPhase)) {
        phaseDependencies[taskPhase].push(depPhase);
      }
    }
  }

  // 위상 정렬(topological sort) 기반 parallelGroups 생성
  const parallelGroups = _buildParallelGroups(phases, phaseDependencies);

  return { phases, dependencies, phaseDependencies, parallelGroups };
}

/**
 * phaseDependencies에서 위상 정렬 기반으로 병렬 실행 가능한 Phase 그룹(tier)을 생성한다.
 * @param {Array<{phase: number}>} phases - 정렬된 phase 배열
 * @param {object} phaseDependencies - Phase → 선행 Phase[] 매핑
 * @returns {Array<Array<number>>} tier별 Phase 번호 배열
 */
function _buildParallelGroups(phases, phaseDependencies) {
  const phaseNums = phases.map((p) => p.phase);
  const tierOf = {};
  const groups = [];

  // 의존이 없는 Phase부터 tier 0 배치 (Kahn's algorithm 변형)
  let remaining = [...phaseNums];

  while (remaining.length > 0) {
    // 현재 tier: 이전 tier들에서 의존이 모두 해결된 Phase들
    const currentTierPhases = remaining.filter((phase) => {
      const deps = phaseDependencies[phase] || [];
      return deps.every((dep) => tierOf[dep] !== undefined);
    });

    if (currentTierPhases.length === 0) {
      // 순환 의존이 있거나 의존 대상이 tasks에 없는 경우 — 나머지를 마지막 tier로
      const tierIdx = groups.length;
      groups.push([...remaining]);
      for (const ph of remaining) tierOf[ph] = tierIdx;
      break;
    }

    const tierIdx = groups.length;
    groups.push(currentTierPhases);
    for (const ph of currentTierPhases) tierOf[ph] = tierIdx;
    remaining = remaining.filter((ph) => !currentTierPhases.includes(ph));
  }

  return groups;
}

/**
 * 태스크가 코드 출력이 필요한 태스크인지 판별한다.
 * @param {object} task - 태스크 객체
 * @returns {boolean}
 */
export function isCodeTask(task) {
  if (!task) return false;

  const { engineerRoles, codeDomains, koreanKeywords, englishKeywords } = config.taskClassification;

  if (task.assignee && engineerRoles.includes(task.assignee)) {
    return true;
  }

  // dynamic role: workDomains에 코드 관련 도메인이 포함되면 코드 태스크
  if (task.assigneeWorkDomains && task.assigneeWorkDomains.some((d) => codeDomains.includes(d))) {
    return true;
  }

  const searchText = `${task.title || ''} ${task.description || ''}`.toLowerCase();

  // 한국어: 단어 경계가 없으므로 includes() 유지
  const koreanMatch = koreanKeywords.some((kw) => searchText.includes(kw));
  if (koreanMatch) return true;

  // 영어: \b 단어 경계로 false positive 방지 (e.g. "classification" ≠ "class")
  return englishKeywords.some((kw) => {
    let re = COMPILED_KEYWORD_REGEXPS.get(kw);
    if (!re) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      re = new RegExp(`\\b${escaped}\\b`);
      COMPILED_KEYWORD_REGEXPS.set(kw, re);
    }
    return re.test(searchText);
  });
}

/**
 * TDD 방식의 실행 프롬프트를 생성한다.
 * RED → GREEN → REFACTOR 사이클을 지시한다.
 * @param {object} task - 태스크 객체
 * @param {object} teamMember - 담당 팀원 정보
 * @param {object} [context={}] - 추가 컨텍스트
 * @param {string} [context.projectType] - 프로젝트 유형
 * @param {string} [context.testFramework] - 테스트 프레임워크 (기본: 'vitest')
 * @param {string} [context.planExcerpt] - 기획 결정사항
 * @param {string} [context.phaseContext] - 이전 Phase 결과 요약
 * @returns {string} TDD 실행 프롬프트
 */
export function buildTddExecutionPrompt(task, teamMember, context = {}) {
  const testFramework = context.testFramework || 'vitest';

  let prompt = `당신은 **${teamMember.displayName}** (${teamMember.role})입니다.

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
- 각 Phase의 결과를 순서대로 보고하세요

## 결과 보고 규격 (필수)

### 구현 요약
- 무엇을 만들었는지 1-3문장으로 설명

### 핵심 파일
- 생성/수정한 주요 파일과 각각의 역할

### 외부 서비스 및 환경변수
- 외부 API/서비스를 사용하면 목록 제공:
  - 환경변수명: 설명 (발급 URL)
  - 예: TELEGRAM_BOT_TOKEN: 텔레그램 봇 토큰 (https://t.me/botfather)
- 외부 서비스가 없으면 "없음"으로 표기

### 실행 방법
- 결과물을 실행/확인하는 구체적 방법

### 커스터마이징 포인트
- 사용자가 수정할 만한 부분과 방법
  - 예: "뉴스 소스 변경 → src/config.js의 NEWS_SOURCES 수정"`;

  prompt += `\n\n## 구현 전 탐색 (Search Before Building)\n\n구현을 시작하기 전에 반드시 다음을 수행하세요:\n1. 프로젝트 내 기존 코드에서 유사한 패턴, 함수, 모듈을 검색하세요\n2. 이미 존재하는 유틸리티나 헬퍼가 있다면 재사용하세요\n3. 새로 만들기 전에 기존 코드와 일관된 패턴을 따르세요`;

  if (context.projectType) {
    prompt += `\n\n## 프로젝트 힌트\n- 프로젝트 유형: ${context.projectType}`;
  }

  if (context.planExcerpt) {
    prompt += `\n\n## 기획 결정사항\n${context.planExcerpt}`;
  }

  if (context.phaseContext) {
    prompt += `\n\n## 이전 Phase 결과\n${context.phaseContext}`;
  }

  if (context.phaseGuidance) {
    prompt += `\n\n## CEO 지침 (이번 Phase)\n\n${context.phaseGuidance}\n\n**위 지침을 최우선으로 반영하세요.**`;
  }

  if (context.consultationEnabled) {
    prompt += `\n\n## 전문가 상담\n다른 역할에게 질문이 필요하면:\n\`[CONSULT:역할ID]: 질문\`\n(최대 1개, 선택사항)`;
  }

  if (context.allowedPaths && context.allowedPaths.length > 0) {
    prompt += `\n\n## 편집 범위 제한\n\n이 Phase에서는 다음 경로의 파일만 수정하세요:\n${context.allowedPaths.map((p) => `- ${p}`).join('\n')}\n\n위 경로 외의 파일은 읽기만 가능합니다. 수정이 필요하면 리뷰에서 별도 요청하세요.`;
  }

  return prompt;
}

/**
 * 완료된 태스크 목록에서 Phase 컨텍스트를 생성한다.
 * 다음 Phase 에이전트에게 이전 결과를 전달하기 위한 요약 텍스트.
 * @param {Array<object>} completedTasks - taskOutput이 포함된 완료 태스크 배열
 * @param {object} options - 옵션
 * @param {number} [options.maxLinesPerTask=8] - 태스크당 최대 줄 수
 * @returns {string} Phase 컨텍스트 텍스트
 */
export function buildPhaseContext(completedTasks, options = {}) {
  if (!completedTasks || completedTasks.length === 0) return '';
  const maxLines = options.maxLinesPerTask || 8;

  return completedTasks
    .filter((t) => t.taskOutput && t.taskOutput.trim())
    .map((t) => {
      const lines = t.taskOutput.split('\n').filter((l) => l.trim());
      const joined = lines.join('\n');
      return `### ${t.id}: ${t.title} (${t.assignee})\n${truncateLines(joined, maxLines)}`;
    })
    .join('\n\n');
}
