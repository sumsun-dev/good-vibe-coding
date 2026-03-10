---
description: '통합 프로젝트 시작 — 복잡도 분석 + 팀 구성 + 자동 진행'
---

# good-vibe:new — 통합 프로젝트 시작

프로젝트 아이디어를 받아 복잡도를 분석하고, 적합한 모드로 자동 진행합니다.

> **`good-vibe:hello` 없이도 `good-vibe:new`로 바로 시작할 수 있습니다.**
> `good-vibe:hello`는 환경 설정(도구 확인)과 개인 설정(CLAUDE.md)에 사용합니다. 처음이면 hello 먼저.
> `good-vibe:new` 안에서 프로젝트 폴더와 GitHub 저장소를 선택적으로 생성할 수 있습니다.

## 초보자 안내 (처음 실행 시 표시)

프로젝트를 시작하기 전에 전체 흐름을 안내합니다:

```
Good Vibe Coding에 오신 것을 환영합니다!

프로젝트 아이디어만 말씀해주시면, AI 팀이 기획부터 실행까지 도와드립니다.

전체 흐름:
  good-vibe:new → good-vibe:discuss → good-vibe:approve → good-vibe:execute → good-vibe:report

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
    description: "최신 버전으로 업데이트한 뒤 good-vibe:new를 다시 실행합니다"
  - label: "이대로 진행"
    description: "현재 버전으로 프로젝트를 시작합니다"
```

"업데이트 후 진행" 선택 시:

```
업데이트 방법:

  # 소스 설치 사용자
  cd good-vibe-coding && git pull && npm install

  # 플러그인 사용자
  claude plugin update sumsun-dev/good-vibe-coding

업데이트 후 good-vibe:new를 다시 실행해주세요.
```

이 경우 여기서 커맨드를 종료합니다. "이대로 진행" 선택 시 Step 0.5로 넘어갑니다.

---

## Step 0.5: 의도 분류 + 조건부 명확도 분석 (Intent Gate)

사용자가 전달한 텍스트(있는 경우)로 의도를 분류합니다.
입력 텍스트가 있고 intent="create"이면 명확도 분석까지 한번에 수행하여 Task 호출을 줄입니다.

**Task tool로 실행합니다:**

```
의도를 분류하고, 조건 충족 시 명확도까지 분석하세요.

**[필수] CLI에 JSON 전달 시 Write tool 사용:**
- LLM 응답 등 큰 JSON은 반드시 Write tool로 /tmp/gv-*.json에 저장 후 --input-file로 전달하세요.
- echo/cat/heredoc(<<)로 큰 JSON을 bash에 직접 전달하면 보안 탐지에 걸려 자동승인이 중단됩니다.

1. 의도 분류:
   echo '{"input": "{사용자 입력 텍스트}"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js classify-intent

2. intent가 "create"이고 입력 텍스트가 비어있지 않으면, 명확도 분석도 수행:
   echo '{"description": "{사용자 입력 텍스트}"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js clarity-check
   → 생성된 프롬프트를 LLM으로 실행
   → LLM 응답을 Write tool로 /tmp/gv-clarity.json에 저장 (형식: {"rawOutput": "LLM 응답 전체"})
   → node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js parse-clarity --input-file /tmp/gv-clarity.json

   intent가 "create"가 아니거나 입력 텍스트가 없으면, clarity는 null로 반환.

반환 (JSON):
- intent: 의도 분류 결과 전체 (intent, route, projects 등)
- clarity: 명확도 분석 결과 (clarity, dimensions, summary, questions) 또는 null

CLAUDE_PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}
```

> 사용자가 텍스트 없이 `good-vibe:new`만 실행한 경우: `{"input": ""}` 전달 → clarity는 null

**결과별 분기:**

### intent: "create" + clarity가 있음 (입력 텍스트로 명확도 분석 완료)

`currentDescription = 사용자 입력 텍스트`로 설정합니다.

hasExistingProjects 확인:

- **false** → Step 1.5.B(결과 처리)로 바로 진행합니다 (Step 1, 1.5.A 건너뜀).
- **true** → 기존 프로젝트 선택 AskUserQuestion (아래 참조). "새 프로젝트 시작" 선택 시 Step 1.5.B로 진행.

### intent: "create" + clarity가 null (입력 텍스트 없음) + hasExistingProjects: false

→ Step 1로 바로 진행합니다.

### intent: "create" + clarity가 null + hasExistingProjects: true

기존 프로젝트가 있으므로, 이어할지 새로 시작할지 물어봅니다:

```
질문: "기존 프로젝트를 이어서 할까요, 새로 시작할까요?"
header: "프로젝트 선택"
options:
  - label: "{projects[0].name} ({projects[0].status})"
    description: "{projects[0].mode} · 팀 {projects[0].teamSize}명"
  - label: "{projects[1].name} ({projects[1].status})"  (있으면, 최대 3개)
    description: "..."
  - label: "새 프로젝트 시작"
    description: "새로운 아이디어로 프로젝트를 시작합니다"
```

기존 프로젝트 선택 시 → **route.message** 안내 후 종료.
"새 프로젝트 시작" 선택 시 → Step 1로 진행.

### intent: "resume"

CEO에게 재개 안내:

```
"{suggestedProject.name}" 프로젝트를 이어서 진행할 수 있습니다.

현재 상태: {suggestedProject.status}
다음 단계: {route.message}
```

종료.

### intent: "modify"

```
"{suggestedProject.name}" 프로젝트를 수정합니다.
→ good-vibe:modify를 사용하세요.
```

종료.

### intent: "status"

```
프로젝트 상태 확인은 good-vibe:status를 사용하세요.
```

종료.

---

## Step 1: 프로젝트 아이디어 수집

사용자에게 물어보세요:

```
어떤 프로젝트를 만들고 싶으세요?
자유롭게 설명해주세요. (예: "날씨를 알려주는 텔레그램 봇", "팀 프로젝트 관리 웹앱")
```

## Step 1.5: 프로젝트 분석 (Thin Controller)

> **Thin Controller 원칙:** 메인 세션은 CEO UI만 담당. 모든 CLI+LLM 작업은 Task tool로 위임합니다.

**변수 초기화:**

- `currentDescription = 사용자 입력`

### 1.5.A: 분석 실행 (Task tool)

> **건너뛰기 조건:** Step 0.5에서 clarity가 이미 반환되었으면 이 단계를 건너뛰고 1.5.B로 진행합니다.

Task tool 프롬프트:

```
프로젝트 설명을 분석하세요.

**[필수] CLI에 JSON 전달 시 Write tool 사용:**
- LLM 응답, PRD, 작업 목록 등 큰 JSON은 반드시 Write tool로 /tmp/gv-*.json 파일에 저장한 뒤 --input-file 플래그로 CLI에 전달하세요.
- echo/cat/heredoc(<<)로 큰 JSON을 bash에 직접 전달하면 보안 탐지에 걸려 자동승인이 중단됩니다.

1. 명확도 분석:
   echo '{"description": "{currentDescription}"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js clarity-check
   → 생성된 프롬프트를 LLM으로 실행
   → LLM 응답을 Write tool로 /tmp/gv-clarity.json에 저장 (형식: {"rawOutput": "LLM 응답 전체"})
   → node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js parse-clarity --input-file /tmp/gv-clarity.json

반환 (JSON):
- clarity: 명확도 점수
- dimensions: 차원별 점수
- summary: 명확도 요약
- questions: 부족한 차원의 질문 배열 (clarity < 0.8일 때만)

CLAUDE_PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}
```

### 1.5.B: 결과 처리 (메인 세션)

- **clarity >= 0.8**: 명확도 통과 표시 → Step 2(PRD 생성)로

- **clarity < 0.8**: 차원별 점수 + 질문 표시 → 1.5.C로

### 1.5.C: CEO 질문 (메인 세션)

명확도 분석 결과를 표시합니다:

```
📊 명확도 분석: {clarity*100}%

{summary}

차원별 점수:
- scope: {score*100}%
- userStory: {score*100}%
- techStack: {score*100}%
- constraints: {score*100}%
- successCriteria: {score*100}%
```

AskUserQuestion으로 부족한 차원의 질문들을 표시합니다 (최대 4개, Task 반환의 questions 사용).

### 1.5.D: 보강 + 재분석 (Task tool)

Task tool 프롬프트:

```
프로젝트 설명을 보강하고 재분석하세요.

**[필수] CLI에 JSON 전달 시 Write tool 사용:**
- LLM 응답, PRD, 작업 목록 등 큰 JSON은 반드시 Write tool로 /tmp/gv-*.json 파일에 저장한 뒤 --input-file 플래그로 CLI에 전달하세요.
- echo/cat/heredoc(<<)로 큰 JSON을 bash에 직접 전달하면 보안 탐지에 걸려 자동승인이 중단됩니다.

1. 설명 보강:
   → 입력 데이터를 Write tool로 /tmp/gv-enrich.json에 저장 (형식: {"original": "{currentDescription}", "answers": [{CEO 답변}]})
   → node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js enrich-description --input-file /tmp/gv-enrich.json
   → 생성된 프롬프트를 LLM으로 실행 → enriched description 획득

2. 보강된 설명으로 명확도 재분석:
   echo '{"description": "{enrichedDescription}"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js clarity-check
   → 생성된 프롬프트를 LLM으로 실행
   → LLM 응답을 Write tool로 /tmp/gv-clarity.json에 저장 (형식: {"rawOutput": "LLM 응답 전체"})
   → node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js parse-clarity --input-file /tmp/gv-clarity.json

반환 (JSON):
- clarity: 명확도 점수
- dimensions: 차원별 점수
- summary: 명확도 요약
- questions: 부족한 차원의 질문 배열 (clarity < 0.8일 때만)
- enrichedDescription: 보강된 설명

CLAUDE_PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}
```

결과 처리: `currentDescription = enrichedDescription`, 1.5.B로 돌아감 (clarity >= 0.8까지 반복)

## Step 2: PRD + 복잡도 분석 + CEO 확인 (CEO 피드백 루프)

> **Thin Controller:** PRD 생성 + 복잡도 분석은 Task tool 1회로 위임. 메인 세션은 결과 표시 + CEO 피드백만.

명확도 통과 후, PRD를 생성하고 복잡도까지 한번에 분석합니다.
CEO가 PRD와 복잡도를 함께 확인하여 방향성을 빠르게 결정합니다.

**변수 초기화:**

- `prd = null`
- `prdFeedback = null`

### 2.A: PRD + 복잡도 분석 (Task tool)

Task tool 프롬프트:

```
PRD를 생성하고 복잡도를 분석하세요.

**[필수] CLI에 JSON 전달 시 Write tool 사용:**
- LLM 응답, PRD, 작업 목록 등 큰 JSON은 반드시 Write tool로 /tmp/gv-*.json 파일에 저장한 뒤 --input-file 플래그로 CLI에 전달하세요.
- echo/cat/heredoc(<<)로 큰 JSON을 bash에 직접 전달하면 보안 탐지에 걸려 자동승인이 중단됩니다.

1. PRD 프롬프트 생성:
   → PRD 입력 데이터를 Write tool로 /tmp/gv-prd-input.json에 저장 (형식: {"description":"{currentDescription}","clarityDimensions":{dimensions},"codebaseInfo":{codebaseInfo 또는 null},"prdFeedback":"{prdFeedback 또는 null}"})
   → node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js generate-prd-prompt --input-file /tmp/gv-prd-input.json

2. 생성된 프롬프트를 LLM으로 실행

3. PRD 파싱:
   → LLM 응답을 Write tool로 /tmp/gv-prd.json에 저장 (형식: {"rawOutput": "LLM 응답 전체"})
   → node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js parse-prd --input-file /tmp/gv-prd.json

4. 복잡도 분석:
   → 입력 데이터를 Write tool로 /tmp/gv-complexity-input.json에 저장 (형식: {"description":"{currentDescription}","prd":{3에서 파싱된 prd}})
   → node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js complexity-analysis --input-file /tmp/gv-complexity-input.json
   → 생성된 프롬프트를 LLM으로 실행
   → LLM 응답을 Write tool로 /tmp/gv-complexity.json에 저장 (형식: {"rawOutput": "LLM 응답 전체"})
   → node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js parse-complexity --input-file /tmp/gv-complexity.json

반환: { prd, formatted, quality, complexity: { level, score, reasoning, dimensions } }
CLAUDE_PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}
```

### 2.B: CEO 확인 (메인 세션)

PRD 마크다운(`formatted`)을 CEO에게 표시합니다.

**`quality.adequate === false`이면** 품질 경고를 표시합니다:

```
⚠️ PRD 품질 경고 (점수: {quality.score}/100):
{quality.warnings를 줄바꿈으로 표시}
```

**복잡도 분석 결과를 함께 표시합니다.** `complexity.dimensions`가 있으면:

```
복잡도 분석: {complexity.level} ({complexity.score*100}점)

{complexity.reasoning}

차원별 점수:
- 기능 범위: {featureScope.score*100}% — {featureScope.evidence}
- 데이터 모델: {dataComplexity.score*100}% — {dataComplexity.evidence}
- 외부 연동: {integrations.score*100}% — {integrations.evidence}
- 인증/보안: {authSecurity.score*100}% — {authSecurity.evidence}
- 확장성: {scalability.score*100}% — {scalability.evidence}
```

`complexity.dimensions`가 없으면 `{complexity.level}` + `{complexity.reasoning}`만 표시합니다.

AskUserQuestion:

```
질문: "이 방향으로 진행할까요?"
header: "PRD + 복잡도 확인"
options:
  - label: "이대로 진행 (Recommended)"  (quality.adequate가 true일 때만 Recommended)
    description: "이 PRD를 기반으로 모드 선택 + 팀 구성을 진행합니다"
  - label: "자동 보강"  (quality.adequate가 false일 때만 표시, Recommended 표시)
    description: "부족한 부분을 자동으로 보강하여 PRD를 다시 생성합니다"
  - label: "수정 요청"
    description: "구체적 피드백을 입력하면 PRD를 다시 생성합니다"
  - label: "처음부터 다시"
    description: "프로젝트 아이디어 입력부터 다시 시작합니다"
```

- **"이대로 진행"** → `prd`, `complexity` 저장 → Step 3(모드 선택)으로
- **"자동 보강"** → `prdFeedback = quality.warnings.join("\n")` → 2.A로 (PRD+복잡도 함께 재생성)
- **"수정 요청"** → CEO 피드백을 `prdFeedback`에 저장 → 2.A로 (prdFeedback 주입)
- **"처음부터 다시"** → `infraPath = null`, `githubUrl = null` 리셋 → Step 1로 돌아감

## Step 3: 모드 선택 + 인프라 선택

### 첫 프로젝트 사용자 (기존 프로젝트 없음)

복잡도 분석 결과에 따라 모드를 **자동 선택**합니다:

- simple → "바로 만들기" (quick-build) 자동 선택
- medium → "간단 기획 후 만들기" (plan-execute) 자동 선택
- complex → "팀 토론 후 만들기" (plan-only) 자동 선택

자동 선택 후, 인프라 선택만 AskUserQuestion으로 물어봅니다:

```
복잡도 분석 결과: {level}
→ "{선택된 모드}" 모드로 진행합니다.
  다른 모드를 원하시면 말씀해주세요.
```

AskUserQuestion:

```
질문: "프로젝트 폴더를 생성할까요?"
header: "인프라"
options:
  - label: "폴더 생성 (Recommended)"
    description: "프로젝트 폴더 + CLAUDE.md + README.md + .gitignore 생성"
  - label: "폴더 + GitHub 저장소"
    description: "프로젝트 폴더 생성 + GitHub 저장소 자동 생성 (gh CLI 필요)"
  - label: "건너뛰기"
    description: "폴더 없이 기획/보고서만 진행"
```

### 기존 사용자 (프로젝트가 1개 이상 있음)

AskUserQuestion **1회로 모드 + 인프라를 동시에** 선택하게 하세요 (questions 배열 2개).
복잡도 분석 결과에 따라 권장 모드를 표시합니다.

```
questions:
  - question: "어떤 모드로 진행할까요?"
    header: "모드"
    multiSelect: false
    options:
      - label: "바로 만들기"  (simple일 때 Recommended)
        description: "3-5분 · 2-3명 팀 · 토론 없이 바로 만들고 QA 리뷰"
      - label: "간단 기획 후 만들기"  (medium일 때 Recommended)
        description: "10-20분 · 3-5명 팀 · 1라운드 토론 후 자동 실행"
      - label: "팀 토론 후 만들기"  (complex일 때 Recommended)
        description: "20-40분 · 5-8명 팀 · 최대 3라운드 토론 + CEO 승인"
  - question: "프로젝트 폴더를 생성할까요?"
    header: "인프라"
    multiSelect: false
    options:
      - label: "폴더 생성 (Recommended)"
        description: "프로젝트 폴더 + CLAUDE.md + README.md + .gitignore 생성"
      - label: "폴더 + GitHub 저장소"
        description: "프로젝트 폴더 생성 + GitHub 저장소 자동 생성 (gh CLI 필요)"
      - label: "건너뛰기"
        description: "폴더 없이 기획/보고서만 진행"
```

모드 매핑:

- **"바로 만들기"** → quick-build
- **"간단 기획 후 만들기"** → plan-execute
- **"팀 토론 후 만들기"** → plan-only

### 3.1 워크트리 격리 설정 (GitHub 선택 시만)

> **"폴더 + GitHub 저장소"를 선택한 경우에만** 이 단계를 진행합니다.
> 다른 인프라 옵션을 선택했으면 건너뜁니다.

AskUserQuestion:

```
질문: "Phase별 워크트리 격리를 사용할까요?"
header: "워크트리"
options:
  - label: "기본 (Recommended)"
    description: "하나의 브랜치에서 순차적으로 작업합니다"
  - label: "워크트리 격리 ON"
    description: "Phase마다 독립 브랜치에서 작업 후 머지 (코드 격리, 병렬 실행 준비)"
```

- **"기본"** → `worktreeIsolation = false`
- **"워크트리 격리 ON"** → `worktreeIsolation = true`

선택 결과를 Step 4.A Task tool에 전달합니다.

## Step 4: 프로젝트 셋업 (Thin Controller)

> **Thin Controller 원칙:** 인프라 생성 + 프로젝트 생성 + 팀 구성 + 추천을 하나의 Task tool로 묶어 메인 세션의 CLI 체인을 제거합니다.

프로젝트 설명에서 타입을 추론하세요 (web-app, api-server, telegram-bot, cli-tool 등).

### 4.A: 인프라 생성 + 프로젝트 생성 + 팀 구성 (Task tool)

Task tool 프롬프트:

```
프로젝트 인프라를 생성하고, 프로젝트를 생성하고, 팀을 구성하세요.

**[필수] CLI에 JSON 전달 시 Write tool 사용:**
- LLM 응답, PRD, 작업 목록 등 큰 JSON은 반드시 Write tool로 /tmp/gv-*.json 파일에 저장한 뒤 --input-file 플래그로 CLI에 전달하세요.
- echo/cat/heredoc(<<)로 큰 JSON을 bash에 직접 전달하면 보안 탐지에 걸려 자동승인이 중단됩니다.

{infraChoice가 "건너뛰기"가 아닐 때:}
1. 프로젝트 폴더 생성:
   echo '{"name": "{name}", "targetDir": "{targetDir}", "description": "{description}", "techStack": "{techStack}"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js setup-project-infra
   → infraPath = 반환된 projectDir

{infraChoice가 "폴더 + GitHub 저장소"일 때:}
2. GitHub 저장소 생성 + Git 초기화:
   echo '{"repoName": "{slug}", "description": "{description}"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js create-github-repo
   echo '{"projectDir": "{infraPath}", "remoteUrl": "{remoteUrl}"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js git-init-push
   → githubUrl = 반환된 URL
   → worktreeIsolation = Step 3.1의 선택 결과 (true/false)

{항상:}
3. 복잡도 기본값 조회:
   node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js complexity-defaults --level {level}

4. 팀 추천:
   node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js recommend-team --type {type}

5. 프로젝트 생성 (PRD + 인프라 + 분석 결과 포함):
   → 프로젝트 데이터를 Write tool로 /tmp/gv-create-project.json에 저장 (형식: {"name": "{name}", "type": "{type}", "description": "{description}", "mode": "{mode}", "prd": {prd}, "infraPath": "{infraPath 또는 null}", "githubUrl": "{githubUrl 또는 null}", "worktreeIsolation": {worktreeIsolation 또는 false}, "clarityAnalysis": {Step 1.5의 clarity 분석 결과 또는 null}, "complexityAnalysis": {Step 2의 complexity 분석 결과 또는 null}})
   → node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js create-project --input-file /tmp/gv-create-project.json

6. 팀 빌드 + 저장:
   echo '{"roleIds": [...], "complexity": "{level}"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js build-team
   echo '{"id": "{projectId}", "team": [...]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js set-team

   **중요:** build-team → set-team을 반드시 실행. 건너뛰면 displayName, trait, speakingStyle이 undefined.

7. 프로젝트 CLAUDE.md 생성 (infraPath가 있을 때만):
   a. echo '{"roles": [...roleIds], "team": [...builtTeam]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js generate-onboarding
   b. → 온보딩 데이터를 Write tool로 /tmp/gv-project-onboarding.json에 저장 (형식: {"claudeMd": "...", "coreRules": "...", "projectDir": "{infraPath}"})
      → node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js write-project-onboarding --input-file /tmp/gv-project-onboarding.json

8. 스킬/에이전트 추천 (선택):
   echo '{"projectType": "{type}", "complexity": "{level}", "description": "...", "teamRoles": [...]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js recommend-setup

targetDir 기본값: ~/projects/{slug} (setupProjectInfra가 자동 결정)

반환:
- projectId: 생성된 프로젝트 ID
- teamSummary: "팀명 (N명): 역할1, 역할2, ..." (1줄)
- infraResult: { projectDir, githubUrl, files } 또는 null (건너뛰기 시)
- recommendations: { skills: [...], agents: [...], formatted: "마크다운 테이블" } 또는 null

CLAUDE_PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}
```

### 4.B: 결과 표시 + 추천 설치 (메인 세션)

결과 표시:

- infraResult가 있으면: "프로젝트 폴더 생성 완료: {infraResult.projectDir}" + GitHub URL (해당 시)
- "프로젝트 생성 완료: {projectId}"
- "팀 구성: {teamSummary}"

recommendations가 **없으면** → Step 5로 바로 진행.

recommendations가 **있으면** → `formatted` 마크다운 테이블을 표시하고 AskUserQuestion:

- **"전체 설치"** — 추천된 모든 항목 설치
- **"선택 설치"** — 사용자가 원하는 항목만 선택
- **"건너뛰기"** — 설치 없이 진행

### 4.C: 설치 실행 (Task tool)

사용자가 전체 설치 또는 선택 설치를 선택한 경우:

Task tool 프롬프트:

```
선택된 항목을 설치하세요.

echo '{"items":["항목id1","항목id2",...]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js install-setup

반환: 설치 결과의 formatted 필드 (마크다운)

CLAUDE_PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}
```

설치 결과를 CEO에게 표시한 후 Step 5로 진행합니다.

## Step 5: 선택된 모드로 플로우 실행

### Phase 실행 프롬프트 템플릿 (A-4/B-4/C-4 공통)

> 아래 템플릿을 각 Phase의 Task tool 프롬프트로 사용합니다. `{ID}`, `{N}` 등을 실제 값으로 치환하세요.

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
- project.json/execute.md 직접 Read 금지 (next-step이 필요 정보 반환, 레시피가 자체 완결)
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

### 모드 A: 바로 만들기 (quick-build)

토론/승인 없이 CTO 분석 → 바로 실행 → QA 리뷰.

#### A-1. CTO 아키텍처 분석 (Task tool)

> **Thin Controller:** CTO 분석 전체(프롬프트 생성 + LLM 실행 + 재분석 루프)를 하나의 Task로 격리합니다.
> 메인 세션은 결과 표시와 CEO 피드백 수집만 담당합니다.

**변수 초기화:**

- `ceoFeedback = null`

##### A-1a. CTO 분석 실행 (Task tool)

Task tool 프롬프트:

```
프로젝트 ID: {ID}의 CTO 아키텍처 분석을 실행하세요.

**[필수] CLI에 JSON 전달 시 Write tool 사용:**
- LLM 응답, PRD, 작업 목록 등 큰 JSON은 반드시 Write tool로 /tmp/gv-*.json 파일에 저장한 뒤 --input-file 플래그로 CLI에 전달하세요.
- echo/cat/heredoc(<<)로 큰 JSON을 bash에 직접 전달하면 보안 탐지에 걸려 자동승인이 중단됩니다.

1. CTO 분석 프롬프트 생성:
   → 분석 입력을 Write tool로 /tmp/gv-cto-analysis.json에 저장 (형식: {"project": {...}, "teamMember": {CTO팀원}, "context": {"round": 1, "prd": {prd}}})
   → node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js agent-analysis-prompt --input-file /tmp/gv-cto-analysis.json

2. {ceoFeedback이 있으면: "context.ceoFeedback에 다음을 추가하세요: {ceoFeedback}"}

3. 생성된 프롬프트를 LLM으로 실행:
   - 분석 결과에 반드시 Mermaid 아키텍처 다이어그램을 포함
   - UI 프로젝트인 경우 화면 구조(Mermaid flowchart + ASCII 와이어프레임)도 포함

반환 (JSON):
- diagram: Mermaid 다이어그램 코드
- uiStructure: 화면 구조 (있는 경우)
- summary: 기술 스택 + 주요 컴포넌트 + 예상 작업 수 요약

CLAUDE_PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}
```

##### A-1b. CEO 시각적 확인 (메인 세션)

서브에이전트가 반환한 결과를 CEO에게 표시:

```
CTO가 아키텍처를 분석했습니다:

{Mermaid 아키텍처 다이어그램}
{화면 구조 — 해당 시}

{기술 스택 + 주요 컴포넌트 + 예상 작업 수 요약}

AskUserQuestion:
  질문: "이대로 진행할까요?"
  header: "분석 확인"
  options:
    - "이대로 진행 (Recommended)" — 작업 분배로 넘어갑니다
    - "수정 요청" — 구체적 피드백을 주시면 반영합니다
    - "모드 변경" — plan-execute 또는 plan-only 모드로 전환
```

##### A-1c. 재분석 루프

- **"수정 요청"** → CEO 피드백을 `ceoFeedback`에 저장하고 **A-1a로 돌아가** Task tool을 다시 호출합니다 (ceoFeedback 포함).
- **"모드 변경"** → Step 3의 모드 선택으로 돌아갑니다.
- **"이대로 진행"** → A-2로 진행합니다.

#### A-2. 작업 분배 + 실행 초기화 (Task tool)

> **Thin Controller:** 승인→작업분배→실행초기화 CLI 체인을 하나의 Task로 묶습니다.

Task tool 프롬프트:

```
프로젝트 ID: {ID}의 작업을 분배하고 실행을 초기화하세요.

**[필수] CLI에 JSON 전달 시 Write tool 사용:**
- LLM 응답, PRD, 작업 목록 등 큰 JSON은 반드시 Write tool로 /tmp/gv-*.json 파일에 저장한 뒤 --input-file 플래그로 CLI에 전달하세요.
- echo/cat/heredoc(<<)로 큰 JSON을 bash에 직접 전달하면 보안 탐지에 걸려 자동승인이 중단됩니다.

1. 상태 변경:
   echo '{"id":"{ID}","status":"approved"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status

2. 작업 분배 프롬프트 생성 + LLM 실행:
   node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js task-distribution-prompt --id {ID}
   → 생성된 프롬프트를 LLM으로 실행 → 작업 목록 생성
   → 작업 목록을 프로젝트에 저장:
   → 작업 데이터를 Write tool로 /tmp/gv-tasks.json에 저장 (형식: {"id":"{ID}","tasks":[...생성된 작업 배열...]})
   → node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js save-tasks --input-file /tmp/gv-tasks.json

3. 실행 초기화:
   echo '{"id":"{ID}","mode":"auto"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js init-execution

4. 상태 변경:
   echo '{"id":"{ID}","status":"executing"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status

반환:
- phaseCount: 총 Phase 수
- taskCount: 총 태스크 수
- taskSummary: Phase별 태스크 요약 (3줄 이내)

CLAUDE_PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}
```

메인 세션에서 표시: "작업 분배 완료: Phase {N}개, 태스크 {M}개"

#### A-4. Phase별 실행 (Task tool로 격리)

> **컨텍스트 보호:** 각 Phase를 독립 Task tool로 실행하여 메인 세션의 컨텍스트 폭발을 방지합니다.

`next-step`으로 실행 계획의 Phase 수를 파악한 뒤, **각 Phase를 개별 Task tool**로 실행합니다.

각 Phase의 Task tool 프롬프트: **"Phase 실행 프롬프트 템플릿"** (Step 5 상단 공통 섹션)을 사용합니다.

Phase가 끝날 때마다 메인 세션에서 진행률을 표시합니다:

```
Phase {N}/{total} 완료 — {Phase 요약}
품질게이트: {passed/failed}
```

#### A-5. 완료

```bash
echo '{"id":"{프로젝트ID}","status":"completed"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status
```

### 모드 B: 간단 기획 후 만들기 (plan-execute)

> **컨텍스트 보호:** discuss 전체와 execute의 각 Phase를 독립 Task tool로 실행합니다.
> 메인 세션에는 요약만 반환되어 컨텍스트가 ~15KB 이내로 유지됩니다.

#### B-1. 토론 + CEO 확인 (Ralph Loop)

토론을 라운드 단위로 서브에이전트에서 실행하고, CEO 확인은 메인 세션에서 수행합니다.

**변수 초기화:**

- `ceoFeedback = null`
- `roundNumber = 1`

##### B-1a. 토론 라운드 실행 (Task tool)

Task tool 프롬프트:

```
프로젝트 ID: {ID}로 discuss 라운드 {roundNumber}을 실행하세요.

1. commands/discuss.md의 Step 2를 실행합니다 (Phase A: Tier별 분석 + 종합 + Phase B: 리뷰 + 수렴).
   Step 3(CEO 확인)과 Step 4-5(저장/안내)는 실행하지 마세요.
2. {ceoFeedback이 있으면: "CEO 피드백을 context.ceoFeedback으로 전달하세요: {ceoFeedback}"}
3. 에이전트 분석/종합 시 context.prd = {prd}를 전달하세요.
4. 기획서에 Mermaid 아키텍처 다이어그램과 화면 구조를 반드시 포함하세요.
5. 라운드 데이터 저장 시 ceoFeedback을 roundData에 포함하세요 (discuss.md "CEO 피드백 보존" 참조).
6. 반환 (최대 1000자):
   - planSummary: 기획서 핵심 요약
   - diagram: Mermaid 아키텍처 다이어그램
   - techStack: 기술 스택 + 작업 규모 요약
   - convergence: 수렴 상태
   상세 기획서는 project.json에 저장하세요.

CLAUDE_PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}
```

##### B-1b. CEO 시각적 확인 (메인 세션)

서브에이전트가 반환한 결과를 CEO에게 표시:

```
{Mermaid 아키텍처 다이어그램}
{화면 구조 — 해당 시}

기술 스택: {...}
예상 규모: Phase {N}개, 태스크 {M}개

AskUserQuestion:
  질문: "기획이 이대로 괜찮을까요?"
  header: "기획 확인"
  options:
    - "이대로 진행 (Recommended)" — 승인 후 실행으로 넘어갑니다
    - "수정 요청" — 구체적 피드백을 입력하세요
    - "처음부터 다시" — 새로운 방향으로 재분석합니다
```

##### B-1c. 반복

- **"수정 요청"** → CEO 피드백을 `ceoFeedback`에 저장, `roundNumber++`, B-1a로 돌아감
- **"처음부터 다시"** → `ceoFeedback = null`, `roundNumber = 1`, CEO에게 새 방향 입력받고 B-1a로
- **"이대로 진행"** → B-1d로

##### B-1d. 리뷰 + 수렴 (Task tool)

CEO 승인 후, 에이전트 리뷰를 실행합니다:

Task tool 프롬프트:

```
프로젝트 ID: {ID}의 기획서를 팀원들이 리뷰합니다.

1. commands/discuss.md의 Step 2 Phase B를 실행합니다 (리뷰 + 수렴 확인 + 라운드 데이터 저장).
2. CEO가 이미 승인했으므로, 에이전트 수렴 여부와 관계없이 기획서를 확정합니다.
3. 반환: 리뷰 요약 + 수렴 상태

CLAUDE_PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}
```

#### B-2. 자동 승인 + 작업 분배 + 실행 초기화 (Task tool)

> **Thin Controller:** 승인→작업분배→실행초기화 CLI 체인을 하나의 Task로 묶습니다.

Task tool 프롬프트:

```
프로젝트 ID: {ID}의 작업을 분배하고 실행을 초기화하세요.

**[필수] CLI에 JSON 전달 시 Write tool 사용:**
- LLM 응답, PRD, 작업 목록 등 큰 JSON은 반드시 Write tool로 /tmp/gv-*.json 파일에 저장한 뒤 --input-file 플래그로 CLI에 전달하세요.
- echo/cat/heredoc(<<)로 큰 JSON을 bash에 직접 전달하면 보안 탐지에 걸려 자동승인이 중단됩니다.

1. 상태 변경:
   echo '{"id":"{ID}","status":"approved"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status

2. 작업 분배 프롬프트 생성 + LLM 실행:
   node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js task-distribution-prompt --id {ID}
   → 생성된 프롬프트를 LLM으로 실행 → 작업 목록 생성
   → 작업 목록을 프로젝트에 저장:
   → 작업 데이터를 Write tool로 /tmp/gv-tasks.json에 저장 (형식: {"id":"{ID}","tasks":[...생성된 작업 배열...]})
   → node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js save-tasks --input-file /tmp/gv-tasks.json

3. 실행 초기화:
   echo '{"id":"{ID}","mode":"auto"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js init-execution

4. 상태 변경:
   echo '{"id":"{ID}","status":"executing"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status

반환:
- phaseCount: 총 Phase 수
- taskCount: 총 태스크 수
- taskSummary: Phase별 태스크 요약 (3줄 이내)

CLAUDE_PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}
```

메인 세션에서 표시: "작업 분배 완료: Phase {N}개, 태스크 {M}개"

#### B-4. Phase별 실행 (Task tool로 격리)

> **컨텍스트 보호:** 각 Phase를 독립 Task tool로 실행하여 메인 세션의 컨텍스트 폭발을 방지합니다.

`next-step`으로 실행 계획의 Phase 수를 파악한 뒤, **각 Phase를 개별 Task tool**로 실행합니다.

각 Phase의 Task tool 프롬프트: **"Phase 실행 프롬프트 템플릿"** (Step 5 상단 공통 섹션)을 사용합니다.

Phase가 끝날 때마다 메인 세션에서 진행률을 표시합니다:

```
Phase {N}/{total} 완료 — {Phase 요약}
품질게이트: {passed/failed}
```

#### B-5. 완료

```bash
echo '{"id":"{프로젝트ID}","status":"completed"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status
```

### 모드 C: 팀 토론 후 만들기 (plan-only → execute)

> **컨텍스트 보호:** discuss 전체와 execute의 각 Phase를 독립 Task tool로 실행합니다.

#### C-1. 토론 + CEO 확인 (Ralph Loop)

모드 B와 동일한 Ralph Loop 패턴을 적용합니다. 차이점: 에이전트 간 토론도 최대 3라운드까지 진행.

**변수 초기화:**

- `ceoFeedback = null`
- `roundNumber = 1`

##### C-1a. 토론 라운드 실행 (Task tool)

Task tool 프롬프트:

```
프로젝트 ID: {ID}로 discuss 라운드 {roundNumber}을 실행하세요.

1. commands/discuss.md의 Step 2를 실행합니다 (Phase A: Tier별 분석 + 종합 + Phase B: 리뷰 + 수렴).
   Step 3(CEO 확인)과 Step 4-5(저장/안내)는 실행하지 마세요.
2. {ceoFeedback이 있으면: "CEO 피드백을 context.ceoFeedback으로 전달하세요: {ceoFeedback}"}
3. {roundNumber > 1이면: "이전 라운드 기획서를 context.previousSynthesis로 전달하세요"}
4. 에이전트 분석/종합 시 context.prd = {prd}를 전달하세요.
5. 기획서에 Mermaid 아키텍처 다이어그램과 화면 구조를 반드시 포함하세요.
6. 라운드 데이터 저장 시 ceoFeedback을 roundData에 포함하세요 (discuss.md "CEO 피드백 보존" 참조).
7. 반환 (최대 1000자):
   - planSummary: 기획서 핵심 요약
   - diagram: Mermaid 아키텍처 다이어그램
   - techStack: 기술 스택 + 작업 규모 요약
   - convergence: 수렴 상태
   상세 기획서는 project.json에 저장하세요.

CLAUDE_PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}
```

##### C-1b. CEO 시각적 확인 (메인 세션)

서브에이전트가 반환한 결과를 CEO에게 표시:

```
라운드 {roundNumber} 기획서:

{Mermaid 아키텍처 다이어그램}
{화면 구조 — 해당 시}

기술 스택: {...}
예상 규모: Phase {N}개, 태스크 {M}개

AskUserQuestion:
  질문: "기획이 이대로 괜찮을까요?"
  header: "기획 확인"
  options:
    - "이대로 진행 (Recommended)" — 리뷰 후 승인 단계로 넘어갑니다
    - "수정 요청" — 구체적 피드백을 입력하세요
    - "처음부터 다시" — 새로운 방향으로 재분석합니다
```

##### C-1c. 반복

- **"수정 요청"** → CEO 피드백을 `ceoFeedback`에 저장, `roundNumber++`, C-1a로 돌아감
- **"처음부터 다시"** → `ceoFeedback = null`, `roundNumber = 1`, CEO에게 새 방향 입력받고 C-1a로
- **"이대로 진행"** → C-1d로

##### C-1d. 리뷰 + 수렴 (Task tool)

CEO 승인 후, 에이전트 리뷰를 실행합니다:

Task tool 프롬프트:

```
프로젝트 ID: {ID}의 기획서를 팀원들이 리뷰합니다.

1. commands/discuss.md의 Step 2 Phase B를 실행합니다 (리뷰 + 수렴 확인 + 라운드 데이터 저장).
2. CEO가 이미 승인했으므로, 에이전트 수렴 여부와 관계없이 기획서를 확정합니다.
3. 반환: 리뷰 요약 + 수렴 상태

CLAUDE_PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}
```

#### C-2. CEO 최종 승인

리뷰 결과를 보여주고 AskUserQuestion으로 최종 승인을 요청합니다:

```
질문: "기획서를 최종 승인하시겠습니까?"
header: "승인"
options:
  - "승인 (Recommended)" — 작업을 시작합니다
  - "수정 요청" — 피드백을 추가하여 다시 토론합니다 (C-1a로)
  - "중단" — 프로젝트를 여기서 멈춥니다
```

"수정 요청" 선택 시 CEO 피드백을 받아 `ceoFeedback`에 저장하고 C-1a로 돌아갑니다.

"중단" 선택 시:

```
프로젝트가 planning 상태로 유지됩니다. 나중에 재개하려면:
- good-vibe:discuss — 토론 재개
- good-vibe:approve — 기획서 승인
- good-vibe:status — 현재 상태 확인
```

종료.

승인 시, 실행 모드를 선택합니다 (메인 세션 — CEO 터치포인트):

```
질문: "실행 모드를 선택하세요"
header: "모드"
options:
  - label: "인터랙티브 (Recommended)"
    description: "각 Phase 완료 후 진행 여부를 확인합니다"
  - label: "자동 실행"
    description: "에스컬레이션이 필요한 경우에만 중단합니다"
```

> **자동승인 필수:** "자동 실행" 선택 시, Claude Code가 자동승인 모드(Auto-accept edits 이상)가 아니면 매 작업마다 수동 승인이 필요해 자동 실행의 의미가 없습니다. 자동승인이 아닌 경우 `commands/execute.md` Step 1.2의 안내를 따릅니다.

#### C-3. 승인 + 작업 분배 + 실행 초기화 (Task tool)

> **Thin Controller:** 승인→작업분배→실행초기화 CLI 체인을 하나의 Task로 묶습니다.

Task tool 프롬프트:

```
프로젝트 ID: {ID}의 작업을 분배하고 실행을 초기화하세요.

**[필수] CLI에 JSON 전달 시 Write tool 사용:**
- LLM 응답, PRD, 작업 목록 등 큰 JSON은 반드시 Write tool로 /tmp/gv-*.json 파일에 저장한 뒤 --input-file 플래그로 CLI에 전달하세요.
- echo/cat/heredoc(<<)로 큰 JSON을 bash에 직접 전달하면 보안 탐지에 걸려 자동승인이 중단됩니다.

1. 상태 변경:
   echo '{"id":"{ID}","status":"approved"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status

2. 작업 분배 프롬프트 생성 + LLM 실행:
   node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js task-distribution-prompt --id {ID}
   → 생성된 프롬프트를 LLM으로 실행 → 작업 목록 생성
   → 작업 목록을 프로젝트에 저장:
   → 작업 데이터를 Write tool로 /tmp/gv-tasks.json에 저장 (형식: {"id":"{ID}","tasks":[...생성된 작업 배열...]})
   → node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js save-tasks --input-file /tmp/gv-tasks.json

3. 실행 초기화:
   echo '{"id":"{ID}","mode":"{선택된모드}"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js init-execution

4. 상태 변경:
   echo '{"id":"{ID}","status":"executing"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status

반환:
- phaseCount: 총 Phase 수
- taskCount: 총 태스크 수
- taskSummary: Phase별 태스크 요약 (3줄 이내)

CLAUDE_PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}
```

메인 세션에서 표시: "작업 분배 완료: Phase {N}개, 태스크 {M}개"

#### C-4. Phase별 실행 (Task tool로 격리)

> **컨텍스트 보호:** 각 Phase를 독립 Task tool로 실행하여 메인 세션의 컨텍스트 폭발을 방지합니다.

`next-step`으로 실행 계획의 Phase 수를 파악한 뒤, **각 Phase를 개별 Task tool**로 실행합니다.

각 Phase의 Task tool 프롬프트: **"Phase 실행 프롬프트 템플릿"** (Step 5 상단 공통 섹션)을 사용합니다.

Phase가 끝날 때마다 메인 세션에서 진행률을 표시합니다:

```
Phase {N}/{total} 완료 — {Phase 요약}
품질게이트: {passed/failed}
```

인터랙티브 모드에서는 각 Phase 후 CEO에게 진행 여부를 확인합니다.

#### C-5. 완료

```bash
echo '{"id":"{프로젝트ID}","status":"completed"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status
```

## Step 6: 완료 + 실행 가이드

### 6.A: 프로젝트 완료 표시

```
프로젝트가 완료되었습니다!

{생성된 파일/폴더 구조}
```

### 6.B: 사전 설정 가이드 (외부 서비스 감지)

생성된 코드에서 외부 서비스 의존성을 감지합니다:

- `.env.example` 파일이 있으면 → 환경변수별 설정 가이드 생성
- `package.json`의 dependencies에서 외부 서비스 라이브러리 감지
- 코드에서 API 키/토큰/시크릿 패턴 감지

**외부 서비스 의존성이 없으면** 6.B를 건너뛰고 6.C로 진행합니다.

**외부 서비스 의존성이 있으면** 단계별 설정 가이드를 표시합니다.
각 단계 끝에 "잘 모르겠으면 질문해주세요"를 붙여서 초보자가 막히지 않게 합니다.

예시 (텔레그램 봇):

```
실행 전 설정이 필요합니다:

1단계: 텔레그램 봇 생성
  → 텔레그램에서 @BotFather 검색 → 대화 시작
  → /newbot 입력 → 봇 이름 입력 → 봇 username 입력
  → 발급된 토큰(숫자:영문 형태)을 복사하세요
  잘 모르겠으면 질문해주세요!

2단계: Chat ID 확인
  → 텔레그램에서 @userinfobot 검색 → 아무 메시지 전송
  → 표시되는 숫자(Id 항목)를 복사하세요
  잘 모르겠으면 질문해주세요!

3단계: .env 파일 설정
  cp .env.example .env
  파일을 열고 아래 값을 입력하세요:
    BOT_TOKEN=1단계에서_복사한_토큰
    CHAT_ID=2단계에서_복사한_숫자
  잘 모르겠으면 질문해주세요!

4단계: 실행
  npm install
  npm start
  잘 모르겠으면 질문해주세요!
```

위는 텔레그램 봇 예시입니다. 실제로는 프로젝트에서 감지된 외부 서비스에 맞춰 가이드를 생성하세요.

**흔한 외부 서비스 가이드 패턴:**

| 서비스       | 감지 기준                            | 안내 포인트                        |
| ------------ | ------------------------------------ | ---------------------------------- |
| Telegram Bot | `node-telegram-bot-api`, `telegraf`  | BotFather 토큰 발급 + Chat ID      |
| Discord Bot  | `discord.js`                         | Developer Portal 앱 생성 + 봇 토큰 |
| OpenAI API   | `openai`                             | API 키 발급 + 결제 설정            |
| Supabase     | `@supabase/supabase-js`              | 프로젝트 생성 + URL/Key            |
| Firebase     | `firebase`, `firebase-admin`         | 프로젝트 생성 + 서비스 계정        |
| Slack Bot    | `@slack/bolt`                        | Slack App 생성 + Bot Token         |
| RSS/크롤링   | `rss-parser`, `cheerio`, `puppeteer` | 특별 설정 없음 (안내 생략 가능)    |

### 6.C: 다음 단계

```
다음 단계:
  good-vibe:modify    → 기능 추가/수정 (완료된 프로젝트 기반)
  good-vibe:report    → 프로젝트 보고서 생성
  good-vibe:feedback  → 팀원 성과 분석 + 개선점
  good-vibe:status    → 프로젝트 상태 확인
```

---

## 문제가 생기면?

- `good-vibe:learn 문제해결` — 자주 발생하는 문제와 해결 방법
- `good-vibe:status` — 현재 프로젝트 상태 확인
