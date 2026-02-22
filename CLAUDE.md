# Good Vibe Coding v3.0

Virtual AI Team Management Platform — AI 팀을 구성하고 프로젝트를 관리하세요

## 아키텍처
- **CEO 모드**: 사용자가 CEO로서 프로젝트 정의 → AI 팀원 토론 → 기획 → 실행 → 보고
- **두 가지 모드**: plan-only / plan-execute
- **11개 역할 × 22 페르소나 + 커스텀 확장**: CTO, PO, Full-stack, Frontend, Backend, QA, UI/UX, DevOps, Data, Security, Tech Writer
- **v2 호환**: 기존 온보딩 마법사 (`/onboarding`) 유지

## 기술 스택
- Node.js 18+ (ESM)
- Handlebars (템플릿 엔진)
- Vitest (테스트, 347개)

## 핵심 모듈
- `project-manager.js` — 프로젝트 CRUD + 상태 관리
- `team-builder.js` — 팀 추천/구성 (커스텀 페르소나 통합)
- `persona-manager.js` — 커스텀 페르소나 CRUD/Merge (원본 JSON 보존)
- `discussion-engine.js` — 팀 토론 프롬프트 생성
- `task-distributor.js` — 작업 분배 + 실행 계획
- `report-generator.js` — 보고서 생성
- `feedback-manager.js` — 피드백/성과
- `growth-manager.js` — 성장 시스템 (레벨/프롬프트 주입)
- `template-scaffolder.js` — 프로젝트 템플릿 스캐폴딩 (5개 built-in + custom)
- `cli.js` — CLI 브릿지 (커맨드 → 라이브러리)

## 프로젝트 규칙
- 모든 import에 `.js` 확장자 필수 (Windows ESM 호환)
- `"type": "module"` 사용
- 한국어 가이드/프롬프트, 코드/기술 용어는 영어
- 테스트: `npm test` (Vitest)
- 파일명: kebab-case
- 프로젝트 데이터: `~/.claude/good-vibe/projects/{id}/project.json`
- 피드백 데이터: `~/.claude/good-vibe/feedback.json`
- 커스텀 페르소나: `~/.claude/good-vibe/custom-personas/` (custom-roles.json, custom-personalities.json, overrides.json)
- 커스텀 템플릿: `~/.claude/good-vibe/custom-templates/` (*.json)
- Built-in 템플릿: `presets/templates/` (next-app, express-api, cli-app, telegram-bot, npm-library)
