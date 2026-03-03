# Good Vibe Coding

AI 팀을 만들고, 프로젝트를 함께 굴리는 플랫폼.

## 설계: CLI-as-API + SDK

- `cli.js`는 경량 라우터. 116개 커맨드를 14개 핸들러 모듈(`scripts/handlers/*.js`)로 lazy-load 디스패치
- 사용자는 `/hello`, `/new`, `/discuss` 같은 슬래시 커맨드만 씀
- 흐름: 슬래시 커맨드 → 에이전트 디스패치 → cli.js → 핸들러 → 코어 라이브러리
- 에이전트 .md 파일이 `node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js <command>` 형태로 호출
- **SDK** (`src/`): 동일한 코어 모듈을 프로그래밍 API로 노출. `import { GoodVibe } from 'good-vibe-coding'`

## 핵심 컨셉

- **CEO 모드**: 사용자가 CEO로 프로젝트를 정의하면, AI 팀이 토론 → 기획 → 실행 → 보고
- **15개 역할**: CTO, PO, Full-stack, Frontend, Backend, QA, UI/UX, DevOps, Data, Security, Tech Writer, Market/Business/Tech/Design Researcher
- **모델 다양성**: opus/sonnet/haiku — 역할 카테고리별 자동 배분

## 프로젝트 모드 (3가지)

| 모드 | 팀 규모 | 토론 | 추천 상황 | `/new`에서의 자동 진행 |
|------|---------|------|----------|----------------------|
| **quick-build** | 2-3명 | 생략 | 간단한 봇, 스크립트 | CTO 분석 → 작업 분배 → 실행 → QA 리뷰 → 완료 |
| **plan-execute** | 3-5명 | 1라운드 | 웹앱, API 서버 | discuss(1라운드) → 자동 승인 → execute → 완료 |
| **plan-only** | 5-8명 | 최대 3라운드 | 대규모 시스템 | discuss(수렴까지) → CEO 승인 → execute → 완료 |

## 실행 모드 (2가지)

| 모드 | 동작 | 중단 시점 |
|------|------|----------|
| **interactive** | Phase마다 CEO에게 진행 여부 확인 | 매 Phase 완료 후 + 에스컬레이션 |
| **auto** | 자동 진행 | 에스컬레이션(수정 2회 실패)만 멈춤 |

- `/execute` 시작 시 선택, SDK는 auto 고정
- `project.mode` (프로젝트 모드) ≠ `executionState.mode` (실행 모드)

## 프로젝트 상태 전이

```
created → planning → approved → executing → reviewing → completed
                  ↗                                ↗
           (재토론)                          (fix 후 재실행)
```

| 상태 | 가능한 커맨드 | 설명 |
|------|-------------|------|
| `created` | `/new`, `/discuss` | 프로젝트 생성됨, 팀 구성 완료 |
| `planning` | `/discuss`, `/approve` | 토론 중 또는 기획서 작성됨 |
| `approved` | `/execute`, `/report` | CEO 승인 완료, 작업 분배됨 |
| `executing` | `/status`, (자동 진행) | 실행 중 |
| `reviewing` | `/status`, (자동 진행) | 리뷰 중 |
| `completed` | `/report`, `/feedback` | 전체 완료 |

## 기존 프로젝트 이어서 작업

**중단된 실행 재개:**
- `/execute` 시 이전 실행이 있으면 자동으로 재개 여부를 물어봄
- `init-execution`에 `resume: true`로 이전 Phase부터 이어서 진행
- 실행 상태(Phase, fixAttempt, 저널)가 `project.json`에 보존됨

**프로젝트 전환:**
- `/projects` — 전체 목록 확인
- `/status` — 현재 프로젝트 상태 확인
- 대부분의 커맨드는 가장 최근 프로젝트를 자동 선택, 여러 개면 AskUserQuestion으로 선택

## 모드별 전체 워크플로우

### quick-build (자동모드)

```
/new "텔레그램 봇 만들어줘"
  → 복잡도: simple → quick-build 자동 선택
  → 팀 구성: CTO, Backend, QA (3명)
  → CTO 아키텍처 분석 (Task 1회)
  → 작업 목록 생성 + 분배
  → status: executing
  → 각 태스크 병렬 실행 (Task tool)
  → QA 리뷰 → quality-gate
  → 통과 시 완료, 실패 시 수정 → 에스컬레이션
  → status: completed
  → "다음: /report, /feedback"
```

### plan-execute (반자동모드)

```
/new "팀 프로젝트 관리 웹앱"
  → 복잡도: medium → plan-execute 자동 선택
  → 팀 구성: CTO, PO, Fullstack, Frontend, QA (5명)
  → /discuss 자동 실행 (1라운드)
     → Tier별 병렬 분석 → 종합 → 리뷰 → 수렴 확인
  → 기획서 자동 승인 → 작업 분배
  → /execute 자동 실행
     → Phase별: 실행 → 구체화 → 리뷰 → 품질게이트 → 커밋
  → status: completed
```

### plan-only (CEO 승인 필요)

```
/new "마이크로서비스 SaaS 플랫폼"
  → 복잡도: complex → plan-only 자동 선택
  → 팀 구성: 5-8명 (전문가 팀)
  → /discuss 자동 실행 (최대 3라운드, 수렴까지)
  → "기획서가 완성되었습니다. /approve로 승인해주세요"
  → 사용자가 /approve 실행
  → 사용자가 /execute 실행 (모드 선택: interactive/auto)
  → 실행 완료
```

## 커맨드 우선순위

초보자에게는 **필수 6개만** 안내:

1. **필수 6개** — `/hello` → `/new` → `/discuss` → `/approve` → `/execute` → `/report`
2. **관리 4개** — `/status`, `/feedback`, `/my-team`, `/learn`
3. **고급 10개** — `/new-project`, `/projects`, `/onboarding`, `/my-config`, `/add-skill`, `/add-agent`, `/scaffold`, `/preset`, `/reset`, `/eval`

퀵스타트 가이드: `guides/common/00-quick-start.md`

## 혼동 방지

| 비교 | 차이 |
|------|------|
| `/new` vs `/new-project` | 자동(복잡도 분석 → 추천) vs 수동(직접 선택) |
| `/hello` vs `/onboarding` | 프로젝트별 세팅 vs 사용자 환경 설정(1회) |
| `/status` vs `/projects` | 현재 프로젝트만 vs 전체 목록 |
| `/hello` → `/new` vs `/new` 단독 | 코드 생성/관리 필요 시 hello 먼저, 기획서/보고서만 필요 시 new만 |
| `project.mode` vs `executionState.mode` | 프로젝트 모드(plan-only/plan-execute/quick-build) vs 실행 모드(interactive/auto) |
| plan-only vs plan-execute | 둘 다 실행까지 감. plan-only는 /approve 후 수동 /execute, plan-execute는 자동 연결 |

## 기술 스택

- Node.js 18+ (ESM)
- Handlebars 템플릿 엔진
- Vitest 테스트
- GitHub Actions CI (Node 18/20/22)

## 아키텍처

```
┌─────────────────────────────────────────────┐
│  사용자              슬래시 커맨드 6개        │
│  /hello → /new → /discuss → /approve →      │
│  /execute → /report                          │
├─────────────────────────────────────────────┤
│  SDK                 GoodVibe 클래스         │
│  buildTeam → discuss → execute → report     │
├─────────────────────────────────────────────┤
│  AI 팀원             15개 역할               │
│  Tier별 병렬 분석 + 크로스 리뷰              │
├─────────────────────────────────────────────┤
│  내부 API            CLI-as-API (116개)      │
│  에이전트가 호출하는 인터페이스               │
├─────────────────────────────────────────────┤
│  코어 라이브러리      49개 모듈 + 14개 핸들러  │
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

## 코어 모듈 (`scripts/lib/`)

**`core/`** — 기반 유틸리티 (12개)
- `validators.js` — 입력 검증 + AppError (inputError/notFoundError/systemError)
- `config.js` — 중앙 설정 (Object.freeze, 전체 정책 상수)
- `schema-validator.js` — 경량 스키마 검증 (외부 의존성 0)
- `command-schemas.js` — 커맨드 스키마 레지스트리 (에이전트용 입출력 조회)
- `app-paths.js` — 경로 중앙 관리 (SDK용 configure() 지원)
- `file-writer.js` — 파일 시스템 유틸리티
- `json-parser.js` — 3-tier LLM JSON 응답 파싱
- `domain-parsers.js` — 도메인별 파서 + 스키마 검증 (리뷰, 복잡도, 태스크, 제안)
- `cache.js` — 지연 로딩 캐시
- `preset-loader.js` — 프리셋 JSON 로딩
- `prompt-builder.js` — 프롬프트 조합 유틸리티 (순수 마크다운 포맷팅)
- `nl-router.js` — 자연어 → 커맨드 매핑 (규칙 기반, LLM 호출 없음)

**`project/`** — 프로젝트 관리 (12개)
- `project-manager.js` — CRUD + 상태 관리 (원자적 잠금, AppError, 기여도 기록)
- `project-scaffolder.js` — 프로젝트 인프라 생성 (폴더, CLAUDE.md, README.md, 에이전트)
- `project-metrics.js` — 비용/토큰 추적, 에이전트 기여도, 대시보드
- `github-manager.js` — gh CLI 래퍼 (저장소 생성, git init, push)
- `handler-helpers.js` — 핸들러 공통 유틸리티 (withProject)
- `template-scaffolder.js` — 프로젝트 템플릿 스캐폴딩 (5개 built-in + custom)
- `template-engine.js` — Handlebars 엔진
- `codebase-scanner.js` — 프로젝트 폴더 스캔 → 기술 스택/구조 파악 (LLM 호출 없음)
- `commit-message-builder.js` — conventional commit 메시지 생성 (pure, feat/fix/test/refactor/chore 자동 결정)
- `branch-manager.js` — feature branch 생성/관리 (timestamp/phase/custom 전략, graceful skip)
- `pr-manager.js` — Pull Request 생성/관리 (gh CLI 래퍼, graceful skip)
- `ci-generator.js` — GitHub Actions CI 워크플로우 자동 생성 (Node/Python/Go/Java)

**`engine/`** — 실행 엔진 (11개)
- `orchestrator.js` — 멀티에이전트 오케스트레이션 (4-tier 병렬 디스패치, 수렴 확인, 역할별 피드백 주입)
- `discussion-engine.js` — 토론 프롬프트 생성
- `execution-loop.js` — 실행 상태 머신 (시맨틱 검증, 저널, 부실 감지, 실패 복구, 기여도 자동 수집)
- `task-distributor.js` — 작업 분배 + 실행 계획 (리뷰 페이즈 자동 삽입, TDD, 코드 태스크 판별, 페이즈 컨텍스트 주입)
- `review-engine.js` — 크로스 리뷰 (도메인 매칭 리뷰어 선정, 2단계 품질 게이트, 수정 이력 기반 리비전 프롬프트)
- `cross-model-strategy.js` — 구현자와 다른 모델로 리뷰어 배정 (라운드로빈, fallback)
- `execution-verifier.js` — 다언어 빌드 검증 (Node/Python/Go/Java, /tmp 샌드박스, npm install --ignore-scripts)
- `code-materializer.js` — 마크다운에서 파일 추출 → 실제 기록 (path traversal 방지, dry-run 지원)
- `dispatch-plan-generator.js` — JSON 디스패치 계획 생성 (토론/실행 모두, 플레이스홀더 템플릿 계약)
- `eval-engine.js` — A/B 평가 프레임워크
- `acceptance-criteria.js` — 수락 기준 생성/파싱/검증 (기획서 기반 AC)

**`llm/`** — LLM/외부 연동 (3개)
- `llm-provider.js` — LLM 프로바이더 추상화 (Claude/OpenAI/Gemini)
- `gemini-bridge.js` — Gemini CLI 래퍼 (shell injection 방지)
- `auth-manager.js` — 멀티프로바이더 인증 (크레덴셜 CRUD)

**`agent/`** — 에이전트/팀 (8개)
- `team-builder.js` — 팀 추천/구성
- `complexity-analyzer.js` — 복잡도 분석 (모드/팀 규모/모델 추천)
- `recommendation-engine.js` — 스킬/에이전트 추천 (멀티시그널, 한국어 조사 제거, LLM 호출 없음)
- `agent-optimizer.js` — 에이전트 중복/효율 최적화 (bigram 유사도, 기여도 점수, 유니버셜 리뷰어 보호)
- `agent-feedback.js` — 프로젝트 결과 분석 → 에이전트 오버라이드 저장
- `agent-instruction-extractor.js` — 에이전트 인스트럭션 추출
- `setup-installer.js` — 스킬/에이전트 설치
- `dynamic-role-designer.js` — 프로젝트별 맞춤 역할 설계 (프롬프트/파서, dynamic: true)

**`output/`** — 보고/환경 (3개)
- `report-generator.js` — 보고서 생성
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
- `cli.js` — 라우터 (116개 커맨드, 14개 핸들러로 디스패치)
- `cli-utils.js` — readStdin, output, outputOk, parseArgs
- `handlers/*.js` — 14개 핸들러: project, team, discussion, execution, review, build, eval, auth, feedback, infra, metrics, template, task, recommendation

## 정책 상수 (`config.js`)

| 영역 | 상수 | 값 | 설명 |
|------|------|----|------|
| 수렴 | `convergence.threshold` | 0.8 | 80% 승인 시 기획서 확정 |
| 수렴 | `convergence.maxRounds` | 3 | 최대 토론 라운드 |
| 실행 | `execution.maxFixAttempts` | 2 | Phase당 수정 시도, 초과 시 CEO 에스컬레이션 |
| 실행 | `execution.maxAgentCalls` | 500 | 세션당 에이전트 호출 상한 (무한 루프 방지) |
| 리뷰 | `review.minReviewers` | 2 | 최소 리뷰어 수 |
| 리뷰 | `review.maxReviewers` | 3 | 최대 리뷰어 수 |
| 리뷰 | `review.maxRevisionRounds` | 2 | 리비전 최대 라운드 |
| 유사도 | `similarity.redundancyThreshold` | 0.7 | 에이전트 중복 감지 Jaccard 임계값 |
| 유사도 | `similarity.contributionThreshold` | 0.5 | 기여도 미달 시 제거 대상 |
| 빌드 | `build.defaultTimeout` | 30s | Node/Python 빌드 타임아웃 |
| 빌드 | `build.goTimeout` | 45s | Go 빌드 타임아웃 |
| 빌드 | `build.javaTimeout` | 60s | Java/Maven 빌드 타임아웃 |
| 팀 | `team.simple` | 2-3명 | quick-build |
| 팀 | `team.medium` | 3-5명 | plan-execute |
| 팀 | `team.complex` | 5-8명 | plan-only |
| 추천 | `recommendation.minScore` | 3 | 추천 노출 최소 점수 |
| LLM | `llm.defaultTimeout` | 60s | LLM 호출 타임아웃 |
| GitHub | `github.enabled` | false | GitHub 협업 기능 활성화 |
| GitHub | `github.branchStrategy` | timestamp | 브랜치 네이밍 전략 (timestamp/phase/custom) |
| GitHub | `github.baseBranch` | main | 베이스 브랜치 |
| GitHub | `github.autoPush` | true | 브랜치 자동 push |
| GitHub | `github.autoCreatePR` | true | 실행 완료 후 자동 PR 생성 |
| GitHub | `github.prDraft` | false | PR을 Draft로 생성 |

## 토론 플로우

```
Round N:
  [병렬] Tier 1 (priority 1-2) — CTO, PO, Market/Business Researcher (전략/요구사항)
  [병렬] Tier 2 (priority 3-4) — Fullstack, UI/UX, Frontend, Backend (구현 관점)
  [병렬] Tier 3 (priority 5-7) — QA, Security, DevOps, Data, Tech/Design Researcher (검증)
  [병렬] Tier 4 (priority 8+) — Tech Writer (보완)
  → 전체 결과 종합 (기획서)
  [병렬] 전 에이전트 리뷰 (critical 이슈만 블로커로 추출)
  → 80%+ 승인 시 수렴, 아니면 역할별 피드백 주입 후 다음 라운드 (최대 3회)
```

- **역할별 피드백 주입**: 비승인 에이전트의 피드백이 해당 역할 에이전트의 다음 라운드 프롬프트에 타겟 주입
- **블로커 추출**: `checkConvergence`가 critical 이슈만 블로커로 분류, important/minor는 무시

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
    → 2회 초과 → CEO 에스컬레이션 (continue/skip/abort)
  → commit-phase → build-context (이전 Phase 출력을 다음 Phase 프롬프트에 주입)
  → 메트릭 기록 (fire-and-forget, 실행 블로킹 없음)
  → interactive 모드면 confirm-next-phase, auto면 자동 진행
```

- **실행 모드**: `interactive` (Phase 간 CEO 확인) / `auto` (자동 진행)
- **부실 감지**: 마지막 저널 엔트리 또는 startedAt 기준 시간 초과 감지
- **시맨틱 상태 검증**: 6가지 규칙 (fixAttempt 상한, completedAt 필수, escalation 플래그, 중복 Phase 방지 등)
- **리뷰어 선정**: 도메인 오버랩 점수 + 유니버셜 리뷰어(qa/security/cto) +1 보너스
- **리비전 프롬프트**: critical + important 이슈만 포함, minor는 자동 제외

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

## Daily Improvement 자동화

VPS + Claude Code CLI로 매일 KST 자정에 코드베이스를 자동 분석 → Issue 생성 + 코드 수정 + PR 생성. CEO는 GitHub에서 merge만 결정.

```
매일 KST 00:00 (cron: 0 15 * * *)
  → git pull + npm ci
  → ESLint + 테스트 커버리지 + 최근 변경 파일 수집
  → Claude Code CLI가 코드 분석 (품질/보안/성능, CLAUDE.md 자동 참조)
  → 기존 이슈 중복 확인 → critical/important만 처리
  → gh issue create + 코드 수정 + PR 생성
  → lint + test 통과 확인, 실패 시 롤백
```

- **스크립트**: `scripts/daily-improvement.sh` (VPS cron 실행)
- **이슈 템플릿**: `.github/ISSUE_TEMPLATE/improvement.md`
- **수동 실행**: `bash scripts/daily-improvement.sh`
- **인증**: Claude Max Plan OAuth (별도 API key 불필요)

| 안전장치 | 설정 | 역할 |
|----------|------|------|
| `--max-turns 15` | claude -p | Claude 호출 횟수 제한 |
| `set -euo pipefail` | 스크립트 | 에러 시 즉시 중단 |
| `\|\| true` | Claude 호출 | Claude 실패해도 스크립트 정상 종료 |
| 중복 이슈 방지 | existing-issues.json | 열린 이슈 목록 전달 |
| 빈 PR 방지 | 프롬프트 지시 | 변경사항 없으면 PR 미생성 |
| 로그 자동 정리 | find -mtime +30 | 30일 이전 로그 자동 삭제 |

**개발 로드맵**: Phase 1(수동 실행) → Phase 2(프롬프트 튜닝) → Phase 3(cron 자동화) → Phase 4(피드백 루프)
**중단 기준**: 빈 결과 3회 연속, merge율 < 20%, 같은 이슈 3회+ 반복 중 2개 이상 해당 시

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

- **파일명 감지**: `` ```js src/app.js `` (fence) 또는 `// filename: src/app.js` (코멘트) 두 방식 지원
- **보안**: `npm install --ignore-scripts` (LLM 생성 코드의 postinstall 방지), `assertWithinRoot` (path traversal 차단)
- **dry-run 모드**: 파일 기록 없이 구체화 시뮬레이션 가능
- **결과 카운터**: totalBlocks, materializedCount, skippedCount, unmaterializableCount, failedCount, existsSkippedCount, dryRunCount

## 에이전트 최적화

- **중복 감지**: bigram Jaccard 유사도 > 0.7이면 중복 에이전트로 판정
- **기여도 점수**: `(critical×3 + uniqueIssues) / reviewCount` — 빈 승인 리뷰는 -0.5 패널티
- **유니버셜 리뷰어**: qa, security, cto는 중복 판정되어도 제거 불가 (기여도 낮으면 경고만)
- **팀 규모 최적화**: 기여도 최하위 비유니버셜 역할부터 제거

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

## 프로젝트 규칙

- import에 `.js` 확장자 필수 (Windows ESM 호환)
- `"type": "module"`
- 한국어 가이드/프롬프트, 코드/기술 용어는 영어
- 테스트: `npm test` (Vitest), 커버리지 목표 80%+
- 파일명: kebab-case
- 커밋: conventional commits (`feat|fix|refactor|docs|test|chore(scope): subject`)

## 개발 워크플로우

### 새 기능 추가 (커맨드/핸들러)

1. **커맨드 정의** — `commands/new-command.md` 작성 (에이전트 실행 지침)
2. **코어 로직** — `scripts/lib/{category}/new-module.js` 구현
3. **핸들러 등록** — `scripts/handlers/{handler}.js`에 `commands` 객체에 커맨드 추가
4. **COMMAND_MAP 등록** — `scripts/cli.js`의 `COMMAND_MAP`에 `'command-name': 'handler'` 추가
5. **테스트** — `tests/new-module.test.js` (unit) + `tests/handlers/{handler}.test.js` (E2E)

체크리스트:
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

const [,, , ...args] = process.argv;

export const commands = {
  'command-name': async () => {
    const data = await readStdin();          // stdin에서 JSON 파싱
    requireFields(data, ['field1', 'field2']); // 필수 필드 검증
    const result = await coreFunction(data);
    output(result);                          // JSON 출력
  },

  'another-command': async () => {
    const opts = parseArgs(args);            // --key value 파싱
    const item = await getItem(opts.id);
    if (!item) throw notFoundError(`항목을 찾을 수 없습니다: ${opts.id}`);
    outputOk({ id: opts.id });               // { success: true, id: ... }
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
throw inputError('필수 필드 누락');      // AppError { code: 'INPUT_ERROR' }
throw notFoundError('프로젝트 없음');     // AppError { code: 'NOT_FOUND' }
throw new AppError('내부 오류', 'SYSTEM_ERROR');  // 기본값

// cli.js 에러 코드 매핑
// INPUT_ERROR  → exit 2 ("입력 형식을 확인한 후 다시 시도하세요")
// NOT_FOUND    → exit 3 ("/projects 또는 /status로 목록을 확인하세요")
// SYSTEM_ERROR → exit 1 ("설정을 확인하거나 Claude Code를 다시 시작하세요")
// stderr 형식: "오류 [CODE]: message\n💡 hint\n"
```

## 테스트 컨벤션

### 파일 위치

| 대상 | 테스트 파일 | 타입 |
|------|------------|------|
| 코어 모듈 (`scripts/lib/**/*.js`) | `tests/{module-name}.test.js` | Unit |
| 핸들러 (`scripts/handlers/*.js`) | `tests/handlers/{handler-name}.test.js` | E2E |

### mock 패턴 (Unit)

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'fs/promises';
import { resolve } from 'path';

const TMP_DIR = resolve('.tmp-test-{module-name}');

beforeEach(async () => {
  await mkdir(TMP_DIR, { recursive: true });
  setBaseDir(TMP_DIR);  // 테스트용 디렉토리 격리
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
    })
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

| 데이터 | 경로 |
|--------|------|
| 프로젝트 | `~/.claude/good-vibe/projects/{id}/project.json` |
| 에이전트 오버라이드 (사용자) | `~/.claude/good-vibe/agent-overrides/{roleId}.md` |
| 에이전트 오버라이드 (프로젝트) | `{projectDir}/.good-vibe/agent-overrides/{roleId}.md` |
| 커스텀 템플릿 | `~/.claude/good-vibe/custom-templates/` (*.json) |
| Built-in 템플릿 | `presets/templates/` (next-app, express-api, cli-app, telegram-bot, npm-library) |
