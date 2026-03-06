---
description: '작업 실행 — 팀원들이 작업을 실행하고 크로스 리뷰'
---

# good-vibe:execute — 작업 실행

팀원들이 분배된 작업을 실행하고, 다른 팀원이 결과물을 리뷰합니다.
문제가 발견되면 자동으로 수정하고, 그래도 안 되면 CEO(당신)에게 판단을 맡깁니다.

- **걸리는 시간:** 5-15분 (작업량에 따라)
- **결과물:** 리뷰를 통과한 완성 결과물
- **다음 단계:** `good-vibe:report` (보고서 생성)

---

## Step 1: 실행 시작

### 1.1 프로젝트 선택

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js list-projects
```

approved 상태인 프로젝트를 고릅니다.

### 1.2 실행 모드 선택

```
질문: "실행 모드를 선택하세요"
header: "모드"
options:
  - label: "인터랙티브 (Recommended)"
    description: "각 Phase 완료 후 진행 여부를 확인합니다"
  - label: "세미-오토"
    description: "3 Phase마다 확인합니다 (배치 실행)"
  - label: "자동 실행"
    description: "에스컬레이션이 필요한 경우에만 중단합니다"
```

- **인터랙티브** — 처음 쓰거나, 중간 결과를 보면서 진행하고 싶을 때. Phase 단위로 확인하며 넘어갑니다.
- **세미-오토** — Phase가 많은 프로젝트에서, 3개씩 묶어서 중간 확인하고 싶을 때.
- **자동** — 기획이 충분히 검토된 상태에서 빠르게 돌리고 싶을 때. 문제가 생길 때만 멈춥니다.

### 1.3 실행 시작

```bash
echo '{"id":"{ID}","mode":"interactive"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js init-execution
```

이전에 중단된 실행이 있으면 재개 여부를 물어보고:

```bash
echo '{"id":"{ID}","mode":"interactive","resume":true}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js init-execution
```

### 1.4 상태 변경 + 실행 계획 표시

```bash
echo '{"id":"{프로젝트ID}","status":"executing"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status
```

태스크를 Phase별로 묶고, 리뷰 단계를 포함한 실행 계획을 보여줍니다:

```bash
echo '{"tasks": [...], "team": [...]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js execution-plan-with-reviews
```

---

## Step 2: 실행 루프

action이 `complete` 또는 `already-completed`가 될 때까지 아래를 반복합니다.

**진행률 표시:** 각 action 처리 시 progress-formatter의 함수들을 활용하여 진행 상황을 표시합니다.

### 2.1 다음 단계 조회

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js next-step --id {ID}
```

### 2.2 action별 처리

#### `execute-tasks` — 태스크 실행

**Phase 시작 시 표시:**

```
{formatPhaseStart(phase, totalPhases, tasks)}
{formatProgressBar(phase, totalPhases, 'execute-tasks')}
```

ETA가 있으면 (Phase 1 완료 후부터):

```
⏱️ 약 {N}분 남음
```

같은 Phase의 작업을 Task tool로 **병렬** 실행합니다.

1. 팀원 에이전트를 Task 도구로 호출
2. 작업 내용과 팀원 페르소나 전달
3. Phase 2 이상이면 이전 Phase의 컨텍스트(phaseContext, planExcerpt)를 함께 전달
4. 결과 수집

**각 Task 완료 시 표시:**

```
{formatTaskProgress(tasks, completedIds)}
```

#### `materialize` — 코드 구체화 (코드 태스크만)

```bash
echo '{"task": {...}}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js is-code-task
```

코드 태스크인 경우, 임시 디렉토리에서 빌드 검증 후 프로젝트에 반영:

```bash
echo '{"taskOutput": "...", "task": {...}, "projectDir": "/path/to/project"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js verify-and-materialize
```

- `verified: true` — 빌드 성공, 프로젝트에 기록됨
- `verified: false` — 빌드 실패, tempDir 보존하고 수정 루프 진행
- `verified: null` — 빌드 불가(비코드), 건너뜀

#### `review` — 크로스 리뷰

1. 리뷰어 선정 (최소 2명, 도메인 매칭):

```bash
echo '{"task": {...}, "team": [...]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js select-reviewers
```

2. cross-model 전략 시 프로바이더 배정:

```bash
echo '{"reviewers": [...]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js resolve-review-assignments
```

3. 프로바이더별 병렬 실행:
   - **Claude** → Task tool (리뷰 프롬프트 → 에이전트)
   - **Gemini** → Bash tool로 CLI 호출

#### `quality-gate` — 품질 게이트

```bash
echo '{"reviews": [...], "executionResult": {...}}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js enhanced-quality-gate
```

- `passed: true` → advance로 통과 보고
- `passed: false` → advance로 실패 보고 (자동으로 fix 또는 escalate로 전이)

#### `fix` — 수정

**수정 시작 시 표시:**

```
수정 중... (시도 {fixAttempt+1}/{maxFixAttempts})
이전 실패: {카테고리별 이슈 요약}
수정 전략: {카테고리 기반 자동 전략}
담당: {에이전트명}
```

이전 시도에서 뭘 했고 뭐가 안 됐는지를 포함한 수정 프롬프트를 만들어 담당자에게 보냅니다:

```bash
echo '{"task":{...},"implementer":{...},"reviews":[...],"failureContext":{...}}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js revision-prompt
```

failureContext에는 현재 시도 차수, 최대 시도 횟수, 이전 시도 이력, 이슈 카테고리 분포, CEO 지침(ceoGuidance)이 들어있습니다.

#### `commit` — Phase 커밋

```bash
echo '{"projectDir": "/path/to/project", "phase": N, "message": "Phase N: ..."}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js commit-phase
```

프로젝트에 infraPath가 있고 git이 초기화돼 있을 때만 실행.

#### `build-context` — Phase 컨텍스트 생성

**Phase 완료 시 표시:**

```
{formatPhaseComplete(phase, totalPhases, phaseResult)}
{formatProgressBar(nextPhase, totalPhases, 'build-context')}
```

ETA가 있으면:

```
⏱️ 약 {N}분 남음
```

1. 태스크 출력 저장:

```bash
echo '{"id":"{ID}","taskId":"{태스크ID}","output":"..."}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js save-task-output
```

2. Phase 컨텍스트 생성:

```bash
echo '{"completedTasks": [...]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js build-phase-context
```

#### `confirm-next-phase` — 다음 Phase 확인 (인터랙티브만)

다음 Phase로 넘어갈지 물어봅니다. 확인 후 build-context action으로 advance.

#### `escalate` — CEO에게 판단 요청

수정을 2번 시도해도 해결 안 되면, 실패 상세를 보여주고 결정을 받습니다:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js get-failure-context --id {ID}
```

미해결 critical 이슈를 보여준 뒤 세 가지 선택지를 제시합니다:

- **계속 수정** — 핵심 기능이라 반드시 성공해야 할 때. 한 번 더 시도합니다.
- **건너뛰기** — 부가 기능이라 나중에 추가할 수 있을 때. 이 Phase를 넘어갑니다.
- **중단** — 기획 자체를 재검토해야 할 때. 실행을 종료합니다.

"계속 수정" 선택 시 수정 방향을 추가로 질문합니다:

```
AskUserQuestion: "어떤 방향으로 수정하길 원하시나요? (선택 또는 직접 입력)"
options:
  - "AI 팀에게 맡기기" — 기존 전략으로 재시도
  - "직접 지시" — 구체적인 수정 방향 입력
```

"직접 지시" 선택 시 CEO의 피드백을 `ceoGuidance`로 전달합니다:

```bash
echo '{"id":"{ID}","decision":"continue","ceoGuidance":"CEO 지침 내용"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js handle-escalation
```

"AI 팀에게 맡기기" 선택 시:

```bash
echo '{"id":"{ID}","decision":"continue"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js handle-escalation
```

### 2.3 상태 전이

```bash
echo '{"id":"{ID}","stepResult":{"completedAction":"...","taskResults":[...]}}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js advance-execution
```

**stepResult 예시 (action별):**

```json
// execute-tasks 완료
{"completedAction": "execute-tasks", "taskResults": [{"taskId": "task-1", "output": "구현 결과..."}]}

// materialize 완료
{"completedAction": "materialize"}

// review 완료
{"completedAction": "review", "reviews": [{"reviewerId": "qa", "verdict": "approve", "issues": []}]}

// quality-gate 통과
{"completedAction": "quality-gate", "qualityGateResult": {"passed": true, "criticalCount": 0}}

// quality-gate 실패
{"completedAction": "quality-gate", "qualityGateResult": {"passed": false, "criticalCount": 1, "issues": [{"severity": "critical", "description": "SQL injection 위험"}]}}

// fix 완료
{"completedAction": "fix", "taskResults": [{"output": "수정 결과..."}]}

// commit 완료
{"completedAction": "commit"}

// build-context 완료
{"completedAction": "build-context"}

// 에스컬레이션 결정
{"completedAction": "escalation-response", "escalationDecision": "continue"}
```

### 2.4 반복

Step 2.1로 돌아갑니다. action이 `complete`가 될 때까지.

---

## Step 3: 완료

action이 `complete`이면:

```bash
echo '{"id":"{프로젝트ID}","status":"completed"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status
```

### 3.1 CLAUDE.md 업데이트 (해당되는 경우)

프로젝트에 CLAUDE.md가 있으면, 실행 중 내린 기술 결정을 기록합니다:

```bash
echo '{"claudeMdPath":"{infraPath}/CLAUDE.md","sectionName":"decisions-placeholder","content":"### 기술 결정\n{실행 중 결정된 사항 요약}"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js append-claude-md
```

infraPath가 설정된 프로젝트에서만 실행.

### 3.2 완료 요약 표시

실행 결과를 사용자에게 요약합니다:

```
프로젝트가 완료되었습니다!

생성된 파일: {N}개
{파일 목록}

필요한 환경변수:
{환경변수 목록 + 발급 방법}

실행 방법:
1. .env 파일 생성 후 환경변수 입력
2. npm install
3. npm start
4. {프로젝트 타입별 확인 방법}

커스터마이징:
{커스터마이징 포인트 목록}
```

이 정보는 실행 중 에이전트 출력의 "결과 보고 규격" 섹션에서 추출합니다.

---

## Step 4: 다음 단계

완료 후 구체적 안내를 제공합니다:

```
작업이 모두 완료됐습니다!

다음 단계:
1. .env 파일 설정 (위의 환경변수 참고)
2. 의존성 설치 및 실행 확인
3. good-vibe:report    — 구현 상세 + 환경변수 가이드 포함 보고서
4. good-vibe:feedback  — 팀원별 성과 분석
5. good-vibe:status    — 최종 상태 확인

설명을 읽고도 잘 모르겠는 부분이 있으면, 어떤 부분이 헷갈리는지 편하게 질문해 주세요!
```

---

## 서브에이전트 모드 (Phase 단위 실행)

`good-vibe:new`에서 Task tool로 Phase별 호출된 경우, 이 섹션의 절차를 따릅니다.

### 실행 절차

1. `next-step --id {ID}`으로 현재 Phase의 action을 확인합니다.
2. action별로 Step 2.2의 처리를 따릅니다:
   - `execute-tasks` → 태스크 병렬 실행
   - `materialize` → 코드 구체화
   - `review` → 크로스 리뷰
   - `quality-gate` → 품질 게이트
   - `fix` → 수정 (실패 시)
   - `escalate` → 에스컬레이션 (메인 세션에 판단 위임 필요)
   - `commit` → Phase 커밋
   - `build-context` → Phase 컨텍스트 생성
3. 각 action 완료 후 `advance-execution`으로 상태를 전이합니다.
4. `build-context` 또는 `confirm-next-phase` action이 나오면 Phase 완료로 판단합니다.

### 에스컬레이션 처리

`escalate` action이 나오면 서브에이전트에서 직접 처리하지 않고, **메인 세션에 에스컬레이션이 필요하다는 결과를 반환**합니다:

```
에스컬레이션 필요:
- Phase: {N}
- 실패 카테고리: {categories}
- critical 이슈: {issues}
- 시도 횟수: {fixAttempt}/{maxFixAttempts}
```

메인 세션에서 CEO에게 판단을 요청한 뒤, 새 Task tool로 해당 Phase를 이어서 실행합니다.

### 반환 형식

Phase 완료 시 다음 내용만 반환합니다:

- **Phase 요약** (300자 이내) — 실행한 태스크 수, 주요 결과물
- **품질게이트 결과** — passed/failed, critical/important 이슈 수
- **생성 파일 수** (코드 태스크인 경우)

**반환에 포함하지 않을 내용:**

- 태스크별 상세 출력 전문
- 리뷰 코멘트 전체
- 중간 fix 시도 상세

> **이유:** 메인 세션의 컨텍스트를 보호하기 위함. 상세 내용은 project.json에 저장되어 있으므로 `good-vibe:status`나 `good-vibe:report`로 조회 가능.
