---
description: '프로젝트 목록 — 전체 프로젝트 조회'
---

# good-vibe:projects — 프로젝트 목록

전체 프로젝트 목록을 보여줍니다.

## Step 1: 프로젝트 조회

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js list-projects
```

## Step 2: 목록 표시

프로젝트가 있으면 표 형태로 보여주세요:

```
프로젝트 목록
━━━━━━━━━━━━━━━━

| # | 프로젝트 | 타입 | 상태 | 팀원 | 작업 | 생성일 |
|---|---------|------|------|------|------|--------|
| 1 | {name}  | {type} | {status} | {N}명 | {N}개 | {date} |
```

프로젝트가 없으면:

```
아직 프로젝트가 없습니다.
`good-vibe:new`로 첫 프로젝트를 시작하세요! (수동 설정: `good-vibe:new-project`)
```

## Step 3: 프로젝트 선택

프로젝트가 있으면 AskUserQuestion으로:

- "프로젝트를 선택하세요"
- 선택 후 `good-vibe:status` 정보를 표시
