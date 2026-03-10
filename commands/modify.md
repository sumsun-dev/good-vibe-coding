---
description: '기존 프로젝트 수정 — 완료된 프로젝트에 기능 추가/변경/개선'
---

# good-vibe:modify — 프로젝트 수정

완료된 프로젝트에 기능을 추가하거나, 기존 기능을 수정합니다.
"알림 기능 추가해줘", "UI 변경해줘" 같이 자연스럽게 요청하면 됩니다.

---

## Step 1: 프로젝트 선택

completed 상태의 프로젝트를 조회합니다:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js list-projects
```

- completed 프로젝트가 **없으면**: "완료된 프로젝트가 없습니다. `good-vibe:new`로 새 프로젝트를 시작하세요." 안내 후 종료
- completed 프로젝트가 **1개면**: 자동 선택
- completed 프로젝트가 **여러 개면**: AskUserQuestion으로 선택

## Step 2: 수정 내용 확인

사용자가 이미 수정 내용을 설명했으면 (예: "알림 기능 추가해줘") 그대로 사용합니다.
아직 구체적인 수정 내용이 없으면 AskUserQuestion으로 수집합니다:

```
질문: "어떤 수정이 필요한가요? 자유롭게 설명해주세요."
header: "수정 내용"
options:
  - label: "기능 추가"
    description: "새로운 기능을 추가합니다"
  - label: "기능 수정"
    description: "기존 기능을 변경합니다"
  - label: "버그 수정"
    description: "문제를 고칩니다"
  - label: "UI/UX 개선"
    description: "디자인이나 사용성을 개선합니다"
```

사용자가 선택 후 구체적인 설명을 입력하면 다음 단계로 진행합니다.

## Step 3: 수정 분석 + 코드베이스 탐색 + PRD (Task tool)

> **Thin Controller 원칙:** 기존 프로젝트의 맥락(PRD + 기획서 + 실행 결과)과 **실제 코드 상태**를 Task tool이 분석하고, 메인 세션은 수정 방향 확인만 합니다.

Task tool 프롬프트:

```
프로젝트 ID: {ID}의 수정 사항을 분석하세요.

수정 요청: {사용자 수정 설명}

## Phase 1: 메타데이터 수집

node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js get-project --id {ID}
→ 기존 PRD, 기획서, 팀 구성, 실행 결과, infraPath 확인

## Phase 2: 코드베이스 구조 스캔

infraPath가 있으면:
  node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js scan-codebase --path {infraPath}
  → techStack, dependencies, fileStructure 확보

infraPath가 없으면:
  Phase 2-3 건너뛰기. codebaseInsights에 경고 포함:
  "infraPath 없음 — 메타데이터 기반 분석만 수행됨"

## Phase 3: 심층 코드 탐색 (Plan Mode 수준)

infraPath가 있을 때만 수행:

1. Glob으로 수정 요청 관련 파일 패턴 검색
   예: "알림 추가" → **/*notif*, **/*alert*, **/*push*
2. Read로 핵심 파일 최대 5개 읽기 (구현 상태 파악)
   - 엔트리 포인트, 라우터, 핵심 모듈 우선
3. Grep으로 import/require 추적 (영향 범위 산출)
   - 수정 대상 파일을 참조하는 다른 파일 확인
4. Glob으로 기존 테스트 파일 확인 (**/*.test.*, **/*.spec.*)

## Phase 4: 수정 PRD 생성

Phase 1-3 정보를 바탕으로 incremental PRD를 마크다운으로 작성:
- **유지 항목**: 기존 기능 중 변경 없는 것 (간략 목록)
- **수정 항목**: 변경이 필요한 기존 기능 (변경 전/후 비교, 실제 파일 경로 포함)
- **추가 항목**: 새로 추가할 기능 (상세 설명)
- **영향 범위**: 수정으로 영향 받는 기존 파일과 모듈 (Phase 3 결과 기반)
- **기술 요구사항**: 추가 필요한 기술 스택/라이브러리
- **Before/After 아키텍처 다이어그램** (Mermaid):
  - Before: 기존 기획서의 다이어그램 또는 코드 탐색 기반 현재 구조
  - After: 수정 반영 후 예상 구조 (추가/변경 컴포넌트를 강조 표시)
- **Before/After 화면 구조** (UI 프로젝트인 경우):
  - Before: 현재 화면 흐름
  - After: 수정 후 화면 흐름 (추가/변경 화면을 강조 표시)

복잡도를 simple/medium/complex로 평가.

반환 형식 (JSON):
{
  "modifiedPrd": "수정 PRD (마크다운, 1000자 이내)",
  "beforeAfter": {
    "architecture": { "before": "Mermaid 코드", "after": "Mermaid 코드" },
    "ui": { "before": "Mermaid/ASCII", "after": "Mermaid/ASCII" }
  },
  "codebaseInsights": {
    "techStack": ["실제 감지된 기술"],
    "hasTests": true/false,
    "implementationPattern": "감지된 아키텍처 패턴 (예: MVC, 모듈러, 레이어드)"
  },
  "affectedAreas": [
    { "file": "src/bot.js", "reason": "알림 발송 로직 추가", "changeType": "modify" },
    { "file": "src/notification.js", "reason": "알림 서비스 신규 생성", "changeType": "create" }
  ],
  "migrationRisks": ["기존 API 시그니처 변경 시 호출부 수정 필요", "..."],
  "complexity": "simple|medium|complex",
  "estimatedPhases": 숫자,
  "suggestedTeam": ["역할1", "역할2"]
}

beforeAfter.ui는 UI 프로젝트(web-app, frontend 등)인 경우에만 포함합니다.
beforeAfter.architecture는 항상 포함합니다.

CLAUDE_PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}
```

## Step 4: CEO 확인

수정 PRD를 CEO에게 시각적으로 표시합니다 (다이어그램을 먼저 보여줘서 변경 규모를 직관적으로 파악):

- `beforeAfter.architecture`의 Before/After 아키텍처 다이어그램 (나란히 표시)
- `beforeAfter.ui`의 Before/After 화면 구조 (UI 프로젝트인 경우)
- `modifiedPrd` 마크다운 원문
- `affectedAreas`를 파일별로 표시: `[changeType] file — reason` 형식
- `migrationRisks`가 있으면 위험 요소 목록

표시 형식:

```
### Before (현재 구조)

{beforeAfter.architecture.before — Mermaid 다이어그램}

### After (수정 후 구조)

{beforeAfter.architecture.after — Mermaid 다이어그램}

{beforeAfter.ui가 있으면:}
### 화면 구조 변경

Before: {beforeAfter.ui.before}
After: {beforeAfter.ui.after}

---

{modifiedPrd 마크다운 원문}

영향 범위:
{affectedAreas를 [changeType] file — reason 형식으로}

{migrationRisks가 있으면:}
위험 요소:
{migrationRisks 목록}
```

AskUserQuestion:

```
질문: "이 수정 방향으로 진행할까요?"
header: "수정 확인"
options:
  - label: "이대로 진행 (Recommended)"
    description: "수정 작업을 시작합니다"
  - label: "수정 요청"
    description: "다른 방향으로 수정합니다"
  - label: "취소"
    description: "수정을 취소하고 프로젝트를 유지합니다"
```

- **"이대로 진행"** → Step 5
- **"수정 요청"** → 추가 입력 수집 후 Step 3 재실행
- **"취소"** → 종료

## Step 5: 작업 분배 + 실행 초기화 (Task tool)

> **Thin Controller 원칙:** 상태 전이, 작업 분배, 실행 초기화는 모두 하나의 Task tool 안에서 처리합니다.

Task tool 프롬프트:

```
프로젝트 ID: {ID}의 수정 작업을 준비하세요.

**[필수] CLI에 JSON 전달 시 Write tool 사용:**
- LLM 응답, PRD, 작업 목록 등 큰 JSON은 반드시 Write tool로 /tmp/gv-*.json 파일에 저장한 뒤 --input-file 플래그로 CLI에 전달하세요.
- echo/cat/heredoc(<<)로 큰 JSON을 bash에 직접 전달하면 보안 탐지에 걸려 자동승인이 중단됩니다.

수정 PRD: {Step 3의 modifiedPrd}

1. 수정 이력 저장:
   → 수정 데이터를 Write tool로 /tmp/gv-modify-history.json에 저장 (형식: {"id":"{ID}","modifiedPrd":"{Step 3의 modifiedPrd}","codebaseInsights":{Step 3의 codebaseInsights 또는 null},"affectedAreas":{Step 3의 affectedAreas},"migrationRisks":{Step 3의 migrationRisks},"complexity":"{Step 3의 complexity}"})
   → node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js add-modify-history --input-file /tmp/gv-modify-history.json

2. 상태 복귀:
   echo '{"id":"{ID}","status":"approved"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status

3. 작업 분배:
   수정 PRD를 기반으로 작업을 분배합니다.
   node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js task-distribution-prompt --id {ID}
   → 생성된 프롬프트를 LLM으로 실행 → 작업 목록 생성
   → 수정/추가 작업만 포함 (기존 완료 작업은 제외)
   → 리뷰 Phase 자동 삽입

4. 작업 목록 저장:
   → 작업 데이터를 Write tool로 /tmp/gv-tasks.json에 저장 (형식: {"id":"{ID}","tasks":[...생성된 작업 배열...]})
   → node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js save-tasks --input-file /tmp/gv-tasks.json

5. 실행 초기화:
   echo '{"id":"{ID}","mode":"auto"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js init-execution

6. 상태 변경:
   echo '{"id":"{ID}","status":"executing"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status

반환 형식 (JSON):
{
  "phaseCount": 숫자,
  "taskCount": 숫자,
  "taskSummary": "작업 요약 (200자 이내)"
}

CLAUDE_PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}
```

## Step 6: Phase별 실행 (Task tool로 격리)

> **컨텍스트 보호:** 각 Phase를 독립 Task tool로 실행하여 메인 세션의 컨텍스트 폭발을 방지합니다.
> 실행 모드는 auto로 초기화됩니다. 에스컬레이션만 CEO에게 올라갑니다.

`next-step`으로 실행 계획의 Phase 수를 파악한 뒤, **각 Phase를 개별 Task tool**로 실행합니다.

### Phase 실행 프롬프트 템플릿

각 Phase의 Task tool 프롬프트:

```
프로젝트 ID: {ID}의 Phase {N}을 실행하세요.

**[필수] CLI에 JSON 전달 시 Write tool 사용:**
- LLM 응답 등 큰 JSON은 반드시 Write tool로 /tmp/gv-*.json에 저장 후 --input-file로 전달하세요.

**Phase 실행 루프:**
1. `node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js next-step --id {ID}` → 현재 action 확인
2. action별 처리 (아래 레시피)
3. `echo '{"id":"{ID}","stepResult":{...}}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js advance-execution`
4. complete, confirm-next-phase, escalate까지 반복

**Action 레시피 (action → CLI → advance stepResult):**

execute-tasks:
- echo '{"task":{task}}' | node ... is-code-task → {isCodeTask}
- 코드→tdd-execution-prompt, 비코드→execution-prompt (stdin: {"task":..,"teamMember":..})
- 저장: echo '{"id":"{ID}","taskId":"{taskId}","output":"..."}' | node ... save-task-output
- advance: {"completedAction":"execute-tasks"}

materialize (코드 태스크만):
- echo '{"taskOutput":"..","task":{task},"projectDir":"{dir}"}' | node ... verify-and-materialize
- 저장: echo '{"id":"{ID}","taskId":"{taskId}","materializeResult":{result}}' | node ... add-task-materialization
- 상태: echo '{"id":"{ID}","status":"reviewing"}' | node ... update-status
- advance: {"completedAction":"materialize"}

review:
- echo '{"task":{task},"team":[..]}' | node ... select-reviewers
- echo '{"reviewers":[..]}' | node ... resolve-review-assignments
- echo '{"reviewer":{r},"task":{task},"taskOutput":".."}' | node ... task-review-prompt → LLM
- echo '{"id":"{ID}","taskId":"{taskId}","reviews":[..]}' | node ... add-task-reviews
- advance: {"completedAction":"review"}

quality-gate:
- echo '{"reviews":[..],"executionResult":{materializeResult}}' | node ... enhanced-quality-gate
- 상태: echo '{"id":"{ID}","status":"executing"}' | node ... update-status
- advance: {"completedAction":"quality-gate","qualityGateResult":{"passed":bool,"issues":[..]}}

fix:
- node ... get-failure-context --id {ID}
- echo '{"task":{task},"implementer":{m},"reviews":[..],"failureContext":{ctx}}' | node ... revision-prompt → LLM
- save-task-output → advance: {"completedAction":"fix"}

commit:
- echo '{"projectDir":"{dir}","phase":{N}}' | node ... commit-phase (infraPath 없으면 건너뜀)
- advance: {"completedAction":"commit"}

build-context:
- echo '{"completedTasks":[..]}' | node ... build-phase-context
- advance: {"completedAction":"build-context"}

**주의사항:**
- project.json 직접 Read 금지 (next-step이 필요 정보 반환, 레시피가 자체 완결)
- 프로젝트 파일 전체 Read 금지 (태스크에 명시된 파일만)
- 빌드 에러 일괄 수정 (반복 빌드 방지)
- 큰 JSON은 Write tool → /tmp/gv-*.json → --input-file

완료 후 반환 (최대 1000자):
- phaseSummary: 완료된 작업 목록 (한 줄씩)
- qualityGate: { passed, critical, important }
- errors: 실패 시 원인 (있을 때만)
상세 리뷰 결과와 빌드 로그는 project.json에 저장하세요.

CLAUDE_PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}
```

Phase가 끝날 때마다 메인 세션에서 진행률을 표시합니다:

```
Phase {N}/{total} 완료 — {Phase 요약}
품질게이트: {passed/failed}
```

### 에스컬레이션 처리

Task tool이 에스컬레이션 정보를 반환하면, CEO에게 판단을 요청합니다:

```
수정을 2번 시도했지만 해결되지 않았습니다.

Phase: {N}
실패 카테고리: {categories}
Critical 이슈:
- {issue 1}
- {issue 2}
```

AskUserQuestion:

```
질문: "다음 중 하나를 선택하세요"
options:
  - label: "계속 수정"
    description: "핵심 기능이라 반드시 성공해야 할 때. 한 번 더 시도합니다."
  - label: "건너뛰기"
    description: "부가 기능이라 나중에 추가할 수 있을 때. 이 Phase를 넘어갑니다."
  - label: "중단"
    description: "기획 자체를 재검토해야 할 때. 실행을 종료합니다."
```

에스컬레이션 결정 후, 새 Task tool로 실행을 이어갑니다:

```
프로젝트 ID: {ID}
CEO 결정: {decision} (continue/skip/abort)
CEO 지침: {ceoGuidance} ("직접 지시" 선택 시)

1. handle-escalation CLI 호출 (decision + ceoGuidance 전달)
2. continue → Phase 실행 루프 재개
3. skip → 다음 Phase로 진행
4. abort → 즉시 중단 (프로젝트 상태는 executing 유지)

환경변수: CLAUDE_PLUGIN_ROOT={CLAUDE_PLUGIN_ROOT}
```

## Step 7: 완료

```bash
echo '{"id":"{프로젝트ID}","status":"completed"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status
```

완료 후 안내:

```
프로젝트 수정이 완료되었습니다!

→ good-vibe:report — 수정 결과 확인
→ good-vibe:modify — 추가 수정이 필요하면
→ good-vibe:feedback — 팀원 성과 피드백
```

---

## 문제가 생기면?

- `good-vibe:learn 문제해결` — 자주 발생하는 문제와 해결 방법
- `good-vibe:status` — 현재 프로젝트 상태 확인
