# Good Vibe Coding

AI 팀을 만들고, 프로젝트를 함께 굴리는 플랫폼.

## 설계: CLI-as-API + SDK

- `cli.js`는 경량 라우터. 139개 커맨드를 16개 핸들러 모듈(`scripts/handlers/*.js`)로 lazy-load 디스패치
- 사용자는 `good-vibe:hello`, `good-vibe:new`, `good-vibe:discuss` 같은 슬래시 커맨드만 씀
- 흐름: 슬래시 커맨드 → 에이전트 디스패치 → cli.js → 핸들러 → 코어 라이브러리
- 에이전트 .md 파일이 `node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js <command>` 형태로 호출
- **SDK** (`src/`): 동일한 코어 모듈을 프로그래밍 API로 노출. `import { GoodVibe } from 'good-vibe'`

## 핵심 컨셉

- **CEO 모드**: 사용자가 CEO로 프로젝트를 정의하면, AI 팀이 토론 → 기획 → 실행 → 보고
- **15개 역할**: CTO, PO, Full-stack, Frontend, Backend, QA, UI/UX, DevOps, Data, Security, Tech Writer, Market/Business/Tech/Design Researcher
- **모델 다양성**: opus/sonnet/haiku — 역할 카테고리별 자동 배분

## 프로젝트 모드 (3가지)

| 모드             | 팀 규모 | 토론                    | 추천 상황           | `good-vibe:new`에서의 자동 진행               |
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

- `good-vibe:execute` 시작 시 선택, SDK는 auto 고정
- `project.mode` (프로젝트 모드) ≠ `executionState.mode` (실행 모드)

## 프로젝트 상태 전이

```
planning → approved → executing → reviewing → completed
        ↗                                ↗        │
 (재토론)                          (fix 후 재실행)  │
                                                  ↓
                                           (good-vibe:modify)
                                           approved → executing → completed
```

| 상태        | 가능한 커맨드                                                | 설명                       |
| ----------- | ------------------------------------------------------------ | -------------------------- |
| `planning`  | `good-vibe:discuss`, `good-vibe:approve`                     | 토론 중 또는 기획서 작성됨 |
| `approved`  | `good-vibe:execute`, `good-vibe:report`                      | CEO 승인 완료, 작업 분배됨 |
| `executing` | `good-vibe:status`, (자동 진행)                              | 실행 중                    |
| `reviewing` | `good-vibe:status`, (자동 진행)                              | 리뷰 중                    |
| `completed` | `good-vibe:report`, `good-vibe:feedback`, `good-vibe:modify` | 전체 완료                  |

## 기존 프로젝트 이어서 작업

**`good-vibe:new`에서 자동 감지:**

- `good-vibe:new` 실행 시 기존 프로젝트가 있으면 전체 목록 표시
- CEO가 기존 프로젝트를 선택하면, 상태에 따라 적절한 다음 커맨드를 안내
- NL 라우터: "이어서", "계속하자", "재개", "resume" 등을 `new`로 매핑

**중단된 실행 재개:**

- `good-vibe:execute` 시 이전 실행이 있으면 자동으로 재개 여부를 물어봄
- `init-execution`에 `resume: true`로 이전 Phase부터 이어서 진행
- 실행 상태(Phase, fixAttempt, 저널)가 `project.json`에 보존됨

**프로젝트 전환:**

- `good-vibe:projects` — 전체 목록 확인
- `good-vibe:status` — 현재 프로젝트 상태 확인
- 대부분의 커맨드는 가장 최근 프로젝트를 자동 선택, 여러 개면 AskUserQuestion으로 선택

## 모드별 전체 워크플로우

### quick-build (자동모드)

```
good-vibe:new "텔레그램 봇 만들어줘"
  → 복잡도: simple → quick-build 자동 선택
  → 팀 구성: CTO, Backend, QA (3명)
  → CTO 아키텍처 분석 (Task 1회)
  → 작업 목록 생성 + 분배
  → status: executing
  → 각 태스크 병렬 실행 (Task tool)
  → QA 리뷰 → quality-gate
  → 통과 시 완료, 실패 시 수정 → 에스컬레이션
  → status: completed
  → "다음: good-vibe:report, good-vibe:feedback"
```

### plan-execute (반자동모드)

```
good-vibe:new "팀 프로젝트 관리 웹앱"
  → 복잡도: medium → plan-execute 자동 선택
  → 팀 구성: CTO, PO, Fullstack, Frontend, QA (5명)
  → CTO+PO 빠른 분석 (Task 1회)
     → CTO+PO 병렬 분석 → 종합
  → 기획서 자동 승인 → 작업 분배
  → good-vibe:execute 자동 실행
     → Phase별: 실행 → 구체화 → 리뷰 → 품질게이트 → 커밋
  → status: completed
```

### plan-only (CEO 승인 필요)

```
good-vibe:new "마이크로서비스 SaaS 플랫폼"
  → 복잡도: complex → plan-only 자동 선택
  → 팀 구성: 5-8명 (전문가 팀)
  → good-vibe:discuss 자동 실행 (최대 3라운드, 수렴까지)
  → "기획서가 완성되었습니다. good-vibe:approve로 승인해주세요"
  → 사용자가 good-vibe:approve 실행
  → 사용자가 good-vibe:execute 실행 (모드 선택: interactive/auto)
  → 실행 완료
```

## 커맨드 우선순위

초보자에게는 **필수 7개만** 안내:

1. **필수 7개** — `good-vibe:hello` → `good-vibe:new` → `good-vibe:discuss` → `good-vibe:approve` → `good-vibe:execute` → `good-vibe:report` → `good-vibe:modify`
2. **관리 4개** — `good-vibe:status`, `good-vibe:feedback`, `good-vibe:my-team`, `good-vibe:learn`
3. **고급 9개** — `good-vibe:new-project`, `good-vibe:projects`, `good-vibe:my-config`, `good-vibe:add-skill`, `good-vibe:add-agent`, `good-vibe:scaffold`, `good-vibe:preset`, `good-vibe:reset`, `good-vibe:eval`

퀵스타트 가이드: `guides/common/00-quick-start.md`

## 혼동 방지

| 비교                                                        | 차이                                                                                                                    |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `good-vibe:new` vs `good-vibe:new-project`                  | 자동(복잡도 분석 → 추천) vs 수동(직접 선택)                                                                             |
| `good-vibe:status` vs `good-vibe:projects`                  | 현재 프로젝트만 vs 전체 목록                                                                                            |
| `good-vibe:hello` → `good-vibe:new` vs `good-vibe:new` 단독 | hello는 환경+개인설정(1회), new는 프로젝트 시작. 처음이면 hello 먼저, 이후는 new만                                      |
| `project.mode` vs `executionState.mode`                     | 프로젝트 워크플로우(plan-only/plan-execute/quick-build) vs 실행 인터랙션(interactive/semi-auto/auto)                    |
| plan-only vs plan-execute                                   | 둘 다 실행까지 감. plan-only는 토론(최대 3라운드)+approve 후 수동 execute, plan-execute는 CTO+PO 빠른 분석 후 자동 연결 |
| approve 되돌리기                                            | 실행 시작 전이라면 `good-vibe:discuss --reset`으로 approved → planning 복귀 가능                                        |
| `good-vibe:new` vs `good-vibe:modify`                       | `new`는 새 프로젝트 (아이디어 → 팀 구성 → 토론 → 실행), `modify`는 완료된 프로젝트의 기능 추가/수정 (기존 맥락 유지)    |
| `good-vibe:new`에서 "이어서"                                | 기존 프로젝트 전체 목록 → 선택 → 상태별 다음 커맨드 안내. 직접 실행은 안 함 (detect → offer → route)                    |

## 오케스트레이션 일반화 (Phase 1~3)

OMC/LangGraph 같은 일반 하네스로 격상하기 위한 기반. **외부 의존성 0**, 모두 자체 구현.

```
┌─────────────────────────────────────────────────────────┐
│ Phase 1 — 동시성 / 모델 라우팅 기반                    │
│  llm-pool         글로벌+provider 슬롯 + 429 backpressure│
│  model-selector   default/cost/quality/custom + fallback │
│  dispatch hint    plan에 명시적 병렬 메타 (allTiersParallel)│
├─────────────────────────────────────────────────────────┤
│ Phase 2 — 분산 안전성 / 상태 표현                      │
│  file-lock        멀티프로세스 lockfile, reentrant, stale│
│  journal          jsonl event log, monotonic timestamp   │
│  state-machine-dsl  defineStateMachine + guard/actions   │
├─────────────────────────────────────────────────────────┤
│ Phase 3 — 비용 가시화 / 자동 폴백                      │
│  cost-tracker     PROVIDER_PRICING + 누적/budget + 캐시 hit│
│  llm-fallback     callLLMWithFallback (429 → 다음 모델)  │
└─────────────────────────────────────────────────────────┘
```

- **callLLM 자동 통과**: llm-pool로 동시성 제어 + cost-tracker로 토큰/비용 자동 기록
- **callLLMWithFallback**: 폴백이 필요한 경로에서 명시적으로 사용 (기존 callLLM 시그니처 변경 0)
- **마이그레이션 상태**: 새 모듈은 모두 도입됨. 기존 `executionState.journal[]` → jsonl, `state-machine.js` → DSL은 점진적 적용 예정

## 기술 스택

- Node.js 18+ (ESM)
- Handlebars 템플릿 엔진
- Vitest 테스트
- GitHub Actions CI (Node 18/20/22)

## 아키텍처

```
┌─────────────────────────────────────────────┐
│  사용자              슬래시 커맨드 6개                    │
│  good-vibe:hello → good-vibe:new → good-vibe:discuss → │
│  good-vibe:approve → good-vibe:execute → good-vibe:report │
├─────────────────────────────────────────────┤
│  SDK                 GoodVibe 클래스         │
│  buildTeam → discuss → execute → report     │
├─────────────────────────────────────────────┤
│  AI 팀원             15개 역할               │
│  Tier별 병렬 분석 + 크로스 리뷰              │
├─────────────────────────────────────────────┤
│  내부 API            CLI-as-API (152개)      │
│  에이전트가 호출하는 인터페이스               │
├─────────────────────────────────────────────┤
│  코어 라이브러리      73개 모듈 + 16개 핸들러  │
│  프로젝트 관리, 오케스트레이션, 리뷰 엔진 등  │
└─────────────────────────────────────────────┘
```

### SDK export 구조

```javascript
// package.json exports
".":              "./src/index.js"              // GoodVibe, Discusser, Executor, Storage
"./plugin":       "./plugin/adapter.js"        // Claude Code 어댑터
"./lib/core/*":   "./scripts/lib/core/*.js"    // 기반 유틸리티
"./lib/project/*":"./scripts/lib/project/*.js" // 프로젝트 관리
"./lib/engine/*": "./scripts/lib/engine/*.js"  // 실행 엔진
"./lib/agent/*":  "./scripts/lib/agent/*.js"   // 에이전트/팀
"./lib/llm/*":    "./scripts/lib/llm/*.js"     // LLM 연동
"./lib/output/*": "./scripts/lib/output/*.js"  // 보고/환경
```

## 메인 세션 원칙 (Thin Controller)

메인 세션은 **CEO의 UI**입니다. 다음만 수행합니다:

**허용:**

- AskUserQuestion으로 CEO 질문/선택지 제시
- Task tool 반환값을 CEO에게 표시 (진행률, 요약, 다이어그램)
- 단순 조회 CLI 1회 호출 (check-version, list-projects — "변수 읽기" 수준)
- 조건 판정 후 분기 (모드 선택, 수렴 여부 등)

**금지:**

- Good Vibe CLI를 통한 LLM 호출 (clarity-check→LLM→parse 등은 반드시 Task tool 내부에서)
- 다단계 CLI 체인 (2개 이상 CLI 연쇄 호출)
- 데이터 가공/분석 로직

> **참고:** CEO에게 설명/가이드/질문 응답하는 것은 메인 세션의 본래 역할이므로 제한 대상이 아닙니다.

**원칙:** 두 CEO 터치포인트 사이의 모든 작업은 하나의 Task tool로 묶는다.

각 커맨드의 서브에이전트 Task 프롬프트에는 반드시 포함:

- `CLAUDE_PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}`
- 반환 형식 제한 (글자 수, 포함/제외 항목)
- 컨텍스트 보호 목적 명시

### 사용자가 메인 세션에서 직접 작업 요청 시

사용자가 Good Vibe 커맨드 없이 "코드 작성해줘", "이 파일 고쳐줘" 등을 요청하면:

1. **Good Vibe 워크플로우로 안내** — `good-vibe:new` 또는 `good-vibe:status` 추천
2. **혼합 불가 명시** — Good Vibe 커맨드와 직접 코딩의 혼용은 지원하지 않음
3. **사용자 선택 존중** — Good Vibe 없이 직접 작업하겠다면 일반 Claude Code로 진행

**금지 패턴:**

- Good Vibe 커맨드 없이 메인 세션에서 `node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js ...` 직접 호출
- Good Vibe CLI를 Task tool로 감싸서 우회 실행
- 프로젝트 생성/팀 구성/토론/실행 흐름을 직접 진행

## 코어 모듈 (`scripts/lib/`)

**`core/`** — 기반 유틸리티 (19개)

- `validators.js` — 입력 검증 + AppError (inputError/notFoundError/systemError)
- `config.js` — 중앙 설정 (Object.freeze, 전체 정책 상수)
- `schema-validator.js` — 경량 스키마 검증 (외부 의존성 0)
- `command-schemas.js` — 커맨드 스키마 레지스트리 (에이전트용 입출력 조회)
- `app-paths.js` — 경로 중앙 관리 (SDK용 configure() 지원)
- `file-writer.js` — 파일 시스템 유틸리티
- `file-lock.js` — 파일 시스템 기반 분산 락 (O_EXCL atomic, reentrant 카운터, stale 감지, 외부 의존성 0)
- `json-parser.js` — 3-tier LLM JSON 응답 파싱
- `domain-parsers.js` — 도메인별 파서 + 스키마 검증 (리뷰, 복잡도, 태스크, 제안)
- `cache.js` — 지연 로딩 캐시
- `preset-loader.js` — 프리셋 JSON 로딩
- `prompt-builder.js` — 프롬프트 조합 유틸리티 (순수 마크다운 포맷팅, 인젝션 방어: sanitizeForPrompt/wrapUserInput/DATA_BOUNDARY_INSTRUCTION)
- `message-bus.js` — 에이전트 간 비동기 메시지 교환 (FileMessageBus/MemoryMessageBus, 원자적 쓰기, Path Traversal 방어, getStats() 통계)
- `state-machine-dsl.js` — 경량 상태 머신 DSL (defineStateMachine, transition/guard/actions, xstate 미사용)
- `nl-router.js` — 자연어 → 커맨드/카테고리 매핑 (규칙 기반, LLM 호출 없음). `resolveNaturalLanguage`(v1 호환), `dispatchInput`(v2 단일 진입점 1차 디스패처 — status/resume/modify 우선, 그 외 task-router 위임)
- `onboarding-generator.js` — 온보딩 CLAUDE.md/rules 생성
- `settings-manager.js` — 사용자 설정 관리
- `text-utils.js` — 텍스트 유틸리티
- `intent-gate.js` — 의도 분류 게이트 (resume/modify/status/create 라우팅, 프로젝트 상태 기반)

**`project/`** — 프로젝트 관리 (16개)

- `project-manager.js` — CRUD + 상태 관리 (file-lock 기반 멀티프로세스 안전 잠금, AppError, 기여도 기록, 수정 이력)
- `project-scaffolder.js` — 프로젝트 인프라 생성 (폴더, CLAUDE.md, README.md, 에이전트)
- `project-metrics.js` — 비용/토큰 추적, 에이전트 기여도, 대시보드
- `journal.js` — append-only 이벤트 로그 (jsonl, monotonic timestamp, file-lock 직렬화, type/since/limit 필터)
- `github-manager.js` — gh CLI 래퍼 (저장소 생성, git init, push)
- `handler-helpers.js` — 핸들러 공통 유틸리티 (withProject)
- `template-scaffolder.js` — 프로젝트 템플릿 스캐폴딩 (5개 built-in + custom)
- `template-engine.js` — Handlebars 엔진
- `codebase-scanner.js` — 프로젝트 폴더 스캔 → 기술 스택/구조 파악 (LLM 호출 없음)
- `commit-message-builder.js` — conventional commit 메시지 생성 (pure, feat/fix/test/refactor/chore 자동 결정)
- `branch-manager.js` — feature branch 생성/관리 (timestamp/phase/custom 전략, graceful skip)
- `pr-manager.js` — Pull Request 생성/관리 (gh CLI 래퍼, graceful skip)
- `ci-generator.js` — GitHub Actions CI 워크플로우 자동 생성 (Node/Python/Go/Java)
- `worktree-manager.js` — git worktree 기반 격리 작업 공간 (Phase별 독립 worktree, opt-in, graceful degradation)
- `prd-generator.js` — PRD 프롬프트 생성/파싱/포맷 (명확도 → 복잡도 사이 CEO 확인용)

**`engine/`** — 실행 엔진 (21개)

- `task-router.js` — **v2 단일 진입점 라우터** (자연어 → 5개 작업 유형 분류 code/plan/research/review/ask, 한국어/영어 인젝션 방어, 컨텍스트 가중치, LLM 호출 없는 규칙 기반, 100개 픽스처 100% 정확도)
- `task-graph-presets.js` — **5개 작업 유형별 동적 워크플로우 그래프** (state-machine-DSL 기반, 모든 그래프 done/failed terminal 보유, code 그래프는 fixAttempt guard + escalating 노드로 CEO 분기, plan 그래프는 maxRounds/maxRejects guard로 토론·승인 루프 제한, SUBGRAPH_MAP으로 plan:executing → code 위임 명시)
- `risk-evaluator.js` — **위험/예산 임계 평가** (보안/회귀 신호는 항상 동작, 비용 임계는 opt-in. 80% WARNING / 100% CRITICAL+escalate. 우선순위: 보안 > 회귀 > 비용. 순수 함수, 호출자가 metrics/budgetConfig 주입)
- `orchestrator.js` — 멀티에이전트 오케스트레이션 (4-tier 병렬 디스패치, 수렴 확인, 역할별 피드백 주입, 메시지 컨텍스트)
- `discussion-engine.js` — 토론 프롬프트 생성
- `state-machine.js` — 실행 상태 전이 (순수 함수, Phase 내 액션 흐름 정의)
- `execution-utils.js` — 실행 유틸리티 (실패 분류, 실패 컨텍스트, 기여도 추출, 부실 감지)
- `execution-loop.js` — 실행 루프 드라이버 (state-machine 기반 전이, 시맨틱 검증, 저널, 실패 복구, 기여도 수집)
- `task-distributor.js` — 작업 분배 + 실행 계획 (리뷰 페이즈 자동 삽입, TDD, 코드 태스크 판별, 페이즈 컨텍스트 주입)
- `review-engine.js` — 크로스 리뷰 (도메인 매칭 리뷰어 선정, 2단계 품질 게이트, 수정 이력 기반 리비전 프롬프트, question 추출)
- `review-conversation.js` — 리뷰어-구현자 1왕복 대화 오케스트레이션 (질문 → 답변 → 최종 리뷰, graceful degradation)
- `expert-consultation.js` — 에이전트 간 전문가 협의 ([CONSULT:role]: question 패턴, 1왕복, graceful degradation)
- `message-analyzer.js` — 프로젝트 메시지 패턴 분석 (타입 분포, 에이전트 활동도, 인사이트 생성)
- `cross-model-strategy.js` — 구현자와 다른 모델로 리뷰어 배정 (라운드로빈, fallback)
- `execution-verifier.js` — 다언어 빌드 검증 (Node/Python/Go/Java, /tmp 샌드박스, npm install --ignore-scripts)
- `code-materializer.js` — 마크다운에서 파일 추출 → 실제 기록 (path traversal 방지, dry-run 지원)
- `dispatch-plan-generator.js` — JSON 디스패치 계획 생성 (토론/실행 모두, 플레이스홀더 템플릿 계약)
- `eval-engine.js` — A/B 평가 프레임워크
- `acceptance-criteria.js` — 수락 기준 생성/파싱/검증 (기획서 기반 AC)
- `evolution-engine.js` — 진화형 프롬프트 개선 엔진
- `quality-evaluator.js` — 품질 평가 프레임워크

**`llm/`** — LLM/외부 연동 (7개)

- `llm-provider.js` — LLM 프로바이더 추상화 (Claude/OpenAI/Gemini), llm-pool 자동 통과 + cost-tracker 자동 record
- `llm-pool.js` — 글로벌+프로바이더별 동시성 풀 + 429 적응형 backpressure (반감 + cooldown 자동 회복, drain 다중 깨우기)
- `model-selector.js` — 모델 선택 정책 (default/cost-optimized/quality-first/custom) + selectFallback (opus → sonnet → haiku)
- `cost-tracker.js` — LLM 호출 비용 메터링 (PROVIDER_PRICING USD per million, 캐시 적중률, 예산 한도 + 콜백)
- `llm-fallback.js` — 자동 모델 폴백 라우팅 (callLLMWithFallback: 429/5xx 시 selectFallback 체인 따라 자동 전환, onFallback 콜백)
- `gemini-bridge.js` — Gemini CLI 래퍼 (shell injection 방지)
- `auth-manager.js` — 멀티프로바이더 인증 (크레덴셜 CRUD)

**`agent/`** — 에이전트/팀 (9개)

- `team-builder.js` — 팀 추천/구성
- `complexity-analyzer.js` — 복잡도 분석 (모드/팀 규모/모델 추천)
- `clarity-analyzer.js` — 프로젝트 설명 명확도 분석 (5차원 평가, 적응형 가중치, 수렴 판정)
- `recommendation-engine.js` — 스킬/에이전트 추천 (멀티시그널, 한국어 조사 제거, LLM 호출 없음)
- `agent-optimizer.js` — 에이전트 중복/효율 최적화 (bigram 유사도, 기여도 점수, 유니버셜 리뷰어 보호)
- `agent-feedback.js` — 프로젝트 결과 분석 → 에이전트 오버라이드 저장
- `agent-instruction-extractor.js` — 에이전트 인스트럭션 추출
- `setup-installer.js` — 스킬/에이전트 설치
- `dynamic-role-designer.js` — 프로젝트별 맞춤 역할 설계 (프롬프트/파서, dynamic: true)

**`output/`** — 보고/환경 (5개)

- `claude-panel-renderer.js` — **v2 stdout markdown 라이브 패널** (진행 상태 표 + 비용/토큰 + 위험 신호 + 최근 이벤트, opt-in 예산 사용률, Phase A-0a 결과 stdout fallback 적용, 순수 함수)

- `report-generator.js` — 보고서 생성
- `progress-formatter.js` — 실행 진행률 포맷팅 (Phase 시작/완료, 태스크/리뷰 진행률, 품질 게이트, 대시보드)
- `env-checker.js` — 통합 환경 헬스체크 (node/npm/git 필수, gh/gemini 선택)
- `update-checker.js` — 버전 확인 + 업데이트 가능 여부 (git fetch --dry-run + HEAD 비교)

**SDK** (`src/`)

- `good-vibe.js` — GoodVibe 메인 클래스 (buildTeam, discuss, execute, report)
- `discusser.js` — 토론 루프 드라이버 (orchestrator + LLM 연결)
- `executor.js` — 실행 루프 드라이버 (execution-loop + LLM 연결)
- `storage.js` — FileStorage, MemoryStorage, 커스텀 스토리지
- `defaults.js` — SDK 기본 설정값
- `index.js` — 엔트리 포인트

**Claude Code 어댑터** (`plugin/`)

- `adapter.js` — Claude Code 환경에서 SDK 초기화

**CLI 레이어**

- `cli.js` — 라우터 (139개 커맨드, 16개 핸들러로 디스패치)
- `cli-utils.js` — readStdin, output, outputOk, parseArgs
- `handlers/*.js` — 16개 핸들러: project, team, discussion, execution, review, build, eval, auth, feedback, infra, metrics, template, task, recommendation, learn, dispatch(v2 단일 진입점 라우팅)

## 정책 상수 (`config.js`)

| 영역       | 상수                               | 값        | 설명                                                                                                |
| ---------- | ---------------------------------- | --------- | --------------------------------------------------------------------------------------------------- |
| 토론       | `discussion.parallelTiers`         | true      | Tier 간 병렬 실행 (false: 순차 fallback)                                                            |
| 토론       | `discussion.maxReviewers`          | 3         | 토론 리뷰어 최대 수 (전원 대신 핵심 2-3명)                                                          |
| 토론       | `discussion.reviewModel`           | haiku     | 토론 리뷰에 사용할 경량 모델                                                                        |
| 토론       | `discussion.stagnationThreshold`   | 0.05      | 라운드 간 승인율 개선폭이 이 이하 + 블로커 0이면 조기 수렴                                          |
| 수렴       | `convergence.threshold`            | 0.8       | 80% 승인 시 기획서 확정                                                                             |
| 수렴       | `convergence.maxRounds`            | 3         | 최대 토론 라운드                                                                                    |
| 실행       | `execution.maxFixAttempts`         | 2         | Phase당 수정 시도, 초과 시 CEO 에스컬레이션                                                         |
| 실행       | `execution.maxAgentCalls`          | 500       | 세션당 에이전트 호출 상한 (무한 루프 방지)                                                          |
| 실행       | `execution.maxEscalationAttempts`  | 3         | 에스컬레이션 최대 횟수                                                                              |
| 실행       | `execution.maxOutputLines`         | 200       | 에이전트 출력 최대 라인                                                                             |
| 실행       | `execution.reviewIntervention`     | false     | 리뷰 후 CEO 개입 (interactive 모드에서만)                                                           |
| 리뷰       | `review.minReviewers`              | 2         | 최소 리뷰어 수                                                                                      |
| 리뷰       | `review.maxReviewers`              | 3         | 최대 리뷰어 수                                                                                      |
| 리뷰       | `review.maxRevisionRounds`         | 2         | 리비전 최대 라운드                                                                                  |
| 리뷰       | `review.maxImportantIssues`        | 10        | Important 이슈 최대 포함 수                                                                         |
| 유사도     | `similarity.redundancyThreshold`   | 0.7       | 에이전트 중복 감지 Jaccard 임계값                                                                   |
| 유사도     | `similarity.contributionThreshold` | 0.5       | 기여도 미달 시 제거 대상                                                                            |
| 빌드       | `build.defaultTimeout`             | 30s       | Node/Python 빌드 타임아웃                                                                           |
| 빌드       | `build.goTimeout`                  | 45s       | Go 빌드 타임아웃                                                                                    |
| 빌드       | `build.javaTimeout`                | 60s       | Java/Maven 빌드 타임아웃                                                                            |
| 팀         | `team.simple`                      | 2-3명     | quick-build                                                                                         |
| 팀         | `team.medium`                      | 3-5명     | plan-execute                                                                                        |
| 팀         | `team.complex`                     | 5-8명     | plan-only                                                                                           |
| 추천       | `recommendation.minScore`          | 3         | 추천 노출 최소 점수                                                                                 |
| LLM        | `llm.defaultTimeout`               | 60s       | LLM 호출 타임아웃                                                                                   |
| LLM        | `llm.defaultMaxTokens`             | 4096      | 기본 최대 토큰                                                                                      |
| LLM        | `llm.pingTimeout`                  | 15s       | 연결 확인 타임아웃                                                                                  |
| LLM        | `llm.maxRetries`                   | 3         | 재시도 횟수                                                                                         |
| LLM 풀     | `llmPool.maxConcurrent`            | 8         | 글로벌 동시 LLM 호출 상한                                                                           |
| LLM 풀     | `llmPool.perProvider`              | 5/5/1     | claude/openai/gemini 동시성 (gemini는 spawnSync 블로킹이라 1)                                       |
| LLM 풀     | `llmPool.backpressure`             | halve     | 429 시 effective limit 반감, recoveryMs(60s) 후 자동 회복, drain 다중 깨우기                        |
| GitHub     | `github.enabled`                   | false     | GitHub 협업 기능 활성화                                                                             |
| GitHub     | `github.branchStrategy`            | timestamp | 브랜치 네이밍 전략 (timestamp/phase/custom)                                                         |
| GitHub     | `github.baseBranch`                | main      | 베이스 브랜치                                                                                       |
| GitHub     | `github.autoPush`                  | true      | 브랜치 자동 push                                                                                    |
| GitHub     | `github.autoCreatePR`              | true      | 실행 완료 후 자동 PR 생성                                                                           |
| GitHub     | `github.prDraft`                   | false     | PR을 Draft로 생성                                                                                   |
| GitHub     | `github.worktreeIsolation`         | false     | Phase별 git worktree 격리 (good-vibe:new에서 GitHub 선택 시 제시, project.worktreeIsolation에 저장) |
| 품질       | `quality.criticalPenalty`          | 20        | Critical 이슈 감점                                                                                  |
| 품질       | `quality.importantPenalty`         | 5         | Important 이슈 감점                                                                                 |
| 품질       | `quality.fixAttemptPenalty`        | 10        | 수정 시도 감점                                                                                      |
| 품질       | `quality.buildFailurePenalty`      | 30        | 빌드 실패 감점                                                                                      |
| 품질       | `quality.firstPhaseWeight`         | 0.3       | 첫 Phase 가중치                                                                                     |
| 진화       | `evolution.targetScore`            | 80        | A/B 평가 목표 점수                                                                                  |
| 진화       | `evolution.maxGenerations`         | 3         | 최대 세대 수                                                                                        |
| 진화       | `evolution.minImprovement`         | 5         | 최소 개선 폭                                                                                        |
| 명확도     | `clarity.threshold`                | 0.8       | 명확도 목표                                                                                         |
| 명확도     | `clarity.dimensionThreshold`       | 0.6       | 차원별 최소 점수                                                                                    |
| 태스크분류 | `taskClassification.engineerRoles` | 5개 역할  | 코드 태스크 판별 대상                                                                               |
| 메시징     | `messaging.enabled`                | false     | 에이전트 간 메시징 활성화 (plan-execute/plan-only에서 선택, quick-build는 항상 OFF)                 |
| 메시징     | `messaging.maxMessages`            | 100       | 프로젝트당 최대 메시지 수                                                                           |
| 메시징     | `messaging.ttl`                    | 86400     | 메시지 TTL (24시간, 초)                                                                             |
| 메시징     | `messaging.maxThreadDepth`         | 5         | 스레드 최대 깊이                                                                                    |
| CLI        | `cli.suggestionThreshold`          | 3         | NL→커맨드 매핑 최소 점수                                                                            |
| 코드베이스 | `codebase.ignoredDirs`             | 11개      | 스캔 제외 디렉토리                                                                                  |
| 코드베이스 | `codebase.techStackMap`            | 16개      | 기술→도메인 매핑                                                                                    |

## 토론 플로우

```
Round N:
  parallelTiers=true (기본값):
    [전체 병렬] 모든 에이전트 동시 분석 — 토론 시간 60-75% 단축
  parallelTiers=false (fallback):
    [병렬] Tier 1 (priority 1-2) — CTO, PO, Market/Business Researcher (전략/요구사항)
    [병렬] Tier 2 (priority 3-4) — Fullstack, UI/UX, Frontend, Backend (구현 관점)
    [병렬] Tier 3 (priority 5-7) — QA, Security, DevOps, Data, Tech/Design Researcher (검증)
    [병렬] Tier 4 (priority 8+) — Tech Writer (보완)
  → 전체 결과 종합 (기획서)
  핵심 리뷰어 선정 (CTO/QA/Security 우선, 최대 3명) — haiku 경량 모델 사용
  [병렬] 선정된 리뷰어만 리뷰 (critical 이슈만 블로커로 추출)
  → 80%+ 승인 시 수렴
  → 라운드 2+: 개선폭 < 5% + 블로커 0 → 조기 수렴 (stagnation)
  → 라운드 3+: 이전 기획서를 핵심 결정만 추출하여 컨텍스트 최소화
  → 아니면 역할별 피드백 주입 후 다음 라운드 (최대 3회)
```

- **Tier 병렬화**: `config.discussion.parallelTiers` 또는 `Discusser({ parallelTiers })` 옵션으로 제어. `buildAgentAnalysisPrompt()`가 `priorTierOutputs`를 미사용하므로 전체 병렬 안전
- **리뷰어 선정**: `selectDiscussionReviewers`가 유니버셜 리뷰어(CTO, QA, Security) 우선 선정, 나머지는 priority 순 (전원 → 핵심 2-3명)
- **리뷰 경량화**: `discussion.reviewModel = 'haiku'`로 리뷰 LLM 호출 시간 50-70% 단축
- **조기 수렴**: 라운드 2+에서 승인율 개선폭 < `stagnationThreshold`(5%)이고 critical 블로커 0이면 즉시 수렴 처리
- **라운드별 압축**: 라운드 2는 `compressPreviousContext`, 라운드 3+는 `extractKeyDecisions`로 핵심 결정만 전달
- **역할별 피드백 주입**: 비승인 에이전트의 피드백이 해당 역할 에이전트의 다음 라운드 프롬프트에 타겟 주입
- **블로커 추출**: `checkConvergence`가 critical 이슈만 블로커로 분류, important/minor는 무시
- **메시지 컨텍스트**: `context.messages`로 다른 에이전트의 메시지를 프롬프트에 주입 가능 (opt-in)

## 실행 + 리뷰 + 실패 복구 플로우

```
Phase N:
  execute-tasks (병렬, 코드 태스크는 TDD 프롬프트 자동 적용)
  → materialize (코드 태스크만, /tmp 빌드 검증, npm install --ignore-scripts)
  → review (2-3명, 도메인 매칭 + 유니버셜 리뷰어 우대) → 기여도 수집
  → quality-gate (critical 0개, important는 경고만)
  → enhanced-quality-gate (리뷰 통과 AND 빌드 검증 통과)
  → 실패 시:
      카테고리 분류 (security/build/test/performance/type/architecture/logic)
    → failureContext 저장 (이슈 + 카테고리 + 이전 시도)
    → 수정 프롬프트에 이전 시도 + 카테고리 분포 주입 (critical/important만, minor 제외)
    → fix (최대 2회, fixAttempt는 Phase당 리셋)
    → 2회 초과 → CEO 에스컬레이션:
        continue: 핵심 기능이라 반드시 성공해야 할 때 (ceoGuidance 주입 가능)
        skip: 부가 기능이라 나중에 추가 가능할 때
        abort: 기획 자체를 재검토해야 할 때
  → commit-phase → build-context (이전 Phase 출력을 다음 Phase 프롬프트에 주입)
  → 메트릭 기록 (fire-and-forget, 실행 블로킹 없음)
  → interactive 모드면 confirm-next-phase, semi-auto면 batchSize 체크, auto면 자동 진행
```

- **실행 모드**: `interactive` (Phase 간 CEO 확인) / `auto` (자동 진행)
- **CEO Interrupt**: `confirm-phase`(phaseGuidance 포함 가능), `handle-review-intervention`(proceed/revise) — interactive 모드에서 CEO가 Phase 간 지침 전달 및 리뷰 후 개입 가능
- **phaseGuidance**: build-context에서 저장, execute-tasks에서 소멸 (1회성). 태스크 프롬프트에 "CEO 지침" 섹션으로 주입
- **reviewIntervention**: `config.execution.reviewIntervention = true` 시 interactive 모드에서 quality-gate 전에 CEO 개입 가능
- **부실 감지**: 마지막 저널 엔트리 또는 startedAt 기준 시간 초과 감지
- **시맨틱 상태 검증**: 6가지 규칙 (fixAttempt 상한, completedAt 필수, escalation 플래그, 중복 Phase 방지 등)
- **리뷰어 선정**: 도메인 오버랩 점수 + 유니버셜 리뷰어(qa/security/cto) +1 보너스
- **리비전 프롬프트**: critical + important 이슈만 포함, minor는 자동 제외
- **리뷰 대화**: 리뷰어가 `[QUESTION]:` 또는 JSON `question` 필드로 질문 → 구현자 답변 → 최종 리뷰 (최대 1왕복, `messageBus` 활성 시). LLM 실패 시 원본 리뷰 유지 (graceful degradation)
- **전문가 상담**: 에이전트가 `[CONSULT:역할ID]: 질문` 패턴으로 다른 역할에게 ad-hoc 질문 (최대 1회, `messageBus` 활성 시). 답변이 태스크 출력에 `## Expert Consultation` 섹션으로 append
- **메시지 분석**: 프로젝트 완료 시 `messageBus.getStats()` 결과를 `project.messageStats`에 저장, 보고서에 팀 커뮤니케이션 분석 섹션 삽입

## GitHub 협업 워크플로우 (opt-in)

```
github.enabled = false (기본값)
  → 기존과 동일 (main 직접 커밋, branch/PR 없음)

github.enabled = true
  → 실행 시작 시 feature branch 생성 (gv/{slug}-{timestamp})
  → Phase별 conventional commit (feat/fix/test/refactor/chore)
  → 실행 완료 시 자동 PR 생성:
      1. pushBranch() — 최종 push (autoPush=true일 때)
      2. buildMergeReport() — merge 판단용 상세 보고서 생성
      3. createPullRequest() — PR 생성 (gh CLI)
      4. addPullRequest() — PR URL을 project.json에 기록
  → CEO가 GitHub에서 직접 merge 승인 (자동 merge 없음)
```

- **PR 보고서**: 품질 게이트 결과, 리뷰 요약, 실행 이력, 생성 파일 목록, CEO 체크리스트 포함
- **Graceful Degradation**: gh 미설치 시 `{ skipped: true, reason }` 반환, 에러 아님
- **conventional commit**: `feat(phase-1): API 라우터 구현` + Co-authored-by
- **CI 자동 생성**: 기술 스택 감지 → Node/Python/Go/Java CI 워크플로우 생성
- **수동 PR 생성**: `finalize-pr` 커맨드로 이미 완료된 프로젝트에 PR 생성 가능
- **보고서만 생성**: `build-merge-report` 커맨드로 merge 보고서 미리보기 가능

## Daily Improvement 자율 파이프라인

> **내부 개발 도구** — 이 섹션은 Good Vibe Coding 코드베이스 자체를 자동 개선하는 CI/CD 파이프라인이다.
> 사용자가 자기 프로젝트에 사용하는 기능이 아님. 코드는 `internal/` 디렉토리에 위치.

VPS + Claude Code CLI로 매일 KST 자정에 코드베이스를 **Round Loop 파이프라인**으로 자동 분석 → 이슈 생성 → 코드 수정 → PR 생성 → 독립 리뷰 → 수정 루프 → SLA 평가 → SLA 달성까지 반복 → 보고서 → 머지 요청. CEO는 GitHub에서 merge만 결정.

```
daily-improvement.sh (오케스트레이터)
  │
  ├─ Phase 0: 사전 준비                                    [1회]
  │  flock → git pull → npm ci → 데이터 수집 → 브랜치 생성
  │
  ├─── Round Loop (SLA 달성까지 반복) ──────────────────────┐
  │ │                                                       │
  │ ├─ Phase 1: 분석 + 수정 + PR (Claude Improver)          │
  │ │  Round 1: 이슈 생성 + 코드 수정 + lint/test + PR      │
  │ │  Round 2+: SLA 미달 영역 집중 + 같은 PR에 추가 커밋   │
  │ │                                                       │
  │ ├─ Phase 1.5: 이슈 검증 (issue-manager)                 │
  │ │  생성 이슈 확인, closes 링크 검증                      │
  │ │                                                       │
  │ ├─ Phase 2: 독립 리뷰 (Claude Reviewer)                 │
  │ │  gh pr diff → 보안/성능/정확성 → approve/request      │
  │ │                                                       │
  │ ├─ Phase 3: 수정 루프 (최대 5사이클)                    │
  │ │  APPROVED면 건너뜀                                    │
  │ │  Fixer(수정+push) → Re-reviewer(재리뷰)               │
  │ │                                                       │
  │ └─ Phase Eval: 7영역 SLA 평가                           │
  │    ├─ SLA 달성 → break                                  │
  │    ├─ 개선 정체 → break                                 │
  │    └─ SLA 미달 → 피드백 주입 → 다음 라운드              │
  │    ※ 세션 오류 시 checkpoint 저장 → 재개 가능           │
  └─────────────────────────────────────────────────────────┘
  │
  └─ Phase 4: 보고서 + 머지 요청                            [1회]
     SLA 대시보드 + 라운드별 메트릭 + 텔레그램 알림
```

### 7영역 SLA 평가

| 영역           | 평가 대상                              |
| -------------- | -------------------------------------- |
| architecture   | 모듈 구조, 의존성, SRP, 레이어 분리    |
| safety         | 보안 취약점, 입력 검증, injection 방지 |
| promptQuality  | AI 프롬프트 명확성, 출력 형식 강제     |
| reflection     | 히스토리 반영, 적응형 분석             |
| errorHandling  | AppError 사용, graceful degradation    |
| testCoverage   | 테스트 존재/품질, 커버리지             |
| docConsistency | CLAUDE.md/README.md와 코드 일치        |

- SLA 목표: 7.0/10 (환경변수 `SLA_TARGET`으로 조정)
- 개선 정체 감지: 라운드 간 평균 개선폭 < 0.3이면 조기 종료

### 이슈 관리

- Phase 1.5에서 `issue-manager.js`가 이슈 검증
- 생성 이슈 vs GitHub 실제 이슈 교차 확인
- PR body의 `closes #N` 링크 검증
- 라운드 간 이슈 추적 (이전 라운드 미해결 → 다음 라운드 피드백 주입)

### 파일 구조

```
internal/
  daily-improvement.sh              # 오케스트레이터 (Phase 0 → Round Loop → Phase 4)
  improvement/
    config.env                      # 타임아웃, SLA/Round/Session 상수
    lib/
      common.sh                     # log, checkpoint, classify_claude_error, run_claude_safe
      prompts.sh                    # Improver/Reviewer/Fixer/Evaluator/RoundImprover 프롬프트
      history.sh                    # history.jsonl 읽기/쓰기/요약
    phase0-prepare.sh               # git pull, npm ci, 데이터 수집, 브랜치 생성
    phase1-improve.sh               # Claude Improver + PR 생성 (Round 인식)
    phase2-review.sh                # Claude Reviewer + CI 대기
    phase3-fix-loop.sh              # fix-review 사이클 루프
    phase-eval.sh                   # 7영역 SLA 품질 평가
    phase4-report.sh                # 보고서 + SLA 대시보드 + 텔레그램 + 히스토리
  lib/
    prompt-builder.js               # Improver/Reviewer/Fixer/Evaluator/RoundImprover 프롬프트 생성
    history-analyzer.js             # history.jsonl CRUD + 요약 (totalRounds/slaScore 포함)
    sla-evaluator.js                # 7영역 SLA 점수 파싱, 달성 판정, 피드백 생성
    issue-manager.js                # 이슈 검증, closes 연결, stale 정리
    review-parser.js                # 리뷰 결과 파싱
    pipeline-utils.js               # 파이프라인 유틸리티
logs/daily-improvement/
  history.jsonl                     # 실행 이력 (append-only, totalRounds/slaScore 포함)
```

### 실행 정보

- **스크립트**: `internal/daily-improvement.sh` (VPS cron 실행)
- **이슈 템플릿**: `.github/ISSUE_TEMPLATE/improvement.md`
- **수동 실행**: `bash internal/daily-improvement.sh`
- **인증**: Claude Max Plan OAuth (별도 API key 불필요)

### 타임아웃 설정

| Phase                  | 타임아웃    | 역할                                 |
| ---------------------- | ----------- | ------------------------------------ |
| Phase 1 (Improver)     | 4h          | 분석+수정+테스트                     |
| Phase 2 (Reviewer)     | 2h          | 컨텍스트 읽기+깊이 리뷰              |
| Phase 3 (Fixer)        | 1.5h/사이클 | 수정 작업                            |
| Phase 3 (Re-reviewer)  | 1h/사이클   | 재리뷰                               |
| Phase Eval (Evaluator) | 1h          | 7영역 SLA 평가 (read-only)           |
| 전체 파이프라인        | 14h         | Round Loop × N (14h에 graceful 종료) |

### 리뷰 품질 기준

**MUST (reject 사유):** 보안 취약점, 테스트 깨뜨림, 로직 오류, CLAUDE.md 컨벤션 위반, 이슈-수정 불일치, 새 문제 도입
**SHOULD (코멘트만):** 개선 제안, 커버리지 부족, 네이밍/코멘트 개선, 리팩토링 기회

### Reflection (적응형 분석)

`logs/daily-improvement/history.jsonl`에 매 실행 결과를 기록하여 Improver 프롬프트에 최근 7일 요약 주입. 카테고리별 발견 빈도와 승인율을 기반으로 분석 방향을 자동 조정.

### 안전장치

| 안전장치                | 구현                                                                     |
| ----------------------- | ------------------------------------------------------------------------ |
| 동시 실행 방지          | `flock -n` (파일 락)                                                     |
| 전체 타임아웃           | watchdog 프로세스 (14h)                                                  |
| Phase별 타임아웃        | `timeout N claude -p`                                                    |
| master 직접 커밋 방지   | `assert_not_on_master()`                                                 |
| lint/test 실패 롤백     | `git reset HEAD && git checkout -- .`                                    |
| 빈 PR 방지              | `git diff --name-only` 확인                                              |
| Claude 세션 한도 재시도 | `run_claude_safe` — 세션 한도 시 5분 대기 후 새 세션 (최대 3회)          |
| Claude 주간 한도        | checkpoint 저장 → 텔레그램 알림 → 다음 실행에서 재개                     |
| Claude 인증 만료        | 텔레그램 "재로그인 필요" 알림 → 즉시 종료                                |
| 네트워크 오류           | 5분 대기 후 재시도 (최대 3회)                                            |
| Checkpoint/재개         | `checkpoint.json`에 라운드/Phase 진행상황 저장 → 다음 실행에서 자동 재개 |
| 긴급 정지 파일          | `/tmp/gv-daily-improvement.stop` 감지 시 즉시 중단                       |
| gh CLI 재시도           | `retry_gh` — exponential backoff (최대 3회)                              |
| 텔레그램 실패 내성      | `\|\| true`                                                              |
| 30일 로그 정리          | `find -mtime +30 -delete`                                                |
| SLA 정체 감지           | 라운드 간 개선폭 < 0.3이면 조기 종료                                     |

**중단 기준**: SLA 달성, 개선 정체, 시간 제한, 세션/주간 한도 소진, 빈 결과 3회 연속

## UX Improvement 자율 파이프라인

> **내부 개발 도구** — Daily Improvement와 별도로, 사용자 경험(UX) 관점에서 코드베이스를 자동 개선하는 파이프라인.
> VPS에서 매일 1회 실행. 코드는 `internal/ux-improvement/` 디렉토리에 위치.

```
ux-improvement.sh (오케스트레이터)
  │
  ├─ Phase 0: 사전 준비 + 관점 결정 (rotation)
  │
  ├─── Round Loop (UX SLA 달성까지, 최대 3라운드) ─────┐
  │ ├─ Phase 1: UX Improver (관점 기반 분석 + 수정 + PR) │
  │ ├─ Phase 1.5: 이슈 검증                              │
  │ ├─ Phase 2: UX Reviewer (리뷰)                       │
  │ ├─ Phase 3: 수정 루프 (최대 5사이클)                 │
  │ └─ Phase Eval: UX SLA 평가 → 달성/정체 → break      │
  └──────────────────────────────────────────────────────┘
  │
  └─ Phase 4: 보고서 + 자동 머지 (조건 충족 시) + 텔레그램
```

### 8가지 관점 순환 (Perspective Rotation)

매일 1회 실행. 각 실행마다 다른 관점으로 분석 (`rotation_index = execution_count % 8`):

| #   | 관점 ID              | 이름           | 분석 대상                               |
| --- | -------------------- | -------------- | --------------------------------------- |
| 0   | `first-time-user`    | 첫 사용자      | hello → new 흐름, 진입 장벽             |
| 1   | `command-flow`       | 커맨드 플로우  | 상태 전이, 다음 단계 안내               |
| 2   | `error-recovery`     | 에러 복구      | 에러 메시지 품질, 복구 가이드           |
| 3   | `guide-coverage`     | 가이드 완성도  | guides/ vs 실제 기능 매칭               |
| 4   | `sdk-dx`             | SDK DX         | import 패턴, API 일관성                 |
| 5   | `mode-confusion`     | 모드 혼동 방지 | quick-build/plan-execute/plan-only 구분 |
| 6   | `onboarding-quality` | 온보딩 품질    | 프리셋, 템플릿, CLAUDE.md 생성 품질     |
| 7   | `intermediate-user`  | 중급 사용자    | 고급 커맨드, 커스터마이징               |

### 5영역 UX SLA

| 영역                 | 설명                 |
| -------------------- | -------------------- |
| `flowClarity`        | 커맨드 플로우 명확성 |
| `errorQuality`       | 에러 메시지 품질     |
| `guideCompleteness`  | 가이드/문서 완성도   |
| `onboardingFriction` | 온보딩 마찰도        |
| `sdkUsability`       | SDK 사용성           |

SLA 목표: 7.0/10 (환경변수 `UX_SLA_TARGET`으로 조정)

### 자동 머지 정책

다음 조건 **모두** 충족 시 자동 squash merge:

1. `npm test` 전체 통과
2. PR 리뷰 APPROVED
3. 변경 파일이 안전 경로만 포함 (commands/, guides/, templates/, presets/, agents/, skills/)
4. 코어 로직 파일 변경 없음

### 파일 구조

```
internal/
  ux-improvement.sh                    # 오케스트레이터
  ux-improvement/
    config.env                         # UX 전용 설정
    phase0-prepare.sh                  # 준비 + 관점 결정
    phase1-improve.sh                  # UX Improver
    phase2-review.sh                   # UX Reviewer
    phase3-fix-loop.sh                 # 수정 루프
    phase-eval.sh                      # UX SLA 평가
    phase4-report.sh                   # 보고서 + 자동 머지
    lib/
      prompts.sh                       # UX 프롬프트 Shell 래퍼
  lib/
    ux-prompt-builder.js               # UX 프롬프트 생성
    ux-sla-evaluator.js                # UX SLA 평가
    perspective-manager.js             # 관점 순환 관리
logs/
  ux-improvement/
    history.jsonl                      # UX 히스토리
```

### Daily Improvement와의 차이

| 항목      | Daily Improvement                | UX Improvement                |
| --------- | -------------------------------- | ----------------------------- |
| 주기      | 매일 1회                         | 매일 1회                      |
| 관점      | 코드 품질/보안/성능              | 사용자 경험 (8관점 순환)      |
| SLA       | 7영역                            | 5영역 (UX)                    |
| 자동 머지 | APPROVED 시 자동                 | 안전 경로만 자동              |
| lock 파일 | `/tmp/gv-daily-improvement.lock` | `/tmp/gv-ux-improvement.lock` |
| 정지 파일 | `/tmp/gv-daily-improvement.stop` | `/tmp/gv-ux-improvement.stop` |
| 브랜치    | `improve/`                       | `ux-improve/`                 |
| 라벨      | `improvement`                    | `ux-improvement`              |

## 코드 구체화 파이프라인

```
태스크 실행 → isCodeTask? (역할 기반: backend/frontend/fullstack/devops/data + 키워드 매칭)
  → [코드] TDD 프롬프트 (RED → GREEN → REFACTOR, 기본 vitest)
  → 에이전트 실행 → 마크다운 출력
  → extractMaterializableBlocks (fence info-string + 코멘트 기반 파일명 감지)
  → verifyAndMaterialize:
      /tmp에 임시 프로젝트 생성 → 빌드 검증 (언어별 타임아웃)
      → 통과 시에만 프로젝트에 기록 (path traversal 방지, 기존 파일 백업)
      → 실패 시 /tmp 유지 (디버깅용)
  → 강화 품질 게이트 (리뷰 통과 AND 빌드 검증 통과)
  → commitPhase
```

- **파일명 감지**: ` ```js src/app.js ` (fence) 또는 `// filename: src/app.js` (코멘트) 두 방식 지원
- **보안**: `npm install --ignore-scripts` (LLM 생성 코드의 postinstall 방지), `assertWithinRoot` (path traversal 차단)
- **dry-run 모드**: 파일 기록 없이 구체화 시뮬레이션 가능
- **결과 카운터**: totalBlocks, materializedCount, skippedCount, unmaterializableCount, failedCount, existsSkippedCount, dryRunCount

## 에이전트 최적화

- **중복 감지**: bigram Jaccard 유사도 > 0.7이면 중복 에이전트로 판정
- **기여도 점수**: `(critical×3 + uniqueIssues) / reviewCount` — 빈 승인 리뷰는 -0.5 패널티
- **유니버셜 리뷰어**: qa, security, cto는 중복 판정되어도 제거 불가 (기여도 낮으면 경고만)
- **팀 규모 최적화**: 기여도 최하위 비유니버셜 역할부터 제거

## 크로스프로젝트 학습

- `aggregateCrossProjectFeedback(roleId, projects)` — 여러 프로젝트에서 동일 역할의 이슈 패턴 집계
- 3회 이상 반복된 카테고리를 "반복 패턴"으로 추출하여 user-level 오버라이드에 "반복 패턴 주의" 섹션 추가
- `good-vibe:feedback` 실행 시 자동으로 크로스프로젝트 분석 수행

## 프롬프트 버전 관리

- `PROMPT_VERSION` 상수 (`prompt-builder.js`) — 현재 `1.4.0`
- `buildSectioned` 출력에 `<!-- prompt-version: X.X.X -->` 주석 자동 삽입
- 프롬프트 구조 변경 시 버전 업데이트하여 추적 가능

## 추천 엔진

- **4가지 시그널**: projectType(3점) + complexity(2점) + keyword(1점×최대3) + roleAffinity(2점)
- **한국어 조사 자동 제거**: "웹을", "앱의" 등의 조사를 벗겨서 키워드 매칭 정확도 향상
- **최소 점수**: 3점 미만은 노출 안 됨, 카테고리당 최대 5개

## 에이전트 구성 (23개)

**팀 에이전트 (15개)** — `agents/team-*.md`

- Leadership: CTO (priority 1), PO (priority 2)
- Engineering: Fullstack (3), Frontend (4), Backend (4), QA (6), DevOps (7), Data (5), Security (5)
- Design: UI/UX (3)
- Support: Tech Writer (8)
- Research: Market (2), Business (2), Tech (5), Design (5)

**서포트 에이전트 (8개)** — `agents/`

- onboarding-guide, mentor-kr, code-reviewer-kr, tdd-coach-kr
- doc-reviewer-kr, content-editor-kr, data-analyst-kr, accessibility-checker

## 스킬 구성 (5개)

`skills/*/SKILL.md` — 재사용 가능한 워크플로우 스킬

| 스킬                | 설명                           | 트리거                         |
| ------------------- | ------------------------------ | ------------------------------ |
| `beginner-guide`    | 초보자 가이드                  | 사용자 요청                    |
| `korean-workflow`   | 한국어 워크플로우 안내         | 사용자 요청                    |
| `onboarding-wizard` | 대화형 초기 설정               | `good-vibe:hello`              |
| `project-setup`     | 프로젝트 인프라 셋업           | `good-vibe:new`                |
| `multi-review`      | 멀티 AI 리뷰 설정 및 결과 검증 | `good-vibe:execute` Step 1.2.5 |

- `multi-review`: Gemini CLI 인증 검증(connect → verify → rollback) + cross-model 리뷰 활성화 + Phase별 프로바이더 결과 표시

## 프로젝트 규칙

- import에 `.js` 확장자 필수 (Windows ESM 호환)
- `"type": "module"`
- 한국어 가이드/프롬프트, 코드/기술 용어는 영어
- 테스트: `npm test` (Vitest), 커버리지 목표 80%+
- 파일명: kebab-case
- 커밋: conventional commits (`feat|fix|refactor|docs|test|chore(scope): subject`)
- **CLI 우선 사용**: 외부 도구 연동 시 MCP 도구 대신 CLI를 직접 사용. MCP는 샌드박스 환경에서 키체인/인증 접근이 제한될 수 있음

## 사용 가능한 CLI 도구

| CLI                    | 용도                                             |
| ---------------------- | ------------------------------------------------ |
| `gh`                   | GitHub (이슈, PR, 리포지토리 관리)               |
| `git`                  | 버전 관리                                        |
| `ctx7`                 | Context7 문서 조회 (`ctx7 library`, `ctx7 docs`) |
| `node` / `npm` / `npx` | Node.js 런타임, 패키지 관리                      |
| `gemini`               | Gemini CLI (멀티리뷰)                            |
| `codex`                | Codex CLI (멀티리뷰)                             |
| `claude`               | Claude Code CLI                                  |

## 개발 워크플로우

### 새 기능 추가 (커맨드/핸들러)

1. **커맨드 정의** — `commands/new-command.md` 작성 (YAML frontmatter 필수, 에이전트 실행 지침)
2. **코어 로직** — `scripts/lib/{category}/new-module.js` 구현
3. **핸들러 등록** — `scripts/handlers/{handler}.js`에 `commands` 객체에 커맨드 추가
4. **COMMAND_MAP 등록** — `scripts/cli.js`의 `COMMAND_MAP`에 `'command-name': 'handler'` 추가
5. **테스트** — `tests/new-module.test.js` (unit) + `tests/handlers/{handler}.test.js` (E2E)

체크리스트:

- [ ] `commands/*.md`에 YAML frontmatter 포함 (`---\ndescription: "..."\n---`)
- [ ] `skills/*/SKILL.md`에 YAML frontmatter 포함 (`---\nname: ...\ndescription: "..."\n---`)
- [ ] import에 `.js` 확장자 포함
- [ ] `requireFields`로 필수 입력 검증
- [ ] 에러 시 `inputError` / `notFoundError` 사용 (직접 `throw new Error` 금지)
- [ ] `output()` 또는 `outputOk()`로 결과 출력
- [ ] 테스트에서 cliExec/cliExecRaw로 E2E 검증
- [ ] COMMAND_MAP에 등록 확인

## 코드 패턴

### 핸들러 패턴

```javascript
// scripts/handlers/{handler}.js
import { readStdin, output, outputOk, parseArgs } from '../cli-utils.js';
import { requireFields, inputError, notFoundError } from '../lib/core/validators.js';

const [, , , ...args] = process.argv;

export const commands = {
  'command-name': async () => {
    const data = await readStdin(); // stdin에서 JSON 파싱
    requireFields(data, ['field1', 'field2']); // 필수 필드 검증
    const result = await coreFunction(data);
    output(result); // JSON 출력
  },

  'another-command': async () => {
    const opts = parseArgs(args); // --key value 파싱
    const item = await getItem(opts.id);
    if (!item) throw notFoundError(`항목을 찾을 수 없습니다: ${opts.id}`);
    outputOk({ id: opts.id }); // { success: true, id: ... }
  },
};
```

### JSON 파이프 컨벤션

에이전트가 CLI를 호출하는 방식:

```bash
# stdin으로 JSON 전달
echo '{"name": "test", "type": "web-app"}' | node cli.js create-project

# 플래그로 ID 전달
node cli.js get-project --id abc123

# 복합: stdin + 플래그
echo '{"stepResult": {"status": "completed"}}' | node cli.js advance-execution --id abc123
```

### 에러 핸들링

```javascript
// 에러 생성 (validators.js)
throw inputError('필수 필드 누락'); // AppError { code: 'INPUT_ERROR' }
throw notFoundError('프로젝트 없음'); // AppError { code: 'NOT_FOUND' }
throw new AppError('내부 오류', 'SYSTEM_ERROR'); // 기본값

// cli.js 에러 코드 매핑
// INPUT_ERROR  → exit 2 ("입력 형식을 확인한 후 다시 시도하세요")
// NOT_FOUND    → exit 3 ("good-vibe:projects 또는 good-vibe:status로 목록을 확인하세요")
// SYSTEM_ERROR → exit 1 ("설정을 확인하거나 Claude Code를 다시 시작하세요")
// stderr 형식: "오류 [CODE]: message\nhint\n"
```

## 테스트 컨벤션

### 파일 위치

| 대상                              | 테스트 파일                             | 타입 |
| --------------------------------- | --------------------------------------- | ---- |
| 코어 모듈 (`scripts/lib/**/*.js`) | `tests/{module-name}.test.js`           | Unit |
| 핸들러 (`scripts/handlers/*.js`)  | `tests/handlers/{handler-name}.test.js` | E2E  |

### mock 패턴 (Unit)

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'fs/promises';
import { resolve } from 'path';

const TMP_DIR = resolve('.tmp-test-{module-name}');

beforeEach(async () => {
  await mkdir(TMP_DIR, { recursive: true });
  setBaseDir(TMP_DIR); // 테스트용 디렉토리 격리
});

afterEach(async () => {
  await rm(TMP_DIR, { recursive: true, force: true });
});
```

### 핸들러 E2E 헬퍼

```javascript
import { execSync } from 'child_process';

const CLI_PATH = resolve('scripts/cli.js');

// 성공 케이스: JSON 파싱된 결과 반환
function cliExec(command, input) {
  return JSON.parse(
    execSync(`node ${CLI_PATH} ${command}`, {
      input: JSON.stringify(input),
      encoding: 'utf-8',
      timeout: 10_000,
    }),
  );
}

// 에러 케이스: exitCode + stdout + stderr 반환
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

### 테스트 실행

```bash
npm test              # 전체 테스트
npm run test:watch    # 감시 모드
npm run test:coverage # 커버리지 리포트 (목표 80%+)
```

## 데이터 저장 경로

| 데이터                         | 경로                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------- |
| 프로젝트                       | `~/.claude/good-vibe/projects/{id}/project.json`                                 |
| 에이전트 오버라이드 (사용자)   | `~/.claude/good-vibe/agent-overrides/{roleId}.md`                                |
| 에이전트 오버라이드 (프로젝트) | `{projectDir}/.good-vibe/agent-overrides/{roleId}.md`                            |
| 커스텀 템플릿                  | `~/.claude/good-vibe/custom-templates/` (\*.json)                                |
| Built-in 템플릿                | `presets/templates/` (next-app, express-api, cli-app, telegram-bot, npm-library) |
