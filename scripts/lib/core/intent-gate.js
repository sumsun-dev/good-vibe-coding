/**
 * intent-gate — 사용자 의도 분류 + 상태 라우팅
 * good-vibe:new Step 0.5에서 사용. 순수 함수, LLM 호출 없음.
 */

const STATE_ROUTES = Object.freeze({
  planning: {
    commands: ['discuss', 'approve'],
    message: 'good-vibe:discuss로 토론을 계속하거나, good-vibe:approve로 승인하세요',
  },
  approved: { commands: ['execute'], message: 'good-vibe:execute로 실행을 시작하세요' },
  executing: { commands: ['execute'], message: 'good-vibe:execute로 중단된 작업을 재개하세요' },
  reviewing: { commands: ['execute'], message: 'good-vibe:execute로 리뷰 중인 작업을 재개하세요' },
  completed: {
    commands: ['modify', 'report'],
    message: 'good-vibe:modify로 수정하거나, good-vibe:report로 보고서를 확인하세요',
  },
});

const INTENT_PATTERNS = [
  { intent: 'status', patterns: [/상태/, /진행.*상황/, /어디.*까지/, /status/i] },
  { intent: 'modify', patterns: [/수정/, /변경/, /고쳐/, /개선/, /추가해/, /바꿔/, /modify/i] },
  {
    intent: 'resume',
    patterns: [
      /이어서/,
      /계속.*하/,
      /재개/,
      /이전.*프로젝트/,
      /하던.*프로젝트/,
      /resume/i,
      /continue.*project/i,
    ],
  },
  {
    intent: 'create',
    patterns: [/팀.*만들/, /프로젝트.*시작/, /새.*프로젝트/, /create.*team/i, /new.*project/i],
  },
];

const MAX_PROJECTS_IN_RESPONSE = 10;

const INCOMPLETE_STATUSES = new Set(['planning', 'approved', 'executing', 'reviewing']);

/**
 * 사용자 입력 + 프로젝트 상태로 의도를 분류한다 (순수 함수, LLM 없음).
 * @param {string|null|undefined} input - 사용자 텍스트
 * @param {Array<object>} projects - listProjects() 반환값
 * @returns {{ intent: string, suggestedProject: object|null, route: object|null, projects: Array, hasExistingProjects: boolean }}
 */
export function classifyIntent(input, projects = []) {
  const hasExistingProjects = projects.length > 0;
  const summarized = summarizeProjects(projects);
  const trimmed = (input ?? '').trim();

  // 1. 프로젝트 없음
  if (!hasExistingProjects) {
    return {
      intent: 'create',
      suggestedProject: null,
      route: null,
      projects: [],
      hasExistingProjects: false,
    };
  }

  // 2. 입력 없음/빈값
  if (!trimmed) {
    return {
      intent: 'create',
      suggestedProject: null,
      route: null,
      projects: summarized,
      hasExistingProjects: true,
    };
  }

  // 3. 패턴 매칭
  const matched = matchIntent(trimmed);
  if (matched) {
    return resolveIntent(matched, projects, summarized);
  }

  // 4. 패턴 없음 — 새 프로젝트 설명으로 추정 (기존 프로젝트 목록은 hasExistingProjects로 전달)
  return {
    intent: 'create',
    suggestedProject: null,
    route: null,
    projects: summarized,
    hasExistingProjects: true,
  };
}

/**
 * 상태별 라우트 정보를 반환한다.
 * @param {string} status - 프로젝트 상태
 * @returns {{ commands: string[], message: string }|null}
 */
export function getStateRoute(status) {
  return STATE_ROUTES[status] || null;
}

// --- 내부 헬퍼 ---

function matchIntent(input) {
  for (const { intent, patterns } of INTENT_PATTERNS) {
    if (patterns.some((p) => p.test(input))) return intent;
  }
  return null;
}

function resolveIntent(intent, projects, summarized) {
  const hasExistingProjects = true;

  if (intent === 'status') {
    const recent = findMostRecent(projects, () => true);
    return {
      intent: 'status',
      suggestedProject: recent ? summarizeOne(recent) : null,
      route: null,
      projects: summarized,
      hasExistingProjects,
    };
  }

  if (intent === 'modify') {
    const completed = findMostRecent(projects, (p) => p.status === 'completed');
    if (completed) {
      const route = STATE_ROUTES.completed;
      return {
        intent: 'modify',
        suggestedProject: summarizeOne(completed),
        route,
        projects: summarized,
        hasExistingProjects,
      };
    }
    return {
      intent: 'create',
      suggestedProject: null,
      route: null,
      projects: summarized,
      hasExistingProjects,
    };
  }

  if (intent === 'resume') {
    const incomplete = findMostRecent(projects, (p) => INCOMPLETE_STATUSES.has(p.status));
    if (incomplete) {
      const route = STATE_ROUTES[incomplete.status] || null;
      return {
        intent: 'resume',
        suggestedProject: summarizeOne(incomplete),
        route,
        projects: summarized,
        hasExistingProjects,
      };
    }
    return {
      intent: 'create',
      suggestedProject: null,
      route: null,
      projects: summarized,
      hasExistingProjects,
    };
  }

  // create
  return {
    intent: 'create',
    suggestedProject: null,
    route: null,
    projects: summarized,
    hasExistingProjects,
  };
}

function findMostRecent(projects, filterFn) {
  const filtered = projects.filter(filterFn);
  if (filtered.length === 0) return null;
  return filtered.reduce((latest, cur) =>
    new Date(cur.createdAt) > new Date(latest.createdAt) ? cur : latest,
  );
}

function summarizeOne(project) {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    mode: project.mode,
    teamSize: Array.isArray(project.team) ? project.team.length : 0,
    createdAt: project.createdAt,
  };
}

function summarizeProjects(projects) {
  return projects.slice(0, MAX_PROJECTS_IN_RESPONSE).map(summarizeOne);
}
