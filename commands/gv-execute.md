---
description: 'task-graph 기반 작업 실행 — 5개 작업 유형(code/plan/research/review/ask) 동적 그래프 진입점'
---

# /gv:execute — 작업 그래프 실행

`/gv` 자연어 진입에서 분류된 task를 실제 그래프 진행으로 실행합니다.

**현재 동작:** ask/review/research, code(happy path + fix-loop + escalating), plan(다층 토론 + code 서브그래프 위임)이 모두 실제 LLM action으로 통합되어 있습니다. placeholder는 LLM 미연동 환경에서 fallback으로만 사용됩니다.

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

- 5개 taskType 모두 실제 LLM action으로 동작 중. code-materializer 통합(실제 파일 쓰기 + 빌드 검증), 다중 라운드 토론, 실제 CEO 입력 escalating 통합은 후속 마이너에서 진행됩니다.
