# /hello — 프로젝트 인프라 설정

## 이 커맨드를 실행하면?

프로젝트 폴더, CLAUDE.md, README.md, 에이전트를 만들고
GitHub 저장소를 생성하여 연결합니다.

- **소요시간:** 2-3분
- **결과물:** 프로젝트 폴더 + GitHub 저장소 + 초기 파일
- **다음 단계:** `/new` (프로젝트 기획)

---

## Step 1: 프로젝트 기본 정보 수집

AskUserQuestion으로 다음 정보를 수집합니다:

**질문 1: 프로젝트 이름**
```
질문: "프로젝트 이름을 입력해 주세요"
header: "이름"
options:
  - label: "직접 입력"
    description: "원하는 프로젝트 이름을 자유롭게 입력하세요"
```

**질문 2: 한 줄 설명**
```
질문: "프로젝트를 한 줄로 설명해 주세요"
header: "설명"
options:
  - label: "직접 입력"
    description: "예: 날씨를 알려주는 텔레그램 봇"
```

**질문 3: 기술 스택**
```
질문: "기술 스택을 선택해 주세요"
header: "스택"
options:
  - label: "Next.js"
    description: "React 기반 풀스택 프레임워크"
  - label: "React + Node.js"
    description: "프론트엔드 + 백엔드 분리 구조"
  - label: "Python + FastAPI"
    description: "Python 백엔드 API 서버"
```

## Step 2: GitHub 연동 여부

먼저 gh CLI 상태를 확인합니다:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js check-gh-status
```

결과에 따라:

**gh 설치 + 인증 완료 시:**
```
질문: "GitHub 저장소를 만들까요?"
header: "GitHub"
options:
  - label: "비공개 저장소 (Recommended)"
    description: "GitHub에 비공개 저장소를 만들고 연결합니다"
  - label: "공개 저장소"
    description: "GitHub에 공개 저장소를 만들고 연결합니다"
  - label: "GitHub 없이 진행"
    description: "로컬에서만 프로젝트를 만듭니다"
```

**gh 미설치 시:**
```
GitHub CLI(gh)가 설치되지 않았습니다.
GitHub 저장소 연결을 원하시면 아래 가이드를 따라 설치하세요:

📦 설치 방법:
  macOS:   brew install gh
  Windows: winget install --id GitHub.cli
  Linux:   https://github.com/cli/cli/blob/trunk/docs/install_linux.md

설치 후 인증:
  gh auth login

지금은 로컬에서만 프로젝트를 만들고, 나중에 /hello를 다시 실행할 수 있습니다.
```

```
질문: "GitHub 없이 진행할까요?"
header: "GitHub"
options:
  - label: "GitHub 없이 진행 (Recommended)"
    description: "로컬에서만 프로젝트를 만듭니다. 나중에 GitHub 연결 가능"
  - label: "설치 후 다시 시작"
    description: "gh를 설치한 뒤 /hello를 다시 실행합니다"
```

**gh 설치됨 + 미인증 시:**
```
GitHub CLI(gh)가 설치되어 있지만 로그인되지 않았습니다.

🔑 인증 방법:
  gh auth login
  → GitHub.com 선택 → HTTPS 선택 → 브라우저로 인증

인증 후 /hello를 다시 실행하면 GitHub 저장소를 만들 수 있습니다.
```

```
질문: "GitHub 없이 진행할까요?"
header: "GitHub"
options:
  - label: "GitHub 없이 진행 (Recommended)"
    description: "로컬에서만 프로젝트를 만듭니다. 나중에 GitHub 연결 가능"
  - label: "인증 후 다시 시작"
    description: "gh auth login 실행 후 /hello를 다시 실행합니다"
```

## Step 2.5: Gemini CLI 확인 (크로스 모델 리뷰용)

`/execute`에서 크로스 모델 리뷰(Claude + Gemini)를 사용하려면 Gemini CLI가 필요합니다.
필수는 아니지만, 설치되어 있으면 리뷰 품질이 향상됩니다.

```bash
which gemini 2>/dev/null && echo '{"installed":true}' || echo '{"installed":false}'
```

**미설치 시 안내:**
```
💡 Gemini CLI를 설치하면 /execute에서 크로스 모델 리뷰를 사용할 수 있습니다.
   (Claude + Gemini가 각각 리뷰하여 더 높은 품질 보장)

📦 설치 방법:
  npm install -g @google/gemini-cli

필수는 아닙니다 — Claude만으로도 충분히 리뷰가 진행됩니다.
```

이 단계는 안내만 하고 설치를 강제하지 않습니다. 프로젝트 생성은 그대로 진행합니다.

## Step 3: 프로젝트 인프라 생성

수집한 정보로 인프라를 생성합니다:

```bash
echo '{"name":"{이름}","description":"{설명}","techStack":"{스택}"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js setup-project-infra
```

생성되는 파일:
- `CLAUDE.md` — AI 에이전트 컨텍스트 (플레이스홀더 섹션 포함)
- `README.md` — 프로젝트 문서
- `.gitignore` — 스택별 제외 파일
- `.claude/agents/code-reviewer.md` — 코드 리뷰 에이전트
- `.claude/agents/tdd-coach.md` — TDD 코치 에이전트

## Step 4: GitHub 연결 (선택)

Step 2에서 GitHub을 선택한 경우:

```bash
echo '{"repoName":"{이름}","visibility":"{public|private}","description":"{설명}"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js create-github-repo
```

성공 시 git init + push:

```bash
echo '{"projectDir":"{경로}","remoteUrl":"{URL}"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js git-init-push
```

## Step 5: 완료 안내

```
🎉 프로젝트 인프라가 준비되었습니다!

📁 프로젝트 경로: {projectDir}
📄 생성된 파일:
  - CLAUDE.md
  - README.md
  - .gitignore
  - .claude/agents/code-reviewer.md
  - .claude/agents/tdd-coach.md

{GitHub 연결 시: 🔗 GitHub: {url}}

다음 단계:
  /new — 프로젝트 기획 (복잡도 분석 + 팀 구성)
```
