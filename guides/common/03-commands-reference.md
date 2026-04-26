# 커맨드 레퍼런스

Good Vibe Coding v2의 슬래시 커맨드는 **단일 진입점 1개 + 보조 슬래시 5개**로 정리되어 있습니다.
처음에는 `/gv` 하나만 알면 충분합니다.

---

## v2 슬래시 (6개)

| 슬래시        | 하는 일                                    | 일반 소요 | 입력 / 결과                                       |
| ------------- | ------------------------------------------ | --------- | ------------------------------------------------- |
| `/gv "..."`   | 자연어 단일 진입점 (의도 분류 + 다음 액션) | 즉시      | 자연어 한 줄 → category + taskRoute + nextActions |
| `/gv:status`  | 활성 프로젝트 상태 + 다음 권장 액션        | 즉시      | (없음) → 프로젝트 목록 + 상태별 액션              |
| `/gv:execute` | task-graph 실행 시작                       | 가변      | 분류 결과 → 5개 작업 유형 동적 그래프 진행        |
| `/gv:resume`  | 중단된 실행 재개 (file-lock + journal)     | 가변      | (없음) → 마지막 Phase부터 이어서 진행             |
| `/gv:team`    | 팀 구성 + 모델 분포                        | 즉시      | (없음) → 팀 멤버 + 모델별 비용 가시화             |
| `/gv:cost`    | 예산 임계 조회/설정 (opt-in)               | 즉시      | `--cost N` / `--tokens N` / `--clear` → 임계 갱신 |

```
/gv "..." (자연어 진입)
   ▼
의도 분류 (category)
   ├─ status   → /gv:status 안내
   ├─ resume   → /gv:resume 안내
   ├─ modify   → 자연어 재진입 또는 task로 downgrade
   └─ task     → taskRoute(code/plan/research/review/ask) → /gv:execute
```

> 모든 입력은 `/gv`로 통합. 보조 슬래시는 자주 쓰는 동작에 대한 단축어일 뿐입니다.

---

## 5개 작업 유형 (taskRoute)

`/gv`가 자연어 입력을 분류하는 5개 카테고리입니다.

| 작업 유형  | 자동 트리거 예시                          | 일반 소요     | 그래프 흐름                                |
| ---------- | ----------------------------------------- | ------------- | ------------------------------------------ |
| `code`     | 구현·수정·리팩토링·디버깅 ("...만들어줘") | 5-30분        | 분석 → 구현 → 빌드 검증 → 리뷰 → fix-loop  |
| `plan`     | 대규모 기획 ("...플랫폼 만들고 싶어")     | 30분 - 수시간 | 다층 토론 → 수렴 → 작업 분배 + code 위임   |
| `research` | 비교·조사 ("X vs Y 비교")                 | 3-10분        | 후보 조사 → 기준 비교 → 권고 종합          |
| `review`   | PR/diff 리뷰                              | 1-3분         | 도메인 매칭 → 병렬 리뷰 → 종합 + 머지 권고 |
| `ask`      | 자유 질의 ("...어떻게 동작해?")           | 즉시-3분      | 코드베이스 스캔 → 답변 + 출처              |

분류 confidence가 낮으면 `/gv`가 경고와 함께 CEO에게 확정을 요청합니다.

---

## 프로젝트 상태 흐름

```
planning → approved → executing → reviewing → completed
        ↗                                ↗        │
 (재토론)                          (fix 후 재실행)  │
                                                  ↓
                                            (수정 요청)
                                  approved → executing → completed
```

| 상태      | 사용 가능한 슬래시 / 자연어 진입                                  |
| --------- | ----------------------------------------------------------------- |
| planning  | `/gv "추가 토론 ..."` / `/gv "기획 승인"`                         |
| approved  | `/gv:execute`                                                     |
| executing | `/gv:status` (확인) / `/gv:resume` (재개)                         |
| reviewing | `/gv:status` (확인) / `/gv:resume` (재개)                         |
| completed | `/gv "보고서 확인"` / `/gv "피드백 분석"` / `/gv "수정 요청 ..."` |

> 현재 상태를 모르겠으면 `/gv:status`를 실행하세요.

---

## 프로젝트 모드 (3가지)

`/gv`가 자연어 입력의 복잡도를 분석해 자동 추천합니다.

| 모드         | 팀 규모 | 토론             | 적합한 프로젝트     |
| ------------ | ------- | ---------------- | ------------------- |
| quick-build  | 2-3명   | 생략             | 간단한 봇, 스크립트 |
| plan-execute | 3-5명   | 생략 (빠른 분석) | 웹앱, API 서버      |
| plan-only    | 5-8명   | 최대 3라운드     | 대규모 시스템       |

CEO는 추천을 그대로 받거나 자연어로 수정 요청 (예: `/gv "팀을 plan-only로 늘려줘"`).

---

## 실행 모드 (3가지)

`/gv:execute` 시작 시 선택합니다. SDK는 `auto` 고정.

| 모드          | 동작                              | 추천 상황       |
| ------------- | --------------------------------- | --------------- |
| `interactive` | Phase마다 CEO 확인                | 처음 사용할 때  |
| `semi-auto`   | batchSize Phase마다 확인 (기본 3) | Phase가 많을 때 |
| `auto`        | 자동 진행 (에스컬레이션만 멈춤)   | 익숙해진 후     |

> `project.mode` (워크플로우)과 `executionState.mode` (실행 인터랙션)는 다른 개념입니다. 자세한 설명은 [실행 모드 가이드](10-execution-modes.md).

---

## 실행 중 문제가 생기면?

`/gv:execute` 도중 품질 리뷰에서 critical 이슈가 발견되면 자동 fix-loop이 동작합니다.

| 순서 | 동작                                                                      |
| ---- | ------------------------------------------------------------------------- |
| 1    | 문제를 카테고리별로 분류 (보안, 빌드, 테스트, 성능, 타입, 아키텍처, 로직) |
| 2    | 이전 시도의 컨텍스트(failureContext) 포함해 수정 요청 (최대 2회)          |
| 3    | 그래도 안 되면 CEO 에스컬레이션 — 계속 / 건너뛰기 / 중단                  |

각 선택지 사용 기준:

- **계속**: 핵심 기능이라 반드시 성공해야 할 때 (수정 방향 직접 지시 가능)
- **건너뛰기**: 부가 기능이라 나중에 추가 가능할 때
- **중단**: 기획 자체를 재검토해야 할 때

---

## 수정 요청 (`/gv "수정 요청 ..."`)

`completed` 상태 프로젝트에 기능 추가/변경/버그 수정을 요청합니다. v1의 `good-vibe:modify`에 해당하며, v2에서는 자연어로 진입합니다.

### 언제 쓰나요?

- "알림 기능 추가해줘" — 완료된 프로젝트에 새 기능 추가
- "로그인 방식을 JWT로 바꿔줘" — 기존 기능 변경
- "버그 고쳐줘" — 완료된 프로젝트 문제 수정

### CEO 관점 흐름

```
/gv "결제 시스템에 환불 기능 추가해줘"
  → nl-router가 category=modify로 분류 (디스패처가 활성 프로젝트 상태를 확인 후 분기)
  → 코드베이스 스캔 + 영향 범위 분석
  → Before/After 아키텍처 다이어그램 표시
  → CEO 확인: 진행 / 수정 / 취소
  → /gv:execute (auto 고정)
  → 완료
```

### 신규 작업과의 차이

| 항목    | 신규 (`/gv "...만들어줘"`) | 수정 (`/gv "수정 요청 ..."`)        |
| ------- | -------------------------- | ----------------------------------- |
| 대상    | 새 프로젝트                | `completed` 프로젝트                |
| 팀 구성 | 새로 구성                  | 기존 팀 유지                        |
| 토론    | 필요 시 토론               | 생략 (코드베이스 분석으로 대체)     |
| 맥락    | 처음부터 시작              | 기존 PRD + 기획서 + 코드 유지       |
| 실행    | 모드 선택 가능             | auto 고정 (에스컬레이션만 CEO 호출) |

---

## v1 명령 마이그레이션 표

v1 사용자라면 아래 매핑으로 옮겨오세요. v1 슬래시 **전체 20개**의 v2 대응을 정리합니다 (`#3216fba`에서 일괄 제거).

| v1 명령                 | v2 진입                                   | 비고                                                     |
| ----------------------- | ----------------------------------------- | -------------------------------------------------------- |
| `good-vibe:hello`       | (없어짐)                                  | 환경 점검은 `/gv:status` + Claude Code `/doctor`         |
| `good-vibe:new`         | `/gv "...만들어줘"` 자연어                | 복잡도 분석 + 팀 구성이 dispatch에 통합됨                |
| `good-vibe:discuss`     | `/gv "추가 토론 ..."` (planning 상태)     | plan 작업 그래프가 토론 자동 진행                        |
| `good-vibe:approve`     | `/gv "기획 승인"` (planning 상태)         | dispatch가 자연어를 승인 액션으로 라우팅                 |
| `good-vibe:execute`     | `/gv:execute`                             | 직접 매핑                                                |
| `good-vibe:report`      | `/gv "보고서 확인"`                       | completed 상태에서 자연어 진입                           |
| `good-vibe:modify`      | `/gv "수정 요청 ..."`                     | category=modify로 자동 분기                              |
| `good-vibe:status`      | `/gv:status`                              | 직접 매핑                                                |
| `good-vibe:feedback`    | `/gv "피드백 분석"`                       | completed 상태에서 자연어 진입                           |
| `good-vibe:my-team`     | `/gv:team`                                | 직접 매핑                                                |
| `good-vibe:learn`       | `/gv "X 사용법 알려줘"` (ask 작업)        | 별도 슬래시 없음, ask 작업으로 통합                      |
| `good-vibe:new-project` | (없어짐)                                  | `/gv` 자연어 + 추천 수정으로 통합                        |
| `good-vibe:projects`    | `list-projects` CLI 직접 호출             | 슬래시 없음, [고급 커맨드](12-advanced-commands.md)      |
| `good-vibe:my-config`   | (없어짐)                                  | Claude Code `/doctor` + 직접 파일 점검                   |
| `good-vibe:scaffold`    | `/gv "X 템플릿으로 스캐폴드"` (code 작업) | 5개 내장 템플릿은 [고급 커맨드](12-advanced-commands.md) |
| `good-vibe:add-skill`   | (없어짐)                                  | Claude Code 표준 plugin install 사용                     |
| `good-vibe:add-agent`   | (없어짐)                                  | Claude Code 표준 plugin install 사용                     |
| `good-vibe:preset`      | (없어짐)                                  | agent-overrides 직접 편집 또는 자연어 요청               |
| `good-vibe:reset`       | (없어짐)                                  | 데이터 디렉토리 직접 삭제                                |
| `good-vibe:eval`        | (없어짐)                                  | A/B 비교는 별도 도구로 분리 예정                         |

> v1 슬래시는 `#3216fba` 커밋에서 일괄 제거됐습니다. 자연어 진입(`/gv "..."`)이 대부분의 경우를 커버합니다.

---

## 에이전트용 내부 API

에이전트가 내부적으로 사용하는 CLI 커맨드(약 150개)는 그대로 남아 있습니다. 일반 사용자는 쓸 일이 없지만, 커스텀 에이전트나 SDK 사용 시 참고할 수 있습니다.

```bash
# 특정 커맨드의 입출력 스키마 확인
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js describe-command --command init-execution

# 전체 목록
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js describe-command
```

---

## 다음 문서

- [퀵스타트](00-quick-start.md) — `/gv` 한 줄로 시작
- [커맨드와 스킬 개관](03-commands-and-skills.md) — 커맨드 vs 스킬 개념
- [고급 커맨드](12-advanced-commands.md) — v1 → v2 마이그레이션 노트
- [실행 모드 가이드](10-execution-modes.md) — interactive/semi-auto/auto 깊게
