# /execute — 작업 실행 (크로스 리뷰 포함)

plan-execute 모드에서 분배된 작업을 팀원(에이전트)에게 위임하여 실행하고, 리뷰를 거칩니다.

## Step 1: 프로젝트 로드

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js list-projects
```

approved 상태인 프로젝트를 선택합니다.

## Step 2: 상태 변경

```bash
echo '{"id":"{프로젝트ID}","status":"executing"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status
```

## Step 3: 실행 계획 표시 (리뷰 포함)

프로젝트의 tasks를 phase별로 그룹핑하고 리뷰 단계를 포함하여 보여주세요:

```bash
echo '{"tasks": [...], "team": [...]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js execution-plan-with-reviews
```

```
Phase 1 (실행):
  - [task-1] 아키텍처 설계 → 민준 (CTO) 🏗️
  - [task-2] API 설계 → 도윤 (Backend) 🔧
Phase 1 (리뷰):
  - task-1 → 리뷰어: 지민 (QA), 세진 (Security)
  - task-2 → 리뷰어: 민준 (CTO), 지민 (QA)

Phase 2 (실행):
  - [task-3] 테스트 작성 → 지민 (QA) 🧪
Phase 2 (리뷰):
  - task-3 → 리뷰어: 민준 (CTO), 도윤 (Backend)
```

## Step 4: Phase별 실행 + 리뷰

각 phase를 순서대로 실행합니다.

### Step 4.1: 태스크 실행 (Task tool 병렬)

같은 phase의 작업을 Task tool로 **병렬** 실행합니다.

각 작업 실행 시:
1. 해당 팀원의 에이전트(team-{roleId})를 Task 도구로 호출
2. 작업 내용과 팀원 페르소나를 전달
3. 결과를 수집

```
{emoji} {이름}이(가) "{작업제목}" 작업을 수행 중입니다...
```

### Step 4.5: 리뷰 상태 전환 + 리뷰어 선정 + 크로스 모델 리뷰

```bash
echo '{"id":"{프로젝트ID}","status":"reviewing"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status
```

**1. 리뷰어 선정:**

```bash
echo '{"task": {...}, "team": [...]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js select-reviewers
```

**2. 프로바이더 배정 (cross-model 전략 시):**

```bash
echo '{"reviewers": [...]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js resolve-review-assignments
```

결과: `[{reviewer: qa, provider: 'gemini'}, {reviewer: security, provider: 'claude'}, ...]`

**3. 프로바이더별 분기 실행 (병렬):**

- **Claude 배정** → Task tool (기존 방식: 리뷰 프롬프트 생성 후 에이전트 실행)
- **Gemini 배정** → Bash tool로 CLI 호출:

```bash
echo '{"reviewer":{...},"task":{...},"taskOutput":"...","model":"gemini-2.0-flash"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js gemini-review
```

**4. 모든 리뷰 결과를 수집하여 Step 4.6 Quality Gate로 전달**

### Step 4.6: Quality Gate 체크

```bash
echo '{"reviews": [...]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js check-quality-gate
```

- **통과** → 다음 Phase로
- **critical 이슈 있음** → 수정 루프 (최대 2회)
  - 수정 프롬프트 생성 후 담당자에게 재실행
  - 수정 결과 재리뷰

### Step 4.7: 에스컬레이션

수정 루프 2회 초과 시 CEO(사용자)에게 에스컬레이션:
- 미해결 critical 이슈 목록 표시
- AskUserQuestion으로 진행 여부 확인

## Step 5: 다음 Phase 반복

Step 4를 모든 Phase에 대해 반복합니다.

## Step 6: 완료

모든 작업이 완료되면:

```bash
echo '{"id":"{프로젝트ID}","status":"completed"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status
```

## Step 7: 다음 단계

```
모든 작업이 완료되었습니다! (리뷰 통과)
- `/report` — 최종 보고서 생성
- `/feedback` — 팀원 피드백
- `/status` — 최종 상태 확인
```
