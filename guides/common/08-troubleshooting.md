# 문제해결 가이드

Good Vibe Coding 사용 중 자주 만나는 상황과 해결 방법입니다.

---

## Phase 실패가 반복될 때

증상: 품질 게이트에서 critical 이슈로 실패, 수정해도 같은 이슈 반복

해결:

1. 에스컬레이션 시 "직접 지시"를 선택하고 구체적인 수정 방향을 알려주세요
2. 예: "JWT 대신 세션 기반 인증으로 변경해주세요"
3. 그래도 안 되면 "건너뛰기"로 해당 Phase를 넘기고, 나중에 수동으로 구현

예방: `good-vibe:discuss` 단계에서 기술적 제약사항을 구체적으로 설명해주세요

---

## 토론이 수렴하지 않을 때

증상: 3라운드 후에도 승인율 80% 미달

해결:

1. "강제 수렴" 선택 → 현재 기획서로 확정 (미합의 사항은 별도 기록)
2. "모드 변경" 선택 → plan-only로 전환하여 기획서를 직접 수정
3. 블로커 이슈를 확인하고, 프로젝트 설명에 해당 부분을 명확히 추가

예방: `good-vibe:new`에서 프로젝트 설명을 충분히 상세하게 작성하세요. 명확도 80% 이상이 이상적입니다.

---

## 실행이 중단됐을 때 (재개)

증상: 네트워크 오류나 세션 만료로 실행이 중단됨

해결:

```
good-vibe:execute
→ "이전 실행이 있습니다. 재개하시겠습니까?" → "예"
```

내부적으로 `resume: true`로 호출되어 중단된 Phase부터 이어서 진행합니다.

---

## 승인한 기획서를 수정하고 싶을 때

증상: `good-vibe:approve` 후 기획서에 빠진 부분을 발견

해결 (실행 시작 전에만 가능):

```
good-vibe:discuss --reset
→ approved 상태가 planning으로 되돌아감
→ 추가 토론 또는 기획서 직접 수정 후 good-vibe:approve 재실행
```

주의: `good-vibe:execute`로 실행이 시작된 후에는 되돌릴 수 없습니다.

---

## gh CLI가 설치되지 않았을 때

증상: GitHub 관련 기능 (저장소 생성, PR) 사용 불가

해결:

- Good Vibe Coding은 gh CLI 없이도 정상 동작합니다
- GitHub 관련 기능은 `skipped: true`로 건너뛰고 나머지 기능은 그대로 사용
- gh CLI를 설치하려면: https://cli.github.com/

---

## 에스컬레이션이 반복될 때

증상: 같은 Phase에서 계속 에스컬레이션 발생 (최대 3회)

해결:

1. `good-vibe:status`로 실패 이력을 확인하여 반복되는 이슈 카테고리 파악
2. 에스컬레이션 시 "직접 지시"로 근본 원인에 대한 방향 제시
3. 3회 초과 시 "건너뛰기" 또는 "중단" 선택 필요
4. 기획 단계의 문제라면 "중단" 후 `good-vibe:discuss --reset`으로 재기획

---

## 프로젝트를 처음부터 다시 시작하고 싶을 때

방법:

```
good-vibe:new
→ 새 프로젝트를 생성합니다 (기존 프로젝트는 유지)
```

기존 프로젝트는 `good-vibe:projects`로 확인하고, `good-vibe:status`로 개별 확인할 수 있습니다.

---

## 팀 구성을 바꾸고 싶을 때

방법:

```
good-vibe:new-project
→ 수동으로 모드, 팀 규모, 역할을 선택
```

`good-vibe:new`의 자동 추천 대신 직접 설정하고 싶을 때 사용합니다.

---

## 커맨드 실행 순서가 맞지 않을 때

증상: 커맨드를 실행했지만 "프로젝트를 찾을 수 없습니다" 또는 상태 불일치 에러 발생

해결:

1. `good-vibe:status`로 현재 프로젝트의 상태를 확인하세요
2. 프로젝트가 없으면 `good-vibe:new`로 먼저 생성하세요
3. 아래 표에서 현재 상태에 맞는 커맨드를 확인하세요:

| 프로젝트 상태         | 사용 가능한 커맨드                                         |
| --------------------- | ---------------------------------------------------------- |
| created               | `good-vibe:discuss` (토론 시작)                            |
| planning              | `good-vibe:discuss` (재토론), `good-vibe:approve` (승인)   |
| approved              | `good-vibe:execute` (실행 시작)                            |
| executing / reviewing | `good-vibe:execute` (중단된 실행 재개), `good-vibe:status` |
| completed             | `good-vibe:modify` (수정), `good-vibe:report` (보고서)     |

예방: 각 커맨드 완료 시 표시되는 "다음 단계" 안내를 따라가세요.

---

## LLM 호출이 실패할 때

증상: 토론이나 실행 중 "timeout", "network error", "rate limit" 등 오류 발생

해결:

1. 대부분 일시적 오류입니다. 같은 커맨드를 다시 실행하세요
2. 실행 중이었다면 `good-vibe:execute`로 중단 지점부터 재개할 수 있습니다
3. 토론 중이었다면 `good-vibe:discuss`로 마지막 라운드부터 이어갑니다
4. 반복되면 네트워크 연결을 확인하세요

참고: 프로젝트 상태와 실행 진행률은 project.json에 자동 저장되므로, 중단 후 재개해도 이전 작업이 유지됩니다.

---

## 환경 설정에 문제가 있을 때

증상: `good-vibe:hello`에서 환경 체크 경고 또는 CLI 실행 오류

해결:

**필수 도구:**

- Node.js 18 이상: `node --version`으로 확인. 미달 시 https://nodejs.org/ 에서 업데이트
- npm: Node.js와 함께 설치됨. `npm --version`으로 확인
- git: `git --version`으로 확인. 미설치 시 https://git-scm.com/ 에서 설치

**선택 도구 (없어도 정상 동작):**

- gh CLI: GitHub 기능(저장소 생성, PR) 사용 시 필요. https://cli.github.com/
- Gemini CLI: 멀티 AI 리뷰 사용 시 필요. `npm install -g @google/gemini-cli`

선택 도구가 없으면 해당 기능만 건너뛰고 나머지는 정상 동작합니다.
