/**
 * command-schemas — 커맨드 입출력 스키마 레지스트리
 * 에이전트가 CLI 커맨드의 입출력 형태를 프로그래밍적으로 조회할 수 있게 한다.
 */

/**
 * 입력 방법:
 * - 'stdin'  : JSON을 stdin으로 전달
 * - 'args'   : --key value 형태의 CLI 인자
 * - 'none'   : 입력 없음
 *
 * 스키마 형식: schema-validator.js 형식 활용
 * { type: 'string'|'number'|'boolean'|'array'|'object',
 *   required?: boolean, properties?: Record<string, Schema> }
 */

// === 경량 스키마 빌더 (반복 줄이기) ===
const obj = (properties) => ({ type: 'object', properties });
const str = (required = false) => (required ? { type: 'string', required: true } : { type: 'string' });
const num = (required = false) => (required ? { type: 'number', required: true } : { type: 'number' });
const bool = (required = false) => (required ? { type: 'boolean', required: true } : { type: 'boolean' });
const arr = (required = false) => (required ? { type: 'array', required: true } : { type: 'array' });
const objField = (required = false) => (required ? { type: 'object', required: true } : { type: 'object' });
const strEnum = (values, required = false) => ({ type: 'string', enum: values, ...(required ? { required: true } : {}) });

const promptOutput = obj({ prompt: str() });
const projectAndNextStep = obj({ project: objField(), nextStep: objField() });
const idArgsInput = obj({ id: str(true) });

export const COMMAND_SCHEMAS = {
  // ============================================================
  // === project (8개) ===
  // ============================================================
  'create-project': {
    handler: 'project',
    inputMethod: 'stdin',
    input: obj({
      name: str(true),
      type: str(true),
      description: str(),
      mode: strEnum(['plan-only', 'plan-execute', 'quick-build']),
    }),
    output: obj({ id: str(), name: str(), type: str(), status: str() }),
    description: '새 프로젝트를 생성한다',
  },
  'get-project': {
    handler: 'project',
    inputMethod: 'args',
    input: idArgsInput,
    output: obj({ id: str(), name: str(), status: str(), team: arr(), tasks: arr() }),
    description: '프로젝트를 조회한다',
  },
  'list-projects': {
    handler: 'project',
    inputMethod: 'none',
    input: obj({}),
    output: arr(),
    description: '전체 프로젝트 목록을 반환한다',
  },
  'update-status': {
    handler: 'project',
    inputMethod: 'stdin',
    input: obj({
      id: str(true),
      status: strEnum(['planning', 'approved', 'executing', 'reviewing', 'completed'], true),
    }),
    output: obj({ id: str(), status: str() }),
    description: '프로젝트 상태를 업데이트한다',
  },
  'set-team': {
    handler: 'project',
    inputMethod: 'stdin',
    input: obj({ id: str(true), team: arr(true) }),
    output: obj({ id: str(), team: arr() }),
    description: '프로젝트 팀을 설정한다',
  },
  'execution-progress': {
    handler: 'project',
    inputMethod: 'args',
    input: idArgsInput,
    output: obj({ totalTasks: num(), completedTasks: num(), currentPhase: num(), totalPhases: num(), percentage: num() }),
    description: '프로젝트 실행 진행률을 반환한다',
  },
  'report': {
    handler: 'project',
    inputMethod: 'args',
    input: idArgsInput,
    output: obj({ report: str() }),
    description: '프로젝트 보고서를 생성한다',
  },
  'scan-codebase': {
    handler: 'project',
    inputMethod: 'args',
    input: obj({ path: str(true) }),
    output: obj({ techStack: arr(), languages: objField(), dependencies: objField(), fileStructure: str(), suggestedRoles: arr(), scannedAt: str() }),
    description: '프로젝트 폴더를 스캔하여 기술 스택과 구조를 파악한다',
  },
  'describe-command': {
    handler: 'project',
    inputMethod: 'args',
    input: obj({ command: str() }),
    output: obj({ command: str(), handler: str(), inputMethod: str() }),
    description: '커맨드 스키마를 조회한다',
  },

  // ============================================================
  // === team (6개) ===
  // ============================================================
  'recommend-team': {
    handler: 'team',
    inputMethod: 'args',
    input: obj({ type: str(true) }),
    output: obj({ recommended: arr(), optional: arr() }),
    description: '프로젝트 타입에 따른 팀을 추천한다',
  },
  'optimized-team': {
    handler: 'team',
    inputMethod: 'stdin',
    input: obj({ projectType: str(true), complexity: str(true) }),
    output: obj({ roles: arr(), optional: arr() }),
    description: '타입 + 복잡도를 결합해 최적 팀을 구성한다',
  },
  'build-team': {
    handler: 'team',
    inputMethod: 'stdin',
    input: obj({ roleIds: arr(true), personalityChoices: objField(), complexity: str() }),
    output: arr(),
    description: '역할 ID와 페르소나로 팀을 빌드한다',
  },
  'role-catalog': {
    handler: 'team',
    inputMethod: 'none',
    input: obj({}),
    output: obj({ roles: objField() }),
    description: '역할 카탈로그를 반환한다',
  },
  'project-types': {
    handler: 'team',
    inputMethod: 'none',
    input: obj({}),
    output: obj({ types: objField() }),
    description: '프로젝트 타입 목록을 반환한다',
  },
  'design-dynamic-roles': {
    handler: 'team',
    inputMethod: 'stdin',
    input: obj({ description: str(true), existingRoles: arr(), codebaseInfo: objField() }),
    output: promptOutput,
    description: '프로젝트별 맞춤 역할 설계 프롬프트를 생성한다',
  },
  'parse-dynamic-roles': {
    handler: 'team',
    inputMethod: 'stdin',
    input: obj({ rawOutput: str(true) }),
    output: obj({ roles: arr() }),
    description: '동적 역할 LLM 출력을 파싱한다',
  },
  'build-team-with-dynamic': {
    handler: 'team',
    inputMethod: 'stdin',
    input: obj({ roleIds: arr(true), dynamicRoles: arr(), complexity: str() }),
    output: arr(),
    description: 'catalog 역할과 동적 역할을 병합하여 팀을 빌드한다',
  },
  'team-summary': {
    handler: 'team',
    inputMethod: 'stdin',
    input: obj({ roleIds: arr(true), personalityChoices: objField() }),
    output: obj({ summary: str(), team: arr() }),
    description: '팀 요약 문자열을 생성한다',
  },

  // ============================================================
  // === discussion (10개) ===
  // ============================================================
  'discussion-prompt': {
    handler: 'discussion',
    inputMethod: 'args',
    input: idArgsInput,
    output: promptOutput,
    description: '프로젝트별 토론 프롬프트를 생성한다',
  },
  'plan-document': {
    handler: 'discussion',
    inputMethod: 'stdin',
    input: obj({ project: objField(true), discussions: arr() }),
    output: obj({ planDocument: str() }),
    description: '기획서를 저장한다',
  },
  'single-agent-discussion-prompt': {
    handler: 'discussion',
    inputMethod: 'stdin',
    input: obj({ project: objField(true), teamMember: objField(true), context: objField() }),
    output: promptOutput,
    description: '단일 에이전트 토론 프롬프트를 생성한다',
  },
  'agent-analysis-prompt': {
    handler: 'discussion',
    inputMethod: 'stdin',
    input: obj({ project: objField(true), teamMember: objField(true), context: objField() }),
    output: promptOutput,
    description: '개별 에이전트 분석 프롬프트를 생성한다',
  },
  'synthesis-prompt': {
    handler: 'discussion',
    inputMethod: 'stdin',
    input: obj({ project: objField(true), agentOutputs: arr(true), round: num(true) }),
    output: promptOutput,
    description: '에이전트 분석을 종합하는 프롬프트를 생성한다',
  },
  'review-prompt': {
    handler: 'discussion',
    inputMethod: 'stdin',
    input: obj({ teamMember: objField(true), synthesizedPlan: str(true), round: num(true) }),
    output: promptOutput,
    description: '리뷰 프롬프트를 생성한다',
  },
  'check-convergence': {
    handler: 'discussion',
    inputMethod: 'stdin',
    input: obj({ reviews: arr(true) }),
    output: obj({ converged: bool(), approvalRate: num(), blockers: arr() }),
    description: '토론 수렴 여부를 확인한다',
  },
  'group-agents': {
    handler: 'discussion',
    inputMethod: 'stdin',
    input: obj({ team: arr(true) }),
    output: obj({ tiers: arr() }),
    description: '팀을 tier별로 그룹화한다',
  },
  'discussion-dispatch-plan': {
    handler: 'discussion',
    inputMethod: 'stdin',
    input: obj({ project: objField(true), team: arr(true), round: num() }),
    output: obj({ plan: objField() }),
    description: '토론 디스패치 계획을 생성한다',
  },
  'generate-acceptance-criteria': {
    handler: 'discussion',
    inputMethod: 'stdin',
    input: obj({ planDocument: str(true), projectContext: objField() }),
    output: promptOutput,
    description: '기획서 기반 수락 기준 생성 프롬프트를 생성한다',
  },
  'parse-acceptance-criteria': {
    handler: 'discussion',
    inputMethod: 'stdin',
    input: obj({ rawOutput: str(true) }),
    output: obj({ criteria: arr() }),
    description: '수락 기준 LLM 출력을 파싱한다',
  },
  'execution-dispatch-plan': {
    handler: 'discussion',
    inputMethod: 'stdin',
    input: obj({ project: objField(true), team: arr(true), tasks: arr(true) }),
    output: obj({ plan: objField() }),
    description: '실행 디스패치 계획을 생성한다',
  },

  // ============================================================
  // === execution (10개) ===
  // ============================================================
  'init-execution': {
    handler: 'execution',
    inputMethod: 'stdin',
    input: obj({
      id: str(true),
      mode: strEnum(['interactive', 'auto']),
      resume: bool(),
    }),
    output: obj({ project: objField(), nextStep: objField(), resumed: bool() }),
    description: '실행을 초기화하거나 재개한다',
  },
  'next-step': {
    handler: 'execution',
    inputMethod: 'args',
    input: idArgsInput,
    output: obj({ action: str(), phase: num(), description: str() }),
    description: '다음 실행 단계를 조회한다',
  },
  'advance-execution': {
    handler: 'execution',
    inputMethod: 'stdin',
    input: obj({
      id: str(true),
      stepResult: { type: 'object', required: true, properties: { completedAction: str(true) } },
    }),
    output: projectAndNextStep,
    description: '실행 상태를 다음 단계로 전이시킨다',
  },
  'execution-summary': {
    handler: 'execution',
    inputMethod: 'args',
    input: idArgsInput,
    output: obj({ status: str(), currentPhase: num(), totalPhases: num(), percentage: num(), display: str() }),
    description: '실행 진행 요약을 반환한다',
  },
  'task-distribution-prompt': {
    handler: 'execution',
    inputMethod: 'args',
    input: idArgsInput,
    output: promptOutput,
    description: '태스크 분배 프롬프트를 생성한다',
  },
  'execution-prompt': {
    handler: 'execution',
    inputMethod: 'stdin',
    input: obj({ task: objField(true), teamMember: objField(true), context: objField() }),
    output: promptOutput,
    description: '실행 프롬프트를 생성한다',
  },
  'execution-plan': {
    handler: 'execution',
    inputMethod: 'stdin',
    input: obj({ tasks: arr(true), team: arr(true) }),
    output: obj({ phases: arr() }),
    description: '실행 계획을 생성한다',
  },
  'execution-plan-with-reviews': {
    handler: 'execution',
    inputMethod: 'stdin',
    input: obj({ tasks: arr(true), team: arr(true) }),
    output: obj({ phases: arr() }),
    description: '리뷰를 포함한 실행 계획을 생성한다',
  },
  'get-failure-context': {
    handler: 'execution',
    inputMethod: 'args',
    input: idArgsInput,
    output: obj({ status: str(), phase: num(), fixAttempt: num(), failureContext: objField(), failureHistory: arr(), pendingEscalation: objField() }),
    description: '실패 컨텍스트를 조회한다',
  },
  'handle-escalation': {
    handler: 'execution',
    inputMethod: 'stdin',
    input: obj({
      id: str(true),
      decision: strEnum(['continue', 'skip', 'abort'], true),
      reason: str(),
    }),
    output: projectAndNextStep,
    description: 'CEO 에스컬레이션에 대한 결정을 처리한다',
  },

  // ============================================================
  // === review (7개) ===
  // ============================================================
  'select-reviewers': {
    handler: 'review',
    inputMethod: 'stdin',
    input: obj({ task: objField(true), team: arr(true) }),
    output: obj({ reviewers: arr() }),
    description: '태스크에 적합한 리뷰어를 선정한다',
  },
  'task-review-prompt': {
    handler: 'review',
    inputMethod: 'stdin',
    input: obj({ reviewer: objField(true), task: objField(true), taskOutput: str(true) }),
    output: promptOutput,
    description: '태스크 리뷰 프롬프트를 생성한다',
  },
  'check-quality-gate': {
    handler: 'review',
    inputMethod: 'stdin',
    input: obj({ reviews: arr(true) }),
    output: obj({ passed: bool(), criticalCount: num(), importantCount: num(), summary: str() }),
    description: '품질 게이트를 확인한다',
  },
  'enhanced-quality-gate': {
    handler: 'review',
    inputMethod: 'stdin',
    input: obj({ reviews: arr(true), executionResult: objField() }),
    output: obj({ passed: bool(), criticalCount: num(), importantCount: num(), executionVerified: bool(), summary: str() }),
    description: '강화된 품질 게이트를 확인한다 (텍스트 + 실행 검증)',
  },
  'revision-prompt': {
    handler: 'review',
    inputMethod: 'stdin',
    input: obj({ task: objField(true), implementer: objField(true), reviews: arr(true), failureContext: objField() }),
    output: promptOutput,
    description: '수정 프롬프트를 생성한다',
  },
  'verify-execution': {
    handler: 'review',
    inputMethod: 'stdin',
    input: obj({ taskOutput: str(true), task: objField(true) }),
    output: obj({ verified: bool(), buildResult: objField() }),
    description: '빌드 실행을 검증한다',
  },
  'analyze-efficiency': {
    handler: 'review',
    inputMethod: 'stdin',
    input: obj({ agentOutputs: arr(), roleContributions: arr(), teamSize: num(), id: str() }),
    output: obj({ redundancies: arr(), recommendations: arr() }),
    description: '에이전트 효율성을 분석한다',
  },

  // ============================================================
  // === build (5개) ===
  // ============================================================
  'materialize-code': {
    handler: 'build',
    inputMethod: 'stdin',
    input: obj({ taskOutput: str(true), projectDir: str(true) }),
    output: obj({ files: arr(), summary: str() }),
    description: '마크다운에서 파일을 추출하고 기록한다',
  },
  'materialize-batch': {
    handler: 'build',
    inputMethod: 'stdin',
    input: obj({ taskOutputs: arr(true), projectDir: str(true), options: objField() }),
    output: obj({ results: arr(), totalFiles: num() }),
    description: '여러 태스크의 코드를 일괄 구체화한다',
  },
  'verify-and-materialize': {
    handler: 'build',
    inputMethod: 'stdin',
    input: obj({ taskOutput: str(true), task: objField(true), projectDir: str(true) }),
    output: obj({ verified: bool(), files: arr() }),
    description: '빌드 검증 후 프로젝트에 기록한다',
  },
  'extract-materializable-blocks': {
    handler: 'build',
    inputMethod: 'stdin',
    input: obj({ taskOutput: str(true) }),
    output: obj({ blocks: arr() }),
    description: '마크다운에서 구체화 가능한 코드 블록을 추출한다',
  },
  'commit-phase': {
    handler: 'build',
    inputMethod: 'stdin',
    input: obj({ projectDir: str(true), phase: num(true), message: str() }),
    output: obj({ committed: bool(), message: str() }),
    description: 'Phase 결과를 커밋한다',
  },
  'commit-phase-enhanced': {
    handler: 'build',
    inputMethod: 'stdin',
    input: obj({ projectDir: str(true), phase: num(true), tasks: arr(), project: objField(), team: arr(), totalPhases: num(), qualityGate: objField() }),
    output: obj({ success: bool(), message: str(), error: str() }),
    description: 'conventional commit 메시지로 Phase를 커밋한다',
  },

  // ============================================================
  // === eval (9개) ===
  // ============================================================
  'eval-create': {
    handler: 'eval',
    inputMethod: 'stdin',
    input: obj({ projectDescription: str(true), approaches: arr(true) }),
    output: obj({ sessionId: str(), approaches: arr() }),
    description: 'A/B 평가 세션을 생성한다',
  },
  'eval-record': {
    handler: 'eval',
    inputMethod: 'stdin',
    input: obj({ sessionId: str(true), approach: str(true), result: objField(true) }),
    output: obj({ sessionId: str(), approach: str() }),
    description: '평가 결과를 기록한다',
  },
  'eval-compare': {
    handler: 'eval',
    inputMethod: 'args',
    input: obj({ 'session-id': str(true) }),
    output: obj({ comparison: objField(), winner: str() }),
    description: '평가 결과를 비교한다',
  },
  'eval-report': {
    handler: 'eval',
    inputMethod: 'args',
    input: obj({ 'session-id': str(true) }),
    output: obj({ report: str() }),
    description: '평가 보고서를 생성한다',
  },
  'eval-list': {
    handler: 'eval',
    inputMethod: 'none',
    input: obj({}),
    output: arr(),
    description: '평가 세션 목록을 반환한다',
  },
  'eval-baseline-prompt': {
    handler: 'eval',
    inputMethod: 'stdin',
    input: obj({ description: str(true) }),
    output: promptOutput,
    description: '기준선 프롬프트를 생성한다',
  },
  'complexity-analysis': {
    handler: 'eval',
    inputMethod: 'stdin',
    input: obj({ description: str(true) }),
    output: promptOutput,
    description: '복잡도 분석 프롬프트를 생성한다',
  },
  'parse-complexity': {
    handler: 'eval',
    inputMethod: 'stdin',
    input: obj({ rawOutput: str(true) }),
    output: obj({ level: str(), suggestedMode: str(), reasoning: str() }),
    description: '복잡도 분석 결과를 파싱한다',
  },
  'complexity-defaults': {
    handler: 'eval',
    inputMethod: 'args',
    input: obj({ level: str(true) }),
    output: obj({ teamSize: objField(), discussionRounds: num(), reviewRounds: num(), suggestedRoles: arr() }),
    description: '복잡도별 기본값을 반환한다',
  },

  // ============================================================
  // === auth (9개) ===
  // ============================================================
  'connect': {
    handler: 'auth',
    inputMethod: 'stdin',
    input: obj({ provider: str(true), apiKey: str(), type: str() }),
    output: obj({ providerId: str(), type: str() }),
    description: 'LLM 프로바이더를 연결한다',
  },
  'disconnect': {
    handler: 'auth',
    inputMethod: 'stdin',
    input: obj({ provider: str(true) }),
    output: obj({ providerId: str() }),
    description: 'LLM 프로바이더 연결을 해제한다',
  },
  'providers': {
    handler: 'auth',
    inputMethod: 'none',
    input: obj({}),
    output: obj({ supported: arr() }),
    description: '지원 프로바이더 목록을 반환한다',
  },
  'connected-providers': {
    handler: 'auth',
    inputMethod: 'none',
    input: obj({}),
    output: arr(),
    description: '연결된 프로바이더 목록을 반환한다',
  },
  'set-review-strategy': {
    handler: 'auth',
    inputMethod: 'stdin',
    input: obj({ strategy: str(true) }),
    output: obj({ strategy: str() }),
    description: '리뷰 전략을 설정한다',
  },
  'verify-provider': {
    handler: 'auth',
    inputMethod: 'stdin',
    input: obj({ provider: str(true) }),
    output: obj({ connected: bool(), model: str() }),
    description: '프로바이더 연결을 검증한다',
  },
  'cross-model-review': {
    handler: 'auth',
    inputMethod: 'stdin',
    input: obj({ task: objField(true), team: arr(true) }),
    output: obj({ results: arr() }),
    description: '크로스 모델 리뷰를 실행한다',
  },
  'resolve-review-assignments': {
    handler: 'auth',
    inputMethod: 'stdin',
    input: obj({ reviewers: arr(true) }),
    output: obj({ assignments: arr() }),
    description: '리뷰어를 프로바이더별로 배정한다',
  },
  'gemini-review': {
    handler: 'auth',
    inputMethod: 'stdin',
    input: obj({ reviewer: objField(true), task: objField(true), taskOutput: str(true), model: str() }),
    output: obj({ reviewer: objField(), provider: str(), model: str(), review: objField(), tokenCount: num() }),
    description: 'Gemini로 리뷰를 실행한다',
  },

  // ============================================================
  // === feedback (11개) ===
  // ============================================================
  'extract-performance': {
    handler: 'feedback',
    inputMethod: 'args',
    input: idArgsInput,
    output: arr(),
    description: '에이전트별 성과를 추출한다',
  },
  'improvement-prompt': {
    handler: 'feedback',
    inputMethod: 'stdin',
    input: obj({ roleId: str(true), performance: objField(), agentMd: str() }),
    output: promptOutput,
    description: '개선 제안 프롬프트를 생성한다',
  },
  'parse-suggestions': {
    handler: 'feedback',
    inputMethod: 'stdin',
    input: obj({ analysisText: str(true) }),
    output: obj({ suggestions: arr() }),
    description: '개선 제안을 파싱한다',
  },
  'save-agent-override': {
    handler: 'feedback',
    inputMethod: 'stdin',
    input: obj({ roleId: str(true), content: str(true) }),
    output: obj({ roleId: str() }),
    description: '에이전트 오버라이드를 저장한다 (사용자 레벨)',
  },
  'load-agent-override': {
    handler: 'feedback',
    inputMethod: 'args',
    input: obj({ role: str(true) }),
    output: obj({ roleId: str(), content: str() }),
    description: '에이전트 오버라이드를 로딩한다',
  },
  'list-agent-overrides': {
    handler: 'feedback',
    inputMethod: 'none',
    input: obj({}),
    output: arr(),
    description: '에이전트 오버라이드 목록을 반환한다',
  },
  'merge-agent-override': {
    handler: 'feedback',
    inputMethod: 'stdin',
    input: obj({ baseMd: str(true), overrideMd: str(true) }),
    output: obj({ merged: str() }),
    description: '에이전트 오버라이드를 머지한다',
  },
  'save-project-override': {
    handler: 'feedback',
    inputMethod: 'stdin',
    input: obj({ roleId: str(true), content: str(true), projectDir: str(true) }),
    output: obj({ roleId: str() }),
    description: '프로젝트 레벨 에이전트 오버라이드를 저장한다',
  },
  'load-project-override': {
    handler: 'feedback',
    inputMethod: 'stdin',
    input: obj({ roleId: str(true), projectDir: str(true) }),
    output: obj({ content: str() }),
    description: '프로젝트 레벨 에이전트 오버라이드를 로딩한다',
  },
  'list-project-overrides': {
    handler: 'feedback',
    inputMethod: 'stdin',
    input: obj({ projectDir: str(true) }),
    output: arr(),
    description: '프로젝트 레벨 오버라이드 목록을 반환한다',
  },
  'merge-all-overrides': {
    handler: 'feedback',
    inputMethod: 'stdin',
    input: obj({ baseMd: str(true), overrides: arr() }),
    output: obj({ result: str() }),
    description: '모든 레벨의 오버라이드를 머지한다',
  },

  // ============================================================
  // === infra (8개) ===
  // ============================================================
  'setup-project-infra': {
    handler: 'infra',
    inputMethod: 'stdin',
    input: obj({ name: str(true), description: str(), techStack: str(), targetDir: str() }),
    output: obj({ projectDir: str(), created: arr() }),
    description: '프로젝트 인프라를 세팅한다',
  },
  'check-gh-status': {
    handler: 'infra',
    inputMethod: 'none',
    input: obj({}),
    output: obj({ ghInstalled: bool(), authenticated: bool() }),
    description: 'GitHub CLI 상태를 확인한다',
  },
  'check-gemini-status': {
    handler: 'infra',
    inputMethod: 'none',
    input: obj({}),
    output: obj({ installed: bool(), authType: str(), model: str() }),
    description: 'Gemini CLI 설치 상태를 확인한다',
  },
  'create-github-repo': {
    handler: 'infra',
    inputMethod: 'stdin',
    input: obj({ repoName: str(true), description: str(), visibility: str() }),
    output: obj({ repoUrl: str() }),
    description: 'GitHub 저장소를 생성한다',
  },
  'git-init-push': {
    handler: 'infra',
    inputMethod: 'stdin',
    input: obj({ projectDir: str(true), remoteUrl: str(true) }),
    output: obj({ pushed: bool() }),
    description: 'git init + push를 실행한다',
  },
  'append-claude-md': {
    handler: 'infra',
    inputMethod: 'stdin',
    input: obj({ claudeMdPath: str(true), sectionName: str(true), content: str(true) }),
    output: obj({ success: bool() }),
    description: 'CLAUDE.md에 섹션을 추가한다',
  },
  'check-environment': {
    handler: 'infra',
    inputMethod: 'none',
    input: obj({}),
    output: obj({
      node: objField(), npm: objField(), git: objField(),
      gh: objField(), gemini: objField(), handlebars: objField(),
      healthy: bool(),
    }),
    description: '개발 환경의 필수/선택 도구 설치 상태를 확인한다',
  },
  'check-version': {
    handler: 'infra',
    inputMethod: 'none',
    input: obj({}),
    output: obj({ version: str(), updateAvailable: bool(), instructions: str() }),
    description: '현재 버전과 업데이트 가능 여부를 확인한다',
  },
  'create-branch': {
    handler: 'infra',
    inputMethod: 'stdin',
    input: obj({ projectDir: str(true), projectSlug: str(true), baseBranch: str(), strategy: strEnum(['timestamp', 'phase', 'custom']), context: objField() }),
    output: obj({ success: bool(), branchName: str(), error: str() }),
    description: 'feature branch를 생성한다',
  },
  'push-branch': {
    handler: 'infra',
    inputMethod: 'stdin',
    input: obj({ projectDir: str(true), branchName: str(true) }),
    output: obj({ success: bool(), skipped: bool(), reason: str(), error: str() }),
    description: 'branch를 remote에 push한다',
  },
  'current-branch': {
    handler: 'infra',
    inputMethod: 'stdin',
    input: obj({ projectDir: str(true) }),
    output: obj({ branch: str() }),
    description: '현재 branch를 조회한다',
  },
  'create-pr': {
    handler: 'infra',
    inputMethod: 'stdin',
    input: obj({ projectDir: str(true), branchName: str(true), baseBranch: str(), title: str(true), body: str(true), labels: arr(), draft: bool() }),
    output: obj({ success: bool(), url: str(), skipped: bool(), reason: str(), error: str() }),
    description: 'Pull Request를 생성한다',
  },
  'build-pr-body': {
    handler: 'infra',
    inputMethod: 'stdin',
    input: obj({ project: objField(true), executionState: objField(), options: objField() }),
    output: obj({ title: str(), body: str(), labels: arr() }),
    description: 'PR 제목/본문/라벨을 생성한다',
  },
  'generate-ci': {
    handler: 'infra',
    inputMethod: 'stdin',
    input: obj({ projectDir: str(true), techStack: arr(), codebaseInfo: objField(), packageJson: objField() }),
    output: obj({ success: bool(), filePath: str(), strategy: objField(), commands: objField() }),
    description: 'GitHub Actions CI 워크플로우를 생성한다',
  },

  // ============================================================
  // === metrics (3개) ===
  // ============================================================
  'record-metrics': {
    handler: 'metrics',
    inputMethod: 'stdin',
    input: obj({ id: str(true), type: str(true) }),
    output: obj({ metrics: objField() }),
    description: '메트릭스 이벤트를 기록한다',
  },
  'project-metrics': {
    handler: 'metrics',
    inputMethod: 'args',
    input: idArgsInput,
    output: obj({ dashboard: str(), metrics: objField() }),
    description: '프로젝트 메트릭스 대시보드를 반환한다',
  },
  'cost-summary': {
    handler: 'metrics',
    inputMethod: 'args',
    input: idArgsInput,
    output: obj({ totalCostUsd: num(), totalInputTokens: num(), totalOutputTokens: num() }),
    description: '비용 요약을 반환한다',
  },

  // ============================================================
  // === template (3개) ===
  // ============================================================
  'list-templates': {
    handler: 'template',
    inputMethod: 'args',
    input: obj({ type: str() }),
    output: arr(),
    description: '사용 가능한 템플릿 목록을 반환한다',
  },
  'get-template': {
    handler: 'template',
    inputMethod: 'args',
    input: obj({ name: str(true) }),
    output: obj({ name: str(), content: objField() }),
    description: '템플릿 상세를 반환한다',
  },
  'scaffold': {
    handler: 'template',
    inputMethod: 'stdin',
    input: obj({ template: str(true), targetDir: str(true), variables: objField(), overwrite: bool(), backup: bool() }),
    output: obj({ filesCreated: arr() }),
    description: '템플릿으로 프로젝트를 스캐폴딩한다',
  },

  // ============================================================
  // === task (8개) ===
  // ============================================================
  'add-discussion-round': {
    handler: 'task',
    inputMethod: 'stdin',
    input: obj({ id: str(true), roundData: objField(true) }),
    output: obj({ project: objField() }),
    description: '토론 라운드 데이터를 프로젝트에 추가한다',
  },
  'add-task-reviews': {
    handler: 'task',
    inputMethod: 'stdin',
    input: obj({ id: str(true), taskId: str(true), reviews: arr(true) }),
    output: obj({ project: objField() }),
    description: '태스크에 리뷰 결과를 추가한다',
  },
  'update-task-status': {
    handler: 'task',
    inputMethod: 'stdin',
    input: obj({ id: str(true), taskId: str(true), status: str(true) }),
    output: obj({ project: objField() }),
    description: '태스크 상태를 업데이트한다',
  },
  'save-task-output': {
    handler: 'task',
    inputMethod: 'stdin',
    input: obj({ id: str(true), taskId: str(true), output: str(true) }),
    output: obj({ project: objField() }),
    description: '태스크 실행 결과를 저장한다',
  },
  'add-task-materialization': {
    handler: 'task',
    inputMethod: 'stdin',
    input: obj({ id: str(true), taskId: str(true), materializeResult: objField(true) }),
    output: obj({ project: objField() }),
    description: '태스크에 materialization 결과를 저장한다',
  },
  'build-phase-context': {
    handler: 'task',
    inputMethod: 'stdin',
    input: obj({ completedTasks: arr(true) }),
    output: obj({ phaseContext: str() }),
    description: 'Phase 컨텍스트를 생성한다',
  },
  'tdd-execution-prompt': {
    handler: 'task',
    inputMethod: 'stdin',
    input: obj({ task: objField(true), teamMember: objField(true) }),
    output: promptOutput,
    description: 'TDD 실행 프롬프트를 생성한다',
  },
  'is-code-task': {
    handler: 'task',
    inputMethod: 'stdin',
    input: obj({ task: objField(true) }),
    output: obj({ isCodeTask: bool() }),
    description: '코드 태스크 여부를 판단한다',
  },

  // ============================================================
  // === recommendation (4개) ===
  // ============================================================
  'recommend-setup': {
    handler: 'recommendation',
    inputMethod: 'stdin',
    input: obj({ projectType: str(true), complexity: str(true), description: str(true), teamRoles: arr() }),
    output: obj({ skills: arr(), agents: arr() }),
    description: '프로젝트에 맞는 스킬/에이전트를 추천한다',
  },
  'install-setup': {
    handler: 'recommendation',
    inputMethod: 'stdin',
    input: obj({ items: arr(true) }),
    output: obj({ results: arr() }),
    description: '추천된 스킬/에이전트를 설치한다',
  },
  'list-installed': {
    handler: 'recommendation',
    inputMethod: 'none',
    input: obj({}),
    output: obj({ skills: arr(), agents: arr() }),
    description: '설치된 스킬/에이전트 목록을 반환한다',
  },
  'recommendation-catalog': {
    handler: 'recommendation',
    inputMethod: 'none',
    input: obj({}),
    output: obj({ skills: arr(), agents: arr() }),
    description: '추천 가능한 스킬/에이전트 카탈로그를 반환한다',
  },
};

/**
 * 특정 커맨드의 스키마를 조회한다.
 * @param {string} commandName - 커맨드 이름
 * @returns {object|null} 스키마 또는 null
 */
export function getCommandSchema(commandName) {
  return COMMAND_SCHEMAS[commandName] || null;
}

/**
 * 모든 스키마를 핸들러별로 그룹화하여 반환한다.
 * @returns {Record<string, Array<{command: string, schema: object}>>}
 */
export function listCommandSchemas() {
  const grouped = {};
  for (const [command, schema] of Object.entries(COMMAND_SCHEMAS)) {
    const handler = schema.handler;
    if (!grouped[handler]) grouped[handler] = [];
    grouped[handler].push({ command, ...schema });
  }
  return grouped;
}
