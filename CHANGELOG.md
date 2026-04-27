# Changelog

이 프로젝트의 모든 주요 변경 사항을 기록합니다.
형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따릅니다.

## [Unreleased]

## [2.0.0-rc.1] - 2026-04-27

> **메이저 버전 릴리즈 후보 1** — v2 Agentic Platform 첫 외부 노출. CEO 도그푸딩을 거쳐 정식 v2.0.0 승급 여부 결정.

### Added

- **AI-Native 단일 진입점**: `/gv "<자연어>"` — NL 라우터가 입력을 5개 작업 유형(`code` / `plan` / `research` / `review` / `ask`)으로 자동 분류 후 동적 그래프 실행
- **보조 슬래시 5개**: `/gv:status`, `/gv:execute`, `/gv:resume`, `/gv:team`, `/gv:cost`
- **task-graph 엔진**: 작업 유형별 동적 워크플로우 그래프 (state-machine DSL 기반). `code` 그래프는 fix-loop + escalating, `plan`은 다층 토론·서브그래프 위임, `ask/review/research`는 단일 그래프
- **claude-panel-renderer**: stdout markdown 라이브 렌더링 (헤더 깊이/이벤트 제한/위험 신호)
- **opt-in 비용 임계** (`/gv:cost`): 토큰/비용/예산 한도 설정·조회
- **3가지 실행 모드**: interactive / semi-auto (batchSize=3) / auto, `/gv:execute` 시작 시 선택
- **v1 영속 데이터 호환성 회귀 테스트** (`tests/v1-data-compat.test.js`, 12 케이스): `project.json`, `journal.jsonl`, agent-overrides(사용자/프로젝트), custom-templates, `auth.json` 모두 v1 fixture 그대로 v2 로더에서 정상 동작 확인

### Changed

- **BREAKING**: 슬래시 커맨드 체계를 단일 진입점으로 재설계
  - v1 슬래시 20개(`good-vibe:*`) 일괄 제거 (`#3216fba`)
  - v2: `/gv "..."` 자연어 단일 진입점 + 보조 슬래시 5개
  - NL 라우터가 의도를 5개 작업 유형(code/plan/research/review/ask)으로 자동 분류
  - 매핑 표: [커맨드 레퍼런스](guides/common/03-commands-reference.md), [고급 커맨드 마이그레이션](guides/common/12-advanced-commands.md)
- **BREAKING**: 플러그인 이름 `good-vibe-coding` → `good-vibe`로 변경
  - 기존 유저: `node scripts/migrate.js`로 자동 마이그레이션
- 모든 문서의 커맨드 참조를 v2 흐름(`/gv "..."`, `/gv:execute` 등)으로 통일
- 메인 세션 원칙(Thin Controller) 강화: CEO UI만 담당, 실제 작업은 모두 Task tool 위임

### Migration (v1 → v2)

- v1 슬래시 사용자: 자연어 `/gv "..."` 또는 보조 슬래시 5개로 옮겨오세요 ([매핑 표](guides/common/03-commands-reference.md))
- 영속 데이터(프로젝트/journal/agent-overrides/templates/auth)는 v1 그대로 v2에서 읽힙니다 (회귀 테스트로 검증)
- SDK API는 1 마이너 버전 deprecate 후 제거 예정

## [1.1.0] - 2026-03-05

### Added

- semi-auto 실행 모드: batchSize Phase마다 CEO 확인 (기본 3)
- CEO 피드백 주입: 에스컬레이션 시 ceoGuidance를 수정 프롬프트에 반영
- 크로스프로젝트 학습: 동일 역할의 이슈 패턴을 프로젝트 간 집계
- 에스컬레이션 가이드: continue/skip/abort 선택 시 상세 설명 제공
- 토론 진행률 포맷팅: 라운드별 진행 상태 표시
- 수락 기준(Acceptance Criteria) 생성/파싱/검증 모듈

### Changed

- 내부 커맨드 114개로 확장 (101개에서 증가)
- 코어 모듈 55개로 확장 (53개에서 증가)
- 테스트 1,850+개로 확장 (1,267+에서 증가)

### Fixed

- prettier 포맷 수정 및 커맨드 수 동기화
- 실전 예제, 문제해결 가이드 문서 동기화
- 에스컬레이션 가이드 UX 개선
- state-machine 시맨틱 검증 규칙 보강
- shellcheck SC1091 source 경로 추적 경고 제외

## [1.0.0] - 2026-03-03

### Added

- CLI-as-API 아키텍처: 114개 내부 커맨드, 14개 핸들러 모듈
- 20개 슬래시 커맨드 (`/hello`, `/new`, `/discuss`, `/approve`, `/execute`, `/report` 등)
- 15개 AI 팀원 역할 (CTO, PO, Full-stack, Frontend, Backend, QA 등)
- 3가지 프로젝트 모드: quick-build, plan-execute, plan-only
- 복잡도 자동 분석 및 모드/팀 추천
- 4-tier 병렬 토론 엔진 (수렴 확인, 역할별 피드백 주입)
- 실행 루프: Phase별 TDD, 코드 구체화, /tmp 빌드 검증
- 크로스 리뷰 엔진: 도메인 매칭 리뷰어, 2단계 품질 게이트
- 실패 복구: 카테고리 분류, 수정 프롬프트 주입, CEO 에스컬레이션
- SDK: `GoodVibe`, `Discusser`, `Executor`, `Storage` 클래스
- 멀티 LLM 지원: Claude, OpenAI, Gemini
- 크로스 모델 리뷰 전략 (구현자와 다른 모델로 리뷰)
- 에이전트 최적화: 중복 감지, 기여도 분석, 팀 규모 최적화
- 추천 엔진: 스킬/에이전트 멀티시그널 추천
- 5개 built-in 프로젝트 템플릿 (next-app, express-api, cli-app, telegram-bot, npm-library)
- 다언어 빌드 검증 (Node.js, Python, Go, Java)
- GitHub Actions CI (Node 18/20/22)
- 1,850+ Vitest 테스트
