---
description: 'task-graph 진입점 + 활성 프로젝트 mode 흐름 자동 분기 (plan-only 다라운드 토론 → approved)'
---

# /gv:execute — 작업 실행 진입점

두 가지 흐름을 자동 분기합니다.

1. **활성 프로젝트 mode 흐름** — `projectId` 전달 + `project.status === 'planning'`이면 mode-dispatcher가 모드별 흐름 실행 (현재 plan-only만 지원, plan-execute/quick-build는 후속 PR).
2. **task-graph standalone** — `projectId` 없거나 `status !== 'planning'`이면 기존 task-graph 흐름 (5개 task type: code/plan/research/review/ask).

**현재 동작:** ask/review/research, code(happy path + fix-loop + escalating), plan(다층 토론 + code 서브그래프 위임)이 모두 실제 LLM action으로 통합되어 있습니다. placeholder는 LLM 미연동 환경에서 fallback으로만 사용됩니다.

## 실행 흐름

### Case A: 활성 프로젝트 mode 흐름

활성 프로젝트가 `planning` 상태이고 mode가 `plan-only`이면:

```bash
echo '{"projectId": "...", "useLLM": true}' \
  | node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" gv-execute
```

흐름: 팀 미구성 시 자동 구성(5-8명) → 다라운드 토론(최대 3R, Tier 병렬) → 수렴 시 `planDocument` 저장 + `status: approved`. 미수렴 시 `finalState: maxRounds` 반환, status는 planning 유지.

응답:

```json
{
  "success": true,
  "finalState": "approved",
  "rounds": 1,
  "converged": true,
  "panel": "## ⚙️ /gv plan-only · approved\n..."
}
```

`useLLM=false` (기본)는 placeholder 모드 — LLM 호출 없이 즉시 수렴(테스트/CI용).

### Case B: task-graph standalone

`projectId` 없이 `taskRoute`만 전달:

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
2. **success / finalState** (mode 흐름은 `rounds` / `converged`도)
3. **reason** (실패 시 원인 표시)

추가 가공/LLM 호출 금지. CLI 1회 호출 외 작업하지 마세요.

## 참고

- mode 흐름의 후속 PR 범위:
  - `plan-execute` (CTO+PO 빠른 분석 → 자동 approved)
  - `quick-build` (토론 생략, 즉시 실행)
  - `approved → executing → completed` 자동 진행 (현재는 approved에서 멈춤)
- 5개 task-graph taskType은 실제 LLM action으로 동작 중. code-materializer 통합(실제 파일 쓰기 + 빌드 검증), 다중 라운드 토론, 실제 CEO 입력 escalating 통합은 후속 마이너에서 진행됩니다.
