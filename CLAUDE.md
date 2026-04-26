# Good Vibe Coding

AI 팀을 만들고, 프로젝트를 함께 굴리는 플랫폼.

## 진입점 (v2)

| 슬래시 커맨드  | 역할                                                          |
| -------------- | ------------------------------------------------------------- |
| `/gv <자연어>` | **단일 진입점.** NL 라우터가 status/resume/modify/task로 분류 |
| `/gv:status`   | 현재 프로젝트 상태 확인                                       |
| `/gv:resume`   | 중단된 실행 재개                                              |
| `/gv:execute`  | 실행 시작 (interactive/auto/semi-auto)                        |
| `/gv:cost`     | 비용/토큰 집계 + 예산 임계 설정 (opt-in)                      |
| `/gv:team`     | 팀 구성 확인                                                  |

흐름: `/gv` → 에이전트 디스패치 → `cli.js` → 핸들러(`scripts/handlers/*.js`) → 코어 라이브러리(`scripts/lib/*`).
**SDK** (`src/`): 동일한 코어를 프로그래밍 API로 노출 — `import { GoodVibe } from 'good-vibe'`.

## 핵심 컨셉

- **CEO 모드**: 사용자가 CEO로 프로젝트를 정의하면 AI 팀이 토론 → 기획 → 실행 → 보고
- **15개 역할**: CTO, PO, Full-stack, Frontend, Backend, QA, UI/UX, DevOps, Data, Security, Tech Writer, Market/Business/Tech/Design Researcher
- **모델 다양성**: opus/sonnet/haiku — 역할 카테고리별 자동 배분

## 프로젝트 모드 (3가지)

| 모드             | 팀 규모 | 토론                    | 추천 상황           | 자동 진행                                     |
| ---------------- | ------- | ----------------------- | ------------------- | --------------------------------------------- |
| **quick-build**  | 2-3명   | 생략                    | 간단한 봇, 스크립트 | CTO 분석 → 작업 분배 → 실행 → QA 리뷰 → 완료  |
| **plan-execute** | 3-5명   | 생략 (CTO+PO 빠른 분석) | 웹앱, API 서버      | CTO+PO 분석 → 자동 승인 → execute → 완료      |
| **plan-only**    | 5-8명   | 최대 3라운드            | 대규모 시스템       | discuss(수렴까지) → CEO 승인 → execute → 완료 |

## 실행 모드 (2가지)

| 모드            | 동작                              | 중단 시점                          |
| --------------- | --------------------------------- | ---------------------------------- |
| **interactive** | Phase마다 CEO에게 진행 여부 확인  | 매 Phase 완료 후 + 에스컬레이션    |
| **semi-auto**   | batchSize Phase마다 확인 (기본 3) | 배치 완료 후 + 에스컬레이션        |
| **auto**        | 자동 진행                         | 에스컬레이션(수정 2회 실패)만 멈춤 |

- `/gv:execute` 시작 시 선택, SDK는 auto 고정
- `project.mode` (프로젝트 모드) ≠ `executionState.mode` (실행 모드)

## 프로젝트 상태 전이

```
planning → approved → executing → reviewing → completed
        ↗                                ↗        │
 (재토론)                          (fix 후 재실행)  │
                                                  ↓
                                            (수정 요청)
                                  approved → executing → completed
```

| 상태        | 다음 액션 (`/gv` 자연어 또는 직접)                      |
| ----------- | ------------------------------------------------------- |
| `planning`  | 추가 토론 / 승인 응답                                   |
| `approved`  | `/gv:execute`                                           |
| `executing` | `/gv:status` 확인 / `/gv:resume`                        |
| `reviewing` | `/gv:status` 확인 / `/gv:resume`                        |
| `completed` | `/gv 보고서 확인` / `/gv 피드백 분석` / `/gv 수정 요청` |

## 오케스트레이션 일반화

OMC/LangGraph 같은 일반 하네스로 격상하기 위한 기반. **외부 의존성 0**, 모두 자체 구현.

- **Phase 1 — 동시성/모델 라우팅**: `llm-pool` (글로벌+provider 슬롯 + 429 backpressure), `model-selector` (default/cost/quality/custom + fallback), dispatch hint (allTiersParallel)
- **Phase 2 — 분산 안전성/상태**: `file-lock` (멀티프로세스, reentrant, stale 감지), `journal` (jsonl event log), `state-machine-dsl` (defineStateMachine + guard/actions)
- **Phase 3 — 비용 가시화/자동 폴백**: `cost-tracker` (PROVIDER_PRICING + 누적/budget), `llm-fallback` (callLLMWithFallback: 429 → 다음 모델)

`callLLM`은 llm-pool + cost-tracker를 자동 통과. 폴백이 필요한 경로에서만 `callLLMWithFallback` 명시 사용.

## 메인 세션 원칙 (Thin Controller)

메인 세션은 **CEO의 UI**입니다.

**허용:**

- AskUserQuestion으로 CEO 질문/선택지 제시
- Task tool 반환값을 CEO에게 표시 (진행률, 요약)
- 단순 조회 CLI 1회 호출 (check-version, list-projects 수준)
- 조건 판정 후 분기

**금지:**

- Good Vibe CLI를 통한 LLM 호출 (clarity-check→LLM→parse 등은 반드시 Task tool 내부에서)
- 다단계 CLI 체인 (2개 이상 CLI 연쇄 호출)
- 데이터 가공/분석 로직

**원칙:** 두 CEO 터치포인트 사이의 모든 작업은 하나의 Task tool로 묶는다.

각 커맨드의 서브에이전트 Task 프롬프트에는 반드시 포함:

- `CLAUDE_PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}`
- 반환 형식 제한 (글자 수, 포함/제외 항목)
- 컨텍스트 보호 목적 명시

### 사용자가 메인 세션에서 직접 작업 요청 시

`/gv` 워크플로우로 안내. Good Vibe 커맨드와 직접 코딩의 혼용은 지원하지 않음. 사용자가 Good Vibe 없이 직접 작업하겠다면 일반 Claude Code로 진행.

**금지 패턴:**

- `/gv` 없이 메인 세션에서 `node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js ...` 직접 호출
- Good Vibe CLI를 Task tool로 감싸서 우회 실행

## 코어 모듈 개요

| 디렉토리               | 개수 | 핵심 파일                                                                                                                                                    |
| ---------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scripts/lib/core/`    | 19   | validators, config, file-lock, json-parser, prompt-builder, nl-router, intent-gate                                                                           |
| `scripts/lib/project/` | 16   | project-manager, journal, github-manager, branch-manager, pr-manager, prd-generator                                                                          |
| `scripts/lib/engine/`  | 23   | task-graph-runner, task-graph-actions, task-router, task-graph-presets, risk-evaluator, orchestrator, execution-loop, review-engine, code-materializer       |
| `scripts/lib/llm/`     | 8    | llm-provider, llm-pool, model-selector, cost-tracker, llm-fallback, budget-store, gemini-bridge, auth-manager                                                |
| `scripts/lib/agent/`   | 9    | team-builder, complexity-analyzer, clarity-analyzer, recommendation-engine, agent-optimizer                                                                  |
| `scripts/lib/output/`  | 5    | claude-panel-renderer, report-generator, progress-formatter, env-checker, update-checker                                                                     |
| `src/` (SDK)           | 6    | good-vibe (메인 클래스), discusser, executor, storage, defaults, index                                                                                       |
| `plugin/`              | 1    | adapter (Claude Code 환경 SDK 초기화)                                                                                                                        |
| `scripts/handlers/`    | 18   | project, team, discussion, execution, review, build, eval, auth, feedback, infra, metrics, template, task, recommendation, learn, dispatch, cost, gv-execute |

각 모듈의 상세 책임은 코드의 첫 JSDoc 주석 참조. 새 파일 추가 시 책임을 한 줄로 명시.

### v2 핵심 (task-graph)

- **task-router**: 자연어 → 5개 작업 유형 분류 (code/plan/research/review/ask). 한국어/영어 인젝션 방어, 컨텍스트 가중치, LLM 호출 없는 규칙 기반.
- **task-graph-presets**: 5개 작업 유형별 동적 워크플로우 그래프. 모든 그래프 done/failed terminal 보유. code 그래프는 fixAttempt guard + escalating 노드. plan 그래프는 maxRounds/maxRejects guard. SUBGRAPH_MAP으로 plan:executing → code 위임.
- **task-graph-runner**: selectGraph + actions 매핑으로 state machine 진행. onProgress/journal 콜백, maxSteps 무한 루프 방지.
- **task-graph-actions**: state→action 매핑. 5개 작업 유형 모두 callLLM DI로 실제 LLM 호출. `defaultActions(taskType, { useLLM, callLLM })`로 LLM/placeholder 모드 분기.

## 정책 상수 (`scripts/lib/core/config.js`)

핵심 임계값만 표기. 전체는 `config.js` 참조.

| 영역   | 상수                             | 값                           |
| ------ | -------------------------------- | ---------------------------- |
| 토론   | `discussion.parallelTiers`       | true                         |
| 토론   | `discussion.reviewModel`         | haiku                        |
| 수렴   | `convergence.threshold`          | 0.8                          |
| 수렴   | `convergence.maxRounds`          | 3                            |
| 실행   | `execution.maxFixAttempts`       | 2                            |
| 실행   | `execution.maxAgentCalls`        | 500                          |
| 리뷰   | `review.minReviewers`            | 2                            |
| 리뷰   | `review.maxRevisionRounds`       | 2                            |
| 유사도 | `similarity.redundancyThreshold` | 0.7                          |
| LLM    | `llm.defaultTimeout`             | 60s                          |
| LLM 풀 | `llmPool.maxConcurrent`          | 8                            |
| LLM 풀 | `llmPool.perProvider`            | 5/5/1 (claude/openai/gemini) |
| GitHub | `github.enabled`                 | false                        |
| 메시징 | `messaging.enabled`              | false                        |

## 토론 플로우

```
Round N:
  parallelTiers=true (기본): 모든 에이전트 동시 분석 — 토론 시간 60-75% 단축
  → 전체 결과 종합 (기획서)
  → 핵심 리뷰어 선정 (CTO/QA/Security 우선, 최대 3명, haiku 경량 모델)
  → 80%+ 승인 시 수렴
  → 라운드 2+: 개선폭 < 5% + critical 블로커 0 → 조기 수렴
  → 라운드 3+: 핵심 결정만 추출하여 컨텍스트 최소화
  → 아니면 역할별 피드백 주입 후 다음 라운드 (최대 3회)
```

- **Tier 병렬화**: `buildAgentAnalysisPrompt()`가 priorTierOutputs를 미사용하므로 전체 병렬 안전
- **블로커 추출**: critical 이슈만 블로커로 분류, important/minor는 무시
- **메시지 컨텍스트**: `context.messages`로 다른 에이전트의 메시지를 프롬프트에 주입 가능 (opt-in)

## 실행 + 리뷰 + 실패 복구 플로우

```
Phase N:
  execute-tasks (병렬, 코드 태스크는 TDD 프롬프트 자동 적용)
  → materialize (코드 태스크만, /tmp 빌드 검증, npm install --ignore-scripts)
  → review (2-3명, 도메인 매칭 + 유니버셜 리뷰어 우대)
  → quality-gate (critical 0개)
  → enhanced-quality-gate (리뷰 통과 AND 빌드 검증 통과)
  → 실패 시: 카테고리 분류 → failureContext 저장 → fix (최대 2회)
  → 2회 초과 → CEO 에스컬레이션 (continue/skip/abort)
  → commit-phase → build-context (이전 Phase 출력 주입)
  → interactive: confirm-next-phase / semi-auto: batchSize 체크 / auto: 자동 진행
```

- **CEO Interrupt**: `confirm-phase`(phaseGuidance 포함 가능), `handle-review-intervention`(proceed/revise) — interactive에서 CEO가 Phase 간 지침 전달
- **phaseGuidance**: build-context에서 저장, execute-tasks에서 소멸 (1회성)
- **시맨틱 상태 검증**: 6가지 규칙 (fixAttempt 상한, completedAt 필수, escalation 플래그, 중복 Phase 방지 등)
- **리비전 프롬프트**: critical + important만 포함, minor 자동 제외
- **리뷰 대화**: `[QUESTION]:` 또는 JSON `question` 필드로 1왕복 대화 (`messageBus` 활성 시)
- **전문가 상담**: 에이전트가 `[CONSULT:역할ID]: 질문` 패턴으로 ad-hoc 질문 (최대 1회)

## GitHub 협업 워크플로우 (opt-in)

```
github.enabled = false (기본): main 직접 커밋, branch/PR 없음
github.enabled = true:
  → feature branch 생성 (gv/{slug}-{timestamp})
  → Phase별 conventional commit (feat/fix/test/refactor/chore)
  → 실행 완료 시 자동 PR 생성 (pushBranch → buildMergeReport → createPullRequest)
  → CEO가 GitHub에서 직접 merge (자동 merge 없음)
```

- **PR 보고서**: 품질 게이트 결과, 리뷰 요약, 실행 이력, 생성 파일, CEO 체크리스트
- **Graceful Degradation**: gh 미설치 시 `{ skipped: true, reason }` 반환
- **CI 자동 생성**: 기술 스택 감지 → Node/Python/Go/Java CI 워크플로우

## 코드 구체화 파이프라인

```
태스크 실행 → isCodeTask? (역할: backend/frontend/fullstack/devops/data + 키워드)
  → [코드] TDD 프롬프트 (RED → GREEN → REFACTOR)
  → extractMaterializableBlocks (fence info-string + 코멘트 기반 파일명)
  → verifyAndMaterialize: /tmp 빌드 검증 → 통과 시 프로젝트에 기록
  → 강화 품질 게이트 → commitPhase
```

- **파일명 감지**: ` ```js src/app.js ` (fence) 또는 `// filename: src/app.js` (코멘트)
- **보안**: `npm install --ignore-scripts` (LLM 생성 코드의 postinstall 방지), `assertWithinRoot` (path traversal 차단)

## 에이전트/스킬

**팀 에이전트 (15개)** — `agents/team-*.md`
Leadership: CTO(1), PO(2). Engineering: Fullstack(3), Frontend(4), Backend(4), QA(6), DevOps(7), Data(5), Security(5). Design: UI/UX(3). Support: Tech Writer(8). Research: Market(2), Business(2), Tech(5), Design(5).

**서포트 에이전트 (8개)** — `agents/`
onboarding-guide, mentor-kr, code-reviewer-kr, tdd-coach-kr, doc-reviewer-kr, content-editor-kr, data-analyst-kr, accessibility-checker.

**스킬 (5개)** — `skills/*/SKILL.md`
beginner-guide, korean-workflow, onboarding-wizard, project-setup, multi-review (Gemini CLI 인증 검증 + cross-model 리뷰).

## 추천/최적화 알고리즘

- **추천 엔진**: 4시그널 (projectType 3점 + complexity 2점 + keyword 1점×3 + roleAffinity 2점). 한국어 조사 자동 제거. 최소 3점.
- **에이전트 최적화**: bigram Jaccard 유사도 > 0.7이면 중복. 기여도 점수 = (critical×3 + uniqueIssues) / reviewCount. 유니버셜 리뷰어(qa/security/cto)는 제거 불가.
- **크로스프로젝트 학습**: 3회 이상 반복된 카테고리를 user-level 오버라이드에 "반복 패턴 주의" 섹션으로 추가.
- **프롬프트 버전**: `PROMPT_VERSION` 상수 (`prompt-builder.js`). buildSectioned 출력에 `<!-- prompt-version: X.X.X -->` 주석 자동 삽입.

## 프로젝트 규칙

- import에 `.js` 확장자 필수 (Windows ESM 호환)
- `"type": "module"` (Node 18+)
- 한국어 가이드/프롬프트, 코드/기술 용어는 영어
- 테스트: `npm test` (Vitest), 커버리지 목표 80%+
- 파일명: kebab-case
- 커밋: conventional commits (`feat|fix|refactor|docs|test|chore(scope): subject`)
- **CLI 우선**: 외부 도구 연동 시 MCP 도구 대신 CLI 직접 사용 (MCP는 샌드박스에서 키체인/인증 제한 가능)

## 사용 가능한 CLI 도구

`gh`, `git`, `ctx7` (Context7 문서 조회), `node`/`npm`/`npx`, `gemini` (멀티리뷰), `codex` (멀티리뷰), `claude` (Claude Code CLI).

## 개발 워크플로우 — 새 기능 추가

1. **커맨드 정의** — `commands/new-command.md` (YAML frontmatter 필수)
2. **코어 로직** — `scripts/lib/{category}/new-module.js`
3. **핸들러 등록** — `scripts/handlers/{handler}.js`의 `commands` 객체
4. **COMMAND_MAP 등록** — `scripts/cli.js`의 `COMMAND_MAP`에 `'command-name': 'handler'`
5. **테스트** — `tests/new-module.test.js` (unit) + `tests/handlers/{handler}.test.js` (E2E)

체크리스트:

- [ ] `commands/*.md`에 YAML frontmatter (`---\ndescription: "..."\n---`)
- [ ] `skills/*/SKILL.md`에 YAML frontmatter (`---\nname: ...\ndescription: "..."\n---`)
- [ ] import에 `.js` 확장자
- [ ] `requireFields`로 필수 입력 검증
- [ ] 에러는 `inputError` / `notFoundError` 사용 (직접 `throw new Error` 금지)
- [ ] `output()` / `outputOk()`로 결과 출력
- [ ] cliExec/cliExecRaw로 E2E 검증
- [ ] COMMAND_MAP 등록 확인

## 코드 패턴

### 핸들러

```javascript
// scripts/handlers/{handler}.js
import { readStdin, output, outputOk, parseArgs } from '../cli-utils.js';
import { requireFields, inputError, notFoundError } from '../lib/core/validators.js';

const [, , , ...args] = process.argv;

export const commands = {
  'command-name': async () => {
    const data = await readStdin();
    requireFields(data, ['field1', 'field2']);
    const result = await coreFunction(data);
    output(result);
  },

  'another-command': async () => {
    const opts = parseArgs(args);
    const item = await getItem(opts.id);
    if (!item) throw notFoundError(`항목을 찾을 수 없습니다: ${opts.id}`);
    outputOk({ id: opts.id });
  },
};
```

### JSON 파이프 컨벤션

```bash
echo '{"name": "test"}' | node cli.js create-project           # stdin
node cli.js get-project --id abc123                             # 플래그
echo '{"stepResult": {...}}' | node cli.js advance --id abc123  # 복합
```

### 에러 핸들링

```javascript
throw inputError('필수 필드 누락'); // exit 2
throw notFoundError('프로젝트 없음'); // exit 3
throw new AppError('내부 오류', 'SYSTEM_ERROR'); // exit 1
// stderr 형식: "오류 [CODE]: message\nhint\n"
```

## 테스트 컨벤션

| 대상                         | 테스트 파일                             | 타입 |
| ---------------------------- | --------------------------------------- | ---- |
| 코어 모듈 (`scripts/lib/**`) | `tests/{module-name}.test.js`           | Unit |
| 핸들러 (`scripts/handlers/`) | `tests/handlers/{handler-name}.test.js` | E2E  |

```javascript
// Unit mock 패턴
const TMP_DIR = resolve('.tmp-test-{module-name}');
beforeEach(async () => {
  await mkdir(TMP_DIR, { recursive: true });
  setBaseDir(TMP_DIR);
});
afterEach(async () => await rm(TMP_DIR, { recursive: true, force: true }));

// E2E 헬퍼
function cliExec(command, input) {
  return JSON.parse(
    execSync(`node ${CLI_PATH} ${command}`, {
      input: JSON.stringify(input),
      encoding: 'utf-8',
      timeout: 10_000,
    }),
  );
}

function cliExecRaw(command, input) {
  try {
    const stdout = execSync(`node ${CLI_PATH} ${command}`, {
      input: input ? JSON.stringify(input) : '',
      encoding: 'utf-8',
      timeout: 10_000,
    });
    return { exitCode: 0, stdout, stderr: '' };
  } catch (err) {
    return { exitCode: err.status, stdout: '', stderr: err.stderr || '' };
  }
}
```

```bash
npm test              # 전체
npm run test:watch    # 감시 모드
npm run test:coverage # 커버리지 (목표 80%+)
```

## 데이터 저장 경로

| 데이터                         | 경로                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------- |
| 프로젝트                       | `~/.claude/good-vibe/projects/{id}/project.json`                                 |
| 에이전트 오버라이드 (사용자)   | `~/.claude/good-vibe/agent-overrides/{roleId}.md`                                |
| 에이전트 오버라이드 (프로젝트) | `{projectDir}/.good-vibe/agent-overrides/{roleId}.md`                            |
| 커스텀 템플릿                  | `~/.claude/good-vibe/custom-templates/` (\*.json)                                |
| Built-in 템플릿                | `presets/templates/` (next-app, express-api, cli-app, telegram-bot, npm-library) |

## 내부 자율 파이프라인

코드베이스 자체를 자동 개선하는 Daily / UX Improvement 파이프라인은 [internal/CLAUDE.md](./internal/CLAUDE.md) 참조. **현재 VPS cron 제거됨 — 수동 실행만 가능.**
