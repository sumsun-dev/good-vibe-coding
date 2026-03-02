# Project Setup

프로젝트 인프라 셋업을 위한 재사용 가능한 스킬입니다.

## 트리거
- `/hello` 커맨드 실행 시 자동 활성화

## 기능

### 1. 프로젝트 폴더 생성
- 프로젝트명 기반 디렉토리 생성
- CLAUDE.md, README.md, .gitignore 자동 생성
- .claude/agents/ 디렉토리에 기본 에이전트 배치

### 2. CLAUDE.md 초기화
- 프로젝트명, 설명, 기술 스택 포함
- 플레이스홀더 섹션 (Architecture, Decisions)
- /discuss, /execute 진행 시 자동 업데이트

### 3. GitHub 연동 (선택)
- gh CLI 상태 자동 감지
- 공개/비공개 저장소 선택
- git init → initial commit → push 자동 실행

## CLI 커맨드

| 커맨드 | 설명 |
|--------|------|
| `setup-project-infra` | 폴더 + 파일 생성 |
| `check-gh-status` | gh CLI 상태 확인 |
| `create-github-repo` | GitHub 저장소 생성 |
| `git-init-push` | git init + push |
| `append-claude-md` | CLAUDE.md 섹션 업데이트 |

## 라이브러리

- `scripts/lib/project/project-scaffolder.js` — 폴더/파일 생성 로직
- `scripts/lib/project/github-manager.js` — gh CLI 래퍼

## 중요 규칙
- 기존 파일이 있으면 덮어쓰지 않음 (안전)
- gh CLI 미설치 시 로컬 셋업만 진행 (graceful degradation)
- 모든 파일은 한국어 가이드 포함
