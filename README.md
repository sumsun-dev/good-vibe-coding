# Good Vibe Coding

**Virtual AI Team Management Platform** — AI 팀을 구성하고 프로젝트를 관리하세요

[![CI](https://github.com/sumsun-dev/good-vibe-coding/actions/workflows/ci.yml/badge.svg)](https://github.com/sumsun-dev/good-vibe-coding/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

사용자가 **CEO**가 되어 프로젝트를 정의하면, AI 팀원들이 토론하고 기획하고 실행합니다.

## 핵심 특징

- **구조화된 다관점 분석**: 15개 전문 역할이 독립적으로 분석 → 종합하여 단일 시점에서 놓치는 문제를 포착 (역할별 2개 페르소나 변형)
- **멀티에이전트 오케스트레이션**: 역할별 병렬 분석 → 종합 → 수렴까지 자동 반복 (최대 3라운드), JSON 디스패치 계획으로 구조화
- **크로스 리뷰 시스템**: 작업 실행 후 다른 역할 에이전트가 결과물 리뷰, 품질 게이트 체크
- **복잡도 기반 자동 모드 선택**: 프로젝트 복잡도 분석 → 적합한 모드 자동 추천
- **모델 다양성**: 복잡도 기반 opus/sonnet/haiku 자동 선택 (역할 카테고리별 최적 배분)
- **관측성**: 비용/토큰 추적, 에이전트 기여도 분석, 대시보드
- **팀 설정 공유**: 프로젝트 레벨 에이전트 오버라이드 (`.good-vibe/` 디렉토리로 git 공유)
- **스킬/에이전트 자동 추천**: 프로젝트 컨텍스트 기반 스킬/에이전트 추천 → 설치
- **세 가지 모드**: quick-build / plan-execute / plan-only
- **에이전트 피드백**: 프로젝트 결과 분석 → 에이전트 .md 수정안 자동 제안 → 오버라이드 저장
- **한국어 지원**: 가이드, 프롬프트, 에이전트, 커맨드가 한국어 (CLI 출력 및 코드 주석은 영어)

## 설치

### Claude Code 플러그인으로 설치 (권장)

```bash
claude plugin add sumsun-dev/good-vibe-coding
```

### 로컬 설치

```bash
git clone https://github.com/sumsun-dev/good-vibe-coding.git
cd good-vibe-coding
npm install
claude plugin add .
```

### 요구사항

- [Claude Code](https://claude.ai/code) 2.0+
- Node.js 18+
- (선택) [GitHub CLI](https://cli.github.com/) — `/hello`에서 저장소 자동 생성 시 필요

## 퀵스타트

6개 커맨드로 프로젝트를 완성하세요:

```
/hello → /new → /discuss → /approve → /execute → /report
```

| 단계 | 커맨드 | 하는 일 | 소요시간 |
|------|--------|---------|----------|
| 1 | `/hello` | 프로젝트 폴더 + GitHub 저장소 생성 | 2-3분 |
| 2 | `/new` | 아이디어 입력 + 팀 자동 구성 | 1-2분 |
| 3 | `/discuss` | 팀 토론 → 기획서 작성 | 3-10분 |
| 4 | `/approve` | 기획서 확인 + 승인 | 1-2분 |
| 5 | `/execute` | 작업 실행 + 리뷰 | 5-15분 |
| 6 | `/report` | 보고서 생성 | 1분 |

**처음이라면 `/hello`부터 입력하세요.** 나머지는 단계별로 안내해드립니다.

> 자세한 가이드: [3분 퀵스타트](guides/common/00-quick-start.md)

## 사용법: CEO 시나리오

### 0. 프로젝트 인프라 셋업

```
/hello
```

프로젝트 폴더, CLAUDE.md, README.md를 만들고 GitHub 저장소를 생성합니다:
1. 프로젝트 이름, 설명, 기술 스택 입력
2. GitHub 연동 여부 선택 (gh CLI 자동 감지)
3. 프로젝트 폴더 + 초기 파일 생성

### 1. 프로젝트 시작

```
/new
```

복잡도를 자동 분석하고 적합한 모드를 추천합니다:
1. 프로젝트 설명 입력 ("텔레그램 봇을 만들고 싶어")
2. 복잡도 분석 → 모드 자동 추천 (quick-build / plan-execute / plan-only)
3. 추천 팀 확인 및 수정
4. 팀원 스타일 선택

> `/new-project`로 수동 설정도 가능합니다.

### 2. 팀 토론

```
/discuss
```

팀원들이 Tier별로 병렬 분석합니다:
- Tier 1: CTO, PO, Researcher (전략적 분석)
- Tier 2-4: Frontend, Backend, QA 등 (실행 관점 분석)
- 전체 결과 종합 → 80% 이상 승인 시 수렴 (최대 3라운드)

### 3. 기획서 승인

```
/approve
```

CEO가 기획서를 검토하고 승인합니다. 승인 후 작업이 역할별로 분배됩니다.

### 4. 작업 실행 (plan-execute 모드)

```
/execute
```

분배된 작업을 팀원들이 실행합니다:
- 팀원별 병렬 실행
- 크로스 리뷰 (최소 2명이 결과물 검토)
- Quality Gate: critical 이슈 0개 시 통과
- 실패 시 수정 루프 (최대 2회) → 해결 불가 시 CEO 에스컬레이션

### 5. 보고서 & 피드백

```
/report     # 최종 보고서 생성
/feedback   # 프로젝트 결과 분석 → 에이전트 개선 제안
```

## 아키텍처

```
┌─────────────────────────────────────────────┐
│  User Layer     사용자는 6개 커맨드만 사용    │
│  /hello → /new → /discuss → /approve →      │
│  /execute → /report                          │
├─────────────────────────────────────────────┤
│  Agent Layer    15개 역할 × 30 페르소나        │
│  CTO, PO, Backend, Frontend, QA, ...         │
│  Tier별 병렬 디스패치 + 크로스 리뷰           │
├─────────────────────────────────────────────┤
│  Internal API   CLI-as-API                   │
│  cli.js — 에이전트가 호출하는 내부 API        │
│  사용자가 직접 호출하지 않음                   │
├─────────────────────────────────────────────┤
│  Core Library   37개 lib 모듈 + 14개 핸들러   │
│  project-manager, orchestrator, review-      │
│  engine, complexity-analyzer, ...            │
└─────────────────────────────────────────────┘
```

**사용자는 6개 커맨드만 알면 됩니다.** 나머지는 에이전트들이 내부 API를 통해 자동으로 처리합니다.

- **20개 커맨드** (슬래시 커맨드)
- **23개 에이전트** (15 팀 + 8 서포트)
- **37개 lib 모듈** + **14개 핸들러**

## 전체 커맨드

### 필수 커맨드 (프로젝트 완성 플로우)

| 커맨드 | 설명 | 언제 사용? |
|--------|------|-----------|
| `/hello` | 프로젝트 인프라 셋업 (폴더, GitHub) | 맨 처음 |
| `/new` | 스마트 프로젝트 시작 (복잡도 분석 → 모드 추천) | /hello 후 |
| `/discuss` | 멀티에이전트 팀 토론 → 기획서 작성 | /new 후 |
| `/approve` | 기획서 승인 + 작업 분배 | /discuss 후 |
| `/execute` | 작업 실행 + 크로스 리뷰 | /approve 후 |
| `/report` | 최종 보고서 생성 | /execute 후 |

### 보조 커맨드 (프로젝트 관리)

| 커맨드 | 설명 |
|--------|------|
| `/status` | 현재 프로젝트 대시보드 (프로젝트 없으면 목록 표시) |
| `/feedback` | 에이전트 피드백 (결과 분석 → .md 개선) |
| `/my-team` | 팀 현황 + 역할 카탈로그 |
| `/learn` | 역할별 학습 가이드 |

### 고급 커맨드 (커스터마이징)

| 커맨드 | 설명 |
|--------|------|
| `/new-project` | 수동 프로젝트 생성 (`/new`의 수동 버전) |
| `/projects` | 전체 프로젝트 목록 (여러 프로젝트 관리 시) |
| `/onboarding` | 사용자 환경 설정 (역할/워크플로우 — 1회성) |
| `/my-config` | 현재 설정 대시보드 |
| `/scaffold` | 프로젝트 템플릿 스캐폴딩 |
| `/add-skill` | 스킬 추가 |
| `/add-agent` | 에이전트 추가 |
| `/preset` | 프리셋 관리 |
| `/reset` | 설정 초기화 |
| `/eval` | A/B 평가 (접근법 비교) |

## 역할 카탈로그 (15개)

| 역할 | 이모지 | 카테고리 | 설명 |
|------|--------|----------|------|
| CTO | 🏗️ | Leadership | 기술 아키텍처 설계, 기술 의사결정 |
| Product Owner | 📋 | Leadership | 요구사항 정의, 우선순위 결정 |
| Full-stack Developer | ⚡ | Engineering | 프론트엔드 + 백엔드 전체 구현 |
| Frontend Developer | 🎨 | Engineering | UI 구현, 컴포넌트 설계 |
| Backend Developer | 🔧 | Engineering | API 설계, 비즈니스 로직 |
| QA Engineer | 🧪 | Engineering | 테스트 전략, 품질 보증 |
| UI/UX Designer | 🖌️ | Design | 사용자 경험 설계 |
| DevOps Engineer | 🚀 | Engineering | CI/CD, 배포, 인프라 |
| Data Engineer | 📊 | Engineering | 데이터 파이프라인, 분석 |
| Security Engineer | 🛡️ | Engineering | 보안 검토, 취약점 분석 |
| Technical Writer | 📝 | Support | 기술 문서 작성 |
| Market Researcher | 🔍 | Research | 시장 규모, 경쟁사, 트렌드 분석 |
| Business Researcher | 📈 | Research | 비즈니스 모델, 수익화, 성장 전략 |
| Tech Researcher | 🧬 | Research | 기술 스택 비교, 벤치마크, 오픈소스 |
| Design Researcher | 🔬 | Research | 사용자 리서치, UX 벤치마크, 접근성 |

## 프로젝트 타입 (12개)

| 타입 | 추천 팀 |
|------|---------|
| 웹 애플리케이션 | CTO + Full-stack + QA |
| API 서버 | CTO + Backend + QA |
| 텔레그램 봇 | CTO + Backend + QA |
| CLI 도구 | CTO + Backend + QA |
| 모바일 앱 | CTO + Full-stack + UI/UX + QA |
| Chrome 확장 | CTO + Frontend + QA |
| 데이터 파이프라인 | CTO + Data + QA |
| 라이브러리/패키지 | CTO + Backend + QA + Tech Writer |
| Python 앱 | CTO + Backend + QA |
| Go 서비스 | CTO + Backend + QA |
| Java 앱 | CTO + Backend + QA |
| 커스텀 | CTO + 자유 선택 |

## 프로젝트 구조

```
good-vibe-coding/
├── .claude-plugin/plugin.json    # 플러그인 매니페스트
├── agents/                       # 에이전트 (23개: 15 팀 + 8 서포트)
│   ├── team-cto.md              #   CTO 에이전트
│   ├── team-backend.md          #   Backend 에이전트
│   ├── team-*.md                #   (15개 팀 역할 에이전트)
│   └── *.md                     #   (8개 서포트 에이전트)
├── commands/                     # 커맨드 (20개)
│   ├── hello.md                 #   프로젝트 인프라 셋업
│   ├── new.md                   #   스마트 프로젝트 시작
│   ├── new-project.md           #   수동 프로젝트 생성
│   ├── discuss.md               #   멀티에이전트 토론
│   ├── approve.md               #   기획서 승인
│   ├── execute.md               #   작업 실행 + 크로스 리뷰
│   └── *.md                     #   ...
├── presets/
│   ├── team-roles/catalog.json  #   15개 역할 카탈로그
│   ├── project-types.json       #   12개 프로젝트 타입
│   ├── templates/               #   5개 프로젝트 템플릿 (JSON)
│   ├── team-personalities.json  #   30개 페르소나 (15역할 x 2변형)
│   ├── recommendation-catalog.json # 스킬/에이전트 추천 카탈로그
│   ├── roles/                   #   6개 역할 프리셋
│   └── stacks/                  #   2개 스택 프리셋
├── scripts/
│   ├── cli.js                   #   CLI-as-API (에이전트용 내부 API)
│   ├── handlers/                #   14개 핸들러 모듈
│   └── lib/                     #   핵심 라이브러리 (37개 모듈)
├── templates/                    # Handlebars 템플릿
├── hooks/                        # 훅 정의
├── guides/                       # 학습 가이드
├── skills/                       # 스킬 (4개)
└── tests/                        # Vitest 테스트 (1,110개)
```

## 기술 스택

- **Node.js 18+** (ESM)
- **Handlebars** (템플릿 엔진)
- **Vitest** (테스트 프레임워크, 1,110개 테스트)
- **GitHub Actions CI** (Node 18/20/22 매트릭스)

## 개발

```bash
npm install          # 의존성 설치
npm test             # 전체 테스트 실행
npm run test:watch   # 테스트 감시 모드
npm run test:coverage # 커버리지 리포트
```

## 데이터 저장 위치

| 데이터 | 경로 |
|--------|------|
| 프로젝트 | `~/.claude/good-vibe/projects/{id}/project.json` |
| 에이전트 오버라이드 (사용자) | `~/.claude/good-vibe/agent-overrides/{roleId}.md` |
| 에이전트 오버라이드 (프로젝트) | `{projectDir}/.good-vibe/agent-overrides/{roleId}.md` |
| 커스텀 템플릿 | `~/.claude/good-vibe/custom-templates/` |

## 라이선스

MIT
