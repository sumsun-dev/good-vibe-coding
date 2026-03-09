---
description: '기획서 승인 — 확인 후 승인/수정/재토론 선택'
---

# good-vibe:approve — 기획서 승인

## 이 커맨드를 실행하면?

팀이 작성한 기획서를 확인하고, 승인/수정/재토론을 선택할 수 있습니다.
승인하면 작업이 팀원들에게 자동으로 분배됩니다.

- **소요시간:** 1-2분
- **결과물:** 승인된 기획서 + 작업 분배 목록
- **다음 단계:** `good-vibe:execute` (작업 실행)

---

CEO(사용자)가 기획서를 승인하면 작업을 분배합니다.

## Step 1: 프로젝트 로드

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js list-projects
```

가장 최근 planning 상태의 프로젝트를 선택합니다.

## Step 2: 기획서 표시

프로젝트의 기획서(discussion.planDocument)를 표시하고 확인을 요청하세요.

### 수렴 이력 표시 (멀티에이전트 토론인 경우)

discussion.rounds가 있으면 수렴 이력을 함께 보여주세요:

```
토론 수렴 이력:
- 라운드 1: 승인율 60% (미수렴) — 3명 중 2명 반대
  주요 논점: [미합의 사항 요약]
- 라운드 2: 승인율 80% (수렴) — 5명 중 4명 승인
  해결된 논점: [이전 라운드에서 해결된 사항]
```

AskUserQuestion:

- "이 기획서를 승인하시겠습니까?"
- 옵션: "승인", "수정 요청", "재토론"

> **되돌리기:** 승인 후에도 실행 전이라면 `good-vibe:discuss --reset`으로 planning 상태로 되돌려 재토론할 수 있습니다.

## Step 3: 작업 분배 (Task tool)

승인 시, **모든 작업을 하나의 Task tool로 위임**합니다:

```
Task tool 프롬프트:
---
당신은 Good Vibe 프로젝트의 작업 분배 담당자입니다.

**컨텍스트:**
- CLAUDE_PLUGIN_ROOT: ${CLAUDE_PLUGIN_ROOT}
- 프로젝트 ID: {프로젝트ID}

**수행 작업:**
1. 상태를 approved로 업데이트:
   echo '{"id":"{프로젝트ID}","status":"approved"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status

2. 작업 분배 프롬프트 생성:
   node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js task-distribution-prompt --id {프로젝트ID}

3. 생성된 프롬프트를 실행하여 작업 목록 생성

4. 작업 목록을 프로젝트에 저장:
   echo '{"id":"{프로젝트ID}","tasks":[...]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js save-tasks

**반환 형식 (필수):**
반드시 다음 형식의 마크다운 테이블로 반환하세요 (최대 2000자):

| 작업 | 담당 | Phase | 의존성 |
| ---- | ---- | ----- | ------ |
| ... | ... | ... | ... |

테이블 위에 한 줄 요약을 포함하세요:
"총 N개 작업이 M명의 팀원에게 분배되었습니다."

**목적:**
CEO가 승인한 기획서를 실행 가능한 작업 단위로 분배하여 프로젝트를 approved 상태로 전환합니다.
---
```

Task tool 실행 결과를 CEO에게 그대로 표시합니다.

## Step 4: 수정 요청 / 재토론

사용자가 "수정 요청"을 선택한 경우:

- AskUserQuestion으로 수정 내용을 입력받아 discussion.feedback에 저장
- `good-vibe:discuss`를 안내 (다음 라운드에서 피드백 반영)

사용자가 "재토론"을 선택한 경우:

- `good-vibe:discuss --reset`을 안내 (discussion 초기화 후 재시작)

## Step 5: 다음 단계

프로젝트 모드에 따라 안내:

**plan-only 모드**:

```
기획과 작업 분배가 완료되었습니다!

다음 중 하나를 선택하세요:
- `good-vibe:execute` — 작업 실행 시작 (실행 모드: interactive/semi-auto/auto 선택)
- `good-vibe:report` — 기획 보고서만 먼저 확인 (실행 전 검토용)
- `good-vibe:status` — 현재 프로젝트 상태와 작업 분배 현황 확인

💡 처음이라면 good-vibe:execute → interactive 모드를 추천합니다.
   Phase별로 진행 상황을 확인하면서 실행할 수 있습니다.
```

**plan-execute 모드**:

```
작업이 분배되었습니다!

다음 중 하나를 선택하세요:
- `good-vibe:execute` — 작업 실행 시작 (실행 모드: interactive/semi-auto/auto 선택)
- `good-vibe:status` — 현재 프로젝트 상태와 작업 분배 현황 확인

💡 문제가 생기면 자동으로 수정하고, 2번 시도해도 안 되면 물어봅니다.
```
