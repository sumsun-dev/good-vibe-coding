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
- (선택) [GitHub CLI](https://cli.github.com/) — 저장소 자동 생성, branch/PR 관리에 쓰임
- (선택) [Gemini CLI](https://github.com/google-gemini/gemini-cli) — 크로스 모델 리뷰에 쓰임

## 시작하기

### 가장 빠른 방법: `/new`

아이디어만 입력하면, 복잡도를 분석해서 **알아서 끝까지 진행**합니다.

```
/new
→ "날씨 알림 텔레그램 봇 만들어줘"
→ 복잡도 분석: simple → quick-build 모드 자동 선택
→ 팀 구성: CTO, Backend, QA (3명)
→ CTO 아키텍처 분석 → 작업 분배 → 실행 → QA 리뷰
→ 완료!
```

코드를 직접 관리하고 싶다면 `/hello`로 프로젝트 폴더와 GitHub 저장소를 먼저 만들고 `/new`를 실행하세요.

### 단계별로 진행하기

커맨드 6개로 프로젝트 하나를 처음부터 끝까지 만들 수 있습니다.

```
/hello  →  /new  →  /discuss  →  /approve  →  /execute  →  /report
```

| 단계 | 커맨드     | 뭘 하나요?                                                                         | 걸리는 시간 |
| ---- | ---------- | ---------------------------------------------------------------------------------- | ----------- |
| 1    | `/hello`   | 프로젝트 폴더와 GitHub 저장소를 만듭니다. GitHub CLI가 있으면 저장소까지 자동 생성 | 2-3분       |
| 2    | `/new`     | 아이디어를 말하면, 복잡도를 분석해서 모드와 팀을 추천합니다. 직접 수정도 가능      | 1-2분       |
| 3    | `/discuss` | 팀원들이 Tier별로 돌아가며 분석하고, 80%+ 동의하면 기획서 확정                     | 3-10분      |
| 4    | `/approve` | 기획서를 읽고 승인하거나 수정을 요청합니다                                         | 1-2분       |
| 5    | `/execute` | 팀원들이 Phase별로 작업하고, 최소 2명이 크로스 리뷰. 코드는 TDD + /tmp 빌드 검증   | 5-15분      |
| 6    | `/report`  | 전체 과정 보고서 + `/feedback`으로 팀원 성과 분석 (다음 프로젝트에 자동 반영)      | 1분         |

**처음이라면 `/hello`부터 입력하세요.** 다음 단계는 그때그때 안내해드립니다.

> `/hello` 없이 `/new`만으로도 시작할 수 있습니다. 코드 생성/관리가 필요하면 `/hello`를 먼저, 기획서와 보고서만 필요하면 `/new`로 바로 시작하세요.

> 더 자세한 설명: [퀵스타트 가이드](guides/common/00-quick-start.md)

## 세 가지 모드

프로젝트 규모에 맞는 모드를 자동으로 추천합니다. `/new`에서 복잡도를 분석한 결과에 따라 달라집니다.

| 모드             | 팀 규모 | 토론         | 추천 상황                          | 소요시간 |
| ---------------- | ------- | ------------ | ---------------------------------- | -------- |
| **quick-build**  | 2-3명   | 생략         | 간단한 봇, 스크립트, 유틸리티      | 3-5분    |
| **plan-execute** | 3-5명   | 1라운드      | 웹앱, API 서버, 중간 규모 프로젝트 | 10-20분  |
| **plan-only**    | 5-8명   | 최대 3라운드 | 대규모 시스템, 충분한 토론 후 실행 | 20-40분  |

### 모드별 진행 흐름

**quick-build** — 토론 없이 바로 만들기

```
/new → CTO 분석 → 작업 분배 → 실행 + QA 리뷰 → 완료
```

**plan-execute** — 간단히 논의하고 자동 실행

```
/new → 팀 토론(1라운드) → 자동 승인 → 자동 실행 + 크로스 리뷰 → 완료
```

**plan-only** — 충분히 논의한 후 CEO 승인

```
/new → 팀 토론(최대 3라운드) → CEO 승인(/approve) → 실행(/execute) → 완료
```

## 실행 모드

`/execute` 시작 시 세 가지 모드를 선택할 수 있습니다.

| 모드           | 동작                             | 추천 상황                                           |
| -------------- | -------------------------------- | --------------------------------------------------- |
| **인터랙티브** | Phase마다 진행 여부를 확인합니다 | 처음 쓸 때, 중간 결과를 보면서 진행하고 싶을 때     |
| **세미-오토**  | 3 Phase마다 확인합니다           | Phase가 많은 프로젝트에서 배치로 확인하고 싶을 때   |
| **자동**       | 문제가 생길 때만 멈춥니다        | 기획이 충분히 검토된 상태에서 빠르게 돌리고 싶을 때 |

실행 중 문제가 발견되면:

1. 문제를 7개 카테고리(보안, 빌드, 테스트, 성능, 타입, 아키텍처, 로직)로 분류
2. 담당자에게 "이전에 뭘 시도했고 뭐가 안 됐는지"를 알려주면서 수정을 요청 (최대 2회)
3. 그래도 안 되면 당신(CEO)에게 알려줌 — 계속 시도할지, 건너뛸지, 중단할지 선택

## GitHub 협업 워크플로우 (opt-in)

코드를 branch로 관리하고, PR로 리뷰받고 싶다면 GitHub 협업 모드를 켜세요.

```
기본값: github.enabled = false → 기존과 동일 (main 직접 커밋)
```

`/hello`에서 GitHub 협업 모드를 활성화하면:

1. **실행 시작 시** feature branch 자동 생성 (`gv/{프로젝트명}-{timestamp}`)
2. **Phase별** conventional commit 자동 생성 (`feat(phase-1): API 라우터 구현`)
3. **실행 완료 후** Pull Request 자동 생성 (팀 구성, Phase 결과 요약 포함)
4. **기술 스택 감지** 후 GitHub Actions CI 워크플로우 자동 생성

### 브랜치 네이밍 전략

| 전략               | 예시                      | 설명                 |
| ------------------ | ------------------------- | -------------------- |
| `timestamp` (기본) | `gv/my-app-20260303-1400` | 시간 기반, 충돌 없음 |
| `phase`            | `gv/my-app-phase-1`       | Phase 기반           |
| `custom`           | 사용자 지정               | 직접 입력            |

### CI 자동 생성

기술 스택을 감지해서 `.github/workflows/ci.yml`을 자동으로 만듭니다.

| 언어    | 테스트 버전      | 감지 기준                                |
| ------- | ---------------- | ---------------------------------------- |
| Node.js | 18, 20, 22       | `package.json` 존재                      |
| Python  | 3.10, 3.11, 3.12 | `requirements.txt` 또는 `pyproject.toml` |
| Go      | 1.21             | `go.mod` 존재                            |
| Java    | 17               | `pom.xml` 존재                           |

### Graceful Degradation

- GitHub CLI(`gh`)가 설치되지 않아도 에러 없이 동작합니다 (PR 생성만 건너뜀)
- remote가 설정되지 않으면 push를 자동 건너뜁니다
- 모든 GitHub 기능은 opt-in이므로, 켜지 않으면 기존 동작과 완전히 동일합니다

## 기존 프로젝트 이어서 작업

프로젝트가 중간에 끊겼거나, 다음 날 이어서 하고 싶을 때:

```
/status             # 현재 프로젝트가 어디까지 진행됐는지 확인
/execute            # 중단된 실행이 있으면 자동으로 재개 여부를 물어봄
/projects           # 여러 프로젝트 중 하나를 선택해서 작업
```

- 실행 상태(Phase, 수정 이력, 작업 결과)는 자동 저장됩니다
- `/execute` 재실행 시 이전 Phase부터 이어서 진행할 수 있습니다
- 완료된 프로젝트에 `/feedback`으로 팀원 성과를 분석하면, 다음 프로젝트에 자동 반영됩니다

## 전체 커맨드

20개 슬래시 커맨드를 제공합니다. 처음에는 위의 6개만 알면 충분합니다.

### 프로젝트 진행

| 커맨드     | 설명                                                        |
| ---------- | ----------------------------------------------------------- |
| `/hello`   | 프로젝트 폴더 + GitHub 저장소 생성                          |
| `/new`     | 아이디어 입력, 복잡도 분석, 팀 자동 구성, 모드별 자동 진행  |
| `/discuss` | 팀 토론으로 기획서 작성                                     |
| `/approve` | 기획서 승인 + 작업 분배                                     |
| `/execute` | 작업 실행 + 크로스 리뷰 + 자동 수정 (중단된 실행 재개 가능) |
| `/report`  | 최종 보고서                                                 |

### 프로젝트 관리

| 커맨드      | 설명                                                         |
| ----------- | ------------------------------------------------------------ |
| `/status`   | 현재 프로젝트 상태 확인 (대시보드)                           |
| `/feedback` | 팀원 성과 분석, 에이전트 개선 제안 (다음 프로젝트 자동 적용) |
| `/my-team`  | 팀 구성 확인 + 역할 카탈로그                                 |
| `/learn`    | 역할별 학습 가이드                                           |

### 커스터마이징

| 커맨드         | 설명                                        |
| -------------- | ------------------------------------------- |
| `/new-project` | `/new`의 수동 버전 (타입/모드 직접 선택)    |
| `/projects`    | 전체 프로젝트 목록                          |
| `/onboarding`  | 사용자 환경 초기 설정 (한 번만 하면 됨)     |
| `/my-config`   | 현재 설정 확인                              |
| `/scaffold`    | 프로젝트 템플릿으로 초기 코드 생성          |
| `/add-skill`   | 스킬 추가 설치                              |
| `/add-agent`   | 에이전트 추가 설치                          |
| `/preset`      | 프리셋(역할/스택/워크플로우) 관리           |
| `/reset`       | 설정 초기화                                 |
| `/eval`        | 단일 프롬프트 vs 멀티에이전트 A/B 비교 평가 |

## 팀원 역할 (15개)

| 역할                 | 카테고리    | 하는 일                            |
| -------------------- | ----------- | ---------------------------------- |
| CTO                  | Leadership  | 기술 아키텍처 설계, 기술 의사결정  |
| Product Owner        | Leadership  | 요구사항 정의, 우선순위 결정       |
| Full-stack Developer | Engineering | 프론트엔드 + 백엔드 전체 구현      |
| Frontend Developer   | Engineering | UI 구현, 컴포넌트 설계             |
| Backend Developer    | Engineering | API 설계, 비즈니스 로직            |
| QA Engineer          | Engineering | 테스트 전략, 품질 보증             |
| UI/UX Designer       | Design      | 사용자 경험 설계                   |
| DevOps Engineer      | Engineering | CI/CD, 배포, 인프라                |
| Data Engineer        | Engineering | 데이터 파이프라인, 분석            |
| Security Engineer    | Engineering | 보안 검토, 취약점 분석             |
| Technical Writer     | Support     | 기술 문서 작성                     |
| Market Researcher    | Research    | 시장 분석, 경쟁사, 트렌드          |
| Business Researcher  | Research    | 비즈니스 모델, 수익화, 성장 전략   |
| Tech Researcher      | Research    | 기술 스택 비교, 벤치마크, 오픈소스 |
| Design Researcher    | Research    | 사용자 리서치, UX 벤치마크, 접근성 |

## 비용 안내

Good Vibe Coding은 AI 프로바이더의 API를 호출합니다. 모드와 팀 규모에 따라 비용이 달라집니다.

| 모드         | 에이전트 호출 | 대략적 토큰 | 예상 비용 (Claude 기준) |
| ------------ | ------------- | ----------- | ----------------------- |
| quick-build  | 10-20회       | 50K-150K    | $0.5-2                  |
| plan-execute | 30-60회       | 200K-500K   | $3-8                    |
| plan-only    | 50-100회+     | 500K-1M+    | $8-20+                  |

- 위 수치는 프로젝트 복잡도에 따라 크게 달라질 수 있습니다
- `/report`에서 실제 사용량 대시보드(토큰, 비용, 에이전트 호출 수)를 확인할 수 있습니다
- 크로스 모델 리뷰(Gemini) 사용 시 해당 프로바이더 비용이 별도로 발생합니다

## SDK (프로그래밍 API)

슬래시 커맨드 대신 코드로 직접 호출할 수도 있습니다.

```javascript
import { GoodVibe } from 'good-vibe-coding';

const gv = new GoodVibe({
  provider: 'claude', // 'claude' | 'openai' | 'gemini'
  model: 'claude-sonnet-4-6',
  storage: 'memory', // 경로 문자열 또는 커스텀 객체
});

// 팀 구성 (로컬 계산, LLM 미사용)
const team = await gv.buildTeam('날씨 알림 텔레그램 봇', {
  complexity: 'simple',
});

// 토론 자동 루프 (LLM 호출)
const plan = await gv.discuss(team);

// 실행 자동 루프 (LLM 호출, auto 모드 고정)
const result = await gv.execute(plan, {
  onEscalation: async (ctx) => 'skip', // 품질 게이트 실패 시
  onPhaseComplete: async (phase) => {}, // Phase 완료 시
});

// 보고서
const report = gv.report(result);
```

Discusser, Executor를 개별로 import해서 세밀하게 제어할 수도 있습니다.

```javascript
import { Discusser, Executor } from 'good-vibe-coding';
```

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
│  내부 API            CLI-as-API (114개)      │
│  에이전트가 호출하는 인터페이스               │
├─────────────────────────────────────────────┤
│  코어 라이브러리      53개 모듈 + 14개 핸들러  │
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
│   ├── cli.js       내부 API 라우터 (116개 커맨드)
│   ├── handlers/    14개 핸들러 모듈
│   └── lib/         53개 코어 라이브러리
│       ├── core/        기반 유틸 (validators, config, cache 등)
│       ├── project/     프로젝트 관리 (project-manager, scaffolder, branch, PR, CI 등)
│       ├── engine/      실행 엔진 (orchestrator, execution-loop, review 등)
│       ├── llm/         LLM 연동 (llm-provider, gemini-bridge 등)
│       ├── agent/       에이전트/팀 (team-builder, optimizer 등)
│       └── output/      보고/환경 (report-generator, env-checker 등)
├── presets/         역할, 프로젝트 타입, 템플릿, CI 템플릿
├── guides/          사용자 가이드
├── templates/       Handlebars 템플릿
├── skills/          4개 내장 스킬
├── internal/        Daily Improvement 자율 파이프라인 (내부 개발 도구)
└── tests/           1,850+ 테스트 (Vitest)
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
- **Vitest** 테스트 (1,760+개)
- **GitHub Actions** CI (Node 18/20/22)

## 지원 범위

### 빌드 검증 지원 언어

| 언어    | 빌드 커맨드                                | 타임아웃 |
| ------- | ------------------------------------------ | -------- |
| Node.js | `npm install --ignore-scripts && npm test` | 30초     |
| Python  | `pip install && pytest`                    | 30초     |
| Go      | `go build ./...`                           | 45초     |
| Java    | `mvn compile`                              | 60초     |

### 미지원 (현재)

- Rust, C/C++ 빌드 검증
- Docker 기반 빌드/배포
- GUI 테스트 (Playwright, Cypress 등)
- 모바일 앱 빌드 (Flutter, React Native 등)

### 정책 제약

| 항목              | 제한         | 설명                        |
| ----------------- | ------------ | --------------------------- |
| Phase당 수정 시도 | 최대 2회     | 초과 시 CEO 에스컬레이션    |
| 토론 라운드       | 최대 3회     | 80%+ 동의 시 조기 수렴      |
| 에이전트 호출     | 세션당 500회 | 무한 루프 방지              |
| 크로스 리뷰어     | 2-3명        | 도메인 매칭 기반 자동 선정  |
| 리비전 라운드     | 최대 2회     | critical + important 이슈만 |

## 트러블슈팅

### 실행 중 멈췄을 때

```
/status      # 현재 어디까지 진행됐는지 확인 (Phase, 상태)
/execute     # 중단된 실행이 있으면 자동으로 재개 여부를 물어봄
```

실행 상태(Phase, 수정 이력, 작업 결과)는 `project.json`에 자동 저장되므로, 세션이 끊겨도 이전 Phase부터 이어서 진행할 수 있습니다.

### 에스컬레이션이 발생했을 때

수정을 2회 시도해도 품질 게이트를 통과하지 못하면, CEO(당신)에게 선택을 요청합니다:

- **continue** — 한 번 더 수정 시도
- **skip** — 해당 Phase를 건너뛰고 다음으로 진행
- **abort** — 실행 전체를 중단

### 빌드가 실패할 때

코드 태스크는 `/tmp`에서 빌드 검증을 거칩니다. 실패하면:

1. `/tmp` 디렉토리에 임시 프로젝트가 남아있어 직접 디버깅 가능
2. 에러 메시지와 카테고리(security/build/test 등)가 수정 프롬프트에 자동 주입
3. 2회 실패 시 에스컬레이션으로 전환

### 토론이 수렴되지 않을 때

최대 3라운드 토론 후에도 80% 동의에 도달하지 못하면, 마지막 라운드 결과로 기획서를 확정합니다. `/approve`에서 직접 수정 피드백을 남길 수 있습니다.

## 데이터 저장 위치

| 데이터                         | 경로                                                  |
| ------------------------------ | ----------------------------------------------------- |
| 프로젝트                       | `~/.claude/good-vibe/projects/{id}/project.json`      |
| 에이전트 오버라이드 (사용자)   | `~/.claude/good-vibe/agent-overrides/{roleId}.md`     |
| 에이전트 오버라이드 (프로젝트) | `{projectDir}/.good-vibe/agent-overrides/{roleId}.md` |
| 커스텀 템플릿                  | `~/.claude/good-vibe/custom-templates/`               |

## 라이선스

MIT
