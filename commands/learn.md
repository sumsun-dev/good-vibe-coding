# /learn - 한국어 학습 가이드

역할에 맞는 Claude Code 활용법을 한국어로 안내합니다.

## 실행 방법
사용자가 `/learn`을 입력하면 이 커맨드가 실행됩니다.
`/learn [주제]`로 특정 주제를 학습할 수도 있습니다.

## 진행 절차

1. `~/.claude/CLAUDE.md`에서 현재 역할을 확인합니다
2. 역할이 없으면 공통 가이드를 보여줍니다

### 주제 없이 실행 시
역할별 학습 가이드 목차를 보여줍니다:

**공통 (모든 역할):**
```
📚 Claude Code 학습 가이드

[공통 기초]
1. Claude Code란 무엇인가? (/learn 기초)
2. 기본 사용법 (/learn 사용법)
3. 커맨드와 스킬 활용하기
4. 에이전트 이해하기
5. 훅과 자동화
```

**개발자 추가:**
```
[개발자 심화]
6. TDD 워크플로우 실전
7. 코드 리뷰 자동화
8. MCP 서버 연동
```

**PM 추가:**
```
[PM/기획자 심화]
6. Claude Code로 기획서 작성하기
7. 이슈 관리 자동화
8. 데이터 정리와 리포트 생성
```

### 주제 지정 시
해당 가이드 파일(`guides/` 디렉토리)의 내용을 읽어서 대화형으로 안내합니다.

예: `/learn 기초` → `guides/common/01-what-is-claude-code.md` 내용 기반 안내
예: `/learn 사용법` → `guides/common/02-basic-usage.md` 내용 기반 안내
예: `/learn TDD` → `guides/developer/tdd-workflow.md` 내용 기반 안내
