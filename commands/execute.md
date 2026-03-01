# /execute — 작업 실행 (상태 머신 기반 자동 루프)

## 이 커맨드를 실행하면?

팀원들이 분배된 작업을 실행하고, 다른 팀원이 결과물을 리뷰합니다.
문제가 발견되면 자동으로 수정하고, 해결이 안 되면 CEO(당신)에게 보고합니다.

- **소요시간:** 5-15분 (작업량에 따라)
- **결과물:** 완성된 작업 결과 (리뷰 통과)
- **다음 단계:** `/report` (보고서 생성)

---

## Step 1: 실행 초기화

### 1.1 프로젝트 선택

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js list-projects
```

approved 상태인 프로젝트를 선택합니다.

### 1.2 실행 모드 선택

```
질문: "실행 모드를 선택하세요"
header: "모드"
options:
  - label: "인터랙티브 (Recommended)"
    description: "각 Phase 완료 후 진행 여부를 확인합니다"
  - label: "자동 실행"
    description: "에스컬레이션이 필요한 경우에만 중단합니다"
```

**언제 어떤 모드를 선택할까요?**
- **인터랙티브** — 처음 사용하거나, 중간 결과를 검토하고 싶을 때. Phase 단위로 확인하며 진행합니다.
- **자동 실행** — 기획이 충분히 검토된 상태에서, 빠르게 전체 실행하고 싶을 때. 문제 발생 시에만 중단합니다.

### 1.3 실행 시작

```bash
echo '{"id":"{ID}","mode":"interactive"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js init-execution
```

중단된 실행이 있으면 재개 여부를 AskUserQuestion으로 확인 후:

```bash
echo '{"id":"{ID}","mode":"interactive","resume":true}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js init-execution
```

### 1.4 상태 변경 + 실행 계획 표시

```bash
echo '{"id":"{프로젝트ID}","status":"executing"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status
```

프로젝트의 tasks를 phase별로 그룹핑하고 리뷰 단계를 포함하여 보여주세요:

```bash
echo '{"tasks": [...], "team": [...]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js execution-plan-with-reviews
```

---

## Step 2: 실행 루프

다음을 action이 `complete` 또는 `already-completed`가 될 때까지 반복:

### 2.1 다음 단계 조회

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js next-step --id {ID}
```

### 2.2 반환된 action 수행

#### `execute-tasks` — 태스크 실행 (Task tool 병렬)

같은 phase의 작업을 Task tool로 **병렬** 실행합니다.

1. 해당 팀원의 에이전트를 Task 도구로 호출
2. 작업 내용과 팀원 페르소나를 전달
3. **Phase 2+인 경우**: 이전 Phase의 phaseContext와 planExcerpt를 context에 포함
4. 결과를 수집

```
{emoji} {이름}이(가) "{작업제목}" 작업을 수행 중입니다...
```

#### `materialize` — 코드 Materialization (코드 태스크만)

```bash
echo '{"task": {...}}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js is-code-task
```

코드 태스크인 경우:

```bash
echo '{"taskOutput": "...", "task": {...}, "projectDir": "/path/to/project"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js verify-and-materialize
```

- **검증 성공** (`verified: true`) → 파일이 프로젝트에 기록됨
- **검증 실패** (`verified: false`) → tempDir 보존, 수정 루프 진행
- **검증 불가** (`verified: null`) → Materialization 건너뛰기

#### `review` — 크로스 리뷰

1. 리뷰어 선정:
```bash
echo '{"task": {...}, "team": [...]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js select-reviewers
```

2. 프로바이더 배정 (cross-model 전략 시):
```bash
echo '{"reviewers": [...]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js resolve-review-assignments
```

3. 프로바이더별 분기 실행 (병렬):
- **Claude 배정** → Task tool (리뷰 프롬프트 생성 후 에이전트 실행)
- **Gemini 배정** → Bash tool로 CLI 호출

#### `quality-gate` — 품질 게이트 체크

```bash
echo '{"reviews": [...], "executionResult": {...}}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js enhanced-quality-gate
```

- **passed: true** → advance로 통과 보고
- **passed: false** → advance로 실패 보고 (자동으로 fix 또는 escalate 전이)

#### `fix` — 수정

수정 프롬프트 생성 후 담당자에게 재실행:

```bash
echo '{"task":{...},"implementer":{...},"reviews":[...]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js revision-prompt
```

#### `commit` — Phase 커밋

```bash
echo '{"projectDir": "/path/to/project", "phase": N, "message": "Phase N: ..."}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js commit-phase
```

프로젝트에 infraPath가 설정되어 있고 git이 초기화된 경우에만 실행.

#### `build-context` — Phase 컨텍스트 생성

1. 각 태스크 출력 저장:
```bash
echo '{"id":"{ID}","taskId":"{태스크ID}","output":"..."}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js save-task-output
```

2. Phase 컨텍스트 생성:
```bash
echo '{"completedTasks": [...]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js build-phase-context
```

#### `confirm-next-phase` — 다음 Phase 확인 (interactive만)

AskUserQuestion으로 다음 Phase 진행 여부를 확인합니다.
확인 후 `build-context` action으로 advance합니다.

#### `escalate` — CEO 에스컬레이션

미해결 critical 이슈 목록을 표시하고 AskUserQuestion으로 결정을 받습니다:
- **계속 수정** → escalation-response: continue
- **건너뛰기** → escalation-response: skip
- **중단** → escalation-response: abort

### 2.3 상태 전이

```bash
echo '{"id":"{ID}","stepResult":{"completedAction":"...","taskResults":[...]}}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js advance-execution
```

### 2.4 반복

Step 2.1로 돌아감 (action이 `complete`가 될 때까지).

---

## Step 3: 완료

action이 `complete`이면:

```bash
echo '{"id":"{프로젝트ID}","status":"completed"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status
```

### Step 3.1: CLAUDE.md 업데이트 (프로젝트에 CLAUDE.md가 있는 경우)

실행 중 내린 기술 결정을 CLAUDE.md Decisions 섹션에 추가합니다:

```bash
echo '{"claudeMdPath":"{infraPath}/CLAUDE.md","sectionName":"decisions-placeholder","content":"### 기술 결정\n{실행 중 결정된 사항 요약}"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js append-claude-md
```

이 단계는 프로젝트에 infraPath가 설정되어 있을 때만 실행합니다.

## Step 4: 다음 단계

```
모든 작업이 완료되었습니다! (리뷰 통과)
- `/report` — 최종 보고서 생성
- `/feedback` — 팀원 피드백
- `/status` — 최종 상태 확인
```
