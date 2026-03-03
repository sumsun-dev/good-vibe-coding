/**
 * 테스트용 프로젝트 fixture
 */

/** 기본 웹앱 프로젝트 */
export const WEB_APP_PROJECT = {
  id: 'test-webapp-2026-02',
  name: '테스트 웹앱',
  type: 'web-app',
  description: 'E2E 테스트용 웹 애플리케이션',
  createdAt: '2026-02-01T00:00:00.000Z',
  status: 'executing',
  mode: 'plan-execute',
  infraPath: null,
  githubUrl: null,
  team: [],
  discussion: { rounds: [], planDocument: '' },
  tasks: [],
  report: null,
  feedback: [],
};

/** CLI 도구 프로젝트 */
export const CLI_PROJECT = {
  id: 'test-cli-2026-02',
  name: '테스트 CLI',
  type: 'cli-tool',
  description: 'CLI 도구 테스트용 프로젝트',
  createdAt: '2026-02-01T00:00:00.000Z',
  status: 'executing',
  mode: 'plan-execute',
  infraPath: null,
  githubUrl: null,
  team: [],
  discussion: { rounds: [], planDocument: '' },
  tasks: [],
  report: null,
  feedback: [],
};

/** API 서버 프로젝트 */
export const API_PROJECT = {
  id: 'test-api-2026-02',
  name: '테스트 API',
  type: 'api-server',
  description: 'API 서버 테스트용 프로젝트',
  createdAt: '2026-02-01T00:00:00.000Z',
  status: 'approved',
  mode: 'plan-execute',
  infraPath: null,
  githubUrl: null,
  team: [],
  discussion: { rounds: [], planDocument: '' },
  tasks: [],
  report: null,
  feedback: [],
};

/** 태스크가 포함된 프로젝트 */
export const PROJECT_WITH_TASKS = {
  ...CLI_PROJECT,
  id: 'test-with-tasks-2026-02',
  tasks: [
    {
      id: 'task-1',
      title: '아키텍처 설계',
      assignee: 'cto',
      description: '시스템 아키텍처를 설계합니다',
      phase: 1,
      dependencies: [],
      status: 'completed',
    },
    {
      id: 'task-2',
      title: 'API 구현',
      assignee: 'backend',
      description: 'REST API를 구현합니다',
      phase: 1,
      dependencies: [],
      status: 'executing',
    },
    {
      id: 'task-3',
      title: '테스트 작성',
      assignee: 'qa',
      description: '단위 테스트를 작성합니다',
      phase: 2,
      dependencies: ['task-1', 'task-2'],
      status: 'pending',
    },
    {
      id: 'task-4',
      title: 'UI 구현',
      assignee: 'frontend',
      description: '프론트엔드 UI를 구현합니다',
      phase: 2,
      dependencies: ['task-1'],
      status: 'pending',
    },
  ],
};

/** 샘플 태스크 */
export const SAMPLE_TASKS = PROJECT_WITH_TASKS.tasks;

/** 코드 태스크 */
export const CODE_TASK = {
  id: 'task-code-1',
  title: 'REST API 엔드포인트 구현',
  assignee: 'backend',
  description: '사용자 CRUD API 엔드포인트를 구현합니다',
  phase: 1,
  dependencies: [],
  status: 'pending',
  projectType: 'cli-tool',
};

/** 비코드 태스크 */
export const NON_CODE_TASK = {
  id: 'task-noncode-1',
  title: '시장 분석 보고서 작성',
  assignee: 'market-researcher',
  description: '경쟁사 분석 및 시장 트렌드 보고서를 작성합니다',
  phase: 1,
  dependencies: [],
  status: 'pending',
};
