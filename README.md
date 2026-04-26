# Good Vibe Coding

AI 팀을 만들고, 프로젝트를 함께 굴려보세요.

[![CI](https://github.com/sumsun-dev/good-vibe-coding/actions/workflows/ci.yml/badge.svg)](https://github.com/sumsun-dev/good-vibe-coding/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

"텔레그램 봇 만들어줘"라고 하면, CTO가 아키텍처를 잡고, 백엔드 개발자가 API를 짜고, QA가 테스트를 돌립니다. 당신은 CEO로서 방향만 잡으면 됩니다.

## 왜 쓰나요?

**혼자 코딩할 때 이런 경험, 있지 않나요?**

- 기능 구현에 집중하다 보안 취약점을 놓침
- 나중에 보니 아키텍처가 엉망이 되어 있음
- 테스트를 미루다가 결국 안 작성함
- 문서화는 항상 "나중에"

**Good Vibe Coding은 이 문제를 AI 팀으로 해결합니다.**

- CTO가 아키텍처를 잡고, Security Engineer가 보안 취약점을 짚어줍니다
- QA가 테스트 전략을 세우고, 코드 리뷰에서 로직 오류를 잡습니다
- DevOps가 CI/CD를 구성하고, Tech Writer가 문서를 정리합니다
- 2회 수정해도 안 되면 CEO(당신)에게 판단을 요청합니다

자연어 한 줄을 던지면, AI 팀이 **의도 분류 → 팀 구성 → 실행 → 리뷰 → 보고**까지 해줍니다.

## 설치

### Claude Code 플러그인 (권장)

마켓플레이스를 추가하고 플러그인을 설치합니다 (각각 별도로 실행):

```bash
/plugin marketplace add sumsun-dev/good-vibe-coding
```

```bash
/plugin install good-vibe@good-vibe
```

### 소스에서 직접 설치

```bash
git clone https://github.com/sumsun-dev/good-vibe-coding.git
cd good-vibe-coding
npm install
```

```bash
/plugin marketplace add .
```

```bash
/plugin install good-vibe@good-vibe
```

### 업데이트

```bash
/plugin marketplace update good-vibe
```

### 필요한 것

- [Claude Code](https://claude.ai/code) 2.0 이상
- Node.js 18 이상
- (선택) [GitHub CLI](https://cli.github.com/) — 저장소 자동 생성, branch/PR 관리에 쓰임
- (선택) [Gemini CLI](https://github.com/google-gemini/gemini-cli) — 크로스 모델 리뷰에 쓰임

## 시작하기

### 한 줄 진입: `/gv`

자연어 한 줄을 `/gv`에 던지면, 의도를 분류하고 알아서 끝까지 진행합니다.

```
> /gv 날씨 알림 텔레그램 봇 만들어줘

🔍 task=code · confidence=0.92
🔍 복잡도 분석 중...
   복잡도: simple → 추천 모드: quick-build

👥 팀 구성:
   CTO (opus) · Backend Developer (sonnet) · QA Engineer (haiku)

🏗️ CTO 아키텍처 분석...
   → Node.js + Telegraf + OpenWeatherMap API
   → 3개 Phase, 5개 태스크

⚡ 실행 중...
   Phase 1/3: 프로젝트 셋업 ✓
   Phase 2/3: 핵심 기능 구현 ✓
   Phase 3/3: 테스트 + 문서 ✓

📋 QA 리뷰: 통과 (critical 0, important 1)

✅ 프로젝트 완료!
→ 다음: /gv "보고서 확인"으로 보고서를 확인하세요
```

`/gv`가 입력을 자동으로 5개 작업 유형 중 하나로 분류합니다:

| 작업 유형  | 자동 트리거 예시                          | 일반 소요     |
| ---------- | ----------------------------------------- | ------------- |
| `code`     | 구현·수정·리팩토링·디버깅 ("...만들어줘") | 5-30분        |
| `plan`     | 대규모 기획 ("...플랫폼 만들고 싶어")     | 30분 - 수시간 |
| `research` | 비교·조사 ("X vs Y 비교")                 | 3-10분        |
| `review`   | PR/diff 리뷰                              | 1-3분         |
| `ask`      | 자유 질의 ("...어떻게 동작해?")           | 즉시-3분      |

CEO가 외울 절차는 없습니다. AI 팀이 흐름을 결정하고, 위험·비용 임계 초과 시에만 CEO 확인을 요청합니다.

> 더 자세한 설명: [퀵스타트 가이드](guides/common/00-quick-start.md)

### 보조 슬래시 (5개)

`/gv` 자연어로 다 되지만, 자주 쓰는 동작은 짧은 슬래시도 있습니다.

| 슬래시        | 하는 일                                  | 언제 쓰면 좋은가                |
| ------------- | ---------------------------------------- | ------------------------------- |
| `/gv:status`  | 활성 프로젝트 상태 + 다음 권장 액션      | 진행 상황 빠르게 확인           |
| `/gv:execute` | task-graph 실행 (interactive/auto/semi)  | 분류 결과를 받아 실제 실행 시작 |
| `/gv:resume`  | 중단된 실행 재개 (file-lock + journal)   | Phase 중간에 끊겼을 때          |
| `/gv:team`    | 활성 프로젝트 팀 구성 + 모델 분포        | 누가 일하고 있는지 확인         |
| `/gv:cost`    | 토큰/비용 집계 + 예산 임계 설정 (opt-in) | 비용 가시화/한도 설정           |

> 모든 입력은 `/gv`로 통합됩니다. 보조 슬래시는 자주 쓰는 동작에 대한 단축어일 뿐입니다.

## 세 가지 모드

`/gv`가 자연어 입력의 복잡도를 분석해서 적합한 모드를 자동 추천합니다.

| 모드         | 팀 규모 | 토론                    | 추천 상황                          | 소요시간 |
| ------------ | ------- | ----------------------- | ---------------------------------- | -------- |
| quick-build  | 2-3명   | 생략                    | 간단한 봇, 스크립트, 유틸리티      | 3-5분    |
| plan-execute | 3-5명   | 생략 (CTO+PO 빠른 분석) | 웹앱, API 서버, 중간 규모 프로젝트 | 10-15분  |
| plan-only    | 5-8명   | 최대 3라운드            | 대규모 시스템, 충분한 토론 후 실행 | 20-40분  |

추천이 마음에 들지 않으면 자연어로 변경 요청 — 예: `/gv "팀을 plan-only로 늘려줘"`.

### 모드별 실제 진행 예시

**quick-build** — "텔레그램 봇 만들어줘"

```
/gv "..." → CTO 분석 → 작업 분배 → 실행 + QA 리뷰 → 완료

  👥 팀: CTO, Backend, QA (3명)
  📋 Phase 3개, 태스크 5개
  ⏱️ 약 5분
```

**plan-execute** — "팀 프로젝트 관리 웹앱"

```
/gv "..." → CTO+PO 빠른 분석 → 자동 승인 → 자동 실행 + 크로스 리뷰 → 완료

  👥 팀: CTO, PO, Fullstack, Frontend, QA (5명)
  🔍 CTO+PO 병렬 분석 → 기획서 확정
  📋 Phase 5개, 태스크 12개
  ⏱️ 약 10-15분
```

**plan-only** — "마이크로서비스 SaaS 플랫폼"

```
/gv "..." → 팀 토론(최대 3라운드) → CEO 승인 → /gv:execute → 완료

  👥 팀: CTO, PO, Backend, Frontend, DevOps, Security, QA, Tech Writer (8명)
  💬 토론 2라운드 → 승인율 82% → 기획서 확정
  📋 Phase 8개, 태스크 25개
  ⏱️ 약 40분
  ⚠️ CEO 승인 필요: /gv "기획 승인" → /gv:execute
```

## 실행 모드

`/gv:execute` 시작 시 세 가지 모드를 선택할 수 있습니다. (SDK는 `auto` 고정)

| 모드       | 동작                             | 추천 상황                                           |
| ---------- | -------------------------------- | --------------------------------------------------- |
| 인터랙티브 | Phase마다 진행 여부를 확인합니다 | 처음 쓸 때, 중간 결과를 보면서 진행하고 싶을 때     |
| 세미-오토  | 3 Phase마다 확인합니다           | Phase가 많은 프로젝트에서 배치로 확인하고 싶을 때   |
| 자동       | 문제가 생길 때만 멈춥니다        | 기획이 충분히 검토된 상태에서 빠르게 돌리고 싶을 때 |

실행 중 문제가 발견되면:

1. 문제를 7개 카테고리(보안, 빌드, 테스트, 성능, 타입, 아키텍처, 로직)로 분류
2. 담당자에게 "이전에 뭘 시도했고 뭐가 안 됐는지"를 알려주면서 수정을 요청 (최대 2회)
3. 에러 발생 시 에이전트에게 다음 행동 가이드를 자동 제공하여 자율 복구 시도
4. 그래도 안 되면 당신(CEO)에게 알려줌 — 계속 시도할지, 건너뛸지, 중단할지 선택

코드 태스크에서는 구현 전에 기존 코드를 먼저 탐색하여 중복 코드를 방지합니다 (Search Before Building).

## GitHub 협업 워크플로우 (opt-in)

코드를 branch로 관리하고, PR로 리뷰받고 싶다면 GitHub 협업 모드를 켜세요.

```
기본값: github.enabled = false → 기존과 동일 (main 직접 커밋)
```

GitHub 협업 모드를 활성화하면:

1. 실행 시작 시 feature branch 자동 생성 (`gv/{프로젝트명}-{timestamp}`)
2. Phase별 conventional commit 자동 생성 (`feat(phase-1): API 라우터 구현`)
3. 실행 완료 후 Pull Request 자동 생성 (팀 구성, Phase 결과 요약 포함)
4. 기술 스택 감지 후 GitHub Actions CI 워크플로우 자동 생성

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
/gv:status                # 현재 프로젝트가 어디까지 진행됐는지 확인 (Phase, 상태)
/gv:resume                # 중단된 실행 재개 (file-lock + journal로 안전하게)
/gv:execute               # 새 실행 시작 (또는 approved 상태에서 진행)
/gv "이어서 해줘"          # 자연어로 재개 의도 전달 → resume으로 라우팅
```

- "이어서 해줘", "계속하자", "resume" 등의 자연어는 `/gv`가 자동으로 resume 액션으로 분류합니다
- 실행 상태(Phase, 수정 이력, 작업 결과)는 자동 저장됩니다
- `/gv:resume`은 마지막 Phase부터 이어서 진행합니다 (journal에서 복구)
- 완료된 프로젝트에 `/gv "피드백 분석"`으로 팀원 성과를 분석하면, 다음 프로젝트에 자동 반영됩니다
- 완료된 프로젝트에 기능을 추가/수정하려면 `/gv "수정 요청 ..."`으로 기존 맥락을 유지하면서 변경할 수 있습니다

## 전체 커맨드

v2는 **단일 진입점 1개 + 보조 슬래시 5개**로 정리되어 있습니다. 처음에는 `/gv` 하나만 알면 충분합니다.

| 슬래시        | 설명                                         |
| ------------- | -------------------------------------------- |
| `/gv "..."`   | 자연어 단일 진입점 (의도 분류 + 다음 액션)   |
| `/gv:status`  | 활성 프로젝트 상태 + 다음 권장 액션          |
| `/gv:execute` | task-graph 실행 시작 (interactive/auto/semi) |
| `/gv:resume`  | 중단된 실행 재개                             |
| `/gv:team`    | 팀 구성 + 모델 분포                          |
| `/gv:cost`    | 예산 임계 조회/설정 (opt-in)                 |

> v1 슬래시 20개는 v2에서 일괄 제거되었습니다. 매핑은 [커맨드 레퍼런스](guides/common/03-commands-reference.md)와 [고급 커맨드 마이그레이션](guides/common/12-advanced-commands.md)을 참고하세요.

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
- `/gv:cost`로 실제 사용량(토큰, 비용, 에이전트 호출 수)과 예산 임계를 관리할 수 있습니다
- 크로스 모델 리뷰(Gemini) 사용 시 해당 프로바이더 비용이 별도로 발생합니다

## SDK (프로그래밍 API)

슬래시 커맨드 대신 코드로 직접 호출할 수도 있습니다.

```javascript
import { GoodVibe } from 'good-vibe';

const gv = new GoodVibe({
  provider: 'claude', // 'claude' | 'openai' | 'gemini'
  model: 'claude-sonnet-4-6',
  storage: 'memory', // 경로 문자열 또는 커스텀 객체
});

// 팀 구성 → 토론 → 실행 → 보고서
const team = await gv.buildTeam('날씨 알림 텔레그램 봇', { complexity: 'simple' });
const { document } = await gv.discuss(team);
const result = await gv.execute({
  document,
  team: team.agents,
  tasks: [{ id: 't-1', title: 'Bot 구현', assignee: 'backend', phase: 1 }],
});
const report = gv.report(result);
```

Storage 옵션, 에러 처리, Discusser/Executor 개별 사용 등 상세 내용은 [SDK 사용 가이드](guides/common/09-sdk-usage.md)를 참고하세요.

## 트러블슈팅

### 실행 중 멈췄을 때

```
/gv:status      # 현재 어디까지 진행됐는지 확인 (Phase, 상태)
/gv:resume      # 마지막 Phase부터 이어서 진행 (file-lock + journal로 안전하게)
```

실행 상태(Phase, 수정 이력, 작업 결과)는 `project.json`과 `journal.jsonl`에 자동 저장되므로, 세션이 끊겨도 `/gv:resume`으로 안전하게 재개할 수 있습니다.

### 에스컬레이션이 발생했을 때

수정을 2회 시도해도 품질 게이트를 통과하지 못하면, CEO(당신)에게 선택을 요청합니다:

- continue — 한 번 더 수정 시도 (수정 방향 직접 지시 가능)
- skip — 해당 Phase를 건너뛰고 다음으로 진행
- abort — 실행 전체를 중단

### 빌드가 실패할 때

코드 태스크는 `/tmp`에서 빌드 검증을 거칩니다. 실패하면:

1. `/tmp` 디렉토리에 임시 프로젝트가 남아있어 직접 디버깅 가능
2. 에러 메시지와 카테고리(security/build/test 등)가 수정 프롬프트에 자동 주입
3. 2회 실패 시 에스컬레이션으로 전환

### 토론이 수렴되지 않을 때

최대 3라운드 토론 후에도 80% 동의에 도달하지 못하면, 마지막 라운드 결과로 기획서를 확정합니다. `/gv "기획 수정 ..."` 자연어로 직접 수정 피드백을 남길 수 있습니다.

## FAQ

### 처음인데 뭐부터 하면 되나요?

`/gv`에 자연어 한 줄을 던지세요. 예: `/gv 결제 시스템 구현해줘`. 환경 점검은 `/gv:status` + Claude Code 표준 `/doctor`로 갈음됩니다.

### Claude Code 없이도 쓸 수 있나요?

SDK를 사용하면 Claude Code 없이 Node.js 환경에서 직접 호출할 수 있습니다. 다만 슬래시 커맨드(`/gv`, `/gv:execute` 등)는 Claude Code 플러그인이 필요합니다.

### 어떤 LLM을 지원하나요?

Claude, OpenAI, Gemini를 지원합니다. 팀원마다 다른 모델을 배정할 수도 있습니다.

### 기존 코드베이스에 적용할 수 있나요?

기존 코드베이스 폴더에서 `/gv "..."`를 실행하면, 기술 스택과 구조를 자동으로 파악합니다. 이 정보가 팀 구성과 토론에 반영됩니다.

### 팀원을 직접 골라도 되나요?

`/gv`가 자동 추천한 팀을 자연어로 수정할 수 있습니다 — 예: `/gv "팀에 Security Engineer 추가해줘"`.

### 완료된 프로젝트를 수정하고 싶어요

`/gv "수정 요청 ..."`을 사용하세요. 자연어 입력이 `category=modify`로 자동 분류되어, 기존 맥락(팀 구성, 기획서, 실행 이력)을 유지하면서 기능을 추가하거나 수정합니다.

### 실행 중 세션이 끊기면 어떻게 되나요?

실행 상태가 `project.json`과 `journal.jsonl`에 자동 저장됩니다. `/gv:resume`을 실행하면 마지막 Phase부터 안전하게 이어서 진행할 수 있습니다.

### GitHub 연동은 필수인가요?

아닙니다. 기본값은 `github.enabled = false`이고, 켜지 않으면 main 브랜치에 직접 커밋합니다. GitHub CLI가 설치되지 않아도 에러 없이 동작합니다.

## 데이터 저장 위치

| 데이터                         | 경로                                                  |
| ------------------------------ | ----------------------------------------------------- |
| 프로젝트                       | `~/.claude/good-vibe/projects/{id}/project.json`      |
| 에이전트 오버라이드 (사용자)   | `~/.claude/good-vibe/agent-overrides/{roleId}.md`     |
| 에이전트 오버라이드 (프로젝트) | `{projectDir}/.good-vibe/agent-overrides/{roleId}.md` |
| 커스텀 템플릿                  | `~/.claude/good-vibe/custom-templates/`               |

<details>
<summary><strong>개발자 정보 (Contributing)</strong></summary>

### 아키텍처

```
┌─────────────────────────────────────────────┐
│  사용자              슬래시 커맨드 6개        │
│  /gv "..." (단일 진입점)                     │
│  /gv:status, /gv:execute, /gv:resume,       │
│  /gv:team, /gv:cost (보조 슬래시)            │
├─────────────────────────────────────────────┤
│  의도 분류           NL 라우터               │
│  status / resume / modify / task            │
│  task → code/plan/research/review/ask        │
├─────────────────────────────────────────────┤
│  SDK                 GoodVibe 클래스         │
│  buildTeam → discuss → execute → report     │
├─────────────────────────────────────────────┤
│  AI 팀원             15개 역할               │
│  Tier별 병렬 분석 + 크로스 리뷰              │
├─────────────────────────────────────────────┤
│  실행 엔진           task-graph 그래프       │
│  5개 작업 유형별 동적 워크플로우             │
├─────────────────────────────────────────────┤
│  내부 API            CLI-as-API (139개)      │
│  에이전트가 호출하는 인터페이스               │
├─────────────────────────────────────────────┤
│  코어 라이브러리      69개 모듈 + 18개 핸들러  │
│  프로젝트 관리, 오케스트레이션, 리뷰 엔진 등  │
└─────────────────────────────────────────────┘
```

### 프로젝트 구조

```
good-vibe/
├── src/             SDK (GoodVibe, Discusser, Executor, Storage)
├── plugin/          Claude Code 어댑터
├── agents/          23개 에이전트 (팀 15 + 서포트 8)
├── commands/        v2 슬래시 커맨드 정의 (단일 진입점 + 보조 5개)
├── scripts/
│   ├── cli.js       내부 API 라우터 (139개 커맨드)
│   ├── handlers/    18개 핸들러 모듈
│   └── lib/         69개 코어 라이브러리
│       ├── core/        기반 유틸 (validators, config, nl-router 등)
│       ├── project/     프로젝트 관리 (project-manager, scaffolder, branch, PR, CI 등)
│       ├── engine/      실행 엔진 (task-graph-runner, orchestrator, review 등)
│       ├── llm/         LLM 연동 (llm-provider, gemini-bridge 등)
│       ├── agent/       에이전트/팀 (team-builder, optimizer 등)
│       └── output/      보고/환경 (report-generator, env-checker 등)
├── presets/         역할, 프로젝트 타입, 템플릿, CI 템플릿
├── guides/          사용자 가이드
├── templates/       Handlebars 템플릿
├── skills/          5개 내장 스킬
├── internal/        Daily Improvement 자율 파이프라인 (내부 개발 도구)
└── tests/           2,550+ 테스트 (Vitest)
```

### 기술 스택

- Node.js 18+ (ESM)
- Handlebars 템플릿 엔진
- Vitest 테스트 (2,550+개)
- GitHub Actions CI (Node 18/20/22)

### 개발

```bash
npm install           # 의존성 설치
npm test              # 전체 테스트
npm run test:watch    # 감시 모드
npm run test:coverage # 커버리지 리포트
```

### 지원 범위

**빌드 검증 지원 언어:**

| 언어    | 빌드 커맨드                                | 타임아웃 |
| ------- | ------------------------------------------ | -------- |
| Node.js | `npm install --ignore-scripts && npm test` | 30초     |
| Python  | `pip install && pytest`                    | 30초     |
| Go      | `go build ./...`                           | 45초     |
| Java    | `mvn compile`                              | 60초     |

**정책 제약:**

| 항목              | 제한         | 설명                        |
| ----------------- | ------------ | --------------------------- |
| Phase당 수정 시도 | 최대 2회     | 초과 시 CEO 에스컬레이션    |
| 토론 라운드       | 최대 3회     | 80%+ 동의 시 조기 수렴      |
| 에이전트 호출     | 세션당 500회 | 무한 루프 방지              |
| 크로스 리뷰어     | 2-3명        | 도메인 매칭 기반 자동 선정  |
| 리비전 라운드     | 최대 2회     | critical + important 이슈만 |

</details>

## 라이선스

MIT
