# Good Vibe Coding v4.0

Virtual AI Team Management Platform — AI 팀을 구성하고 프로젝트를 관리하세요

## 아키텍처
- **CEO 모드**: 사용자가 CEO로서 프로젝트 정의 → AI 팀원 토론 → 기획 → 실행 → 보고
- **세 가지 모드**: plan-only / plan-execute / quick-build
- **멀티에이전트 오케스트레이션**: 각 역할을 독립 Task 에이전트로 병렬 디스패치, 결과 종합, 수렴까지 반복 (최대 3라운드)
- **크로스 리뷰 시스템**: 작업 실행 후 다른 역할 에이전트가 결과물 리뷰, 품질 게이트 체크
- **복잡도 기반 자동 모드 선택**: /new 커맨드로 프로젝트 복잡도 분석 → 적합한 모드 추천
- **15개 역할 × 30 페르소나 + 커스텀 확장**: CTO, PO, Full-stack, Frontend, Backend, QA, UI/UX, DevOps, Data, Security, Tech Writer, Market Researcher, Business Researcher, Tech Researcher, Design Researcher
- **v2 호환**: 기존 온보딩 마법사 (`/onboarding`) 유지

## 커맨드 우선순위 (초보자 안내 시 참조)

1. **필수 6개** (첫 프로젝트 완성에 필요한 핵심 플로우):
   `/hello` → `/new` → `/discuss` → `/approve` → `/execute` → `/report`
2. **보조 4개** (프로젝트 관리 보조):
   `/status`, `/feedback`, `/my-team`, `/learn`
3. **고급 11개** (커스터마이징, 수동 설정):
   `/new-project`, `/projects`, `/onboarding`, `/my-config`, `/add-skill`, `/add-agent`, `/persona`, `/edit-persona`, `/scaffold`, `/preset`, `/reset`

초보자가 첫 프로젝트를 시작할 때는 필수 6개만 안내합니다.
퀵스타트 가이드: `guides/common/00-quick-start.md`

## 기술 스택
- Node.js 18+ (ESM)
- Handlebars (템플릿 엔진)
- Vitest (테스트)

## 핵심 모듈
- `project-scaffolder.js` — 프로젝트 인프라 생성 (폴더, CLAUDE.md, README.md, 에이전트)
- `github-manager.js` — gh CLI 래퍼 (저장소 생성, git init, push)
- `project-manager.js` — 프로젝트 CRUD + 상태 관리 (reviewing 상태, 토론 라운드, 태스크 리뷰, 실행 진행률 포함)
- `team-builder.js` — 팀 추천/구성 (커스텀 페르소나 통합)
- `persona-manager.js` — 커스텀 페르소나 CRUD/Merge (원본 JSON 보존)
- `discussion-engine.js` — 팀 토론 프롬프트 생성 (단일 에이전트 프롬프트 추가)
- `task-distributor.js` — 작업 분배 + 실행 계획 (리뷰 페이즈 포함)
- `orchestrator.js` — **v4.0** 멀티에이전트 오케스트레이션 (tier별 병렬 디스패치, 수렴 확인)
- `review-engine.js` — **v4.0** 크로스 리뷰 시스템 (리뷰어 선정, 품질 게이트)
- `complexity-analyzer.js` — **v4.0** 프로젝트 복잡도 분석 (모드/팀 규모 추천)
- `report-generator.js` — 보고서 생성
- `agent-feedback.js` — 에이전트 피드백 시스템 (프로젝트 결과 분석 → 오버라이드 저장)
- `template-scaffolder.js` — 프로젝트 템플릿 스캐폴딩 (5개 built-in + custom)
- `cli.js` — CLI 브릿지 (커맨드 → 라이브러리, 79개 커맨드)

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

## 프로젝트 규칙
- 모든 import에 `.js` 확장자 필수 (Windows ESM 호환)
- `"type": "module"` 사용
- 한국어 가이드/프롬프트, 코드/기술 용어는 영어
- 테스트: `npm test` (Vitest)
- 파일명: kebab-case
- 프로젝트 데이터: `~/.claude/good-vibe/projects/{id}/project.json`
- 에이전트 오버라이드: `~/.claude/good-vibe/agent-overrides/{roleId}.md`
- 커스텀 페르소나: `~/.claude/good-vibe/custom-personas/` (custom-roles.json, custom-personalities.json, overrides.json)
- 커스텀 템플릿: `~/.claude/good-vibe/custom-templates/` (*.json)
- Built-in 템플릿: `presets/templates/` (next-app, express-api, cli-app, telegram-bot, npm-library)
