---
description: '한국어 학습 가이드 — 역할별 Claude Code 활용법'
---

# good-vibe:learn - 한국어 학습 가이드

역할에 맞는 Claude Code 활용법을 한국어로 안내합니다.

## 실행 방법

사용자가 `good-vibe:learn`을 입력하면 이 커맨드가 실행됩니다.
`good-vibe:learn [주제]`로 특정 주제를 학습할 수도 있습니다.

## 진행 절차

1. `~/.claude/CLAUDE.md`에서 현재 역할을 확인합니다
2. 역할이 없으면 공통 가이드를 보여줍니다

### 주제 없이 실행 시

역할별 학습 가이드 목차를 보여줍니다:

**공통 (모든 역할):**

```
Claude Code 학습 가이드

[공통 기초]
1. Claude Code란 무엇인가? (good-vibe:learn 기초)
2. 기본 사용법 (good-vibe:learn 사용법)
3. 커맨드와 스킬 활용하기 (good-vibe:learn 커맨드)
4. 에이전트 이해하기 (good-vibe:learn 에이전트)
5. 훅과 자동화 (good-vibe:learn 자동화)

[활용]
6. 연동 가이드 (good-vibe:learn 연동)
7. 실전 예제 (good-vibe:learn 예제)
8. 문제해결 (good-vibe:learn 문제해결)
9. SDK 사용법 (good-vibe:learn SDK)
10. 실행 모드 가이드 (good-vibe:learn 실행모드)
11. CEO 가이드 (good-vibe:learn CEO)
12. 퀵스타트 (good-vibe:learn 퀵스타트)
13. 커맨드 레퍼런스 (good-vibe:learn 레퍼런스)
14. 고급 커맨드 (good-vibe:learn 고급커맨드)
```

**개발자 추가:**

```
[개발자 심화]
13. TDD 워크플로우 실전 (good-vibe:learn TDD)
14. 코드 리뷰 자동화 (good-vibe:learn 코드리뷰)
```

**PM 추가:**

```
[PM/기획자 심화]
13. PRD 작성하기 (good-vibe:learn PRD)
14. 이슈 관리 자동화 (good-vibe:learn 이슈)
```

**디자이너 추가:**

```
[디자이너 심화]
13. 접근성 가이드 (good-vibe:learn 접근성)
14. 디자인 시스템 (good-vibe:learn 디자인시스템)
```

### 주제 지정 시

해당 가이드 파일(`guides/` 디렉토리)의 내용을 읽어서 대화형으로 안내합니다.

예: `good-vibe:learn 기초` → `guides/common/01-what-is-claude-code.md` 내용 기반 안내
예: `good-vibe:learn 사용법` → `guides/common/02-basic-usage.md` 내용 기반 안내
예: `good-vibe:learn TDD` → `guides/developer/tdd-workflow.md` 내용 기반 안내
예: `good-vibe:learn 레퍼런스` → `guides/common/03-commands-reference.md` 내용 기반 안내
예: `good-vibe:learn 고급커맨드` → `guides/common/12-advanced-commands.md` 내용 기반 안내
