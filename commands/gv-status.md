---
description: '진행 중인 작업과 프로젝트 상태를 한눈에 표시 (v2 보조 슬래시)'
---

# /gv:status — 작업/프로젝트 상태 조회

진행 중이거나 최근 사용한 프로젝트의 상태(planning/approved/executing/reviewing/completed)와 현재 단계를 표시합니다.

- **소요시간:** 즉시
- **결과물:** 프로젝트 목록 + 활성 프로젝트의 현재 단계 + 다음 권장 액션

## 실행 흐름

### Step 1: 프로젝트 목록 조회 (단순 CLI 1회)

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" list-projects
```

### Step 2: 활성 자가발전 candidate 조회 (단순 CLI 1회)

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" list-shadow-candidates
```

각 항목: `{ roleId, projectCount, projectIds, entryCount }`. `projectCount / 3` (기본 minProjects)으로 학습 진행률 표시.

### Step 3: 결과 표시

CEO에게 다음을 한 번에 표시:

1. **활성 프로젝트** (가장 최근 + 미완료)
   - 이름, 상태, 모드, 팀 규모, createdAt
2. **상태별 다음 권장 액션**
   - `planning` → `/gv 추가 토론 ...` 또는 `/gv 기획 승인` (자연어 진입)
   - `approved` → `/gv:execute`
   - `executing` / `reviewing` → `/gv:resume` (또는 `/gv 이전 작업 이어서`)
   - `completed` → `/gv 보고서 확인` / `/gv 피드백 분석` / `/gv 수정 요청 ...`
3. **전체 프로젝트 목록** (최대 10개, 최근순)
4. **자가발전 학습 진행** (활성 candidate가 있을 때만)
   - 각 역할별 `roleId · projectCount/3` 형식 (예: `cto · 2/3`)
   - 비어있으면 이 섹션 자체 생략
   - `evaluate-completion`이 다음 프로젝트 완료 시 자동으로 promote/discard 결정함을 안내

추가 작업/판단/LLM 호출 금지. 두 단순 조회 CLI 결과를 그대로 가공 없이 표시.
