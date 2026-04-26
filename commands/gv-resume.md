---
description: '중단된 작업을 가장 최근 Phase부터 이어서 재개 (v2 보조 슬래시)'
---

# /gv:resume — 중단된 작업 재개

이전 실행이 Phase 중간에 중단됐다면 그 시점부터 이어서 진행합니다. file-lock + journal 기반으로 안전하게 재개됩니다.

- **소요시간:** 작업 분량에 따라 가변
- **결과물:** 이전 Phase 컨텍스트 유지하며 다음 Phase 진입

## 실행 흐름

### Step 1: 재개 가능한 프로젝트 식별

상태가 `executing` 또는 `reviewing`이면서 `completedAt`이 없는 가장 최근 프로젝트가 재개 대상입니다.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" list-projects
```

세션 컨텍스트에서 이미 활성 프로젝트 ID를 알고 있다면 그 값을 사용하세요.

### Step 2: 재개 안내

CEO에게:

1. **재개 대상**: 프로젝트 이름, 마지막 Phase, journal 마지막 이벤트 시각
2. **다음 액션**: `good-vibe:execute`를 실행하면 자동으로 이전 Phase부터 이어서 진행
3. **주의 사항**: 마지막 실행이 24시간 이상 지났다면 Stale 감지로 자동 재개가 거부될 수 있음. 이 경우 `good-vibe:execute --id <projectId>`로 수동 재개를 시도하세요

핸들러 1회 호출 외 추가 작업 금지.
