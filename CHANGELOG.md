# Changelog

이 프로젝트의 모든 주요 변경 사항을 기록합니다.
형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따릅니다.

## [1.0.0] - 2026-03-03

### Added

- CLI-as-API 아키텍처: 101개 내부 커맨드, 14개 핸들러 모듈
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
- 1,267+ Vitest 테스트
