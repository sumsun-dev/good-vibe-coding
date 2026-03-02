# Good Vibe Coding

**AI 팀을 만들고, 프로젝트를 함께 굴려보세요.**

[![CI](https://github.com/sumsun-dev/good-vibe-coding/actions/workflows/ci.yml/badge.svg)](https://github.com/sumsun-dev/good-vibe-coding/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

"텔레그램 봇 만들어줘"라고 하면, CTO가 아키텍처를 잡고, 백엔드 개발자가 API를 짜고, QA가 테스트를 돌립니다. 당신은 CEO로서 방향만 잡으면 됩니다.

## 왜 쓰나요?

혼자 코딩할 때 놓치는 게 많습니다. 보안은 생각했는지, API 설계는 괜찮은지, 테스트는 충분한지. Good Vibe Coding은 15개 전문 역할의 AI 팀원이 각자 관점에서 짚어주고, 서로 리뷰하고, 문제가 있으면 자동으로 고칩니다.

**한 줄 요약:** 아이디어를 말하면, AI 팀이 기획 - 토론 - 실행 - 리뷰까지 해줍니다.

## 설치

### Claude Code 플러그인 (권장)

```bash
claude plugin add sumsun-dev/good-vibe-coding
```

### 소스에서 직접 설치

```bash
git clone https://github.com/sumsun-dev/good-vibe-coding.git
cd good-vibe-coding
npm install
claude plugin add .
```

### 업데이트

```bash
# 소스 설치 사용자
cd good-vibe-coding && git pull && npm install

# 플러그인 사용자
claude plugin update sumsun-dev/good-vibe-coding
```

### 필요한 것

- [Claude Code](https://claude.ai/code) 2.0 이상
- Node.js 18 이상
- (선택) [GitHub CLI](https://cli.github.com/) — 저장소 자동 생성에 쓰임
- (선택) [Gemini CLI](https://github.com/anthropics/gemini-cli) — 크로스 모델 리뷰에 쓰임

## 시작하기

커맨드 6개로 프로젝트 하나를 처음부터 끝까지 만들 수 있습니다.

```
/hello  →  /new  →  /discuss  →  /approve  →  /execute  →  /report
```

| 단계 | 커맨드 | 뭘 하나요? | 걸리는 시간 |
|------|--------|-----------|-----------|
| 1 | `/hello` | 프로젝트 폴더와 GitHub 저장소를 만듭니다 | 2-3분 |
| 2 | `/new` | 아이디어를 말하면, 복잡도를 보고 팀을 짜줍니다 | 1-2분 |
| 3 | `/discuss` | 팀원들이 돌아가며 분석하고, 기획서를 씁니다 | 3-10분 |
| 4 | `/approve` | 기획서를 읽고 승인하거나 수정을 요청합니다 | 1-2분 |
| 5 | `/execute` | 팀원들이 작업하고, 서로 리뷰합니다 | 5-15분 |
| 6 | `/report` | 전체 과정을 정리한 보고서를 받습니다 | 1분 |

**처음이라면 `/hello`부터 입력하세요.** 다음 단계는 그때그때 안내해드립니다.

> 더 자세한 설명: [퀵스타트 가이드](guides/common/00-quick-start.md)

## 실제 사용 흐름

### 1. 프로젝트 만들기

```
/hello
```

프로젝트 이름, 설명, 기술 스택을 물어봅니다. GitHub CLI가 설치돼 있으면 저장소까지 자동으로 만들어줍니다.

### 2. 팀 꾸리기

```
/new
```

"날씨 알림 텔레그램 봇을 만들고 싶어"처럼 아이디어를 입력하면, 프로젝트 복잡도를 분석해서 적합한 모드와 팀 구성을 추천합니다. 마음에 안 들면 직접 수정할 수 있습니다.

> 모드를 직접 고르고 싶다면 `/new-project`를 쓰세요.

### 3. 팀 토론

```
/discuss
```

CTO가 먼저 아키텍처를 잡고, PO가 요구사항을 정리하고, 리서처가 기술 스택을 비교합니다. 그 결과를 바탕으로 나머지 팀원들이 각자 관점에서 살을 붙입니다. 팀원의 80% 이상이 동의하면 기획서가 완성되고, 아니면 의견이 갈리는 부분을 중심으로 다시 토론합니다 (최대 3라운드).

### 4. 기획서 승인

```
/approve
```

완성된 기획서를 보여줍니다. 승인하면 작업이 역할별로 분배되고, 수정이 필요하면 피드백을 남길 수 있습니다.

### 5. 실행

```
/execute
```

여기서 실제 작업이 이뤄집니다. 팀원들이 Phase별로 병렬 작업하고, 다른 팀원 최소 2명이 결과물을 리뷰합니다.

리뷰에서 문제가 발견되면:
1. 문제를 7개 카테고리(보안, 빌드, 테스트, 성능, 타입, 아키텍처, 로직)로 분류
2. 담당자에게 "이전에 뭘 시도했고 뭐가 안 됐는지"를 알려주면서 수정을 요청 (최대 2회)
3. 그래도 안 되면 당신(CEO)에게 알려줌 — 계속 시도할지, 건너뛸지, 중단할지 선택

### 6. 보고서

```
/report      # 전체 과정 정리
/feedback    # 팀원별 성과 분석 + 다음 프로젝트를 위한 개선 제안
```

## 전체 커맨드

20개 슬래시 커맨드를 제공합니다. 처음에는 위의 6개만 알면 충분합니다.

### 프로젝트 진행

| 커맨드 | 설명 |
|--------|------|
| `/hello` | 프로젝트 폴더 + GitHub 저장소 생성 |
| `/new` | 아이디어 입력, 복잡도 분석, 팀 자동 구성 |
| `/discuss` | 팀 토론으로 기획서 작성 |
| `/approve` | 기획서 승인 + 작업 분배 |
| `/execute` | 작업 실행 + 크로스 리뷰 + 자동 수정 |
| `/report` | 최종 보고서 |

### 프로젝트 관리

| 커맨드 | 설명 |
|--------|------|
| `/status` | 현재 프로젝트 상태 확인 |
| `/feedback` | 팀원 성과 분석, 에이전트 개선 제안 |
| `/my-team` | 팀 구성 확인 + 역할 카탈로그 |
| `/learn` | 역할별 학습 가이드 |

### 커스터마이징

| 커맨드 | 설명 |
|--------|------|
| `/new-project` | `/new`의 수동 버전 (타입/모드 직접 선택) |
| `/projects` | 전체 프로젝트 목록 |
| `/onboarding` | 사용자 환경 초기 설정 (한 번만 하면 됨) |
| `/my-config` | 현재 설정 확인 |
| `/scaffold` | 프로젝트 템플릿으로 초기 코드 생성 |
| `/add-skill` | 스킬 추가 설치 |
| `/add-agent` | 에이전트 추가 설치 |
| `/preset` | 프리셋(역할/스택/워크플로우) 관리 |
| `/reset` | 설정 초기화 |
| `/eval` | 접근법 A/B 비교 평가 |

## 세 가지 모드

프로젝트 규모에 맞는 모드를 자동으로 추천합니다. `/new`에서 복잡도를 분석한 결과에 따라 달라집니다.

| 모드 | 팀 규모 | 토론 | 추천 상황 |
|------|---------|------|----------|
| **quick-build** | 2-3명 | 생략 | 간단한 봇, 스크립트, 유틸리티 |
| **plan-execute** | 3-5명 | 1라운드 | 웹앱, API 서버, 중간 규모 프로젝트 |
| **plan-only** | 5-8명 | 최대 3라운드 | 대규모 시스템, 기획서만 필요할 때 |

## 팀원 역할 (15개)

| 역할 | 카테고리 | 하는 일 |
|------|----------|---------|
| CTO | Leadership | 기술 아키텍처 설계, 기술 의사결정 |
| Product Owner | Leadership | 요구사항 정의, 우선순위 결정 |
| Full-stack Developer | Engineering | 프론트엔드 + 백엔드 전체 구현 |
| Frontend Developer | Engineering | UI 구현, 컴포넌트 설계 |
| Backend Developer | Engineering | API 설계, 비즈니스 로직 |
| QA Engineer | Engineering | 테스트 전략, 품질 보증 |
| UI/UX Designer | Design | 사용자 경험 설계 |
| DevOps Engineer | Engineering | CI/CD, 배포, 인프라 |
| Data Engineer | Engineering | 데이터 파이프라인, 분석 |
| Security Engineer | Engineering | 보안 검토, 취약점 분석 |
| Technical Writer | Support | 기술 문서 작성 |
| Market Researcher | Research | 시장 분석, 경쟁사, 트렌드 |
| Business Researcher | Research | 비즈니스 모델, 수익화, 성장 전략 |
| Tech Researcher | Research | 기술 스택 비교, 벤치마크, 오픈소스 |
| Design Researcher | Research | 사용자 리서치, UX 벤치마크, 접근성 |

## SDK (프로그래밍 API)

슬래시 커맨드 대신 코드로 직접 호출할 수도 있습니다.

```javascript
import { GoodVibe } from 'good-vibe-coding';

const gv = new GoodVibe({
  provider: 'claude',                // 'claude' | 'openai' | 'gemini'
  model: 'claude-sonnet-4-6',
  storage: 'memory',                 // 경로 문자열 또는 커스텀 객체
});

// 팀 구성 (로컬 계산, LLM 미사용)
const team = await gv.buildTeam('날씨 알림 텔레그램 봇', {
  complexity: 'simple',
});

// 토론 자동 루프 (LLM 호출)
const plan = await gv.discuss(team);

// 실행 자동 루프 (LLM 호출)
const result = await gv.execute(plan, {
  onEscalation: async (ctx) => 'skip',     // 품질 게이트 실패 시
  onPhaseComplete: async (phase) => {},     // Phase 완료 시
});

// 보고서
const report = gv.report(result);
```

Discusser, Executor를 개별로 import해서 세밀하게 제어할 수도 있습니다.

## 아키텍처

```
┌─────────────────────────────────────────────┐
│  사용자              슬래시 커맨드 6개        │
│  /hello → /new → /discuss → /approve →      │
│  /execute → /report                          │
├─────────────────────────────────────────────┤
│  SDK                 GoodVibe 클래스         │
│  buildTeam → discuss → execute → report     │
├─────────────────────────────────────────────┤
│  AI 팀원             15개 역할               │
│  Tier별 병렬 분석 + 크로스 리뷰              │
├─────────────────────────────────────────────┤
│  내부 API            CLI-as-API (101개)      │
│  에이전트가 호출하는 인터페이스               │
├─────────────────────────────────────────────┤
│  코어 라이브러리      41개 모듈 + 14개 핸들러  │
│  프로젝트 관리, 오케스트레이션, 리뷰 엔진 등  │
└─────────────────────────────────────────────┘
```

사용자가 슬래시 커맨드를 입력하면, 에이전트가 내부 API를 호출하고, 코어 라이브러리가 실제 로직을 처리합니다. SDK는 동일한 코어 라이브러리를 프로그래밍 API로 노출합니다.

## 프로젝트 구조

```
good-vibe-coding/
├── src/             SDK (GoodVibe, Discusser, Executor, Storage)
├── plugin/          Claude Code 어댑터
├── agents/          23개 에이전트 (팀 15 + 서포트 8)
├── commands/        20개 슬래시 커맨드 정의
├── scripts/
│   ├── cli.js       내부 API 라우터 (101개 커맨드)
│   ├── handlers/    14개 핸들러 모듈
│   └── lib/         41개 코어 라이브러리
│       ├── core/        기반 유틸 (validators, config, cache 등)
│       ├── project/     프로젝트 관리 (project-manager, scaffolder 등)
│       ├── engine/      실행 엔진 (orchestrator, execution-loop, review 등)
│       ├── llm/         LLM 연동 (llm-provider, gemini-bridge 등)
│       ├── agent/       에이전트/팀 (team-builder, optimizer 등)
│       └── output/      보고/환경 (report-generator, env-checker 등)
├── presets/         역할, 프로젝트 타입, 템플릿
├── guides/          사용자 가이드
├── templates/       Handlebars 템플릿
├── skills/          4개 내장 스킬
└── tests/           1,225+ 테스트 (Vitest)
```

## 개발

```bash
npm install           # 의존성 설치
npm test              # 전체 테스트
npm run test:watch    # 감시 모드
npm run test:coverage # 커버리지 리포트
```

## 기술 스택

- **Node.js 18+** (ESM)
- **Handlebars** 템플릿 엔진
- **Vitest** 테스트 (1,225+개)
- **GitHub Actions** CI (Node 18/20/22)

## 데이터 저장 위치

| 데이터 | 경로 |
|--------|------|
| 프로젝트 | `~/.claude/good-vibe/projects/{id}/project.json` |
| 에이전트 오버라이드 (사용자) | `~/.claude/good-vibe/agent-overrides/{roleId}.md` |
| 에이전트 오버라이드 (프로젝트) | `{projectDir}/.good-vibe/agent-overrides/{roleId}.md` |
| 커스텀 템플릿 | `~/.claude/good-vibe/custom-templates/` |

## 라이선스

MIT
