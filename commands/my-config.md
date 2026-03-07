---
description: '현재 설정 확인 — 대시보드 형태로 조회'
---

# good-vibe:my-config - 현재 설정 확인

현재 Claude Code 설정 상태를 대시보드 형태로 보여줍니다.

## 실행 방법

사용자가 `good-vibe:my-config`를 입력하면 이 커맨드가 실행됩니다.

## 진행 절차

1. `~/.claude/` 디렉토리를 탐색합니다
2. 다음 항목을 확인합니다:
   - `CLAUDE.md` 존재 여부 및 설정된 역할
   - `rules/` 디렉토리의 규칙 파일들
   - `agents/` 디렉토리의 에이전트 목록
   - `skills/` 디렉토리의 스킬 목록
   - `commands/` 디렉토리의 커맨드 목록
   - 훅 설정 여부

3. 결과를 아래 형식으로 출력합니다:

```
┌─ 현재 설정 ──────────────────────────┐
│ 역할: {역할명}                         │
│ 업무: {선택한 업무들}                   │
│ Agents: {N}개  Skills: {N}개          │
│ Commands: {N}개  Hooks: {N}개         │
│                                       │
│ 설정 파일:                              │
│   ~/.claude/CLAUDE.md          [O]    │
│   ~/.claude/rules/core.md      [O]    │
│   ~/.claude/agents/            {상태}  │
│   ~/.claude/skills/            {상태}  │
└───────────────────────────────────────┘
```

4. 설정이 없으면 `good-vibe:hello` 실행을 안내합니다.

## 추가 옵션

- `good-vibe:my-config --detail`: 각 파일의 상세 내용 표시
- `good-vibe:my-config --json`: JSON 형식으로 출력
