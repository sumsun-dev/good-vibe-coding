# /new — 통합 프로젝트 시작

프로젝트 아이디어를 받아 복잡도를 분석하고, 적합한 모드로 자동 진행합니다.

> **💡 `/hello` 없이도 `/new`로 바로 시작할 수 있습니다.**
> `/hello`는 GitHub 저장소와 프로젝트 인프라(폴더, CLAUDE.md)를 먼저 셋업할 때 사용합니다.
> - 코드를 직접 생성/관리하고 싶다면 → `/hello` → `/new`
> - 기획서와 보고서만 필요하다면 → `/new`로 바로 시작

## 초보자 안내 (처음 실행 시 표시)

프로젝트를 시작하기 전에 전체 흐름을 안내합니다:

```
👋 Good Vibe Coding에 오신 것을 환영합니다!

프로젝트 아이디어만 말씀해주시면, AI 팀이 기획부터 실행까지 도와드립니다.

전체 흐름:
  /new → /discuss → /approve → /execute → /report

지금은 아이디어만 입력해주세요. 나머지는 단계별로 안내해드립니다.
```

## Step 0: 버전 체크

새 프로젝트를 시작하기 전에 최신 버전인지 확인합니다:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js check-version
```

**`updateAvailable: false`** → Step 1로 바로 진행합니다.

**`updateAvailable: true`** → 업데이트 여부를 물어봅니다:

```
질문: "새 버전이 있습니다 (현재: {version}). 업데이트하시겠습니까?"
header: "업데이트"
options:
  - label: "업데이트 후 진행 (Recommended)"
    description: "최신 버전으로 업데이트한 뒤 /new를 다시 실행합니다"
  - label: "이대로 진행"
    description: "현재 버전으로 프로젝트를 시작합니다"
```

"업데이트 후 진행" 선택 시:
```
📦 업데이트 방법:

  # 소스 설치 사용자
  cd good-vibe-coding && git pull && npm install

  # 플러그인 사용자
  claude plugin update sumsun-dev/good-vibe-coding

업데이트 후 /new를 다시 실행해주세요.
```

이 경우 여기서 커맨드를 종료합니다. "이대로 진행" 선택 시 Step 1로 넘어갑니다.

---

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

### 첫 프로젝트 사용자 (기존 프로젝트 없음)

복잡도 분석 결과에 따라 모드를 **자동 선택**합니다:
- simple → "바로 만들기" (quick-build) 자동 선택
- medium → "간단 기획 후 만들기" (plan-execute) 자동 선택
- complex → "팀 토론 후 만들기" (plan-only) 자동 선택

자동 선택 후 안내:
```
복잡도 분석 결과: {level}
→ "{선택된 모드}" 모드로 진행합니다.
  다른 모드를 원하시면 말씀해주세요.
```

### 기존 사용자 (프로젝트가 1개 이상 있음)

AskUserQuestion으로 모드를 선택하게 하세요.
복잡도 분석 결과에 따라 권장 모드를 표시합니다.

옵션:
- **"바로 만들기"** (quick-build) — 빠르게 결과물을 얻고 싶을 때
  - ⏱ 소요시간: 3-5분
  - simple 프로젝트에 권장 (간단한 봇, 유틸리티, 스크립트)
  - 2-3명 팀이 토론 없이 바로 만들고 QA 리뷰

- **"간단 기획 후 만들기"** (plan-execute) — 기획과 실행을 한번에
  - ⏱ 소요시간: 10-20분
  - medium 프로젝트에 권장 (웹앱, API 서버, CRUD 앱)
  - 3-5명 팀이 1라운드 토론 후 자동 실행

- **"팀 토론 후 만들기"** (plan-only → plan-execute) — 충분히 논의한 후 시작
  - ⏱ 소요시간: 20-40분
  - complex 프로젝트에 권장 (대규모 시스템, 멀티서비스, 플랫폼)
  - 5-8명 팀이 최대 3라운드 토론 + CEO 승인 후 실행

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

## Step 4.5: 스킬/에이전트 추천

팀 구성 후, 프로젝트에 도움이 될 스킬과 에이전트를 자동 추천합니다.

### 1. 추천 요청

```bash
echo '{"projectType":"{타입}","complexity":"{level}","description":"{프로젝트 설명}","teamRoles":["{역할1}","{역할2}",...]}' \
  | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js recommend-setup
```

### 2. 결과 처리

- 추천 결과가 **비어있으면** (`skills`와 `agents` 모두 빈 배열) → 이 단계를 건너뛰고 Step 5로 진행
- 추천 결과가 **있으면** → `formatted` 필드의 마크다운 테이블을 표시하고 AskUserQuestion으로 선택:
  - **"전체 설치"** — 추천된 모든 항목 설치
  - **"선택 설치"** — 사용자가 원하는 항목만 선택
  - **"건너뛰기"** — 설치 없이 진행

### 3. 설치 실행

사용자가 전체 설치 또는 선택 설치를 선택한 경우:

```bash
echo '{"items":["항목id1","항목id2",...]}' \
  | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js install-setup
```

설치 결과의 `formatted` 필드를 표시합니다.

### 4. Step 5로 진행

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

📄 /report — 프로젝트 전체 과정을 정리한 보고서를 생성합니다
💬 /feedback — 팀원별 성과를 분석하고, 다음 프로젝트를 위한 개선점을 제안합니다
📊 /status — 프로젝트 상태와 작업 진행률을 확인합니다
```
