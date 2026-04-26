# 퀵스타트

Good Vibe Coding은 AI 팀원들과 함께 일하는 도구입니다.
당신이 CEO 역할을 맡고, AI 팀이 의도 분류 → 작업 분해 → 실행 → 검증 → 보고를 자율적으로 처리합니다.

**이 가이드를 마치면 이런 결과를 얻습니다:**

- 자연어 한 줄로 작업을 던지면 AI가 알아서 흐름을 결정합니다
- 5가지 작업 유형(코드/기획/리서치/리뷰/질의) 모두 같은 진입점에서 처리됩니다
- 위험·비용 임계 초과 시에만 CEO에게 확인이 옵니다
- 라이브 패널로 진행 상황을 실시간 확인할 수 있습니다

> 어디서부터 볼까요?
>
> - 지금 바로 시작하려면 아래 "한 줄 진입"을 따라가세요
> - 자세한 명령 흐름은 [커맨드 레퍼런스](03-commands-reference.md)
> - 팀원 역할이 궁금하면 [에이전트 가이드](04-agents.md)
> - 자동화 설정이 궁금하면 [훅과 자동화](05-hooks-and-automation.md)
> - 코드에서 SDK로 쓰려면 [SDK 사용 가이드](09-sdk-usage.md) (설치만으로 체험 가능, LLM 호출 시 프로바이더 연결 필요)
> - 모드가 헷갈리면 [실행 모드 가이드](10-execution-modes.md)

---

## 한 줄 진입 (가장 빠른 경로)

자연어 한 줄을 `/gv`에 던지면 AI가 의도를 분류하고 다음 액션을 안내합니다.

```
/gv 결제 시스템 구현해줘
/gv 이 PR 리뷰해줘 https://github.com/foo/bar/pull/123
/gv BullMQ vs Temporal 비교해줘
/gv 이 코드베이스에서 인증은 어떻게 동작해?
/gv 마이크로서비스 SaaS 플랫폼 만들고 싶어
```

`/gv`가 입력을 분석해서 5개 작업 유형 중 하나로 분류합니다:

| 작업 유형  | 자동 트리거 예시                          | 일반 소요     |
| ---------- | ----------------------------------------- | ------------- |
| `code`     | 구현·수정·리팩토링·디버깅 ("...만들어줘") | 5-30분        |
| `plan`     | 대규모 기획 ("...플랫폼 만들고 싶어")     | 30분 - 수시간 |
| `research` | 비교·조사 ("X vs Y 비교")                 | 3-10분        |
| `review`   | PR/diff 리뷰                              | 1-3분         |
| `ask`      | 자유 질의 ("...어떻게 동작해?")           | 즉시-3분      |

분류가 모호하면 `/gv`가 confidence와 경고를 함께 표시하고 CEO에게 확정을 요청합니다.

---

## 동작 흐름 (모든 작업 공통)

```
/gv "..." (자연어)
   ▼
의도 분류 → 5개 작업 유형 중 하나
   ▼
팀 자동 구성 (3-8명, 작업 유형/도메인 매칭)
   ▼
동적 그래프 실행 (작업 유형별 워크플로우)
   ├─ code: 분석 → 구현 → 빌드 검증 → 리뷰 → fix-loop
   ├─ plan: 다층 토론 → 수렴 → 작업 분배
   ├─ research/review/ask: 조사·종합 → 종합 보고
   ▼
라이브 패널로 진행 표시
   ▼
위험/비용 임계 초과 시에만 CEO 호출
   ▼
완료 → 보고서 + 다음 액션 안내
```

CEO가 외울 절차는 없습니다. AI 팀이 흐름을 결정합니다.

---

## 보조 슬래시 (5개)

`/gv` 자연어로 다 되지만, 자주 쓰는 동작은 짧은 슬래시도 있습니다.

| 슬래시        | 하는 일                                  | 언제 쓰면 좋은가                |
| ------------- | ---------------------------------------- | ------------------------------- |
| `/gv:status`  | 활성 프로젝트 상태 + 다음 권장 액션      | 진행 상황 빠르게 확인           |
| `/gv:execute` | task-graph 실행 (interactive/auto/semi)  | 분류 결과를 받아 실제 실행 시작 |
| `/gv:resume`  | 중단된 실행 재개 (file-lock + journal)   | Phase 중간에 끊겼을 때          |
| `/gv:team`    | 활성 프로젝트 팀 구성 + 모델 분포        | 누가 일하고 있는지 확인         |
| `/gv:cost`    | 토큰/비용 집계 + 예산 임계 설정 (opt-in) | 비용 가시화/한도 설정           |

**원칙**: 모든 입력은 `/gv`로 통합. 보조 슬래시는 자주 쓰는 기능에 대한 단축어일 뿐.

---

## 4가지 시나리오

### S1. PR 리뷰 (가장 자주 사용)

```
> /gv 이 PR 리뷰해줘 https://github.com/foo/bar/pull/123

🔍 task=review · confidence=0.94
👥 팀 구성: CTO + Security + Backend
⚡ 병렬 리뷰 진행 중...
✅ 완료 — critical 0, important 2, minor 5
   → 머지 권고: 안전 (important 이슈 머지 후 후속 처리 가능)
```

소요 1-3분 · CEO 개입 0회 (위험 없을 때)

### S2. 코드 작업 (구현·수정·디버깅 통합)

```
> /gv 결제 시스템 구현해줘

🔍 task=code · confidence=0.88
👥 팀 구성: CTO + Backend + Security + QA
⚡ 분석 → 설계 → 구현 → 빌드 검증 → 리뷰 (자동 진행)
   Phase 1/3: 데이터 모델 ✓
   Phase 2/3: API 구현 ✓ (fix 1회)
   Phase 3/3: 테스트 ✓
✅ 완료 — 생성 파일 7개, 리뷰 통과
```

소요 5-30분 · CEO 개입은 fix 2회 실패 시 에스컬레이션만

### S3. 리서치 (의사결정 지원)

```
> /gv BullMQ vs Temporal 비교해줘 — Node 환경 작업 큐 선택 중

🔍 task=research · confidence=0.91
👥 팀 구성: Tech Researcher + Backend
⚡ 후보 조사 → 기준 비교 → 권고 종합
✅ 완료 — 권고: BullMQ (이유: ...)
```

### S4. 대규모 기획 (plan)

```
> /gv 마이크로서비스 SaaS 플랫폼 만들고 싶어

🔍 task=plan · confidence=0.86
👥 팀 구성: CTO + PO + 4개 도메인 리서처 + Security
💬 토론 라운드 1/3 — 병렬 분석
✅ 라운드 2 수렴 (승인율 85%)
📋 기획서 + 작업 분배 완료
   → 다음 액션: /gv:execute (실행 시작) 또는 /gv "기획 수정 ..."
```

대규모 기획은 CEO 승인을 거친 뒤 `/gv:execute`로 진행됩니다.

---

## 프로젝트 상태 전이

```
planning → approved → executing → reviewing → completed
        ↗                                ↗        │
 (재토론)                          (fix 후 재실행)  │
                                                  ↓
                                            (수정 요청)
                                  approved → executing → completed
```

| 상태        | 다음 액션 (`/gv` 자연어 또는 보조 슬래시)               |
| ----------- | ------------------------------------------------------- |
| `planning`  | `/gv 추가 토론 ...` / `/gv 기획 승인`                   |
| `approved`  | `/gv:execute`                                           |
| `executing` | `/gv:status` 확인 / `/gv:resume`                        |
| `reviewing` | `/gv:status` 확인 / `/gv:resume`                        |
| `completed` | `/gv 보고서 확인` / `/gv 피드백 분석` / `/gv 수정 요청` |

---

## 실행 모드 (3가지)

`/gv:execute` 시작 시 선택합니다. (SDK는 `auto` 고정)

| 모드          | 동작                              | 중단 시점                           |
| ------------- | --------------------------------- | ----------------------------------- |
| `interactive` | Phase마다 CEO 확인                | 매 Phase 완료 후 + 에스컬레이션     |
| `semi-auto`   | batchSize Phase마다 확인 (기본 3) | 배치 완료 후 + 에스컬레이션         |
| `auto`        | 자동 진행                         | fix 2회 실패 등 에스컬레이션만 멈춤 |

처음이라면 `interactive`를 추천합니다.

---

## 환경 준비 (선택)

`/gv`는 즉시 사용 가능합니다. 다음 도구가 있으면 더 풍부한 기능이 활성화됩니다:

- **Node.js 18+** (필수)
- **git** (필수)
- **GitHub CLI (`gh`)** — opt-in 시 자동 PR/브랜치 (`config.github.enabled = true`)
- **Gemini CLI / Codex CLI** — 멀티-모델 교차 리뷰

설정·도구 점검은 `/gv:status` + 일반 Claude Code의 `/doctor`로 갈음됩니다.

---

## 다음 단계

- 전체 슬래시·동작 → [커맨드 레퍼런스](03-commands-reference.md)
- 15개 역할 카탈로그 → [에이전트 가이드](04-agents.md)
- 실행 모드 깊게 → [실행 모드 가이드](10-execution-modes.md)
- CEO 입장에서의 운영 팁 → [CEO 가이드](11-ceo-guide.md)

---

## 업데이트

새 기능이나 버그 수정이 있으면 업데이트하세요:

```bash
# 소스 설치 사용자
cd good-vibe-coding && git pull && npm install

# 플러그인 사용자
claude plugin update sumsun-dev/good-vibe-coding
```
