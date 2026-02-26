# /start — 통합 프로젝트 시작

프로젝트 아이디어를 받아 복잡도를 분석하고, 적합한 모드로 자동 진행합니다.

## Step 1: 프로젝트 아이디어 수집

사용자에게 물어보세요:

```
어떤 프로젝트를 만들고 싶으세요?
자유롭게 설명해주세요. (예: "날씨를 알려주는 텔레그램 봇", "팀 프로젝트 관리 웹앱")
```

## Step 2: 복잡도 자동 분석

프로젝트 설명을 분석하여 복잡도를 판단합니다:

```bash
echo '{"description": "사용자 입력"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js complexity-analysis
```

생성된 프롬프트를 실행하여 복잡도를 판단한 후:

```bash
echo '{"rawOutput": "분석 결과"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js parse-complexity
```

## Step 3: 모드 선택

AskUserQuestion으로 모드를 선택하게 하세요.
복잡도 분석 결과에 따라 권장 모드를 표시합니다.

옵션:
- **"바로 만들기"** (quick-build) — CTO 1회 분석 + 엔지니어 실행 + QA 리뷰
  - simple 프로젝트에 권장
  - 2-3명 팀, 토론 없이 바로 실행

- **"간단 기획 후 만들기"** (plan-execute) — 1라운드 토론 + 자동승인 + 실행/리뷰
  - medium 프로젝트에 권장
  - 3-5명 팀, 1라운드 토론

- **"팀 토론 후 만들기"** (plan-only → plan-execute) — 풀 멀티에이전트 토론(최대 3라운드) + CEO 승인 + 실행/리뷰
  - complex 프로젝트에 권장
  - 5-15명 팀, 최대 3라운드 토론

## Step 4: 프로젝트 타입 자동 판단 + 팀 구성

프로젝트 설명에서 타입을 추론하세요 (web-app, api-server, telegram-bot, cli-tool 등).
복잡도별 기본값을 조회합니다:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js complexity-defaults --level {level}
```

추천 팀을 구성합니다:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js recommend-team --type {프로젝트타입}
```

프로젝트를 생성합니다:

```bash
echo '{"name": "프로젝트명", "type": "타입", "description": "설명", "mode": "선택된모드"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js create-project
```

## Step 5: 선택된 모드로 플로우 실행

### 모드 A: 바로 만들기 (quick-build)

토론/승인 없이 CTO 분석 → 바로 실행 → QA 리뷰.

#### A-1. CTO 아키텍처 분석

CTO 에이전트에게 프로젝트 분석을 요청합니다 (Task tool 1회):

```bash
echo '{"project": {...}, "teamMember": {CTO팀원}, "context": {"round": 1}}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js agent-analysis-prompt
```

생성된 프롬프트로 Task tool 호출 → CTO의 아키텍처 분석 결과를 받습니다.

#### A-2. 작업 목록 생성

CTO 분석 결과를 기획서로 저장하고 작업 분배:

```bash
echo '{"id":"{프로젝트ID}","status":"approved"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status
```

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js task-distribution-prompt --id {프로젝트ID}
```

생성된 프롬프트를 실행하여 작업 목록을 만들고 프로젝트에 저장합니다.

#### A-3. 작업 실행 (Task tool 병렬)

```bash
echo '{"id":"{프로젝트ID}","status":"executing"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status
```

각 작업을 담당 에이전트(team-{roleId})에게 Task tool로 병렬 디스패치합니다.
작업 실행 프롬프트:

```bash
echo '{"task": {...}, "teamMember": {...}}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js execution-prompt
```

```
{emoji} {이름}이(가) "{작업제목}" 작업을 수행 중입니다...
```

#### A-4. QA 리뷰

```bash
echo '{"id":"{프로젝트ID}","status":"reviewing"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status
```

각 작업 결과에 대해 QA 에이전트가 리뷰합니다 (Task tool):

```bash
echo '{"reviewer": {QA팀원}, "task": {...}, "taskOutput": "..."}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js task-review-prompt
```

Quality Gate 체크:

```bash
echo '{"reviews": [...]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js check-quality-gate
```

- **통과** → A-5로
- **critical 이슈** → 담당자에게 수정 요청 (최대 2회), 그래도 미해결 시 사용자에게 보고

#### A-5. 완료

```bash
echo '{"id":"{프로젝트ID}","status":"completed"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status
```

### 모드 B: 간단 기획 후 만들기 (plan-execute)

1. `/discuss` 실행 (1라운드)
2. 자동 승인 처리
3. `/execute` 실행 (리뷰 포함)
4. 완료 보고

### 모드 C: 팀 토론 후 만들기 (plan-only → execute)

1. `/discuss` 실행 (최대 3라운드, 수렴까지)
2. `/approve` 실행 (CEO 승인)
3. `/execute` 실행 (리뷰 포함)
4. 완료 보고

## Step 6: 완료 안내

```
프로젝트가 완료되었습니다!
- `/report` — 최종 보고서 생성
- `/feedback` — 팀원 피드백
- `/status` — 프로젝트 상태 확인
```
