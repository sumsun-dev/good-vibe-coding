---
description: 'task-graph 기반 작업 실행 (Phase B-4a 골격, B-4b/c/d에서 실제 LLM 통합)'
---

# /gv:execute — 작업 그래프 실행

`/gv` 자연어 진입에서 분류된 task를 실제 그래프 진행으로 실행합니다.

**현재 단계 (Phase B-4a):** placeholder action으로 그래프가 happy path를 따라 진행되는 골격만 동작. 실제 LLM 호출은 후속 PR에서 추가.

## 실행 흐름

### Step 1: taskRoute 준비

`/gv` 슬래시 결과(`gv-dispatch` 응답의 `taskRoute`)를 그대로 사용. 또는 직접 taskType을 지정해서 실행.

### Step 2: gv-execute 호출 (Thin Controller)

```bash
echo '{"taskRoute": {"taskType": "ask", "intent": null, "sanitizedInput": "..."}}' \
  | node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" gv-execute
```

응답:

```json
{
  "success": true,
  "finalState": "done",
  "steps": 4,
  "reason": "정상 완료",
  "history": [...],
  "panel": "## ⚙️ /gv ask · done\n..."
}
```

### Step 3: 결과 표시

CEO에게:

1. **panel** (markdown 그대로 출력)
2. **success / finalState / steps**
3. **reason** (실패 시 원인 표시)

추가 가공/LLM 호출 금지. CLI 1회 호출 외 작업하지 마세요.

## 참고

- 후속 PR (Phase B-4b/c/d)에서 각 taskType별 실제 LLM action으로 교체됩니다.
- 현재는 그래프 진행만 검증 가능 (단위/통합 테스트로).
