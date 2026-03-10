---
description: '환경 설정 + 개인 설정 — 도구 확인, CLAUDE.md 생성/개선'
---

# good-vibe:hello — 환경 설정 + 개인 설정

## 이 커맨드를 실행하면?

개발 환경을 확인하고, 개인 설정(CLAUDE.md)을 생성하거나 개선합니다.

- **소요시간:** 2-3분
- **결과물:** 도구 상태 확인 + CLAUDE.md 생성/개선
- **다음 단계:** `good-vibe:new` (프로젝트 시작)

### 전체 흐름

```
Step 1: Welcome
  ↓
Step 2: 도구 + 자동승인 확인 ──→ [미설치 + 가이드 선택] → 종료
  ↓ (모두 OK 또는 "이대로 진행")
Step 2.5: 자동승인 설정
  ↓
Step 3: 개인 설정
  ├─ 3.A: CLAUDE.md 미존재 → 생성
  └─ 3.B: CLAUDE.md 존재 → 분석 + 개선
  ↓
Step 4: 완료 → good-vibe:new
```

---

## Step 1: Welcome + 환경 감지

다음을 확인하고 사용자에게 알려주세요:

- Claude Code 버전 (`claude --version`)
- 운영체제

```
안녕하세요! Good Vibe Coding 환경을 설정합니다.

현재 환경:
  Claude Code: v{version}
  OS: {os}
```

## Step 2: 도구 확인 + 설치 가이드

**Task tool로 일괄 확인합니다** (Thin Controller 원칙):

```
다음 2개 CLI를 병렬로 실행하세요 (Bash tool을 2번 동시 호출하여 병렬 실행):

병렬 1: node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js check-environment
병렬 2: node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js read-settings

반환 형식 (JSON):
{
  "environment": {
    "node": { "version": "...", "meetsMinimum": bool },
    "git": { "installed": bool, "version": "..." },
    "gh": { "installed": bool, "authenticated": bool },
    "gemini": { "installed": bool },
    "healthy": bool
  },
  "settings": {
    "hasAutoApprove": bool
  }
}

environment.healthy=true면 필수 도구(node/npm/git) 모두 정상입니다.
settings.hasAutoApprove=true면 permissions.allow 배열에 "Bash" 또는 "Bash(node *)" 패턴이 이미 있습니다.
CLAUDE_PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}
```

**결과를 표시합니다:**

```
도구 상태:
  {git 상태 아이콘} git {버전 또는 "미설치"}
  {gh 상태 아이콘} gh CLI {상태}
  {gemini 상태 아이콘} Gemini CLI {상태}
```

아이콘 규칙: 설치+인증 완료 = `+`, 미설치/미인증 = `!`

**모든 도구가 설치+인증 완료이면** 질문 없이 Step 3으로 바로 진행합니다.

**미설치/미인증 항목이 있으면** AskUserQuestion:

```
질문: "설치가 필요한 도구가 있습니다. 어떻게 하시겠습니까?"
header: "도구"
options:
  - label: "이대로 진행 (Recommended)"
    description: "필수 도구(git)만 있으면 프로젝트를 시작할 수 있습니다"
  - label: "설치 가이드 보기"
    description: "미설치 도구의 설치 방법을 안내합니다"
```

**"이대로 진행"** 선택 시 Step 3으로 진행합니다.

**"설치 가이드 보기"** 선택 시 미설치/미인증 항목만 골라서 가이드를 한번에 표시합니다:

**git 미설치 가이드:**

```
## git 설치 방법

**Windows:** https://git-scm.com/download/win 에서 다운로드
**macOS:** xcode-select --install (또는 brew install git)
**Linux:** sudo apt install git

설치 후 초기 설정:
  git config --global user.name "내 이름"
  git config --global user.email "내이메일@example.com"

잘 모르겠으면 질문해주세요!
```

**gh CLI 미설치 가이드:**

```
## GitHub CLI 설치 방법

**Windows:** winget install --id GitHub.cli
**macOS:** brew install gh
**Linux:** sudo apt install gh

설치 후 인증: gh auth login -> GitHub.com -> HTTPS -> Login with a web browser

잘 모르겠으면 질문해주세요!
```

**gh 미인증 가이드:**

```
## GitHub CLI 인증

gh auth login -> GitHub.com -> HTTPS -> Login with a web browser

잘 모르겠으면 질문해주세요!
```

**Gemini CLI 미설치/미인증 가이드:**

```
## Gemini CLI (선택사항 - 크로스 모델 리뷰용)

설치: npm install -g @google/gemini-cli
인증: gemini (처음 실행 시 브라우저 로그인)

필수는 아닙니다 - Claude만으로도 리뷰가 잘 진행됩니다.

잘 모르겠으면 질문해주세요!
```

가이드 표시 후: "설치 완료되면 `good-vibe:hello`를 다시 실행하세요!"
가이드를 보여준 뒤에는 여기서 종료합니다 (Step 3으로 진행하지 않음).

## Step 2.5: Claude Code 자동승인 설정

Good Vibe Coding은 AI 팀이 파일 편집과 CLI 실행을 빈번하게 수행합니다.
자동승인 모드를 설정하면 매번 승인하지 않아도 됩니다.

Step 2에서 확인한 `settings.hasAutoApprove`를 사용합니다.
이미 true이면 "Good Vibe 자동승인이 이미 설정되어 있습니다!" 표시 후 Step 3으로 진행합니다.

설정이 없는 경우 AskUserQuestion:

```
질문: "자동승인 모드를 선택해주세요"
header: "자동승인"
options:
  - label: "자동 모드 (Recommended)"
    description: "파일 읽기/쓰기, 검색, 웹 조회, CLI 실행을 모두 자동 승인합니다"
  - label: "선택적 모드"
    description: "읽기/검색/CLI만 자동 승인 (파일 쓰기는 매번 확인)"
  - label: "매번 확인"
    description: "CLI 실행만 자동 승인 (나머지는 매번 확인)"
  - label: "건너뛰기"
    description: "나중에 직접 설정합니다"
```

선택 결과를 `autoApproveMode` 변수로 저장합니다 (Step 3에서 사용):

- **자동 모드** → `autoApproveMode = "auto"`
- **선택적 모드** → `autoApproveMode = "selective"`
- **매번 확인** → `autoApproveMode = "manual"`
- **건너뛰기** → `autoApproveMode = "none"` (Step 3에서 autoApprove 섹션 미포함)

**"건너뛰기" 이외 선택 시:**

CLI로 자동승인 규칙을 일괄 추가합니다:

자동 모드:

```bash
echo '{"patterns":["Read","Write","Edit","Glob","Grep","WebFetch","WebSearch","NotebookEdit","Bash"]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js add-permissions
```

> `"Bash"`는 모든 bash 명령을 자동 승인합니다 (ls, mkdir, git, npm, echo, node 등).

선택적 모드:

```bash
echo '{"patterns":["Read","Glob","Grep","Bash(node *)","Bash(echo *)","Bash(ls *)","Bash(cat *)","Bash(pwd)","Bash(which *)"]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js add-permissions
```

> CLI 호출(`node`, `echo ... | node` 파이프)과 읽기 전용 bash(`ls`, `cat`, `pwd`)를 자동 승인합니다.

매번 확인 모드:

```bash
echo '{"patterns":["Bash(node *)","Bash(echo *)"]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js add-permissions
```

> CLI 호출과 `echo ... | node` 파이프만 자동 승인합니다.

결과 표시:

```
자동승인이 설정되었습니다!
  추가된 규칙: {added 배열의 각 항목}
  이미 있던 규칙: {skipped 배열의 각 항목} (있을 때만)
```

**"건너뛰기"** 선택 시 → Step 3으로 진행합니다.

**모든 경로에서 Step 2.5 완료 후 → Step 3으로 진행합니다.**

## Step 3: 개인 설정 (onboarding 통합)

`~/.claude/CLAUDE.md` 존재 여부로 분기합니다.

### 3.A: CLAUDE.md 미존재 -> 글로벌 CLAUDE.md 생성

역할/팀/스택 선택은 프로젝트 생성 시(`good-vibe:new`) 수행합니다.
글로벌 CLAUDE.md는 역할 무관 공통 규칙만 포함합니다.

#### 3.A-1: 글로벌 CLAUDE.md 생성 + 미리보기

Step 2.5에서 저장한 `autoApproveMode`를 사용합니다 (건너뛰기 선택 시 `"none"`).

```bash
echo '{"autoApproveMode":"auto"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js generate-global-onboarding
```

반환: `{ "claudeMd": "...", "coreRules": "..." }`

**생성된 CLAUDE.md + rules/core.md 내용을 CEO에게 미리보기로 표시합니다:**

```
글로벌 CLAUDE.md 미리보기:

---
{claudeMd 내용}
---

글로벌 rules/core.md 미리보기:

---
{coreRules 내용}
---
```

#### 3.A-2: CEO 확인

AskUserQuestion:

```
질문: "이 내용으로 CLAUDE.md + rules/core.md를 생성할까요?"
header: "CLAUDE.md"
options:
  - label: "생성 (Recommended)"
    description: "위 내용으로 ~/.claude/CLAUDE.md + ~/.claude/rules/core.md를 생성합니다"
  - label: "건너뛰기"
    description: "나중에 직접 설정합니다"
```

**"생성"** 선택 시:

```
→ 온보딩 데이터를 Write tool로 /tmp/gv-onboarding.json에 저장 (형식: {"claudeMd":"...생성된 내용...","coreRules":"...생성된 내용..."})
→ node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js write-global-onboarding --input-file /tmp/gv-onboarding.json
```

반환: `{ "written": ["~/.claude/CLAUDE.md", "~/.claude/rules/core.md"] }`

```
설정 파일이 생성되었습니다!
  경로: ~/.claude/CLAUDE.md, ~/.claude/rules/core.md
```

**"건너뛰기"** 선택 시 -> Step 4로 진행합니다.

### 3.B: CLAUDE.md 존재 -> 분석 + 개선 제안

#### 3.B-1: 현재 설정 분석

Task tool로 분석합니다:

```
~/.claude/CLAUDE.md와 ~/.claude/rules/core.md를 모두 읽고 분석하세요.
(rules/core.md가 없으면 CLAUDE.md만 분석합니다)

확인 항목:
1. 워크플로우 설정이 있는지 (CLAUDE.md 또는 rules/core.md)
2. 보안 규칙(API key, .env 등)이 있는지
3. 코딩 컨벤션(네이밍, 파일 크기 제한 등)이 있는지
4. Git 커밋 규칙이 있는지
5. 테스트 정책이 있는지
6. 언어 설정이 있는지
7. CLAUDE.md와 rules/core.md 간 역할 분리가 적절한지

반환 형식:
{
  "summary": "현재 설정 요약 (3줄)",
  "hasRulesCore": true/false,
  "improvements": [{ "area": "...", "current": "...", "suggested": "...", "reason": "..." }],
  "missingAreas": ["..."]
}

반환은 최대 1000자. 상세는 필드에 구조화하세요.
CLAUDE_PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}
```

#### 3.B-2: CEO에게 결과 표시

```
현재 CLAUDE.md 분석:

{summary}

개선 제안:
1. {area}: {reason}
   현재: {current}
   제안: {suggested}
2. ...

누락된 설정:
- {missingArea1}
- {missingArea2}
```

개선 제안이 없고 누락 영역도 없으면 "현재 설정이 잘 되어 있습니다!" 표시 후 Step 4로 진행합니다.

#### 3.B-3: AskUserQuestion

개선 제안이 있을 때만 질문합니다:

```
질문: "설정을 개선하시겠습니까?"
header: "설정"
options:
  - label: "제안 적용 (Recommended)"
    description: "개선 사항을 CLAUDE.md에 반영합니다"
  - label: "선택 적용"
    description: "원하는 항목만 골라서 적용합니다"
  - label: "이대로 유지"
    description: "현재 설정을 그대로 사용합니다"
```

**"제안 적용"** 선택 시 -> Task tool로 CLAUDE.md 업데이트
**"선택 적용"** 선택 시 -> 각 제안을 AskUserQuestion으로 확인 후 선택된 항목만 적용
**"이대로 유지"** 선택 시 -> Step 4로

## Step 4: 완료 + 다음 단계

```
환경 설정이 완료되었습니다!

도구: {git 상태} {gh 상태} {gemini 상태}
자동승인: {모드 상태 — "자동 모드" / "선택적 모드" / "매번 확인" / "건너뜀"}
설정: CLAUDE.md + rules/core.md {생성됨/개선됨/유지됨}

다음 단계:
  good-vibe:new   -> 프로젝트 시작 (역할 선택 + 폴더 생성 + 기획 + 실행)
  good-vibe:learn  -> Claude Code 활용법 배우기
```

---

## 문제가 생기면?

- `good-vibe:learn 문제해결` — 자주 발생하는 문제와 해결 방법
- `good-vibe:status` — 현재 프로젝트 상태 확인
