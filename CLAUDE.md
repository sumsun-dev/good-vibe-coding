# Good Vibe Coding

AI 팀을 만들고, 프로젝트를 함께 굴리는 플랫폼.

## 설계: CLI-as-API + SDK

- `cli.js`는 경량 라우터. 152개 커맨드를 15개 핸들러 모듈(`scripts/handlers/*.js`)로 lazy-load 디스패치
- 사용자는 `good-vibe:hello`, `good-vibe:new`, `good-vibe:discuss` 같은 슬래시 커맨드만 씀
- 흐름: 슬래시 커맨드 → 에이전트 디스패치 → cli.js → 핸들러 → 코어 라이브러리
- 에이전트 .md 파일이 `node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js <command>` 형태로 호출
- **SDK** (`src/`): 동일한 코어 모듈을 프로그래밍 API로 노출. `import { GoodVibe } from 'good-vibe'`

## 핵심 컨셉

- **CEO 모드**: 사용자가 CEO로 프로젝트를 정의하면, AI 팀이 토론 → 기획 → 실행 → 보고
- **15개 역할**: CTO, PO, Full-stack, Frontend, Backend, QA, UI/UX, DevOps, Data, Security, Tech Writer, Market/Business/Tech/Design Researcher
- **모델 다양성**: opus/sonnet/haiku — 역할 카테고리별 자동 배분

## 프로젝트 모드 (3가지)

| 모드             | 팀 규모 | 토론         | 추천 상황           | `good-vibe:new`에서의 자동 진행               |
| ---------------- | ------- | ------------ | ------------------- | --------------------------------------------- |
| **quick-build**  | 2-3명   | 생략         | 간단한 봇, 스크립트 | CTO 분석 → 작업 분배 → 실행 → QA 리뷰 → 완료  |
| **plan-execute** | 3-5명   | 1라운드      | 웹앱, API 서버      | discuss(1라운드) → 자동 승인 → execute → 완료 |
| **plan-only**    | 5-8명   | 최대 3라운드 | 대규모 시스템       | discuss(수렴까지) → CEO 승인 → execute → 완료 |

## 실행 모드 (3가지)

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
  → good-vibe:discuss 자동 실행 (1라운드)
     → Tier별 병렬 분석 → 종합 → 리뷰 → 수렴 확인
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

| 비교                                                        | 차이                                                                                                                 |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `good-vibe:new` vs `good-vibe:new-project`                  | 자동(복잡도 분석 → 추천) vs 수동(직접 선택)                                                                          |
| `good-vibe:status` vs `good-vibe:projects`                  | 현재 프로젝트만 vs 전체 목록                                                                                         |
| `good-vibe:hello` → `good-vibe:new` vs `good-vibe:new` 단독 | hello는 환경+개인설정(1회), new는 프로젝트 시작. 처음이면 hello 먼저, 이후는 new만                                   |
| `project.mode` vs `executionState.mode`                     | 프로젝트 워크플로우(plan-only/plan-execute/quick-build) vs 실행 인터랙션(interactive/semi-auto/auto)                 |
| plan-only vs plan-execute                                   | 둘 다 실행까지 감. plan-only는 good-vibe:approve 후 수동 good-vibe:execute, plan-execute는 자동 연결                 |
| approve 되돌리기                                            | 실행 시작 전이라면 `good-vibe:discuss --reset`으로 approved → planning 복귀 가능                                     |
| `good-vibe:new` vs `good-vibe:modify`                       | `new`는 새 프로젝트 (아이디어 → 팀 구성 → 토론 → 실행), `modify`는 완료된 프로젝트의 기능 추가/수정 (기존 맥락 유지) |
| `good-vibe:new`에서 "이어서"                                | 기존 프로젝트 전체 목록 → 선택 → 상태별 다음 커맨드 안내. 직접 실행은 안 함 (detect → offer → route)                 |

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
│  코어 라이브러리      60개 모듈 + 15개 핸들러  │
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

| 카테고리                 | 모듈 수 | 핵심 모듈                                                                                                                                                                      |
| ------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `core/` 기반 유틸리티    | 17개    | `validators.js`(AppError), `config.js`(정책 상수), `prompt-builder.js`(인젝션 방어), `message-bus.js`(에이전트 메시징), `nl-router.js`(NL→커맨드), `intent-gate.js`(의도 분류) |
| `project/` 프로젝트 관리 | 14개    | `project-manager.js`(CRUD+잠금), `project-scaffolder.js`(인프라 생성), `github-manager.js`(gh 래퍼), `worktree-manager.js`(격리), `prd-generator.js`(PRD)                      |
| `engine/` 실행 엔진      | 18개    | `orchestrator.js`(4-tier 병렬), `execution-loop.js`(상태 전이+저널), `review-engine.js`(크로스 리뷰), `code-materializer.js`(코드 추출), `task-distributor.js`(작업 분배)      |
| `llm/` LLM 연동          | 3개     | `llm-provider.js`(Claude/OpenAI/Gemini), `gemini-bridge.js`, `auth-manager.js`                                                                                                 |
| `agent/` 에이전트/팀     | 9개     | `team-builder.js`, `complexity-analyzer.js`, `clarity-analyzer.js`, `agent-optimizer.js`(중복/기여도)                                                                          |
| `output/` 보고/환경      | 4개     | `report-generator.js`, `progress-formatter.js`, `env-checker.js`, `update-checker.js`                                                                                          |

**SDK** (`src/`): GoodVibe(메인), Discusser, Executor, Storage(File/Memory), defaults, index
**Claude Code 어댑터** (`plugin/adapter.js`): SDK 초기화
**CLI**: `cli.js`(라우터, 152개→15핸들러), `cli-utils.js`, `handlers/*.js`

## 정책 상수

전체 상수는 `scripts/lib/core/config.js` 참조. 주요 값:

- 수렴: threshold 0.8, maxRounds 3
- 실행: maxFixAttempts 2, maxAgentCalls 500, maxEscalationAttempts 3
- 리뷰: 2-3명, maxRevisionRounds 2
- 팀: simple 2-3명, medium 3-5명, complex 5-8명
- GitHub: enabled=false (opt-in), branchStrategy=timestamp
- 메시징: enabled=false (opt-in), maxMessages 100, ttl 24h

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
  [병렬] 전 에이전트 리뷰 (critical 이슈만 블로커로 추출)
  → 80%+ 승인 시 수렴, 아니면 역할별 피드백 주입 후 다음 라운드 (최대 3회)
```

- **Tier 병렬화**: `config.discussion.parallelTiers` 또는 `Discusser({ parallelTiers })` 옵션으로 제어. `buildAgentAnalysisPrompt()`가 `priorTierOutputs`를 미사용하므로 전체 병렬 안전
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

> **내부 개발 도구** — 코드는 `internal/` 디렉토리. 상세 구조는 `internal/improvement/` 참조.

VPS cron (KST 자정)으로 Round Loop 파이프라인 실행: Phase 0(준비) → Phase 1(분석+수정+PR) → Phase 1.5(이슈 검증) → Phase 2(독립 리뷰) → Phase 3(수정 루프, 최대 5사이클) → Phase Eval(7영역 SLA) → SLA 달성까지 반복 → Phase 4(보고서+텔레그램).

- **7영역 SLA**: architecture, safety, promptQuality, reflection, errorHandling, testCoverage, docConsistency (목표 7.0/10)
- **안전장치**: flock, watchdog 14h, checkpoint/재개, master 직접 커밋 방지, `run_claude_safe`, 긴급 정지 파일
- **실행**: `internal/daily-improvement.sh`, 인증: Claude Max Plan OAuth
- **히스토리**: `logs/daily-improvement/history.jsonl` (최근 7일 요약 → Improver 프롬프트 주입)

## UX Improvement 자율 파이프라인

> **내부 개발 도구** — 코드는 `internal/ux-improvement/` 디렉토리. 상세 구조는 해당 디렉토리 참조.

VPS cron (KST 오전 10시)으로 UX 관점 자동 개선. Daily Improvement와 동일한 Round Loop 구조 (최대 2라운드).

- **8관점 순환**: first-time-user, command-flow, error-recovery, guide-coverage, sdk-dx, mode-confusion, onboarding-quality, intermediate-user (`rotation_index = count % 8`)
- **5영역 UX SLA**: flowClarity, errorQuality, guideCompleteness, onboardingFriction, sdkUsability (목표 7.0/10)
- **자동 머지**: APPROVED면 squash merge + 브랜치 삭제
- **vs Daily**: Daily=코드 품질(KST 자정, 수동 머지), UX=사용자 경험(KST 10시, 자동 머지), 브랜치 `ux-improve/`, 라벨 `ux-improvement`

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

- `PROMPT_VERSION` 상수 (`prompt-builder.js`) — 현재 `1.2.0`
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

- **핸들러**: `readStdin()` → `requireFields()` → 코어 로직 → `output()`/`outputOk()`. 기존 핸들러 참고: `scripts/handlers/*.js`
- **JSON 파이프**: stdin JSON (`echo '{...}' | node cli.js cmd`) 또는 플래그 (`--id abc123`) 또는 복합
- **에러**: `inputError(msg)` → exit 2, `notFoundError(msg)` → exit 3, `AppError(msg, 'SYSTEM_ERROR')` → exit 1

## 테스트 컨벤션

- **Unit**: `tests/{module-name}.test.js` — `.tmp-test-*` 디렉토리 격리, `setBaseDir(TMP_DIR)`
- **E2E**: `tests/handlers/{handler-name}.test.js` — `cliExec(cmd, input)` / `cliExecRaw(cmd, input)` 헬퍼 사용
- **실행**: `npm test` (전체), `npm run test:watch` (감시), `npm run test:coverage` (목표 80%+)

## 데이터 저장 경로

| 데이터                         | 경로                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------- |
| 프로젝트                       | `~/.claude/good-vibe/projects/{id}/project.json`                                 |
| 에이전트 오버라이드 (사용자)   | `~/.claude/good-vibe/agent-overrides/{roleId}.md`                                |
| 에이전트 오버라이드 (프로젝트) | `{projectDir}/.good-vibe/agent-overrides/{roleId}.md`                            |
| 커스텀 템플릿                  | `~/.claude/good-vibe/custom-templates/` (\*.json)                                |
| Built-in 템플릿                | `presets/templates/` (next-app, express-api, cli-app, telegram-bot, npm-library) |
