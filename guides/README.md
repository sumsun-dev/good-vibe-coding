# Good Vibe Coding 가이드

Good Vibe Coding의 사용법을 단계별로 안내하는 가이드 모음입니다.

**어디서부터 시작하세요?**

- 처음 쓴다면 → [퀵스타트](common/00-quick-start.md)부터 시작하세요
- Claude Code가 뭔지 모른다면 → [Claude Code란?](common/01-what-is-claude-code.md)을 먼저 읽어보세요
- 이미 써봤고 특정 주제가 궁금하다면 → 아래 레벨별 가이드에서 찾아보세요

---

## 초보자: 첫 프로젝트 만들기

처음이라면 이 순서대로 읽으세요.

| 순서 | 가이드                                             | 설명                                                               |
| ---- | -------------------------------------------------- | ------------------------------------------------------------------ |
| 1    | [Claude Code란?](common/01-what-is-claude-code.md) | Claude Code의 핵심 개념 5가지 — AI 에디터가 뭔지부터 이해          |
| 2    | [기본 사용법](common/02-basic-usage.md)            | 대화하는 법, 요청 패턴, 역할별 활용 — Claude Code 사용이 처음일 때 |
| 3    | [퀵스타트](common/00-quick-start.md)               | 6단계로 프로젝트 끝내기 — 실제 커맨드와 출력 예시 포함             |

## 중급자: 커맨드와 워크플로우

기본 흐름을 알겠고, 더 효율적으로 쓰고 싶을 때.

| 가이드                                             | 설명                                                                        |
| -------------------------------------------------- | --------------------------------------------------------------------------- |
| [커맨드와 스킬](common/03-commands-and-skills.md)  | 20개 커맨드 + 4개 스킬 — 어떤 커맨드가 있고 언제 쓰는지                     |
| [커맨드 레퍼런스](common/03-commands-reference.md) | 모드 비교, 실행 모드, 에스컬레이션 — 각 커맨드의 상세 동작과 옵션           |
| [에이전트](common/04-agents.md)                    | 8개 서포트 에이전트, 모델 선택 기준 — 팀원 역할과 커스터마이징              |
| [실전 예제](common/07-examples.md)                 | 3가지 모드별 프로젝트 흐름 — quick-build, plan-execute, plan-only 실제 진행 |
| [문제해결](common/08-troubleshooting.md)           | 자주 만나는 상황과 해결 방법 — 에러 대응, 세션 복구                         |

## 고급자: 자동화와 확장

워크플로우를 자동화하거나, SDK로 직접 제어하고 싶을 때.

| 가이드                                           | 설명                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------ |
| [훅과 자동화](common/05-hooks-and-automation.md) | 자동 포맷팅, 린트, 커밋 검사 — Git hook과 CI 연동                        |
| [외부 서비스 연동](common/06-integrations.md)    | GitHub, Supabase, Vercel, n8n — 외부 도구와 연결                         |
| [SDK 사용 가이드](common/09-sdk-usage.md)        | 코드로 직접 호출하기 — GoodVibe 클래스, Storage, 에러 처리               |
| [실행 모드 가이드](common/10-execution-modes.md) | interactive/semi-auto/auto 상세 — Phase 제어와 에스컬레이션 커스터마이징 |
| [CEO 가이드](common/11-ceo-guide.md)             | CEO 역할 심화 — 승인 기준, 피드백 전략, 팀 최적화                        |

## 역할별 가이드

특정 역할에 집중해서 쓰고 싶을 때.

| 역할      | 가이드                                                                             |
| --------- | ---------------------------------------------------------------------------------- |
| 개발자    | [TDD 워크플로우](developer/tdd-workflow.md), [코드 리뷰](developer/code-review.md) |
| PM/기획자 | [PRD 작성](pm/prd-writing.md), [이슈 관리](pm/issue-management.md)                 |
| 디자이너  | [디자인 시스템](designer/design-system.md), [접근성](designer/accessibility.md)    |
| 리서처    | [리서치 워크플로우](researcher/00-research-workflow.md)                            |
| 콘텐츠    | [콘텐츠 워크플로우](content/00-content-workflow.md)                                |
