---
description: 'v2 단일 진입점 — 자연어 한 줄로 의도를 분류하고 다음 액션을 안내합니다'
---

# /gv — v2 단일 진입점

자연어 한 줄을 받아 의도를 자동 분류하고, CEO가 따를 다음 액션을 제시합니다.

- **소요시간:** 즉시 (분류만)
- **결과물:** category(status/resume/modify/task) + 다음 액션 안내
- **다음 단계:** category에 따라 자동 제시되는 액션을 따르세요

## 사용 예시

```
/gv 이 PR 리뷰해줘 https://github.com/foo/bar/pull/123
/gv 결제 시스템 구현해줘
/gv BullMQ vs Temporal 비교해줘
/gv 이 코드베이스에서 인증은 어떻게 동작해?
/gv 마이크로서비스 SaaS 플랫폼 만들고 싶어
/gv 상태 보여줘
/gv 이전 작업 이어서 진행해줘
```

## 실행 흐름

### Step 1: 자연어 입력 수신

사용자 입력: `$ARGUMENTS`

### Step 2: dispatch 호출 (메인 세션이 결과만 받음 — Thin Controller 원칙)

다음 명령으로 `gv-dispatch` 핸들러를 호출하세요. 컨텍스트(현재 디렉토리에 git 저장소 존재 여부, 현재 활성 프로젝트 존재 여부)를 함께 전달하세요.

```bash
echo '{"input": "$ARGUMENTS", "hasGitRepo": <bool>, "hasProject": <bool>}' \
  | node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" gv-dispatch
```

`hasGitRepo`와 `hasProject`는 이미 세션 컨텍스트에 알고 있는 값을 그대로 전달하세요. 모를 경우 `false` 또는 생략하면 핸들러가 기본값으로 안전하게 처리합니다 (메인 세션이 추가 stat/CLI 호출로 직접 확인하지 마세요 — Thin Controller).

### Step 3: 결과 표시

`gv-dispatch` 응답:

```json
{
  "category": "status | resume | modify | task",
  "taskRoute": null | { "taskType": "code|plan|research|review|ask", "intent": "...", "confidence": 0.x },
  "nextActions": ["..."]
}
```

CEO에게:

1. **카테고리** + **분류 결과** (taskRoute가 있다면 taskType + intent)
2. **다음 액션** (`nextActions` 배열의 안내문)
3. **`escalateForConfirm: true`인 경우만** confidence와 warnings를 강조 표시 (모호 입력 안내)
4. (Phase B-3, B-4 머지 후) 적절한 후속 슬래시 자동 안내

### Step 4: 후속 안내 (현재는 안내까지만)

- `category === 'status'` → "/good-vibe:status" 안내
- `category === 'resume'` → "/good-vibe:execute" 안내
- `category === 'modify'` → "/good-vibe:modify" 안내 (또는 task로 downgrade)
- `category === 'task'` → 현재는 분류 결과만 표시.
  - **Phase B-4 머지 후**: 적절한 task graph(task-graph-presets) 실행으로 연결됨
  - **현재 단계**: CEO가 nextActions 안내를 보고 어떤 v1 슬래시를 쓸지 결정

## 메인 세션 원칙 (Thin Controller)

- 메인 세션은 `gv-dispatch` CLI 1회 호출 + 결과 표시만
- LLM 호출, 다단계 CLI 체인, 데이터 가공 금지
- 분류 결과를 CEO에게 그대로 전달, 다음 액션은 CEO가 결정
