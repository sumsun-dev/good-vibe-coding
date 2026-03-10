# 외부 서비스 연동

Good Vibe Coding은 외부 서비스와 연동하여 워크플로우를 확장할 수 있습니다.
이 가이드에서는 GitHub, Supabase, Vercel, n8n 연동 방법을 설명합니다.

---

## GitHub

### 설치 및 인증

Good Vibe Coding의 `good-vibe:hello` 커맨드가 GitHub 저장소를 자동으로 만들려면 GitHub CLI(gh)가 필요합니다.

```bash
# macOS
brew install gh

# Windows
winget install --id GitHub.cli

# Linux
# https://github.com/cli/cli/blob/trunk/docs/install_linux.md
```

설치 후 인증:

```bash
gh auth login
# → GitHub.com 선택 → HTTPS 선택 → 브라우저로 인증
```

### /hello에서 자동 연동

`good-vibe:hello` 실행 시 gh CLI가 설치 + 인증되어 있으면:

- 비공개/공개 저장소 중 선택 가능
- 저장소 생성 → git init → 초기 커밋 → push 자동 처리
- 이후 `good-vibe:execute`에서 작성한 코드가 자동으로 커밋됨

### GitHub 협업 워크플로우

기본적으로 GitHub 협업 기능은 꺼져 있습니다 (`github.enabled = false`).
활성화하면 feature branch, conventional commit, 자동 PR 생성 등 팀 협업에 필요한 기능이 추가됩니다.

`good-vibe:new`에서 GitHub 저장소를 설정할 때 활성화할 수 있습니다.

**활성화 시 동작:**

```
good-vibe:execute 시작
  → feature branch 생성 (gv/{프로젝트}-{timestamp})
  → Phase별 conventional commit (feat/fix/test/refactor/chore)
  → 실행 완료 시 자동 PR 생성 (품질 보고서 포함)
  → CEO가 GitHub에서 직접 merge 승인
```

**설정 옵션:**

| 설정                | 기본값      | 설명                                         |
| ------------------- | ----------- | -------------------------------------------- |
| `enabled`           | `false`     | GitHub 협업 기능 활성화                      |
| `branchStrategy`    | `timestamp` | 브랜치 네이밍 (`timestamp`/`phase`/`custom`) |
| `baseBranch`        | `main`      | PR의 베이스 브랜치                           |
| `autoPush`          | `true`      | 브랜치 자동 push                             |
| `autoCreatePR`      | `true`      | 실행 완료 후 자동 PR 생성                    |
| `prDraft`           | `false`     | PR을 Draft로 생성                            |
| `worktreeIsolation` | `false`     | Phase별 git worktree 격리                    |

**커밋 형식:** `feat(phase-1): API 라우터 구현` + Co-authored-by

**PR 보고서에 포함되는 내용:**

- 품질 게이트 결과 (critical/important 이슈 수)
- 리뷰 요약 (리뷰어별 피드백)
- 생성된 파일 목록
- CEO 체크리스트

> GitHub 협업을 끈 상태에서는 main에 직접 커밋됩니다 (기존 동작). gh CLI가 없으면 GitHub 기능만 건너뛰고 나머지는 정상 동작합니다.

### GitHub Actions CI

`good-vibe:execute`가 코드를 생성한 뒤, CI 파이프라인을 자동으로 설정할 수 있습니다.
DevOps 역할 에이전트가 팀에 포함되어 있으면, 토론 시 CI/CD 전략을 제안합니다.

```yaml
# .github/workflows/ci.yml 예시
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm test
```

---

## Supabase

[Supabase](https://supabase.com)는 오픈소스 Firebase 대안으로, PostgreSQL 데이터베이스 + 인증 + 스토리지 + 실시간 기능을 제공합니다.

### 프로젝트 생성

1. [supabase.com](https://supabase.com)에서 프로젝트 생성
2. Settings → API에서 URL과 anon key 확인

### 환경 변수 설정

프로젝트 루트에 `.env` 파일을 만듭니다:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> `.env` 파일은 자동으로 `.gitignore`에 포함됩니다.

### /discuss에서 활용

팀 토론 시 "Supabase를 사용해서 인증과 데이터베이스를 구현해줘"라고 요청하면:

- CTO가 Supabase 기반 아키텍처를 설계
- Backend 개발자가 Supabase 클라이언트 코드를 계획
- Security 엔지니어가 Row Level Security(RLS) 정책을 제안

### /execute에서 활용

실행 시 Supabase 관련 코드가 자동으로 생성됩니다:

- 데이터베이스 스키마 (SQL 마이그레이션)
- Supabase 클라이언트 초기화 코드
- 인증 헬퍼 함수
- RLS 정책

---

## Vercel

[Vercel](https://vercel.com)은 프론트엔드 프레임워크(Next.js, React 등)에 최적화된 배포 플랫폼입니다.

### CLI 설치 및 로그인

```bash
npm install -g vercel
vercel login
```

### GitHub 연동

Vercel 대시보드에서 GitHub 저장소를 연결하면, push 시 자동 배포됩니다:

1. [vercel.com](https://vercel.com)에서 "Import Project"
2. GitHub 저장소 선택
3. 프레임워크 자동 감지 → 배포 설정 확인

### Next.js 템플릿과 함께 사용

`good-vibe:scaffold`으로 Next.js 템플릿을 사용하면 Vercel에 바로 배포할 수 있는 구조가 만들어집니다:

```
good-vibe:scaffold
→ 템플릿: next-app
→ 프로젝트 디렉토리 선택
```

생성된 프로젝트를 Vercel에 배포:

```bash
cd your-project
vercel
```

---

## n8n

[n8n](https://n8n.io)은 워크플로우 자동화 도구로, API 웹훅을 통해 외부 이벤트를 트리거할 수 있습니다.

### 셀프호스팅

```bash
# Docker
docker run -it --rm --name n8n -p 5678:5678 n8nio/n8n

# npm
npm install -g n8n
n8n start
```

### 클라우드

[n8n.io](https://n8n.io)에서 클라우드 플랜을 사용할 수도 있습니다.

### API 웹훅 연동

n8n에서 Webhook 노드를 만들고, 프로젝트에서 해당 URL로 이벤트를 보내는 구조입니다:

```javascript
// 예: 프로젝트 완료 시 n8n 웹훅 호출
const webhookUrl = process.env.N8N_WEBHOOK_URL;
await fetch(webhookUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ event: 'project_complete', projectId: '...' }),
});
```

### 자동화 워크플로우 예시

| 트리거         | 액션                    |
| -------------- | ----------------------- |
| GitHub PR 생성 | Slack 알림 발송         |
| 프로젝트 완료  | 보고서 이메일 전송      |
| 일일 스케줄    | 프로젝트 상태 요약 전송 |

---

## 연동 조합 표

프로젝트 유형별 추천 서비스 조합입니다:

| 프로젝트 유형     | 추천 조합                                   | 설명                            |
| ----------------- | ------------------------------------------- | ------------------------------- |
| SaaS 웹앱         | Next.js + Supabase + Vercel                 | 풀스택, 인증/DB 내장, 자동 배포 |
| API 서버          | Express/FastAPI + Supabase + GitHub Actions | 백엔드 중심, CI/CD 파이프라인   |
| 텔레그램 봇       | Node.js + Supabase + n8n                    | 봇 로직 + 데이터 저장 + 자동화  |
| 정적 사이트       | Next.js + Vercel                            | 빠른 배포, CDN 지원             |
| 데이터 파이프라인 | Python + Supabase + n8n                     | 데이터 수집/가공/저장 자동화    |

---

## 이전 가이드

- [훅과 자동화](./05-hooks-and-automation.md) → 자동 포맷팅, 린트, 커밋 검사
