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
실행이 시작된 프로젝트(executing/reviewing/completed)는 되돌릴 수 없습니다.

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

## Step 2: 토론 프롬프트 생성

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js discussion-prompt --id {프로젝트ID} --round 1
```

## Step 3: 에이전트 tier 분류

팀원을 priority tier별로 그룹화합니다:

```bash
echo '{"team": [프로젝트팀]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js group-agents
```

- Tier 1 (priority 1-2): CTO, PO, Researchers — 전략/요구사항 먼저
- Tier 2 (priority 3-4): Fullstack, UI/UX, Frontend, Backend — 구현 관점
- Tier 3 (priority 5-7): QA, Security, DevOps, Data, Tech/Design Researcher — 검증/리서치
- Tier 4 (priority 8+): Tech Writer — 부가 분석

## Step 4: Tier별 병렬 에이전트 디스패치

각 tier를 순서대로, tier 내 에이전트를 **Task tool로 병렬 디스패치**합니다.

각 에이전트에게 전달할 프롬프트:

```bash
echo '{"project": {...}, "teamMember": {...}, "context": {"round": 1}}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js agent-analysis-prompt
```

**진행률 표시:** 각 Tier 시작/완료 시 progress-formatter를 활용하여 진행률을 표시합니다.

```
{formatDiscussionProgress(round, maxRounds, currentTier, totalTiers, tierAgents)}
```

1. **Tier 1** 에이전트를 각각 Task tool로 병렬 디스패치
   - `{formatTierProgress('전략/요구사항', completedAgents, totalAgents)}`
2. Tier 1 결과 수집
3. **Tier 2** 에이전트 디스패치 (Tier 1 결과를 context.priorTierOutputs에 포함)
   - `{formatTierProgress('구현', completedAgents, totalAgents)}`
4. **Tier 3-4** 에이전트 디스패치 (Tier 1+2 결과 포함)
   - `{formatTierProgress('검증', completedAgents, totalAgents)}`

각 에이전트 호출 시:

```
{emoji} {이름}이(가) 프로젝트를 분석 중입니다...
```

## Step 5: 결과 종합 (Synthesis)

모든 에이전트 분석 결과를 종합합니다:

```bash
echo '{"project": {...}, "agentOutputs": [...], "round": 1}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js synthesis-prompt
```

CEO 피드백이 있는 경우 (Ralph Loop 재분석 시), `context.ceoFeedback`을 함께 전달합니다:

```bash
echo '{"project": {...}, "agentOutputs": [...], "round": 1, "ceoFeedback": "CEO 피드백 내용"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js synthesis-prompt
```

생성된 프롬프트를 실행하여 통합 기획서를 작성하세요.
기획서에는 **Mermaid 아키텍처 다이어그램**과 **화면 구조** (UI 프로젝트인 경우)가 반드시 포함됩니다.

## Step 5.5: CEO 시각적 확인 (Ralph Loop)

종합 기획서가 생성되면, CEO에게 핵심 산출물을 시각적으로 보여주고 피드백을 수집합니다.
CEO가 승인할 때까지 이 단계를 반복합니다.

### 표시 내용

기획서에서 다음을 추출하여 CEO에게 보여줍니다:

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
    - "이대로 진행 (Recommended)" — 리뷰 단계(Step 6)로 넘어갑니다
    - "수정 요청" — 구체적 피드백을 주시면 반영합니다
    - "처음부터 다시" — 새로운 방향으로 재분석합니다
```

#### "이대로 진행" 선택 시

Step 6(리뷰)으로 넘어갑니다.

#### "수정 요청" 선택 시

CEO에게 수정 사항을 자유 입력받습니다.

입력받은 피드백을 `ceoFeedback`으로 저장하고:

1. CEO 피드백을 에이전트 분석 프롬프트에 주입 (`context.ceoFeedback`으로 전달, 기존 `feedbackForMe`와 동일 방식)
2. Tier별 재분석 실행 (Step 4로 돌아감, CEO 피드백이 관련된 역할에 타겟 주입)
3. 재종합 (Step 5 Synthesis)
4. 다시 CEO에게 시각적 확인 표시 (이 Step 5.5로 복귀)

이 루프는 CEO가 "이대로 진행"을 선택할 때까지 반복합니다.
라운드 수 제한은 없습니다 (CEO 주도 종료).

#### "처음부터 다시" 선택 시

CEO에게 새로운 방향을 입력받고, Step 4 (Tier별 분석)부터 다시 실행합니다.
이전 기획서와 ceoFeedback은 초기화됩니다.

### 기존 "CEO 결정 필요 사항" 처리

기획서에 "CEO 결정 필요 사항" 섹션이 있으면, 위 CEO 확인 시 함께 표시합니다.
각 결정 사항에 대한 선택지를 추가로 제시하세요.

## Step 6: 리뷰 (전체 에이전트 병렬)

종합 기획서를 전체 에이전트가 리뷰합니다 (Task tool 병렬):

```bash
echo '{"teamMember": {...}, "synthesizedPlan": "...", "round": 1}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js review-prompt
```

## Step 7: 수렴 확인

이전 라운드 정보가 있으면 `previousRounds`를 함께 전달하여 진화 추이를 확인합니다:

```bash
echo '{"reviews": [...], "previousRounds": [{"approvalRate": 0.6, "blockers": ["이슈A"]}]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js check-convergence
```

`previousRounds`가 없으면 기존처럼 동작합니다:

```bash
echo '{"reviews": [...]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js check-convergence
```

**진화 추이 표시** (`evolution` 필드가 있을 때):

```
📊 라운드 {N} 수렴 상태

승인율 추이:
  Round 1: 60% ████████░░░░
  Round 2: 75% ██████████░░
  Round 3: 85% ███████████░

개선 속도: +10% ({trend})

블로커 변화:
  ✅ 해결: {resolvedBlockers}
  ⚠️ 신규: {newBlockers}
```

- **수렴 (80% 이상 승인)** → Step 8로 진행
- **미수렴** → Round 2로 (Step 4로 돌아감, 각 에이전트에게 이전 기획서 + 피드백 전달)
  - 다음 라운드의 `previousRounds`에 현재 라운드 `{ approvalRate, blockers }`를 추가
- **최대 3라운드**: 3라운드까지 미수렴 시 AskUserQuestion으로 선택지를 제시합니다:

```
3라운드 후에도 미수렴 (승인율 {N}%). 어떻게 할까요?

AskUserQuestion:
  질문: "토론이 3라운드 후에도 수렴하지 않았습니다. 어떻게 진행할까요?"
  header: "미수렴"
  options:
    - "강제 수렴 (Recommended)" — 현재 기획서로 확정, 미합의 사항 기록
    - "추가 토론" — 1라운드 더 진행 (최대 1회 추가)
    - "모드 변경" — plan-only로 전환하여 CEO가 직접 조정
    - "중단" — 토론 종료, 기획서 미확정
```

수렴 상태 표시: `{formatConvergenceStatus(approvalRate, threshold, blockers)}`

## Step 8: 기획서 저장

기획서를 project.json에 저장하세요:

```bash
echo '{"id":"{프로젝트ID}","status":"planning"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status
```

## Step 8.5: CLAUDE.md 업데이트 (프로젝트에 CLAUDE.md가 있는 경우)

프로젝트의 infraPath가 있으면, 기획서의 아키텍처 섹션을 CLAUDE.md에 추가합니다:

```bash
echo '{"claudeMdPath":"{infraPath}/CLAUDE.md","sectionName":"architecture-placeholder","content":"### 아키텍처\n{기획서에서 추출한 아키텍처 요약}"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js append-claude-md
```

**추출할 내용:**

- 기획서의 기술 아키텍처 섹션
- 주요 컴포넌트/모듈 구조
- 데이터 플로우

이 단계는 프로젝트에 infraPath가 설정되어 있을 때만 실행합니다 (`good-vibe:hello`를 통해 생성된 경우).

## Step 9: 다음 단계 안내

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

`good-vibe:new`에서 Task tool로 호출된 경우, 위 Step 1-9를 동일하게 실행하되 **최종 반환 형식**을 제한합니다.

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
