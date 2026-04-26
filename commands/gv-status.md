---
description: '진행 중인 작업과 프로젝트 상태를 한눈에 표시 (v2 보조 슬래시)'
---

# /gv:status — 작업/프로젝트 상태 조회

진행 중이거나 최근 사용한 프로젝트의 상태(planning/approved/executing/reviewing/completed)와 현재 단계를 표시합니다.

- **소요시간:** 즉시
- **결과물:** 프로젝트 목록 + 활성 프로젝트의 현재 단계 + 다음 권장 액션

## 실행 흐름

### Step 1: 프로젝트 목록 조회 (Thin Controller — CLI 1회)

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" list-projects
```

### Step 2: 결과 표시

CEO에게 다음을 한 번에 표시:

1. **활성 프로젝트** (가장 최근 + 미완료)
   - 이름, 상태, 모드, 팀 규모, createdAt
2. **상태별 다음 권장 액션**
   - `planning` → `/gv 추가 토론 ...` 또는 `/gv 기획 승인` (자연어 진입)
   - `approved` → `/gv:execute`
   - `executing` / `reviewing` → `/gv:resume` (또는 `/gv 이전 작업 이어서`)
   - `completed` → `/gv 보고서 확인` / `/gv 피드백 분석` / `/gv 수정 요청 ...`
3. **전체 프로젝트 목록** (최대 10개, 최근순)

추가 작업/판단/LLM 호출 금지. 단일 CLI 결과를 그대로 가공 없이 표시.
