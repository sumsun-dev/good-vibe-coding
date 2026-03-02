# Good Vibe Coding

AI 팀을 만들고, 프로젝트를 함께 굴리는 플랫폼.

## 설계: CLI-as-API + SDK

- `cli.js`는 경량 라우터. 101개 커맨드를 14개 핸들러 모듈(`scripts/handlers/*.js`)로 lazy-load 디스패치
- 사용자는 `/hello`, `/new`, `/discuss` 같은 슬래시 커맨드만 씀
- 흐름: 슬래시 커맨드 → 에이전트 디스패치 → cli.js → 핸들러 → 코어 라이브러리
- 에이전트 .md 파일이 `node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js <command>` 형태로 호출
- **SDK** (`src/`): 동일한 코어 모듈을 프로그래밍 API로 노출. `import { GoodVibe } from 'good-vibe-coding'`

## 아키텍처

- **CEO 모드**: 사용자가 CEO로 프로젝트를 정의하면, AI 팀이 토론 → 기획 → 실행 → 보고
- **세 가지 모드**: plan-only / plan-execute / quick-build
- **멀티에이전트 오케스트레이션**: 역할별 독립 Task 에이전트로 병렬 디스패치, 결과 종합, 수렴까지 반복 (최대 3라운드)
- **크로스 리뷰**: 작업 후 다른 역할 에이전트가 리뷰하고 품질 게이트 체크
- **실패 복구**: 품질 게이트 실패 시 7개 카테고리 분류 → 이력 추적 → 수정 프롬프트에 이전 시도 주입 → CEO 에스컬레이션
- **CLI 계약**: `command-schemas.js` — 에이전트가 커맨드 입출력 스키마를 조회 가능
- **복잡도 기반 모드 선택**: /new에서 버전 체크 → 복잡도 분석 → 모드/팀 규모/모델 자동 추천
- **환경 헬스체크**: check-environment로 필수(node/npm/git)/선택(gh/gemini) 도구 통합 확인
- **모델 다양성**: opus/sonnet/haiku — 역할 카테고리별 자동 배분
- **관측성**: 비용/토큰 추적, 에이전트 기여도 자동 수집, 대시보드
- **팀 설정 공유**: 프로젝트 레벨 에이전트 오버라이드 (.good-vibe/ 디렉토리)
- **15개 역할 x 30 페르소나**: CTO, PO, Full-stack, Frontend, Backend, QA, UI/UX, DevOps, Data, Security, Tech Writer, Market/Business/Tech/Design Researcher
- **스킬/에이전트 추천**: /new에서 프로젝트 컨텍스트 기반 추천 → 설치

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

## 기술 스택

- Node.js 18+ (ESM)
- Handlebars 템플릿 엔진
- Vitest 테스트
- GitHub Actions CI (Node 18/20/22)

## 코어 모듈

**프로젝트 관리**
- `project-manager.js` — CRUD + 상태 관리 (원자적 잠금, AppError, 기여도 기록)
- `project-scaffolder.js` — 프로젝트 인프라 생성 (폴더, CLAUDE.md, README.md, 에이전트)
- `github-manager.js` — gh CLI 래퍼 (저장소 생성, git init, push)
- `project-metrics.js` — 비용/토큰 추적, 에이전트 기여도, 대시보드

**팀 구성**
- `team-builder.js` — 팀 추천/구성
- `complexity-analyzer.js` — 복잡도 분석 (모드/팀 규모/모델 추천)
- `recommendation-engine.js` — 스킬/에이전트 추천 (멀티시그널, LLM 호출 없음)

**토론**
- `discussion-engine.js` — 토론 프롬프트 생성
- `orchestrator.js` — 멀티에이전트 오케스트레이션 (tier별 병렬 디스패치, 수렴 확인)

**실행**
- `execution-loop.js` — 실행 상태 머신 (시맨틱 검증, 저널, 부실 감지, 실패 복구 — 7개 카테고리/이력 추적/에스컬레이션, 기여도 자동 수집)
- `task-distributor.js` — 작업 분배 + 실행 계획 (리뷰 페이즈, TDD, 코드 태스크 판별)
- `code-materializer.js` — 마크다운에서 파일 추출 → 실제 기록 (path traversal 방지)
- `execution-verifier.js` — 다언어 빌드 검증 (Node/Python/Go/Java)

**리뷰**
- `review-engine.js` — 크로스 리뷰 (리뷰어 선정, 품질 게이트, 수정 이력 기반 리비전 프롬프트)
- `cross-model-strategy.js` — 구현자와 다른 모델로 리뷰어 배정
- `agent-optimizer.js` — 에이전트 중복/효율 최적화 (유사도, 기여도 추적, 최적 팀 추천)

**피드백/보고**
- `agent-feedback.js` — 프로젝트 결과 분석 → 에이전트 오버라이드 저장
- `report-generator.js` — 보고서 생성

**프롬프트/파싱**
- `prompt-builder.js` — 프롬프트 조합 유틸리티
- `json-parser.js` — 3-tier LLM JSON 응답 파싱
- `domain-parsers.js` — 도메인별 파서 + 스키마 검증 (리뷰, 복잡도, 태스크, 제안)
- `dispatch-plan-generator.js` — JSON 디스패치 계획 생성

**인프라/유틸**
- `validators.js` — 입력 검증 + AppError (inputError/notFoundError/systemError)
- `config.js` — 중앙 설정 (Object.freeze)
- `schema-validator.js` — 경량 스키마 검증 (외부 의존성 0)
- `command-schemas.js` — 커맨드 스키마 레지스트리 (에이전트용 입출력 조회)
- `app-paths.js` — 경로 중앙 관리 (SDK용 configure() 지원)
- `handler-helpers.js` — 핸들러 공통 유틸리티 (withProject)
- `file-writer.js` — 파일 시스템 유틸리티
- `cache.js` — 지연 로딩 캐시
- `preset-loader.js` — 프리셋 JSON 로딩
- `update-checker.js` — 버전 확인 + 업데이트 가능 여부 (git fetch --dry-run + HEAD 비교)
- `env-checker.js` — 통합 환경 헬스체크 (node/npm/git 필수, gh/gemini 선택)

**템플릿**
- `template-scaffolder.js` — 프로젝트 템플릿 스캐폴딩 (5개 built-in + custom)
- `template-engine.js` — Handlebars 엔진

**외부 연동**
- `auth-manager.js` — 멀티프로바이더 인증 (크레덴셜 CRUD)
- `llm-provider.js` — LLM 프로바이더 추상화 (Claude/OpenAI/Gemini)
- `gemini-bridge.js` — Gemini CLI 래퍼 (shell injection 방지)

**평가**
- `eval-engine.js` — A/B 평가 프레임워크

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
- `cli.js` — 라우터 (101개 커맨드, 14개 핸들러로 디스패치)
- `cli-utils.js` — readStdin, output, outputOk, parseArgs
- `handlers/*.js` — 14개 핸들러: project, team, discussion, execution, review, build, eval, auth, feedback, infra, metrics, template, task, recommendation

## 토론 플로우

```
Round N:
  [병렬] Tier 1 — CTO, PO, Researchers (독립 분석)
  [병렬] Tier 2 — Tier 1 결과 포함
  [병렬] Tier 3-4 — 누적 결과 포함
  → 전체 결과 종합 (기획서)
  [병렬] 전 에이전트 리뷰
  → 80%+ 승인 시 수렴, 아니면 다음 라운드 (최대 3회)
```

## 실행 + 리뷰 + 실패 복구 플로우

```
Phase N:
  execute-tasks (병렬)
  → materialize (코드 태스크만, /tmp 빌드 검증)
  → review (최소 2명, 도메인 매칭) → 기여도 수집
  → quality-gate (critical 0개)
  → 실패 시:
      카테고리 분류 (security/build/test/performance/type/architecture/logic)
    → failureContext 저장 (이슈 + 카테고리 + 이전 시도)
    → 수정 프롬프트에 이전 시도 주입
    → fix (최대 2회)
    → 2회 초과 → CEO 에스컬레이션 (continue/skip/abort)
  → commit-phase → build-context → 메트릭 기록
  → 다음 Phase
```

## 코드 구체화 파이프라인

```
태스크 실행 → isCodeTask?
  → [코드] TDD 프롬프트 (RED → GREEN → REFACTOR)
  → 에이전트 실행 → 마크다운 출력
  → extractMaterializableBlocks
  → verifyAndMaterialize (/tmp 빌드 검증 → 프로젝트 기록)
  → 강화 품질 게이트 (리뷰 + 실행 검증 통합)
  → commitPhase
```

## 프로젝트 규칙

- import에 `.js` 확장자 필수 (Windows ESM 호환)
- `"type": "module"`
- 한국어 가이드/프롬프트, 코드/기술 용어는 영어
- 테스트: `npm test` (Vitest)
- 파일명: kebab-case
- 프로젝트 데이터: `~/.claude/good-vibe/projects/{id}/project.json`
- 에이전트 오버라이드 (사용자): `~/.claude/good-vibe/agent-overrides/{roleId}.md`
- 에이전트 오버라이드 (프로젝트): `{projectDir}/.good-vibe/agent-overrides/{roleId}.md`
- 커스텀 템플릿: `~/.claude/good-vibe/custom-templates/` (*.json)
- Built-in 템플릿: `presets/templates/` (next-app, express-api, cli-app, telegram-bot, npm-library)
