# 퀵스타트

Good Vibe Coding은 AI 팀원들과 함께 프로젝트를 만드는 도구입니다.
당신이 CEO 역할을 맡고, AI 팀원들이 기획부터 실행까지 처리합니다.

**이 가이드를 마치면 이런 결과를 얻습니다:**

- AI 팀(CTO, 개발자, QA 등)이 자동으로 구성됩니다
- 팀원들이 토론해서 기획서를 만들고, 코드를 작성하고, 리뷰합니다
- 프로젝트 폴더에 실제 코드 파일이 생성됩니다
- 전체 과정 보고서를 받을 수 있습니다

> 어디서부터 볼까요?
>
> - 지금 바로 시작하려면 아래 6단계를 따라가세요
> - 전체 커맨드가 궁금하면 [커맨드 레퍼런스](03-commands-reference.md)
> - 팀원 역할이 궁금하면 [에이전트 가이드](04-agents.md)
> - 자동화 설정이 궁금하면 [훅과 자동화](05-hooks-and-automation.md)
> - 코드에서 SDK로 쓰려면 [SDK 사용 가이드](09-sdk-usage.md) (설치만으로 체험 가능, LLM 호출 시 프로바이더 연결 필요)
> - 모드가 헷갈리면 [실행 모드 가이드](10-execution-modes.md)

---

## 처음이라면 이렇게 하세요 (최소 경로)

가장 빠르게 결과를 보려면 이 두 커맨드만 실행하세요:

```
1. good-vibe:hello     ← 환경 설정 (처음 1회만)
2. good-vibe:new       ← 아이디어 입력하면 끝까지 자동 진행
```

`good-vibe:new`가 복잡도를 분석해서 모드, 팀, 토론, 실행을 알아서 결정합니다.
간단한 프로젝트(봇, 스크립트)라면 입력 후 5분이면 완료됩니다.

아래 6단계는 각 과정을 하나씩 직접 제어하고 싶을 때 참고하세요.

---

## 6단계로 프로젝트 끝내기

> 아래 플로우는 plan-only 모드 기준입니다. plan-execute 모드에서는 Step 3(`good-vibe:discuss`)이 CTO+PO 빠른 분석으로 대체되고 Step 4(`good-vibe:approve`)는 자동 승인됩니다. quick-build 모드에서는 Step 3-4를 건너뛰고 바로 실행합니다.

```
아이디어 → good-vibe:new → 복잡도 분석
├─ simple → quick-build (약 5분, 토론 없이 바로 실행)
│  CTO 분석 → 확인 → 작업 실행 → QA 리뷰 → 완료
│
├─ medium → plan-execute (약 10-15분, CTO+PO 빠른 분석 + 자동 실행)
│  CTO+PO 분석 → 자동 승인 → good-vibe:execute → 완료
│
└─ complex → plan-only (약 40분, 3라운드 토론 + 수동 승인)
   good-vibe:discuss(수렴까지) → good-vibe:approve → good-vibe:execute → 완료
```

### Step 1: `good-vibe:hello` — 환경 설정

개발 환경을 확인하고, CLAUDE.md와 개인 설정을 만들어줍니다.
GitHub CLI가 설치돼 있으면 저장소도 자동으로 만들어줍니다.

약 2-3분

```
> good-vibe:hello

🔍 환경 확인 중...
   ✓ Node.js v22.0.0
   ✓ npm 10.8.0
   ✓ git 2.43.0
   ✓ GitHub CLI 2.50.0
   ⚠ Gemini CLI 미설치 (크로스 모델 리뷰 비활성)

📝 개인 설정:
   이름: CEO
   선호 언어: 한국어
   기본 모델: claude-sonnet-4-6

✅ 환경 설정 완료!
→ 다음: good-vibe:new로 프로젝트를 시작하세요
```

---

### Step 2: `good-vibe:new` — 아이디어 입력 + 팀 구성

아이디어를 자연어로 입력하면, 프로젝트 복잡도를 분석해서 모드와 팀 구성을 추천해줍니다.
추천이 마음에 안 들면 직접 수정할 수 있습니다.

약 1-2분

```
> good-vibe:new

CEO: "날씨를 알려주는 텔레그램 봇을 만들고 싶어"

🔍 복잡도 분석 중...
   복잡도: simple
   추천 모드: quick-build

👥 추천 팀 구성:
   CTO (opus) — 아키텍처 설계
   Backend Developer (sonnet) — API 구현
   QA Engineer (haiku) — 테스트 전략

이대로 진행할까요? [승인 / 수정]
→ 승인

🏗️ CTO 아키텍처 분석 시작...
```

---

### Step 3: `good-vibe:discuss` — 팀 토론

팀원들이 역할별로 프로젝트를 분석합니다. CTO는 아키텍처를, PO는 요구사항을, 리서처는 기술 스택을 봅니다. 전체 의견을 모아서 기획서를 만들고, 80% 이상이 동의할 때까지 반복합니다 (최대 3라운드).

약 3-10분 (프로젝트 규모에 따라 다름)

```
> good-vibe:discuss

💬 토론 라운드 1/3 시작

   [전체 병렬] CTO, PO, Fullstack, Frontend, QA, Security, Tech Writer 동시 분석 중...

📋 기획서 초안 완성
   → 전체 리뷰 진행 중...

✅ 승인율: 85% (6/7 승인) — 수렴 완료!
→ 기획서가 확정되었습니다
```

---

### Step 4: `good-vibe:approve` — 기획서 검토

완성된 기획서를 보여줍니다. 세 가지 선택지가 있습니다:

- 승인 — 바로 실행 단계로 넘어감
- 수정 요청 — 피드백을 반영해서 기획서 수정
- 재토론 — 팀원들이 다시 토론

약 1-2분

```
> good-vibe:approve

📄 기획서 요약:
   프로젝트: 날씨 알림 텔레그램 봇
   기술 스택: Node.js + Telegraf + OpenWeatherMap API
   Phase 3개, 태스크 7개
   예상 소요: 약 10분

[승인 / 수정 요청 / 재토론]
→ 승인

✅ 기획서 승인 완료!
→ 작업이 7개 태스크로 분배되었습니다
→ 다음: good-vibe:execute로 실행하세요
```

---

### Step 5: `good-vibe:execute` — 실행 + 리뷰

팀원들이 Phase별로 작업하고, 다른 팀원이 결과물을 리뷰합니다.
리뷰에서 문제가 나오면 자동으로 수정하고, 2번 시도해도 안 되면 당신에게 판단을 맡깁니다.

세 가지 모드가 있습니다:

- 인터랙티브 — Phase마다 진행 여부를 확인 (처음 쓸 때 추천)
- 세미-오토 — 3 Phase마다 확인 (Phase가 많을 때 추천)
- 자동 — 문제가 생길 때만 멈춤

약 5-15분 (작업량에 따라 다름)

```
> good-vibe:execute

실행 모드를 선택하세요: [인터랙티브 / 세미-오토 / 자동]
→ 인터랙티브

⚡ Phase 1/3: 프로젝트 셋업
   Backend Developer: package.json, 폴더 구조 생성
   → 빌드 검증: ✓ 통과
   → 리뷰: QA ✓, CTO ✓ (critical 0)
   ✅ Phase 1 완료

   다음 Phase로 진행할까요? [진행 / 지침 추가 / 중단]
   → 진행

⚡ Phase 2/3: 핵심 기능 구현
   Backend Developer: Telegraf 봇 + OpenWeatherMap API 연동
   → 빌드 검증: ✓ 통과
   → 리뷰: QA ✓, CTO ✓ (critical 0, important 1)
   ✅ Phase 2 완료

⚡ Phase 3/3: 테스트 + 문서
   QA Engineer: 단위 테스트 + README 작성
   → 빌드 검증: ✓ 통과
   → 리뷰: CTO ✓, Backend ✓
   ✅ Phase 3 완료

✅ 전체 실행 완료!
→ 다음: good-vibe:report로 보고서를 확인하세요
```

---

### Step 6: `good-vibe:report` — 보고서

프로젝트 전체 과정을 정리한 보고서를 받습니다.

약 1분

```
> good-vibe:report

📊 프로젝트 보고서: 날씨 알림 텔레그램 봇

   상태: completed
   모드: quick-build
   팀: CTO, Backend Developer, QA Engineer

   Phase 3/3 완료
   태스크 7/7 완료
   리뷰 3회, critical 이슈 0개

   생성된 파일:
   ├── src/bot.js
   ├── src/weather.js
   ├── tests/bot.test.js
   └── README.md

→ good-vibe:feedback으로 팀원 성과를 분석하면 다음 프로젝트에 반영됩니다
→ good-vibe:modify로 기능을 추가하거나 수정할 수 있습니다
```

---

## 모드별 차이 비교

같은 아이디어라도 `good-vibe:new`에서 분석한 복잡도에 따라 다르게 진행됩니다.

| 항목        | quick-build       | plan-execute            | plan-only                     |
| ----------- | ----------------- | ----------------------- | ----------------------------- |
| 토론        | 생략              | 생략 (CTO+PO 빠른 분석) | 최대 3라운드 (CEO 승인 필요)  |
| 팀 규모     | 2-3명             | 3-5명                   | 5-8명                         |
| CEO가 할 일 | 아이디어 입력만   | 아이디어 입력만         | 기획서 승인 + 실행 모드 선택  |
| 사용 커맨드 | `new`             | `new`                   | `new` → `approve` → `execute` |
| 예시        | 봇, 스크립트, CLI | 웹앱, API 서버          | 마이크로서비스, 대규모 시스템 |
| 소요 시간   | 3-5분             | 10-20분                 | 20-40분                       |

---

## 그 외 쓸 만한 커맨드

| 커맨드               | 하는 일                                  |
| -------------------- | ---------------------------------------- |
| `good-vibe:status`   | 지금 프로젝트가 어디까지 진행됐는지 확인 |
| `good-vibe:feedback` | 팀원별 성과 분석 + 개선 제안             |
| `good-vibe:my-team`  | 현재 팀 구성 확인                        |
| `good-vibe:learn`    | 역할별 사용법 가이드                     |
| `good-vibe:modify`   | 완료된 프로젝트에 기능 추가/수정         |

---

전체 커맨드 목록은 [커맨드 레퍼런스](03-commands-reference.md)를 참고하세요.

---

## 업데이트

새 기능이나 버그 수정이 있으면 업데이트하세요:

```bash
# 소스 설치 사용자
cd good-vibe-coding && git pull && npm install

# 플러그인 사용자
claude plugin update sumsun-dev/good-vibe-coding
```
