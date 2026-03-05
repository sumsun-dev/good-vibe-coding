# Changelog

이 프로젝트의 모든 주요 변경 사항을 기록합니다.
형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따릅니다.

## [Unreleased]

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
