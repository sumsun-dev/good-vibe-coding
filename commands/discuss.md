---
description: '팀 토론 — AI 팀원들이 프로젝트를 분석하고 기획서를 작성'
---

# good-vibe:discuss — 팀 토론 (멀티에이전트)

## 이 커맨드를 실행하면?

AI 팀원들이 프로젝트를 각자 분석하고, 결과를 모아 **기획서**를 만듭니다.
팀원들끼리 서로 리뷰하면서, 의견이 모일 때까지 반복합니다.

- **소요시간:** 3-10분 (팀 규모와 프로젝트 복잡도에 따라)
- **결과물:** 기획서 (프로젝트 분석 + 작업 계획)
- **다음 단계:** 모드에 따라 `good-vibe:approve` (plan-only) 또는 `good-vibe:execute` (plan-execute)

---

팀원들이 각자 독립적으로 프로젝트를 분석하고, 결과를 종합하여 기획서를 작성합니다.
에이전트들이 서로의 작업을 리뷰하고, 결과가 수렴될 때까지 반복합니다 (최대 3라운드).

### `--reset` 플래그

approved 상태의 프로젝트를 planning으로 되돌리고 재토론합니다.

- **사용 가능 상태:** `approved` → `planning`
- **사용 불가 상태:** `executing`, `reviewing`, `completed` — 상태 전이 검증에 의해 자동 거부됨

```bash
echo '{"id":"{프로젝트ID}","status":"planning"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status
```

되돌린 후 Step 2부터 진행합니다.

## Step 1: 프로젝트 로드

가장 최근 프로젝트를 로드하세요:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js list-projects
```

프로젝트가 여러 개면 AskUserQuestion으로 선택하게 하세요.

## Step 2-5: 토론 라운드 실행 (Task tool)

**Thin Controller 원칙:** 토론 프롬프트 생성, Tier 분류, 에이전트 디스패치, 결과 종합을 하나의 Task tool로 실행합니다.

Task tool에 다음 작업을 위임:

1. 토론 프롬프트 생성 (`discussion-prompt`)
2. 에이전트 Tier 분류 (`group-agents`)
3. Tier별 순차 실행:
   - Tier 1 (priority 1-2): CTO, PO, Researchers — 전략/요구사항
   - Tier 2 (priority 3-4): Fullstack, UI/UX, Frontend, Backend — 구현
   - Tier 3 (priority 5-7): QA, Security, DevOps, Data, Researchers — 검증
   - Tier 4 (priority 8+): Tech Writer — 문서화
4. 각 Tier 내 에이전트 병렬 디스패치 (`agent-analysis-prompt`)
5. 결과 종합 (`synthesis-prompt`)

### Task tool 프롬프트 (서브에이전트용)

```markdown
당신은 Good Vibe Coding의 토론 오케스트레이터입니다.

**환경:**

- CLAUDE_PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}

**작업:**

1. 프로젝트 {프로젝트ID}의 라운드 {N} 토론을 실행합니다
2. 에이전트를 Tier별로 분류하고, 순차적으로 디스패치합니다
3. 각 Tier 결과를 다음 Tier의 context.priorTierOutputs에 전달합니다
4. 모든 분석 결과를 종합하여 기획서를 생성합니다

**반환 형식:**
{
"synthesizedPlan": "...", // 통합 기획서 (Mermaid 다이어그램 포함)
"agentOutputs": [...], // 전체 에이전트 분석 결과
"round": N
}

**반환 크기 제한:** 기획서는 5000자 이내, 에이전트 출력은 각 1000자 이내로 요약. 상세는 project.json에 저장하세요.

**사용할 CLI:**

- discussion-prompt: 토론 프롬프트 생성
- group-agents: Tier 분류
- agent-analysis-prompt: 개별 에이전트 프롬프트 생성
- synthesis-prompt: 종합 기획서 생성

**진행률 표시:**

- 분석그룹 시작/완료 시: {formatDiscussionProgress(...)}
- 에이전트 실행 시: {emoji} {이름}이(가) 분석 중...
```

### CEO 피드백 반영 시

Ralph Loop로 CEO 피드백을 받은 경우, Task tool 프롬프트에 추가:

```markdown
**CEO 피드백:**
{ceoFeedback}

이 피드백을 관련 역할의 agent-analysis-prompt에 context.ceoFeedback으로 주입하세요.
```

### CEO 피드백 보존

토론 라운드 데이터를 `add-discussion-round`로 저장할 때, CEO 피드백이 있으면 roundData에 `ceoFeedback` 필드로 포함하세요:

```bash
echo '{"id":"{ID}","roundData":{"round":N,"agentOutputs":[...],"synthesis":"...","reviews":[...],"converged":false,"ceoFeedback":"{ceoFeedback 또는 null}"}}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js add-discussion-round
```

`addDiscussionRound()`이 roundData를 spread로 저장하므로, ceoFeedback 필드는 자동으로 project.json에 보존됩니다. 이후 `good-vibe:status`나 `good-vibe:report`에서 라운드별 CEO 피드백을 조회할 수 있습니다.

### Task tool 결과 표시

메인 세션은 Task tool 반환값에서 다음만 표시:

- 기획서 핵심 요약 (500자)
- Mermaid 아키텍처 다이어그램
- 화면 구조 (UI 프로젝트)
- 진행률 요약

## Step 6: CEO 시각적 확인 (Ralph Loop)

**메인 세션 역할:** Step 2-5의 Task tool 결과를 CEO에게 표시하고, 피드백을 수집합니다.

### 표시 내용

Task tool 반환값에서 다음을 추출하여 보여줍니다:

1. **아키텍처 다이어그램** (Mermaid)
   - 시스템 구성도, 모듈 간 관계, 데이터 흐름
   - 기획서의 Mermaid 코드 블록을 그대로 표시

2. **화면 구조** (UI 프로젝트인 경우)
   - 주요 화면 목록과 네비게이션 흐름 (Mermaid flowchart)
   - ASCII 와이어프레임 (핵심 화면 1-2개)

3. **기술 스택 요약**
   - 프레임워크, DB, 외부 서비스

4. **작업 규모**
   - 예상 Phase 수, 태스크 수

### CEO 확인

```
AskUserQuestion:
  질문: "기획서를 확인해주세요. 이대로 진행할까요?"
  header: "기획 확인"
  options:
    - "이대로 진행 (Recommended)" — 리뷰 단계(Step 7)로 넘어갑니다
    - "수정 요청" — 구체적 피드백을 주시면 반영합니다
    - "처음부터 다시" — 새로운 방향으로 재분석합니다

잘 모르겠으면 질문해주세요!
```

#### "이대로 진행" 선택 시

Step 7(리뷰)로 넘어갑니다.

#### "수정 요청" 선택 시

CEO에게 수정 사항을 자유 입력받습니다.

입력받은 피드백을 `ceoFeedback`으로 저장하고, Step 2-5 Task tool을 다시 호출합니다 (피드백 포함).

이 루프는 CEO가 "이대로 진행"을 선택할 때까지 반복합니다.
CEO의 수정 요청 반복 횟수에 제한은 없습니다 (CEO 주도 종료, 수렴 라운드와는 별개).

#### "처음부터 다시" 선택 시

CEO에게 새로운 방향을 입력받고, Step 2-5 Task tool을 다시 호출합니다 (ceoFeedback 초기화).

### 기존 "CEO 결정 필요 사항" 처리

기획서에 "CEO 결정 필요 사항" 섹션이 있으면, 위 CEO 확인 시 함께 표시합니다.
각 결정 사항에 대한 선택지를 추가로 제시하세요.

## Step 7-8: 리뷰 + 수렴 확인 (Task tool)

**Thin Controller 원칙:** 전체 에이전트 리뷰와 수렴 확인을 하나의 Task tool로 실행합니다.

Task tool에 다음 작업을 위임:

1. 전체 에이전트 병렬 리뷰 (`review-prompt`)
2. 수렴 확인 (`check-convergence`)
3. 이전 라운드 추이 분석 (previousRounds 전달)

### Task tool 프롬프트 (서브에이전트용)

```markdown
당신은 Good Vibe Coding의 리뷰 + 수렴 체커입니다.

**환경:**

- CLAUDE_PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}

**작업:**

1. 전체 팀원이 기획서를 리뷰합니다 (병렬)
2. 리뷰 결과를 분석하여 수렴 여부를 판단합니다
3. 이전 라운드 정보가 있으면 진화 추이를 계산합니다

**반환 형식:**
{
"converged": true/false,
"approvalRate": 0.85,
"blockers": [...], // critical 이슈만
"reviews": [...], // verdict만 포함
"evolution": { // previousRounds가 있을 때만
"trend": "improving",
"resolvedBlockers": [...],
"newBlockers": [...]
}
}

**반환 크기 제한:** 전체 2000자 이내, 리뷰는 각 300자 이내. 상세는 project.json에 저장하세요.

**사용할 CLI:**

- review-prompt: 개별 리뷰 프롬프트 생성
- check-convergence: 수렴 판정
```

### Task tool 결과 표시

메인 세션은 Task tool 반환값을 다음 형식으로 표시:

```
📊 라운드 {N} 수렴 상태

승인율: {approvalRate}% {progressBar}

{evolution 있으면:}
승인율 추이:
  Round 1: 60% ████████░░░░
  Round 2: 75% ██████████░░
  Round 3: 85% ███████████░

개선 속도: {trend}

블로커 변화:
  ✅ 해결: {resolvedBlockers}
  ⚠️ 신규: {newBlockers}
```

### 수렴/미수렴 처리

- **수렴 (80% 이상)** → Step 9로 진행
- **미수렴** → Step 2-5로 돌아가서 다음 라운드 실행 (feedbackForMe 주입)
- **최대 3라운드 미수렴** → AskUserQuestion:

```
3라운드 후에도 미수렴 (승인율 {N}%). 어떻게 할까요?

AskUserQuestion:
  질문: "토론이 3라운드 후에도 수렴하지 않았습니다. 어떻게 진행할까요?"
  header: "미수렴"
  options:
    - "강제 수렴 (Recommended)" — 현재 기획서로 확정, 미합의 사항 기록
    - "추가 토론" — 1라운드 더 진행 (최대 1회 추가)
    - "CEO 직접 조정" — 기획서의 미합의 쟁점을 CEO가 직접 결정하고 확정
    - "중단" — 토론 종료, 기획서 미확정
```

#### "CEO 직접 조정" 선택 시

미합의 쟁점 목록을 CEO에게 AskUserQuestion으로 하나씩 제시합니다.
각 쟁점에 대해 찬성/반대 의견을 요약하고, CEO가 방향을 결정합니다.
모든 쟁점 결정 후 기획서에 반영하고, "강제 수렴"과 동일하게 진행합니다.

## Step 9: 기획서 저장 + CLAUDE.md 업데이트

**메인 세션 역할:** 단순 CLI 호출 (상태 업데이트만)

기획서를 project.json에 저장하세요:

```bash
echo '{"id":"{프로젝트ID}","status":"planning"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status
```

### CLAUDE.md 업데이트 (infraPath가 있는 경우)

프로젝트에 infraPath가 설정되어 있으면 (`good-vibe:hello`로 생성된 경우), 기획서의 아키텍처 섹션을 CLAUDE.md에 추가합니다:

```bash
echo '{"claudeMdPath":"{infraPath}/CLAUDE.md","sectionName":"architecture-placeholder","content":"### 아키텍처\n{기획서에서 추출한 아키텍처 요약}"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js append-claude-md
```

**추출할 내용:**

- 기획서의 기술 아키텍처 섹션
- 주요 컴포넌트/모듈 구조
- 데이터 플로우

## Step 10: 다음 단계 안내

**메인 세션 역할:** CEO에게 모드별 안내 표시

프로젝트 모드에 따라 차등 안내합니다:

**plan-execute 모드:**

```
기획서가 완성되었습니다! (라운드 {N}에서 수렴, 승인율 {X}%)

다음 단계: 작업을 실행합니다.
→ `good-vibe:execute` — 팀원들이 작업을 실행하고 리뷰합니다
```

**plan-only 모드:**

```
기획서가 완성되었습니다! (라운드 {N}에서 수렴, 승인율 {X}%)

다음 단계: CEO 승인이 필요합니다.
→ `good-vibe:approve` — 기획서를 승인하고 작업을 분배합니다
→ `good-vibe:discuss` — 재토론 (다른 관점에서)
→ `good-vibe:status` — 현재 상태 확인
```

---

## 서브에이전트 모드 (good-vibe:new에서 호출 시)

`good-vibe:new`에서 Task tool로 호출된 경우, 위 Step 1-10을 동일하게 실행하되 **최종 반환 형식**을 제한합니다.

### 반환에 포함할 내용

- **기획서 핵심 요약** (500자 이내) — 기술 스택, 주요 컴포넌트, 작업 수
- **아키텍처 다이어그램** (Mermaid 코드 블록) — CEO 시각적 확인용
- **화면 구조** (해당 시, Mermaid flowchart + ASCII 와이어프레임)
- **수렴 상태** — 라운드 수, 승인율
- **다음 단계 안내** — approved/planning 상태

### 반환에 포함하지 않을 내용

- 개별 에이전트 분석 전문
- 리뷰 상세 내용 (verdict만 전달)
- 중간 라운드 기록
- Tier별 진행률 상세

> **이유:** 메인 세션의 컨텍스트를 보호하기 위함. 상세 내용은 project.json에 저장되어 있으므로 `good-vibe:status`나 `good-vibe:report`로 조회 가능.

---

## 워크플로우 요약 (Thin Controller 준수)

```
Step 1: 프로젝트 로드 (메인 세션 — 단순 조회 CLI)
  ↓
Step 2-5: 토론 라운드 실행 (Task tool — 프롬프트 생성 + Tier 분류 + 디스패치 + 종합)
  ↓
Step 6: CEO 시각적 확인 (메인 세션 — Task 결과 표시 + AskUserQuestion)
  ↓ (수정 요청 시 Step 2-5로 돌아가서 ceoFeedback 주입)
  ↓ (이대로 진행 선택 시)
Step 7-8: 리뷰 + 수렴 확인 (Task tool — 병렬 리뷰 + check-convergence + 진화 추이)
  ↓
  ↓ (미수렴 시 Step 2-5로, feedbackForMe 주입)
  ↓ (수렴 시)
Step 9: 기획서 저장 (메인 세션 — 단순 상태 업데이트 CLI)
  ↓
Step 10: 다음 단계 안내 (메인 세션 — 모드별 안내 표시)
```

**메인 세션 역할:**

- 프로젝트 조회 (list-projects)
- Task tool 결과 표시
- CEO 질문/피드백 수집 (AskUserQuestion)
- 상태 업데이트 (update-status)
- 다음 단계 안내

**Task tool 역할:**

- 토론 프롬프트 생성 + Tier 분류 + 에이전트 디스패치 + 종합
- 전체 리뷰 + 수렴 확인 + 진화 추이 분석
- 모든 LLM 호출과 멀티-CLI 체인
