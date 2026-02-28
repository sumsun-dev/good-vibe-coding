# Good Vibe Coding v4.5

Virtual AI Team Management Platform — AI 팀을 구성하고 프로젝트를 관리하세요

## 핵심 설계: CLI-as-API 패턴
- `cli.js`는 **경량 라우터** — 13개 핸들러 모듈(`scripts/handlers/*.js`)로 커맨드를 lazy-load 디스패치
- 사용자는 `/hello`, `/new`, `/discuss` 등 **슬래시 커맨드**만 사용
- 슬래시 커맨드 → 에이전트 디스패치 → cli.js 라우터 → 핸들러 모듈 → Core Library 실행
- 에이전트 .md 파일이 cli.js를 `node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js <command>` 형태로 호출

## 아키텍처
- **CEO 모드**: 사용자가 CEO로서 프로젝트 정의 → AI 팀원 토론 → 기획 → 실행 → 보고
- **세 가지 모드**: plan-only / plan-execute / quick-build
- **멀티에이전트 오케스트레이션**: 각 역할을 독립 Task 에이전트로 병렬 디스패치, 결과 종합, 수렴까지 반복 (최대 3라운드)
- **크로스 리뷰 시스템**: 작업 실행 후 다른 역할 에이전트가 결과물 리뷰, 품질 게이트 체크
- **복잡도 기반 자동 모드 선택**: /new 커맨드로 프로젝트 복잡도 분석 → 적합한 모드 추천
- **모델 다양성**: 복잡도 기반 모델 자동 선택 (opus/sonnet/haiku — 역할 카테고리별 최적 배분)
- **관측성**: 비용/성능 추적 (토큰 사용량, 비용 브레이크다운, 에이전트 기여도)
- **팀 설정 공유**: 프로젝트 레벨 에이전트 오버라이드 (.good-vibe/ 디렉토리)
- **15개 역할 × 30 페르소나**: CTO, PO, Full-stack, Frontend, Backend, QA, UI/UX, DevOps, Data, Security, Tech Writer, Market Researcher, Business Researcher, Tech Researcher, Design Researcher
- **v2 호환**: 기존 온보딩 마법사 (`/onboarding`) 유지

## 커맨드 우선순위 (초보자 안내 시 참조)

1. **필수 6개** (첫 프로젝트 완성에 필요한 핵심 플로우):
   `/hello` → `/new` → `/discuss` → `/approve` → `/execute` → `/report`
2. **보조 4개** (프로젝트 관리 보조):
   `/status`, `/feedback`, `/my-team`, `/learn`
3. **고급 10개** (커스터마이징, 수동 설정, 평가):
   `/new-project`, `/projects`, `/onboarding`, `/my-config`, `/add-skill`, `/add-agent`, `/scaffold`, `/preset`, `/reset`, `/eval`

초보자가 첫 프로젝트를 시작할 때는 필수 6개만 안내합니다.
퀵스타트 가이드: `guides/common/00-quick-start.md`

## 커맨드 구분 가이드 (혼동 방지)
| 비교 | 차이 |
|------|------|
| `/new` vs `/new-project` | 자동(복잡도 분석 → 모드 추천) vs 수동(타입/모드 직접 선택) |
| `/hello` vs `/onboarding` | 프로젝트 인프라 셋업 vs 사용자 환경 설정(1회성) |
| `/status` vs `/projects` | 현재 프로젝트 대시보드 vs 전체 프로젝트 목록 |

## 기술 스택
- Node.js 18+ (ESM)
- Handlebars (템플릿 엔진)
- Vitest (테스트)
- GitHub Actions CI (Node 18/20/22 매트릭스)

## 핵심 모듈
- `project-scaffolder.js` — 프로젝트 인프라 생성 (폴더, CLAUDE.md, README.md, 에이전트)
- `github-manager.js` — gh CLI 래퍼 (저장소 생성, git init, push)
- `project-manager.js` — 프로젝트 CRUD + 상태 관리 (원자적 read-modify-write 잠금, AppError 표준화, reviewing 상태, 토론 라운드, 태스크 리뷰, 실행 진행률 포함)
- `team-builder.js` — 팀 추천/구성
- `discussion-engine.js` — 팀 토론 프롬프트 생성 (단일 에이전트 프롬프트 추가)
- `task-distributor.js` — 작업 분배 + 실행 계획 (리뷰 페이즈, TDD 프롬프트, 코드 태스크 판별 포함)
- `code-materializer.js` — **v4.1** 코드 구체화 (마크다운 → 실제 파일 기록, path traversal 방지)
- `execution-verifier.js` — **v4.1** 실행 검증 + 구체화 (다언어 빌드 검증: Node/Python/Go/Java → 프로젝트 기록 통합)
- `orchestrator.js` — **v4.0** 멀티에이전트 오케스트레이션 (tier별 병렬 디스패치, 수렴 확인)
- `review-engine.js` — **v4.0** 크로스 리뷰 시스템 (리뷰어 선정, 품질 게이트)
- `complexity-analyzer.js` — **v4.0** 프로젝트 복잡도 분석 (모드/팀 규모/모델 티어 추천)
- `report-generator.js` — 보고서 생성
- `agent-feedback.js` — 에이전트 피드백 시스템 (프로젝트 결과 분석 → 사용자/프로젝트 레벨 오버라이드 저장)
- `project-metrics.js` — **v4.3** 관측성 (비용/토큰 추적, 에이전트 기여도, 대시보드)
- `template-scaffolder.js` — 프로젝트 템플릿 스캐폴딩 (5개 built-in + custom)
- `json-parser.js` — **v4.2** 3-tier LLM JSON 응답 파싱 유틸리티
- `domain-parsers.js` — **v4.5** 도메인별 JSON 응답 파서 + 스키마 검증 (리뷰, 복잡도, 태스크, 제안)
- `dispatch-plan-generator.js` — **v4.2** 구조화된 JSON 디스패치 계획 생성
- `validators.js` — **v4.5** 공통 입력 검증 유틸리티 + AppError 클래스 (inputError/notFoundError/systemError)
- `config.js` — **v4.5** 중앙 설정 모듈 (Object.freeze, 매직 넘버 제거)
- `schema-validator.js` — **v4.5** 경량 스키마 검증 (validate/coerce, 외부 의존성 0)
- `execution-loop.js` — **v4.5** 실행 상태 머신 (시맨틱 검증, 저널 기록, 부실 실행 감지)
- `app-paths.js` — **v4.4** 애플리케이션 경로 중앙 관리
- `prompt-builder.js` — **v4.4** 프롬프트 구성 유틸리티 (섹션 조합, 목록 변환)
- `cache.js` — **v4.4** 지연 로딩 캐시 유틸리티
- `cli.js` — **v4.5** CLI 라우터 (13개 핸들러 모듈로 lazy-load 디스패치)
- `cli-utils.js` — **v4.5** CLI 유틸리티 (readStdin, output, outputOk, parseArgs)
- `handlers/*.js` — **v4.5** 13개 커맨드 핸들러 모듈 (project, team, discussion, execution, review, build, eval, auth, feedback, infra, metrics, template, task)

## 멀티에이전트 토론 플로우 (v4.0)
```
Round N:
  [병렬] Tier 1 에이전트 독립 분석 (CTO, PO, Researchers)
  [병렬] Tier 2 에이전트 분석 (Tier 1 결과 포함)
  [병렬] Tier 3-4 에이전트 분석
  → 전체 분석 결과 종합 (기획서)
  [병렬] 전체 에이전트 리뷰
  → 80% 이상 승인 시 수렴, 미수렴 시 다음 라운드 (최대 3회)
```

## 크로스 리뷰 플로우 (v4.0)
```
Phase N 태스크 실행 (병렬)
  → 리뷰어 자동 선정 (최소 2명)
  → 리뷰 (병렬)
  → Quality Gate (critical 0개)
  → 실패 시 수정 루프 (최대 2회)
  → 2회 초과 시 CEO 에스컬레이션
```

## Generation → Execution 파이프라인 (v4.1)
```
태스크 실행 → isCodeTask 판별
  → [코드 태스크] TDD 프롬프트 (RED → GREEN → REFACTOR)
  → 에이전트 실행 → 마크다운 출력
  → extractMaterializableBlocks (파일명 있는 블록 추출)
  → verifyAndMaterialize (/tmp 빌드 검증 → 성공 시 프로젝트에 기록)
  → 강화 품질 게이트 (리뷰 + 실행 검증 통합)
  → commitPhase (Phase별 git commit)
```

## v4.5 변경사항
- **동시성 버그 수정**: `withProjectLock()` — 원자적 read-modify-write로 12개 mutator 함수 보호
- **에러 표준화**: `AppError` (inputError/notFoundError) 일관 사용, EACCES/JSON 파싱 에러 전파
- **중앙 설정**: `config.js` — 9개 모듈의 매직 넘버를 Object.freeze 설정으로 통합
- **스키마 검증**: `schema-validator.js` — LLM 응답 구조 검증 (외부 의존성 0)
- **실행 상태 복구**: 시맨틱 검증 강화, 저널 기록, 부실 실행 감지 (`isStaleExecution`)
- **CLI 라우터**: 826줄 모놀리스 → 경량 라우터 + 13개 핸들러 모듈
- **CI/CD**: GitHub Actions (Node 18/20/22 매트릭스, 테스트 + 커버리지)

## 프로젝트 규칙
- 모든 import에 `.js` 확장자 필수 (Windows ESM 호환)
- `"type": "module"` 사용
- 한국어 가이드/프롬프트, 코드/기술 용어는 영어
- 테스트: `npm test` (Vitest)
- 파일명: kebab-case
- 프로젝트 데이터: `~/.claude/good-vibe/projects/{id}/project.json`
- 에이전트 오버라이드 (사용자): `~/.claude/good-vibe/agent-overrides/{roleId}.md`
- 에이전트 오버라이드 (프로젝트): `{projectDir}/.good-vibe/agent-overrides/{roleId}.md`
- 커스텀 템플릿: `~/.claude/good-vibe/custom-templates/` (*.json)
- Built-in 템플릿: `presets/templates/` (next-app, express-api, cli-app, telegram-bot, npm-library)
