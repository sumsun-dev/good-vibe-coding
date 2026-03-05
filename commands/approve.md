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

## Step 3: 승인 처리

승인 시:

```bash
echo '{"id":"{프로젝트ID}","status":"approved"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status
```

## Step 4: 작업 분배

작업 분배 프롬프트를 생성하고 실행하세요:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js task-distribution-prompt --id {프로젝트ID}
```

생성된 프롬프트를 실행하여 작업 목록을 만드세요.
작업 목록을 프로젝트에 저장하세요.

## Step 5: 결과 표시

작업 분배 결과를 표 형태로 보여주세요:

| 작업 | 담당 | Phase | 의존성 |
| ---- | ---- | ----- | ------ |

## Step 6: 다음 단계

프로젝트 모드에 따라 안내:

**plan-only 모드**:

```
기획과 작업 분배가 완료되었습니다!
- `good-vibe:execute` — 작업 실행 시작 (크로스 리뷰 포함)
- `good-vibe:report` — 기획 보고서만 먼저 확인
- `good-vibe:status` — 진행 상태 확인
```

**plan-execute 모드**:

```
작업이 분배되었습니다!
- `good-vibe:execute` — 작업 실행 시작 (크로스 리뷰 포함)
- `good-vibe:status` — 진행 상태 확인
```
