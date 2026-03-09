---
description: '작업 실행 — 팀원들이 작업을 실행하고 팀 검토'
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
  - label: "배치 실행"
    description: "3 Phase마다 확인합니다 (배치 실행)"
  - label: "자동 실행"
    description: "에스컬레이션이 필요한 경우에만 중단합니다"
```

- **인터랙티브** — 처음 쓰거나, 중간 결과를 보면서 진행하고 싶을 때. Phase 단위로 확인하며 넘어갑니다.
- **배치 실행** — Phase가 많은 프로젝트에서, 3개씩 묶어서 중간 확인하고 싶을 때.
- **자동** — 기획이 충분히 검토된 상태에서 빠르게 돌리고 싶을 때. 문제가 생길 때만 멈춥니다.

잘 모르겠으면 질문해주세요!

**"자동 실행" 또는 "배치 실행" 선택 시 자동승인 확인:**

`~/.claude/settings.json`의 `permissions.allow`에 `"Bash(node * cli.js *)"` 패턴이 있는지 확인합니다.

**설정이 있으면** -> 그대로 진행합니다.

**설정이 없으면** -> 간략히 안내합니다:

```
Good Vibe CLI 자동승인이 미설정입니다.
자동/배치 실행 모드에서는 승인 요청이 많을 수 있습니다.
```

AskUserQuestion:

```
질문: "자동승인을 설정하시겠습니까?"
header: "승인 모드"
options:
  - label: "자동승인 설정 (Recommended)"
    description: "settings.json에 Good Vibe CLI 자동승인 규칙을 추가합니다"
  - label: "이대로 진행"
    description: "수동 승인하면서 실행합니다 (승인 요청이 많을 수 있음)"
  - label: "인터랙티브로 변경"
    description: "Phase마다 확인하는 모드로 전환합니다"
```

**"자동승인 설정"** 선택 시 -> hello.md Step 2.5와 동일하게 `~/.claude/settings.json`에 규칙 추가 후 진행합니다.

### 1.2.5 멀티 AI 리뷰 설정 (선택)

> 실행 모드 선택 후, 실행 초기화 전에 한 번만 확인합니다.

`skills/multi-review/SKILL.md`의 **셋업** 플로우를 실행합니다.

이미 `reviewStrategy === 'cross-model'`이면 Step 1.3의 실행 준비 메시지에 `리뷰 방식: 멀티 AI` 한 줄만 추가하고 넘어갑니다.

### 1.3 실행 초기화 (Task tool)

**Task tool 프롬프트:**

```
프로젝트 ID: {ID}
실행 모드: {mode}
재개 여부: {resume} (이전 실행이 있는 경우)

다음 작업을 수행하고 실행 계획 요약만 반환하세요:

1. init-execution CLI 호출 (resume 플래그 포함)
2. update-status CLI 호출 (status: executing)
3. execution-plan-with-reviews CLI 호출

**반환 형식 (최대 300자):**
- 총 Phase 수
- 총 태스크 수
- Phase별 태스크 개수 요약 (예: "Phase 1: 3개, Phase 2: 5개, Phase 3: 2개")
- 예상 소요 시간 (있는 경우)

상세는 project.json에 저장하세요.

환경변수: CLAUDE_PLUGIN_ROOT={CLAUDE_PLUGIN_ROOT}
```

**CEO에게 표시:**

```
실행 준비 완료!

총 {N}개 Phase, {M}개 태스크
Phase별: Phase 1: 3개, Phase 2: 5개, ...
예상 소요: 약 {N}분

지금부터 팀이 작업을 시작합니다.
```

---

## Step 2: 실행 루프

> **Thin Controller 원칙:** Phase 실행의 모든 복잡성(next-step, action 처리, advance-execution)은 Task tool 내부에 격리됩니다. 메인 세션은 결과만 받아서 CEO에게 표시합니다.

action이 `complete` 또는 `already-completed`가 될 때까지 아래를 반복합니다.

### 2.1 Phase 실행 (Task tool)

**인터랙티브 모드:** Phase 1개씩 Task tool 실행
**배치 실행 모드:** batchSize(기본 3)개 Phase씩 Task tool 실행
**자동 모드:** 전체를 하나의 Task tool 실행 (에스컬레이션 시에만 중단)

**Task tool 프롬프트 (각 Phase 또는 Phase 배치):**

```
프로젝트 ID: {ID}
실행 모드: {mode}
시작 Phase: {startPhase}
종료 Phase: {endPhase} (또는 에스컬레이션 발생까지)

다음 Phase 실행 루프를 수행하고, 각 Phase 완료 시 결과 요약만 반환하세요:

**Phase 실행 루프:**

1. next-step CLI 호출로 현재 action 확인
2. action별 처리:
   - execute-tasks: 태스크 병렬 실행 (팀원별 Task tool 호출 또는 Gemini CLI)
   - materialize: 코드 파일 생성 (is-code-task → verify-and-materialize)
   - review: 팀 검토 (select-reviewers → resolve-review-assignments → 병렬 리뷰)
   - quality-gate: 품질 검증 (enhanced-quality-gate)
   - fix: 수정 (revision-prompt → 재실행)
   - commit: Phase 커밋 (commit-phase)
   - build-context: Phase 컨텍스트 생성 (save-task-output → build-phase-context)
   - confirm-next-phase: (메인 세션에 반환)
   - escalate: (메인 세션에 에스컬레이션 정보 반환)
3. 각 action 완료 후 advance-execution CLI 호출로 상태 전이
4. action이 complete, confirm-next-phase, 또는 escalate가 될 때까지 반복

**반환 형식 (Phase별 요약, 최대 300자):**

Phase {N} 완료:
- 실행 태스크: {N}개
- 주요 결과물: {요약}
- 품질 검증: {passed/failed}, critical {N}개, important {N}개
- 생성 파일: {N}개 (코드 태스크인 경우)
- 수정 시도: {N}회 (있는 경우)
- 리뷰 프로바이더: {Claude, Gemini} (cross-model인 경우)

Phase {N+1} 완료:
...

상세는 project.json에 저장하세요.

**에스컬레이션 발생 시:**

에스컬레이션 필요:
- Phase: {N}
- 실패 카테고리: {categories}
- critical 이슈: {issues}
- 시도 횟수: {fixAttempt}/{maxFixAttempts}

(이후 Phase는 실행하지 않고 즉시 반환)

**confirm-next-phase 발생 시 (인터랙티브 모드):**

Phase {N} 완료, 다음 Phase 대기 중

**제외할 내용:**
- 태스크별 상세 출력 전문
- 리뷰 코멘트 전체
- 중간 fix 시도 상세

환경변수: CLAUDE_PLUGIN_ROOT={CLAUDE_PLUGIN_ROOT}
```

**CEO에게 표시 (Phase 완료 시):**

```
Phase {N}/{총Phase} 완료

실행 태스크: {N}개
주요 결과물: {요약}
품질 검증: 통과 (critical 0개, important 2개)
생성 파일: 5개

⏱️ 약 {N}분 남음 (있는 경우)
```

### 2.2 에스컬레이션 처리

Task tool이 에스컬레이션 정보를 반환하면, CEO에게 판단을 요청합니다:

**CEO에게 표시:**

```
수정을 2번 시도했지만 해결되지 않았습니다.

Phase: {N}
실패 카테고리: {categories}
Critical 이슈:
- {issue 1}
- {issue 2}
...

어떻게 하시겠습니까?
```

**AskUserQuestion:**

```
질문: "다음 중 하나를 선택하세요"
options:
  - label: "계속 수정"
    description: "핵심 기능이라 반드시 성공해야 할 때. 한 번 더 시도합니다."
  - label: "건너뛰기"
    description: "부가 기능이라 나중에 추가할 수 있을 때. 이 Phase를 넘어갑니다."
  - label: "중단"
    description: "기획 자체를 재검토해야 할 때. 실행을 종료합니다."

잘 모르겠으면 질문해주세요!
```

**"중단" 선택 후 복구 방법 안내:**

중단을 선택하면 CEO에게 다음 안내를 표시합니다:

```
실행이 중단되었습니다. 다시 시작하려면:

- `good-vibe:execute` → 중단 지점(Phase {N})부터 재개
- `good-vibe:discuss --reset` → 기획서 재작성 후 다시 실행
- `good-vibe:status` → 현재 상태 + 미해결 이슈 확인
```

**"계속 수정" 선택 시 추가 질문:**

```
질문: "어떤 방향으로 수정하길 원하시나요?"
options:
  - label: "AI 팀에게 맡기기"
    description: "기존 전략으로 재시도"
  - label: "직접 지시"
    description: "구체적인 수정 방향 입력"
```

### 2.3 에스컬레이션 결정 적용 (Task tool)

CEO 결정을 받은 후, 새 Task tool로 실행을 이어갑니다.

**Task tool 프롬프트 (에스컬레이션 이후):**

```
프로젝트 ID: {ID}
CEO 결정: {decision} (continue/skip/abort)
CEO 지침: {ceoGuidance} ("직접 지시" 선택 시)

다음 작업을 수행하세요:

1. handle-escalation CLI 호출 (decision + ceoGuidance 전달)
2. decision이 continue인 경우: Phase 실행 루프 재개 (2.1과 동일)
3. decision이 skip인 경우: 다음 Phase로 진행
4. decision이 abort인 경우: 즉시 중단 (프로젝트 상태는 executing 유지)

반환 형식: 2.1과 동일 (Phase별 요약)

환경변수: CLAUDE_PLUGIN_ROOT={CLAUDE_PLUGIN_ROOT}
```

### 2.4 다음 Phase 확인 (인터랙티브 모드)

Task tool이 "Phase {N} 완료, 다음 Phase 대기 중"을 반환하면:

**AskUserQuestion:**

```
질문: "Phase {N}이 완료되었습니다. 다음 Phase를 어떻게 진행할까요?"
options:
  - label: "진행"
    description: "다음 Phase 실행"
  - label: "지침 추가 후 진행"
    description: "다음 Phase에 대한 방향을 지시한 후 진행"
  - label: "상태 확인"
    description: "good-vibe:status로 현재 상태 확인 후 결정"
  - label: "중단"
    description: "여기서 멈추고 나중에 재개"
```

"진행" 선택 시:

```bash
echo '{"id": "{ID}"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js confirm-phase
```

"지침 추가 후 진행" 선택 시: CEO에게 지침을 입력받은 후:

```bash
echo '{"id": "{ID}", "phaseGuidance": "{CEO 지침}"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js confirm-phase
```

phaseGuidance는 다음 Phase의 execute-tasks 프롬프트에 "CEO 지침" 섹션으로 주입되며, 사용 후 자동 소멸합니다.

"중단" 선택 시: 실행 종료 (프로젝트 상태는 executing 유지, 다음 good-vibe:execute에서 resume)

### 2.5 리뷰 후 CEO 개입 (인터랙티브 모드, opt-in)

`config.execution.reviewIntervention = true` 설정 시, interactive 모드에서 review 완료 후 quality-gate 전에 CEO가 개입할 수 있습니다.

Task tool이 `review-intervention` action을 반환하면:

**CEO에게 리뷰 결과 요약을 표시한 후 AskUserQuestion:**

```
질문: "리뷰가 완료되었습니다. 어떻게 하시겠습니까?"
options:
  - label: "진행"
    description: "품질 검증로 넘어갑니다"
  - label: "수정 지시"
    description: "리뷰 결과를 보고 추가 수정 방향을 지시합니다"
```

"진행" 선택 시:

```bash
echo '{"id": "{ID}", "decision": "proceed"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js handle-review-intervention
```

"수정 지시" 선택 시: CEO에게 지침을 입력받은 후:

```bash
echo '{"id": "{ID}", "decision": "revise", "revisionGuidance": "{수정 지침}"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js handle-review-intervention
```

### 2.6 반복

action이 `complete`가 될 때까지 2.1-2.5를 반복합니다.

---

## Step 3: 완료

> **Thin Controller 원칙:** 완료 처리(상태 업데이트 + 파일 목록 + 환경변수 추출)를 하나의 Task tool로 묶습니다.

action이 `complete`이면 완료 처리를 시작합니다.

### 3.1 완료 처리 (Task tool)

**Task tool 프롬프트:**

```
프로젝트 ID: {ID}

다음 작업을 수행하고 완료 요약만 반환하세요:

1. update-status CLI 호출 (status: completed)
2. infraPath가 있는 경우: append-claude-md CLI 호출 (실행 중 기술 결정 기록)
3. 실행 결과 요약 생성:
   - project.json에서 생성된 파일 목록 추출
   - 필요한 환경변수 추출 (에이전트 출력의 "결과 보고 규격" 섹션)
   - 실행 방법 추출
   - 커스터마이징 포인트 추출

**반환 형식 (최대 500자):**

상세는 project.json에 저장하세요.

프로젝트 완료!

생성 파일: {N}개
- {파일 1}
- {파일 2}
...

필요 환경변수:
- {변수명}: {설명 + 발급 방법}

실행 방법:
1. .env 설정
2. npm install
3. npm start
4. {확인 방법}

커스터마이징:
- {포인트 1}
- {포인트 2}

환경변수: CLAUDE_PLUGIN_ROOT={CLAUDE_PLUGIN_ROOT}
```

**CEO에게 표시 (Task tool 결과 그대로):**

```
{Task tool 반환값 전체}
```

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

> **Thin Controller 원칙:** `good-vibe:new`에서 호출 시에도 동일한 격리 원칙이 적용됩니다.

`good-vibe:new`에서 Task tool로 Phase별 호출된 경우, Step 2.1의 Task tool 프롬프트를 그대로 따릅니다.

### 실행 절차

Task tool 프롬프트 (Step 2.1 참고):

```
프로젝트 ID: {ID}
시작 Phase: {startPhase}
종료 Phase: {endPhase} (또는 에스컬레이션 발생까지)

Phase 실행 루프:
1. next-step CLI 호출
2. action별 처리 (execute-tasks, materialize, review, quality-gate, fix, commit, build-context)
3. advance-execution CLI 호출
4. complete, confirm-next-phase, 또는 escalate까지 반복

반환 형식: Phase별 요약 (각 300자 이내)
- 실행 태스크 수
- 주요 결과물
- 품질 검증 결과
- 생성 파일 수
- 수정 시도 (있는 경우)

에스컬레이션 발생 시: 즉시 에스컬레이션 정보 반환
confirm-next-phase 발생 시: 현재 Phase 완료 표시 후 반환

제외: 태스크 상세 출력, 리뷰 코멘트 전체, 중간 fix 시도 상세

환경변수: CLAUDE_PLUGIN_ROOT={CLAUDE_PLUGIN_ROOT}
```

### 에스컬레이션 처리

`escalate` action이 발생하면 Task tool이 즉시 에스컬레이션 정보를 반환합니다:

```
에스컬레이션 필요:
- Phase: {N}
- 실패 카테고리: {categories}
- critical 이슈: {issues}
- 시도 횟수: {fixAttempt}/{maxFixAttempts}
```

메인 세션에서 CEO에게 판단을 요청한 뒤, Step 2.3의 Task tool로 실행을 이어갑니다.

### 반환 형식

**Phase 완료 시:**

```
Phase {N} 완료:
- 실행 태스크: {N}개
- 주요 결과물: {요약}
- 품질 검증: {passed/failed}, critical {N}개, important {N}개
- 생성 파일: {N}개 (코드 태스크인 경우)
- 수정 시도: {N}회 (있는 경우)
- 리뷰 프로바이더: {Claude, Gemini} (cross-model인 경우)
```

**제외할 내용:**

- 태스크별 상세 출력 전문
- 리뷰 코멘트 전체
- 중간 fix 시도 상세

> **이유:** 메인 세션의 컨텍스트를 보호하기 위함. 상세 내용은 project.json에 저장되어 있으므로 `good-vibe:status`나 `good-vibe:report`로 조회 가능.

---

## 워크플로우 요약 (Thin Controller 준수)

```
Step 1: 프로젝트 로드 + 모드 선택 (메인 세션 — 조회 CLI + AskUserQuestion)
  ↓
Step 1.3: 실행 초기화 (Task tool — init-execution + update-status + execution-plan)
  ↓
Step 2: 실행 루프 (Task tool — Phase 실행 + 리뷰 + 품질 검증 + 수정)
  ↓ (에스컬레이션 발생 시)
Step 2.2: CEO 판단 (메인 세션 — AskUserQuestion)
  ↓
Step 2.3: 에스컬레이션 적용 (Task tool — handle-escalation + Phase 재개)
  ↓ (complete 반환)
Step 3: 완료 처리 (Task tool — update-status + 파일 목록 + 환경변수 추출)
  ↓
Step 4: 다음 단계 안내 (메인 세션 — 결과 표시)
```

**메인 세션 역할:**

- 프로젝트 조회 (list-projects)
- 실행 모드 선택 (AskUserQuestion)
- Task tool 결과 표시 (Phase 요약, 진행률)
- 에스컬레이션 판단 (AskUserQuestion)
- 다음 Phase 확인 (인터랙티브 모드)
- 완료 안내

**Task tool 역할:**

- 실행 초기화 (init-execution + update-status + execution-plan)
- Phase 루프 전체 (next-step → action별 처리 → advance-execution)
- 에스컬레이션 결정 적용 (handle-escalation + 재개)
- 완료 처리 (update-status + 결과 추출)
- 모든 LLM 호출과 멀티-CLI 체인
