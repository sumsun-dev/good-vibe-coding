# /discuss — 팀 토론 (멀티에이전트)

## 이 커맨드를 실행하면?

AI 팀원들이 프로젝트를 각자 분석하고, 결과를 모아 **기획서**를 만듭니다.
팀원들끼리 서로 리뷰하면서, 의견이 모일 때까지 반복합니다.

- **소요시간:** 3-10분 (팀 규모와 프로젝트 복잡도에 따라)
- **결과물:** 기획서 (프로젝트 분석 + 작업 계획)
- **다음 단계:** 모드에 따라 `/approve` (plan-only) 또는 `/execute` (plan-execute)

---

팀원들이 각자 독립적으로 프로젝트를 분석하고, 결과를 종합하여 기획서를 작성합니다.
에이전트들이 서로의 작업을 리뷰하고, 결과가 수렴될 때까지 반복합니다 (최대 3라운드).

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

1. **Tier 1** 에이전트를 각각 Task tool로 병렬 디스패치
2. Tier 1 결과 수집
3. **Tier 2** 에이전트 디스패치 (Tier 1 결과를 context.priorTierOutputs에 포함)
4. **Tier 3-4** 에이전트 디스패치 (Tier 1+2 결과 포함)

각 에이전트 호출 시:
```
{emoji} {이름}이(가) 프로젝트를 분석 중입니다...
```

## Step 5: 결과 종합 (Synthesis)

모든 에이전트 분석 결과를 종합합니다:

```bash
echo '{"project": {...}, "agentOutputs": [...], "round": 1}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js synthesis-prompt
```

생성된 프롬프트를 실행하여 통합 기획서를 작성하세요.

## Step 6: 리뷰 (전체 에이전트 병렬)

종합 기획서를 전체 에이전트가 리뷰합니다 (Task tool 병렬):

```bash
echo '{"teamMember": {...}, "synthesizedPlan": "...", "round": 1}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js review-prompt
```

## Step 7: 수렴 확인

```bash
echo '{"reviews": [...]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js check-convergence
```

- **수렴 (80% 이상 승인)** → Step 8로 진행
- **미수렴** → Round 2로 (Step 4로 돌아감, 각 에이전트에게 이전 기획서 + 피드백 전달)
- **최대 3라운드**: 3라운드까지 미수렴 시 강제 수렴. 미해결 이견은 "미합의 사항"으로 기록

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

이 단계는 프로젝트에 infraPath가 설정되어 있을 때만 실행합니다 (`/hello`를 통해 생성된 경우).

## Step 9: 다음 단계 안내

프로젝트 모드에 따라 차등 안내합니다:

**plan-execute 모드:**
```
기획서가 완성되었습니다! (라운드 {N}에서 수렴, 승인율 {X}%)

다음 단계: 작업을 실행합니다.
→ `/execute` — 팀원들이 작업을 실행하고 리뷰합니다
```

**plan-only 모드:**
```
기획서가 완성되었습니다! (라운드 {N}에서 수렴, 승인율 {X}%)

다음 단계: CEO 승인이 필요합니다.
→ `/approve` — 기획서를 승인하고 작업을 분배합니다
→ `/discuss` — 재토론 (다른 관점에서)
→ `/status` — 현재 상태 확인
```
