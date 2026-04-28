# PRD: Good Vibe v2 — AI-Native Agentic Team Platform

| 항목      | 값                                                                                                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 버전      | v2.8 (자가발전 Tier 1 통합 완료, 2.0.0-rc.2 cut)                                                                                                                                            |
| 작성일    | 2026-04-26 (v2.8 갱신: 2026-04-28)                                                                                                                                                          |
| 작성자    | sose (CEO) + Claude (기획 보조)                                                                                                                                                             |
| 상태      | **2.0.0-rc.2 RC 릴리즈 단계** — 자가발전 Tier 1(다차원 신호 + provenance + shadow mode) + 통합(A 시리즈) + CEO 가시성/제어(`/gv:agent-history`) 완료. CEO 도그푸딩 후 v2.0.0 정식 승급 결정 |
| 영향 범위 | 진입 UX, 명령 체계, 메인 세션 가이드, SDK 표면 (코어 모듈은 유지)                                                                                                                           |

---

## 1. 비전

> **사용자의 일상 코딩 옆에 항상 대기하는 자율 AI 팀.**
> 사용자는 자연어 한 줄로 의도만 던지고, 팀이 의도 분류 → 작업 분해 → 실행 → 검증 → 보고를 스스로 처리한다. 사람은 위험 결정과 최종 승인에만 개입한다.

기존 v1의 "초보자가 프로젝트 1개를 만드는 1회성 도구"에서 **시니어 개발자/팀 리드의 일상 운영 도구**로 격상한다.

## 2. 배경: v1의 한계

| 영역       | v1 한계                                                 | v2 목표                                                 |
| ---------- | ------------------------------------------------------- | ------------------------------------------------------- |
| 진입점     | 7개 슬래시 커맨드 학습 강제                             | 자연어 1줄, 워크플로우는 AI가 결정                      |
| 사용 단위  | "프로젝트" 라이프사이클 강제                            | "작업/세션"이 1차 단위, 프로젝트는 컨테이너             |
| 워크플로우 | hello → new → discuss → approve → execute → report 정형 | 작업 유형별 동적 그래프 (state-machine-DSL로 매번 조립) |
| 컨텍스트   | 빈 폴더 신규 생성 전제                                  | 기존 코드베이스 위에서 즉시 작동                        |
| CEO 개입   | 매 Phase 승인 강제 (기본값)                             | 위험/비용 임계 초과 시만 자동 호출                      |
| 일상 작업  | 코드 리뷰/리팩토링/디버깅/리서치 위임 어려움            | 5+ 작업 유형을 1개 진입점에서 처리                      |

## 3. 핵심 원칙

### 3.1 AI-Native

사용자는 절차를 외우지 않는다. AI가 의도/맥락/위험을 분석해서 흐름을 결정한다.

- 단일 자연어 진입 (`/gv "..."` 또는 평문)
- 정형 워크플로우는 **프리셋**으로 격하, 기본은 **동적 그래프**
- 메인 세션은 라이브 패널 + CEO 입력만 담당 (Thin Controller 강화)

### 3.2 Agentic Team

15개 역할이 자율적으로 협업한다. 오케스트레이터는 라우터일 뿐 통제자가 아니다.

- 팀이 스스로 작업 분배, 상호 질의 (message-bus), 크로스 리뷰
- 자체 검증 (build/test) 후 결과 반환
- 위험 신호(보안/비용/회귀) 감지 시 CEO 자동 호출

### 3.3 범용성 (특정 시나리오 X)

"코드 리뷰만 잘하는 도구"가 아니라 **모든 일상 코딩 작업**에 동일 인터페이스로 대응.

**지원 작업 유형 (5개 — CEO 확정)**:

- `code` — **코드 작성/수정/리팩토링/디버깅 통합**. AI가 세부 의도를 자동 분류 (신규 기능/기존 수정/원인 분석)
- `plan` — 기획 (대형 프로젝트, 기존 plan-only 흐름 흡수)
- `research` — 기술/시장 리서치, 의사결정 지원
- `review` — PR/diff/파일 리뷰
- `ask` — 자유 질의 (코드베이스 기반 Q&A)

> **설계 결정**: 사용자가 "코드 작성"으로 묶어달라고 한 의도 반영. v1의 feature/refactor/debug 3개를 `code` 1개로 통합하고, AI가 입력에서 의도(추가 vs 수정 vs 디버깅)를 자동 추론한다. 사용자가 외울 카테고리 수를 4-5개로 제한하는 게 AI-Native 원칙에 부합.

### 3.4 영속 컨텍스트

프로젝트/팀/학습/비용이 세션을 넘어 누적된다.

- 프로젝트별 메모리 (코드베이스 스캔 캐시 + 의사결정 로그)
- 팀별 학습 (agent-overrides 자동 진화)
- 크로스프로젝트 패턴 (반복 이슈 자동 추출)
- 비용 누적 (월별/프로젝트별 대시보드)

### 3.5 관측성 우선

팀이 무엇을 하는지 항상 보이고, 언제든 중단할 수 있다.

- journal jsonl 라이브 스트림
- 토큰/비용/모델 분포 실시간
- 위험 신호 즉시 알림
- 중단 → 재개 (file-lock + journal 기반, 이미 구현됨)

## 4. 사용자 시나리오

### S1. 일상 PR 리뷰 (가장 자주 사용)

```
사용자: /gv 이 PR 리뷰해줘 https://github.com/.../pull/123
  ▼
Intent Router: review 작업 식별 → diff 가져오기 → 도메인 분석
  ▼
팀 자동 구성: CTO + Security + 도메인 전문가 (Backend or Frontend)
  ▼
병렬 리뷰 → 종합 → 위험도/머지 권고 표시
  ▼
사용자: GitHub에서 직접 머지 결정
```

**소요 시간**: 1-3분 / **CEO 개입**: 0회 (위험 없을 시)

### S2. 리팩토링 의뢰 (code 작업의 변형)

```
사용자: /gv auth 모듈 너무 복잡해. 리팩토링해줘
  ▼
Intent Router: code 작업 (refactor 의도) → 코드베이스 스캔 → 영향 범위 분석
  ▼
팀 자동 구성: Backend + QA + Security
  ▼
side-impact 분석 → 계획 제시 → CEO 확인 (위험 임계 초과)
  ▼
승인 시 실행 → 테스트 → PR 자동 생성
```

**소요 시간**: 5-15분 / **CEO 개입**: 1회 (계획 승인)

### S3. 디버깅 (code 작업의 변형)

```
사용자: /gv 이 테스트가 왜 깨지지 + 에러 로그 첨부
  ▼
Intent Router: code 작업 (debug 의도) → 로그 분석 → 관련 코드 식별
  ▼
팀 자동 구성: Backend + QA (debug 모드는 소규모)
  ▼
원인 분석 → 수정 제안 → 사용자 확인 후 패치 적용
```

**소요 시간**: 30초-3분 / **CEO 개입**: 1회 (수정 적용)

### S4. 기술 리서치 (의사결정 지원)

```
사용자: /gv BullMQ vs Temporal, 우리 워크로드에 뭐가 맞을까
  ▼
Intent Router: research 작업 → 코드베이스 워크로드 추정
  ▼
팀 자동 구성: Tech Researcher + Backend + DevOps
  ▼
병렬 조사 → 비교 매트릭스 → 권고안 + 트레이드오프
```

**소요 시간**: 3-10분 / **CEO 개입**: 0회

### S5. 신규 기능 추가 (대형 code 작업)

```
사용자: /gv 결제 시스템 추가해줘. Stripe 사용
  ▼
Intent Router: code 작업 + 복잡도 분석 → 자동으로 plan-execute 그래프 적용
  ▼
기존 v1 흐름 (discuss → approve → execute) 동적 그래프로 흡수 — CEO 개입 임계만 다름
```

**소요 시간**: 30분-수시간 / **CEO 개입**: 2-5회

### S6. 자유 질의

```
사용자: /gv 이 코드베이스에서 인증은 어떻게 동작해?
  ▼
Intent Router: ask 작업 → 코드베이스 RAG → 단일 에이전트 답변
```

**소요 시간**: 30초 / **CEO 개입**: 0회

### S7. 프로젝트 기획 (대형 plan 작업)

```
사용자: /gv 마이크로서비스 SaaS 플랫폼 만들고 싶어
  ▼
Intent Router: plan 작업 (대형) → 기존 plan-only 흐름을 동적 그래프로 흡수
```

## 5. 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│  진입 레이어 (UX)                                       │
│  /gv "<자연어>"  또는 평문 입력                         │
└────────────────────┬────────────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Intent Router  (자율 라우팅)                           │
│  - intent-gate + nl-router 확장                          │
│  - 컨텍스트 스캔 (codebase-scanner)                      │
│  - 복잡도/위험/비용 추정 (complexity-analyzer)           │
│  - 작업 그래프 동적 조립 (state-machine-dsl)             │
│  - 팀 자동 구성 (team-builder + 작업 유형 매핑)          │
└────────────────────┬────────────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────────────┐
│  Agentic Team (자율 협업)                               │
│  - orchestrator (이미 구현)                              │
│  - message-bus (에이전트 간 비동기 통신)                 │
│  - expert-consultation ([CONSULT:role] 패턴)             │
│  - review-conversation (질문→답변→최종 리뷰)             │
│  - cross-model-strategy (다른 모델로 리뷰)               │
└────────────────────┬────────────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────────────┐
│  자체 검증 + 안전망                                     │
│  - execution-verifier (Node/Python/Go/Java 빌드)         │
│  - quality-evaluator (7영역 SLA — 일부 재사용)            │
│  - acceptance-criteria (수락 기준 자동 검증)             │
│  - 위험 트리거 → CEO escalation                          │
└────────────────────┬────────────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────────────┐
│  관측 + 영속 컨텍스트                                   │
│  - journal jsonl (라이브 스트림)                         │
│  - cost-tracker (실시간 비용)                            │
│  - llm-pool (동시성 + backpressure)                      │
│  - project memory (코드베이스 + 의사결정)                │
│  - agent-feedback (자동 학습)                            │
└─────────────────────────────────────────────────────────┘
```

**격상 작업의 본질**: 새로 만들 모듈 ≤ 5개. 나머지는 **재배선과 진입점 재설계**.

## 6. 진입점 재설계

### 6.1 새 명령 체계 (CEO 확정)

| 우선순위 | 명령           | 역할                                                 | 비고                     |
| -------- | -------------- | ---------------------------------------------------- | ------------------------ |
| **P0**   | `/gv <자연어>` | **단일 진입점**, 의도 자동 라우팅 (옵션 플래그 없음) | 신규                     |
| **P1**   | `/gv:status`   | 진행 중 작업 + 프로젝트 상태                         | 기존 status 확장         |
| **P1**   | `/gv:cost`     | 비용 대시보드 + 예산 임계 설정 (opt-in)              | 신규 (cost-tracker 노출) |
| **P1**   | `/gv:team`     | 팀 구성 보기/편집                                    | 기존 my-team 확장        |
| **P2**   | `/gv:resume`   | 중단된 작업 재개                                     | 기존 execute resume 분리 |

**확정 사항**:

- 진입은 자연어만 받는다. `/gv "..." --pr 123` 같은 옵션 플래그 없음. URL/경로는 자연어 안에서 자유 형식으로 추출.
- `good-vibe:*` 네임스페이스 → `gv:*` 단축.
- **v1 명령 호환 레이어 없음**. 기존 `good-vibe:*` 슬래시는 v2 릴리즈와 함께 제거. 사용자는 `/gv` 자연어로 마이그레이션.
- v1 데이터(project.json 등)는 v2에서 그대로 읽기 가능 (포맷 호환은 유지).

### 6.2 메인 세션 Thin Controller 강화

**v1**: 메인 세션이 일부 분기 판단 (모드 선택 등)
**v2**: 메인 세션은 **CEO 입력 표시 + Task tool 결과 표시**만. 의도 분류조차 Task로 위임.

```
사용자 입력
  ▼
[메인 세션] AskUserQuestion (필요 시)
  ▼
[Task tool] Intent Router 서브에이전트
  ▼
[Task tool] Agentic Team 실행
  ▼
[메인 세션] 결과 표시 + 다음 CEO 액션 제안
```

## 7. 기존 자산 매핑

| v2 기능            | 활용 v1 모듈                                                              | 신규/확장 작업                 |
| ------------------ | ------------------------------------------------------------------------- | ------------------------------ |
| 단일 진입 라우팅   | `intent-gate.js`, `nl-router.js`                                          | **확장**: 작업 유형 분류 추가  |
| 컨텍스트 자동 스캔 | `codebase-scanner.js`                                                     | 그대로 활용                    |
| 동적 워크플로우    | `state-machine-dsl.js`                                                    | **확장**: 작업별 그래프 프리셋 |
| 팀 자동 구성       | `team-builder.js`, `complexity-analyzer.js`                               | **확장**: 작업 유형 → 팀 매핑  |
| 자율 협업          | `orchestrator.js`, `message-bus.js`, `expert-consultation.js`             | 그대로 활용                    |
| 자체 검증          | `execution-verifier.js`, `quality-evaluator.js`, `acceptance-criteria.js` | 그대로 활용                    |
| 관측성             | `journal.js`, `cost-tracker.js`, `progress-formatter.js`                  | **신규**: 라이브 대시보드 UI   |
| 영속 학습          | `agent-feedback.js`, agent-overrides                                      | 그대로 활용                    |
| 비용/폴백          | `llm-pool.js`, `cost-tracker.js`, `llm-fallback.js`                       | 그대로 활용                    |

**신규 모듈 (예상 4개 — legacy 제거로 1개 감소)**:

1. `task-router.js` — 자연어 → 작업 유형(5개) + 동적 그래프 결정
2. `task-graph-presets.js` — 5가지 작업 유형별 그래프 정의
3. `risk-evaluator.js` — 위험/예산 임계(opt-in) 판정 → CEO 호출 트리거
4. `claude-panel-renderer.js` — journal/cost를 **구조화된 stdout markdown**으로 라이브 렌더링 (Phase A-0a 결과 패널 API 미지원 확정, [Spike A-0a 노트](spikes/a-0a-claude-panel-api.md) 참조. statusline 보조 통합은 옵션)

## 8. 비기능 요구사항

### 8.1 성능

- 단순 작업(`ask`, `review`) **응답 시작 ≤ 5초**, 완료 ≤ 3분
- 중간 작업(`refactor`, `debug`) 완료 ≤ 15분
- 대형 작업(`feature`, `plan`) 진행률 표시 필수, 30초마다 업데이트
- **예외 조건**: `llm-pool` 429 backpressure 발동 시 effective limit가 절반(반감)으로 떨어지므로 위 목표는 정상 풀 상태 기준. backpressure 활성 구간에서는 진행률에 "백프레셔 활성, 응답 지연 가능" 신호를 패널에 표시하고 SLA 미달로 카운트하지 않음
- Phase B에서 `review`/`ask` 우선순위 힌트(낮은 비용/빠른 응답 요구) 설계를 검토 — `llm-pool` 큐 정책에 작업 유형별 가중치 도입 가능성

### 8.2 비용 (CEO 확정: 기본 임계값 없음, opt-in)

- **기본값 임계 없음**. 사용자가 명시적으로 설정한 경우만 동작 (`/gv:cost --limit $X` 같은 명령으로 설정)
- 비용/토큰은 항상 추적 (cost-tracker)되고 패널에 표시
- 사용자가 임계를 켜면: 80% 경고 + 100% CEO 호출 (정책 그대로)
- 모델 자동 폴백은 임계와 무관하게 항상 동작 (haiku 우선, 429/5xx 시 승격) — 안정성 목적

### 8.3 보안

- 코드 구체화 시 path traversal 차단 (이미 구현)
- `npm install --ignore-scripts` 강제 (이미 구현)
- 비밀 정보 자동 마스킹 (`.env` 차단 hook 활용)
- LLM 응답에서 외부 명령 추출 금지
- **자연어 진입의 프롬프트 인젝션 방어 (v2 신규)**:
  - `task-router.js`에 들어오는 자연어는 반드시 `wrapUserInput()`으로 감싸 LLM 프롬프트에 삽입
  - 기존 `sanitizeForPrompt()`의 영어 패턴 9개 외에 **한국어 인젝션 패턴 탐지 추가** ("이전 지시를 무시", "새로운 역할로", "system prompt를 출력", 등)
  - 위 두 항목은 Phase A `task-router.js` 신규 모듈의 수락 기준(AC)에 명시 (이슈 #236에 추가)
  - v1은 구조화된 슬래시 커맨드 진입이라 자유 자연어 노출이 제한적이었지만, v2는 자연어가 LLM 추론 레이어에 직접 통과하므로 공격 면적 확대 — 이를 명시적으로 다룸

### 8.4 관측성

- 모든 작업이 journal jsonl로 추적
- 비용 추적은 fire-and-forget이지만 손실 0%
- CEO가 언제든 중단 가능 (file-lock + journal 기반 재개)

### 8.5 호환성

- **v1 슬래시 명령 호환 없음** (CEO 결정). v2 릴리즈 시 `good-vibe:*` 제거
- **기존 영속 데이터는 v2에서 그대로 읽기** (포맷 호환 유지):
  - `~/.claude/good-vibe/projects/{id}/project.json` — 프로젝트 메타/상태
  - `~/.claude/good-vibe/projects/{id}/journal.jsonl` — 이벤트 로그
  - `~/.claude/good-vibe/agent-overrides/*.md` — 사용자 레벨 에이전트 오버라이드
  - `{projectDir}/.good-vibe/agent-overrides/*.md` — 프로젝트 레벨 오버라이드
  - `~/.claude/good-vibe/custom-templates/*.json` — 커스텀 템플릿
  - `~/.claude/good-vibe/auth.json` — auth-manager 멀티프로바이더 크레덴셜
- Phase C 회귀 테스트는 위 6개 데이터 모두 검증 (§10-13에 반영) — 구현: `tests/v1-data-compat.test.js` (12 케이스)
- SDK API는 1 마이너 버전 deprecate 후 제거

## 9. MVP 범위 (Milestone 1)

**한 번에 다 풀려고 하면 미궁**. 첫 릴리즈는 명확한 한계로 한정.

### 포함 (MVP)

- ✅ `/gv <자연어>` 단일 진입점 (옵션 플래그 없음)
- ✅ **작업 유형 5개 모두**: `code` / `plan` / `research` / `review` / `ask`
  - 단, `code`/`plan`은 v1 흐름(execute / discuss-approve-execute)을 동적 그래프로 흡수만 하고 추가 최적화는 다음 마일스톤
  - `research`/`review`/`ask`는 v2에서 처음 정식 도입 — 우선 정상 동작 확보
- ✅ Intent Router (5개 작업 유형 분류 + 컨텍스트 스캔 + 팀 자동 구성)
- ✅ 동적 그래프 조립 (5개 작업 유형 프리셋)
- ✅ Claude Code 패널 라이브 렌더링 (진행률 + 비용 + 위험 신호)
- ✅ 비용 임계 opt-in 설정 (`/gv:cost`)

### 제외 (다음 마일스톤)

- ❌ `code`/`plan` 작업의 추가 최적화 (현재는 v1 흐름 흡수만)
- ❌ 크로스프로젝트 메모리 통합 인덱스
- ❌ MCP 서버 자동 통합
- ❌ 외부 웹 대시보드 (Claude Code 패널만)

### 성공 판정

- MVP 사용자가 **5개 작업 유형을 모두 `/gv` 자연어로 시작 가능**
- v1 슬래시 명령은 v2 릴리즈와 동시에 제거되므로 "혼용 사용량" 지표는 N/A
- 작업당 평균 CEO 개입 횟수 v1 대비 70% 감소
- 단순 작업(`ask`/`review`) 평균 응답 시간 ≤ 3분

## 10. 마이그레이션 전략 (v1 호환 제거로 단순화 — 약 6주)

### Phase A — 기반 정비 (2주)

**스파이크 + 측정 (이슈 외 작업)**:

- **A-0 v1 baseline 측정** — 기존 프로젝트들의 journal.jsonl 샘플에서 평균 CEO 개입 횟수, 작업 완료 시간, 토큰 사용량 추출. 결과를 §11 KPI 표의 "베이스라인" 컬럼에 채워 비교 기준 확보
- **A-0a Claude Code 패널 API 검증 스파이크** — Extension API에서 라이브 패널 렌더링 진입점 존재 여부 확인. 미지원 시 §7-4 모듈을 구조화 stdout 기반으로 재설계 (Claude Code가 markdown 자동 렌더링하므로 실용적 fallback 가능)
- **A-0b task-router 테스트 픽스처 작성** — 5개 작업 유형 × 20개 예시 입력(한국어/영어 혼합) = 최소 **100개 정답 레이블 픽스처**. Phase A 완료 게이트의 90%+ 정확도 측정 기준이 됨

**신규 모듈 구현 (이슈 #236-#239)**:

1. `task-router.js` 신규 (자연어 → 5개 작업 유형 분류)
2. `task-graph-presets.js` 신규 (5개 그래프 정의)
3. `risk-evaluator.js` 신규 (예산 임계 opt-in 처리)
4. `nl-router.js` 확장 (의도 분류 통합)
5. v1 명령은 그대로 유지 (Phase A 동안은 변경 없음)

**Phase A → B 진입 게이트 (모두 충족 시 Phase B 시작)**:

- task-router 분류 정확도 **단위 테스트** ≥ 90% (A-0b 픽스처 100개 기준)
- task-router에 한국어 인젝션 방어 + `wrapUserInput()` 적용 확인
- A-0a 결과 → `claude-panel-renderer.js` 인터페이스 확정 (Phase B Step 8 전에)

### Phase B — 단일 진입 도입 (2주)

6. `/gv` 슬래시 커맨드 추가
7. 5개 작업 유형 동작 (Intent Router → 팀 구성 → 실행)
8. `claude-panel-renderer.js` 신규 (A-0a에서 확정된 인터페이스로 구현)
9. `/gv:status`, `/gv:cost`, `/gv:team`, `/gv:resume` 추가
10. 통합 테스트 + 자체 도그푸딩 가능성 검증

### Phase C — v1 제거 + 릴리즈 (2주)

**Phase C 진입 전 점검 (병렬 PR 가능)**:

- **C-pre1 내부 파이프라인 점검** — `grep -r "good-vibe:" internal/` 로 daily/ux improvement 스크립트가 v1 슬래시에 의존하는지 확인. 의존 발견 시 마이그레이션 PR 별도 진행
- **C-pre2 commands/skills/guides 교차 참조 점검** — `grep -r "good-vibe:" commands/ skills/ guides/` 로 약 170건의 v1 명령 참조를 `/gv` 자연어 예시로 일괄 대치. 누락 시 사용자에게 존재하지 않는 명령이 안내됨

**Phase C 본 작업**:

11. **v1 슬래시 명령 일괄 제거** (`good-vibe:*`)
12. CLAUDE.md/README.md/guides 새 흐름 중심으로 재작성
13. v1 영속 데이터 호환성 회귀 테스트 — §8.5의 6개 데이터(project.json, journal.jsonl, agent-overrides 사용자/프로젝트, custom-templates, auth credentials) 모두 v2에서 정상 읽힘 확인
14. 메이저 버전 릴리즈

**총 기간 예상**: 약 6주 (legacy 호환 제거로 4주 단축). 각 Phase는 master 머지 가능한 단위로 분할.

## 11. 성공 지표 (KPI)

> Phase A-0 결과 v1 journal 데이터 부재 (테스트 데이터만 존재). 자세한 내용은 [Spike A-0](spikes/a-0-baseline-measurement.md) 참조.
> v2 운영 첫 1주 데이터를 자체 baseline으로 사용 → 2주 시점에 KPI 목표 재설정.

| 지표                         | 베이스라인                       | 목표                                                 | 측정 방법                                 |
| ---------------------------- | -------------------------------- | ---------------------------------------------------- | ----------------------------------------- |
| 5개 작업 유형 모두 정상 동작 | N/A (신규)                       | 100%                                                 | 각 유형별 통합 테스트 통과                |
| 작업당 CEO 개입              | v2 운영 첫 1주 누적값            | 베이스라인 -70% (2주차 재설정)                       | journal escalation 카운트                 |
| 평균 작업 완료 시간          | v2 운영 첫 1주 누적값            | `review`/`ask` ≤ 3분, `code` ≤ 30분, `plan` ≤ 수시간 | journal 시작-종료 차이                    |
| 비용 효율                    | v2 운영 첫 1주 누적값            | 베이스라인 -30% (2주차 재설정)                       | cost-tracker 누적                         |
| 사용자 재방문                | v2 운영 첫 1주 누적값            | 베이스라인 +200% (2주차 재설정)                      | journal 이벤트 주간 카운트 (로컬 집계)    |
| Intent Router 정확도 (단위)  | task-router PR(#240) 100% 측정 ✓ | 90%+                                                 | A-0b 픽스처 100개 단위 테스트 통과율      |
| Intent Router 정확도 (운영)  | v2 운영 첫 1주 누적값            | 85%+                                                 | journal에서 사용자 재라우팅 비율 (역추출) |

## 12. 리스크 & 완화

| 리스크                                     | 영향                                                             | 완화                                                                                                                                    |
| ------------------------------------------ | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Intent Router 오분류                       | 작업이 엉뚱한 팀에 라우팅                                        | 분류 confidence 낮으면 CEO 확인 단계 추가                                                                                               |
| 위험 트리거 누락                           | 비용 폭발 / 보안 사고                                            | 다층 안전망: 비용 임계 + acceptance-criteria + 자체 검증                                                                                |
| v1 사용자 이탈                             | v1 명령 즉시 제거(CEO 결정)로 학습자 혼란 가능                   | CHANGELOG와 README 첫 줄에 마이그레이션 안내, `/gv` 자연어가 자동 라우팅하므로 학습 곡선 낮음                                           |
| 동적 그래프 무한 루프                      | 자율성 ↑ → 종료 조건 모호                                        | 작업당 최대 단계 수 + 비용 한도 + journal 기반 watchdog                                                                                 |
| 자체 도그푸딩 실패                         | 사용자에게 노출 전 자신감 부족                                   | Phase B 끝에 가능성 검증, 시점은 §13-5 보류                                                                                             |
| Claude Code 패널 API 미지원                | `claude-panel-renderer.js` 구현 불가 → Phase B 차단              | Phase A-0a 스파이크에서 검증. 미지원 시 구조화된 stdout(markdown 헤더 + 표)으로 fallback — Claude Code가 자동 렌더링하므로 UX 손실 최소 |
| 내부 파이프라인 (`internal/`) v1 명령 의존 | Phase C에서 v1 슬래시 제거 시 daily/ux improvement 스크립트 깨짐 | Phase C 진입 전 `grep -r "good-vibe:" internal/` 점검 + 마이그레이션 체크리스트                                                         |

## 13. 오픈 이슈 — CEO 결정 사항 정리

| #   | 이슈                  | 결정                                                                                                                 |
| --- | --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | 슬래시 이름           | ✅ **`/gv`** (짧음 우선)                                                                                             |
| 2   | 자연어 vs 옵션 플래그 | ✅ **자연어만** (옵션 플래그 없음)                                                                                   |
| 3   | MVP 작업 유형         | ✅ **5개 모두** — `code` / `plan` / `research` / `review` / `ask`. v1의 feature/refactor/debug는 `code`로 통합       |
| 4   | legacy 호환 기간      | ✅ **호환 없음** — v2 릴리즈 시 v1 슬래시 일괄 제거. 데이터 호환만 유지                                              |
| 5   | 자체 도그푸딩 시점    | ⚠️ **보류** — Phase B 끝에 가능성 검증 후 결정                                                                       |
| 6   | 라이브 대시보드 형태  | ✅ **stdout markdown** (A-0a 스파이크 결과 패널 API 미지원 확정 — 결정 시점에는 패널 옵션을 채택했으나 검증 후 변경) |
| 7   | 비용 임계 기본값      | ✅ **기본 없음**, opt-in (`/gv:cost --limit`로 사용자가 설정 시 동작)                                                |

**남은 결정 (Phase B 진입 시점에 다시 확인)**:

- §13-5: 자체 도그푸딩을 Phase B 끝에 시작할지, Phase C로 미룰지

---

## 14. 다음 단계

### Phase A 완료 (2026-04-26)

- ✅ PRD v2.4 확정
- ✅ 4개 신규 모듈 모두 머지: `task-router` (#236), `task-graph-presets` (#237), `risk-evaluator` (#238), `nl-router 확장` (#239)
- ✅ A-0b 픽스처 100개 + task-router 100% 분류 정확도
- ✅ A-0a 패널 API 검증 → stdout fallback 확정 ([노트](spikes/a-0a-claude-panel-api.md))
- ✅ A-0 v1 baseline 측정 시도 → 데이터 부재로 v2 운영 자체 baseline 정책으로 변경 ([노트](spikes/a-0-baseline-measurement.md))

### Phase B 진입 게이트 (모두 통과)

- ✅ task-router 분류 정확도 단위 테스트 ≥ 90% (실측 100%)
- ✅ task-router 한국어 인젝션 방어 + `wrapUserInput()` 적용
- ✅ A-0a 결과 → `claude-panel-renderer.js` 인터페이스 확정 (stdout markdown)

### Phase B 완료 (2026-04-26)

- ✅ B-1: `claude-panel-renderer` (헤더 깊이/이벤트 제한/위험 신호 — #246)
- ✅ B-2: `/gv` + dispatch 핸들러 — 단일 진입점 (#248)
- ✅ B-3: `/gv:status, /gv:cost, /gv:team, /gv:resume` 보조 슬래시 4종 (#250)
- ✅ B-4a: `task-graph-runner` 골격 + placeholder action (#252)
- ✅ B-4b: `ask/review/research` 실제 LLM 통합 (#254)
- ✅ B-4c: `code` happy path 5개 state LLM 통합 (#256)
- ✅ B-4d: `plan` LLM + code 서브그래프 위임 (#258)
- ✅ B-4c-2: code fix-loop + escalating LLM 통합 (#260)
- ✅ B-5 도그푸딩 검증 — A 옵션 (mock + 단위 테스트로 충분, 실제 LLM은 v2 릴리즈 후): [노트](spikes/b-5-self-dogfooding.md)

### Phase C 진입 게이트 (모두 통과)

- ✅ `/gv` 단일 진입점 동작
- ✅ 5개 작업 유형 LLM 통합 (placeholder도 fallback으로 유지)
- ✅ 라이브 패널 + opt-in 예산
- ✅ internal/ 파이프라인 점검 완료 (`good-vibe:` 의존 0건)
- ✅ 전체 회귀 통과 (2910+ tests)

### Phase C 작업 (다음)

**진입 전 점검 (병렬 PR 가능)**:

- ✅ C-pre1 internal/ 점검 — 의존 없음 확인
- ✅ C-pre2 commands/skills/guides 교차 참조 정리 (2026-04-27 완료) — 6 PR 시리즈로 진행
  - PR 1/6 (#264): commands/quickstart v2 흐름 재작성
  - PR 2/6 (#265): commands 카탈로그 v2 재작성
  - PR 3/6 (#266): agents/execution-modes/ceo-guide v2 흐름 반영
  - PR 4/6 (#267): hooks/integrations/examples v2 흐름 반영
  - PR 5/6 (#268): troubleshooting/sdk-usage v2 흐름 반영
  - PR 6/6 (#269): README/CHANGELOG final sweep — v1 슬래시 잔재 0건 달성

**Phase C 본 작업**:

11. ✅ **v1 슬래시 명령 일괄 제거** (`good-vibe:*`) — `#3216fba`에서 선행 완료
12. ✅ CLAUDE.md/README.md/guides 새 흐름 중심으로 재작성 — `da3e32d` (CLAUDE.md 슬림화) + C-pre2 6 PR이 흡수
13. ✅ v1 영속 데이터 호환성 회귀 테스트 — §8.5의 6개 데이터 모두 v2에서 정상 읽힘 확인 (`tests/v1-data-compat.test.js`, 12 케이스, PR #271)
14. 🚧 메이저 버전 릴리즈 — **2.0.0-rc.1** RC 단계로 진입. CEO 도그푸딩 후 정식 v2.0.0 승급 결정

**B-4 후속 (별도 마이너 버전)**:

- code-materializer/execution-verifier 통합 (실제 파일 쓰기 + 빌드 검증)
- 다중 라운드 토론 (plan)
- 실제 CEO 입력 통합 (escalating)
