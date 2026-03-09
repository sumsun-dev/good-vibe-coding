---
description: '환경 설정 + 개인 설정 — 도구 확인, CLAUDE.md 생성/개선'
---

# good-vibe:hello — 환경 설정 + 개인 설정

## 이 커맨드를 실행하면?

개발 환경을 확인하고, 개인 설정(CLAUDE.md)을 생성하거나 개선합니다.

- **소요시간:** 2-3분
- **결과물:** 도구 상태 확인 + CLAUDE.md 생성/개선
- **다음 단계:** `good-vibe:new` (프로젝트 시작)

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
다음 CLI를 순서대로 실행하고 결과를 종합하세요:
1. node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js check-environment
2. node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js check-gh-status
3. node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js check-gemini-status

반환 형식 (JSON):
{
  "git": { "installed": bool, "version": "..." },
  "gh": { "installed": bool, "authenticated": bool },
  "gemini": { "installed": bool, "authenticated": bool }
}

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

먼저 CLI로 현재 설정을 확인합니다:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js read-settings
```

반환된 JSON에서 `permissions.allow` 배열에 `"Bash(node * cli.js *)"` 패턴이 있는지 확인합니다.
이미 있으면 "Good Vibe CLI 자동승인이 이미 설정되어 있습니다!" 표시 후 Step 3으로 진행합니다.

설정이 없는 경우 AskUserQuestion:

```
질문: "Good Vibe CLI 자동승인을 설정할까요?"
header: "자동승인"
options:
  - label: "자동승인 켜기 (Recommended)"
    description: "Good Vibe CLI 명령을 자동 승인합니다 (settings.json에 추가)"
  - label: "매번 확인"
    description: "모든 작업에 수동 승인이 필요합니다 (안전하지만 느림)"
  - label: "건너뛰기"
    description: "나중에 직접 설정합니다"
```

**"자동승인 켜기"** 선택 시:

CLI로 규칙을 추가합니다:

```bash
echo '{"pattern":"Bash(node * cli.js *)"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js add-permission
```

```
Good Vibe CLI 자동승인이 설정되었습니다!
  추가된 규칙: Bash(node * cli.js *)

이제 Good Vibe 실행 시 CLI 명령이 자동 승인됩니다.
```

**"매번 확인"** 선택 시 -> "현재 설정을 유지합니다." 표시 후 Step 3으로 진행합니다.

**"건너뛰기"** 선택 시 -> Step 3으로 진행합니다.

## Step 3: 개인 설정 (onboarding 통합)

`~/.claude/CLAUDE.md` 존재 여부로 분기합니다.

### 3.A: CLAUDE.md 미존재 -> 풀 온보딩

#### 3.A-1: 역할 선택 (복수 선택 가능)

AskUserQuestion으로 역할을 묻습니다:

```
질문: "어떤 일을 주로 하시나요? (여러 개 선택 가능)"
header: "역할"
multiSelect: true
options:
  - label: "개발"
    description: "풀스택 / 프론트엔드 / 백엔드 / 데이터"
  - label: "기획/관리"
    description: "PM / PO / 프로젝트 매니저"
  - label: "디자인"
    description: "UI/UX 디자이너 / 웹 퍼블리셔"
  - label: "학습/기타"
    description: "학생 / 입문자 / 리서처 / 콘텐츠"
```

역할 -> 프리셋 매핑:

- 개발 -> `developer`
- 기획/관리 -> `pm`
- 디자인 -> `designer`
- 학습/기타 -> `student`

복수 선택 시 roles 배열에 모두 포함합니다 (예: ["developer", "pm"]).

#### 3.A-2: 세부 선택

역할에 따라 추가 질문을 합니다:

**개발 선택 시 (roles에 "developer" 포함):**

```
질문: "주로 사용하는 기술 스택은?"
header: "스택"
options:
  - label: "Next.js + Supabase"
    description: "풀스택 React 프레임워크"
  - label: "React + Node.js"
    description: "프론트엔드 + 백엔드 분리 구조"
  - label: "Python + FastAPI"
    description: "Python 백엔드 API 서버"
  - label: "아직 정하지 않았어요"
    description: "나중에 프로젝트 시작 시 선택합니다"
```

스택 -> 프리셋 매핑:

- Next.js + Supabase -> `nextjs-supabase`
- React + Node.js -> `react-node`
- Python + FastAPI -> `python-fastapi`
- 아직 정하지 않았어요 -> stack 없음 (CLAUDE.md에 Stack 섹션 미생성)

**기획/관리 선택 시:**

```
질문: "주로 하는 업무는?"
header: "업무"
multiSelect: true
options:
  - label: "PRD/기획서 작성"
    description: "제품 요구사항 문서 작성"
  - label: "이슈/티켓 관리"
    description: "Jira, GitHub Issues 등"
  - label: "데이터 분석/리포트"
    description: "데이터 기반 의사결정"
  - label: "회의록/문서 정리"
    description: "회의 정리, 문서화"
```

**디자인 선택 시:**

```
질문: "주요 작업 영역은?"
header: "영역"
options:
  - label: "UI/UX 디자인"
    description: "사용자 인터페이스 설계"
  - label: "웹 퍼블리싱"
    description: "HTML/CSS 코딩"
  - label: "디자인 시스템 관리"
    description: "컴포넌트 라이브러리 관리"
```

**학습/기타 선택 시:**

```
질문: "현재 학습 단계는?"
header: "단계"
options:
  - label: "프로그래밍 입문"
    description: "처음 코딩을 배우는 중"
  - label: "특정 기술 학습 중"
    description: "특정 프레임워크/언어 공부"
  - label: "프로젝트 실습"
    description: "직접 만들면서 배우기"
```

#### 3.A-3: 워크플로우 선택

역할에 맞는 워크플로우 옵션을 제시합니다:

**개발:**

```
질문: "선호하는 개발 워크플로우는?"
header: "워크플로우"
options:
  - label: "풀 워크플로우 (Recommended)"
    description: "기획 -> TDD -> 검증 -> 리뷰"
  - label: "TDD 중심"
    description: "테스트 우선 개발에 집중"
  - label: "간소화"
    description: "빠르게 구현하고 나중에 보완"
```

**기획/관리:**

```
질문: "선호하는 업무 스타일은?"
header: "워크플로우"
options:
  - label: "체계적 (Recommended)"
    description: "템플릿 기반 문서 작성"
  - label: "유연"
    description: "자유 형식"
  - label: "애자일"
    description: "스프린트 중심"
```

**디자인:**

```
질문: "선호하는 디자인 워크플로우는?"
header: "워크플로우"
options:
  - label: "컴포넌트 기반 (Recommended)"
    description: "디자인 시스템 활용"
  - label: "자유 디자인"
    description: "자유로운 창작"
  - label: "접근성 중심"
    description: "접근성 우선 설계"
```

**학습/기타:**

```
질문: "선호하는 학습 방식은?"
header: "워크플로우"
options:
  - label: "단계별 학습 (Recommended)"
    description: "개념 -> 실습 -> 복습"
  - label: "프로젝트 기반"
    description: "직접 만들면서 배우기"
  - label: "자유 탐색"
    description: "궁금한 것부터 자유롭게"
```

#### 3.A-4: 팀 스타일 선택

각 에이전트에 대해 AskUserQuestion으로 성격 변형을 선택합니다.
첫 번째 옵션에는 "(Recommended)" 표시.
"기본 스타일로 진행" 옵션도 제공하여 스킵 가능.

**진행 방식:**

1. 역할 프리셋에 포함된 에이전트 목록을 가져옵니다
2. `team-personalities.json`에서 각 에이전트의 변형을 조회합니다
3. AskUserQuestion으로 각 에이전트의 스타일을 묻습니다:

예시 (개발자 역할):

```
질문: "코드 리뷰어의 스타일을 선택해 주세요"
header: "리뷰 스타일"
options:
  - label: "꼼꼼한 검토자 (Recommended)"
    description: "세심하게 체크하고 개선점을 정확히 제시합니다"
  - label: "친절한 멘토"
    description: "좋은 점을 먼저 짚고, 개선점을 부드럽게 제안합니다"
  - label: "기본 스타일로 진행"
    description: "기본값을 사용합니다"
```

4. 선택 결과를 `choices.personalities` 객체에 저장합니다
5. 모든 에이전트 선택 완료 후 팀 소개 메시지를 보여줍니다:

```
당신의 팀이 구성되었습니다!

  준영 (꼼꼼한 검토자) - 코드 리뷰어
  하윤 (엄격한 코치) - TDD 코치
```

#### 3.A-5: 설정 생성

> **CLI 기반 생성:** 온보딩 데이터 생성 + 파일 쓰기를 CLI 커맨드로 수행합니다.

**Step 1: 온보딩 데이터 생성**

```bash
echo '{"roles":["developer"],"stack":"nextjs-supabase","personalities":{}}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js generate-onboarding
```

복수 역할 예시:

```bash
echo '{"roles":["developer","pm"],"stack":"nextjs-supabase"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js generate-onboarding
```

스택 미정 시 stack 필드를 생략합니다:

```bash
echo '{"roles":["developer"]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js generate-onboarding
```

반환: `{ "claudeMd": "...", "coreRules": "..." }`

**Step 2: 파일 쓰기**

```bash
echo '{"claudeMd":"...","coreRules":"..."}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js write-onboarding
```

반환: `{ "written": ["~/.claude/CLAUDE.md", "~/.claude/rules/core.md"] }`

### 3.B: CLAUDE.md 존재 -> 분석 + 개선 제안

#### 3.B-1: 현재 설정 분석

Task tool로 분석합니다:

```
~/.claude/CLAUDE.md를 읽고 분석하세요.

확인 항목:
1. 역할/워크플로우 설정이 있는지
2. 보안 규칙(API key, .env 등)이 있는지
3. 코딩 컨벤션(네이밍, 파일 크기 제한 등)이 있는지
4. Git 커밋 규칙이 있는지
5. 테스트 정책이 있는지
6. 언어 설정이 있는지

반환 형식:
{
  "summary": "현재 설정 요약 (3줄)",
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
자동승인: {자동승인 모드 상태 — "Auto-accept edits" / "Normal" / "건너뜀"}
설정: {역할} / {워크플로우} (3.A 경로)
      또는 CLAUDE.md {생성됨/개선됨/유지됨} (3.B 경로)

다음 단계:
  good-vibe:new   -> 프로젝트 시작 (폴더 생성 + 기획 + 실행)
  good-vibe:learn  -> Claude Code 활용법 배우기
```
