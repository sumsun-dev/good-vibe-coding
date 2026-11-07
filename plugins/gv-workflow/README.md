# gv-workflow

Claude Code 로 매일 일하면서 쓰는 작업 습관 묶음. [good-vibe](../../README.md) 마켓플레이스에 함께 들어 있는 별도 플러그인입니다.

## 설치

```
/plugin marketplace add sumsun-dev/good-vibe-coding
/plugin install gv-workflow@good-vibe
```

## 들어 있는 것

| 이름                     | 종류   | 하는 일                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/gv-workflow:daily-end` | 커맨드 | 저장소 정리(푸시·PR 머지·이슈 닫기·브랜치 삭제·pull, 확인 후 실행) → 오늘 한 일·다음 할 일을 `~/daily-logs/<프로젝트>/YYYY-MM-DD.md` 로 저장. `review` 는 점검만                                                                                                                                                                                                                                                            |
| `/gv-workflow:improve`   | 커맨드 | 대화 회고 → 메모리·규칙·CLAUDE.md·커맨드·훅 개선안 제안, 승인한 것만 적용. `week`(최근 7일 일지), `explore`(외부 도구 탐색)                                                                                                                                                                                                                                                                                                 |
| `/gv-workflow:qa-design` | 커맨드 | 디자인 토큰·컴포넌트·반응형·접근성 4개 관점 병렬 감사                                                                                                                                                                                                                                                                                                                                                                       |
| `/gv-workflow:qa-data`   | 커맨드 | 스키마·평가 로직·커버리지·정합성 4개 관점 병렬 감사                                                                                                                                                                                                                                                                                                                                                                         |
| `/gv-workflow:qa-full`   | 커맨드 | 위 두 감사 8개를 한 번에, 통합 리포트                                                                                                                                                                                                                                                                                                                                                                                       |
| `hangul-wrap`            | 스킬   | 한글 어절 쪼개짐·고아 줄·가로 넘침을 브라우저 6개 폭에서 실측 → 자리별 CSS 처방 → 재측정                                                                                                                                                                                                                                                                                                                                    |
| `kr-service-style`       | 스킬   | 서비스(토스·당근 등)와 범위(사용 흐름 UX·화면 모양 UI·문구)를 골라 공개 원칙을 기존 화면에 적용하고 검사기로 전·후 실측. `toss 문구` 처럼 인자로도 지정. 색·로고·전용 서체는 가져오지 않음. 네이버·카카오·배민은 공개 서체·로그인 버튼 가이드·상표 경계                                                                                                                                                                     |
| `landing-demo`           | 스킬   | 랜딩에 넣을 제품 데모 애니메이션(폰·창 안의 앱 화면이 질문→결과로 움직임)을 실제 제품 화면·검증된 내용으로 만들고 폭별·시간별로 찍어 고침. [Stageshow](https://github.com/benjitaylor/skills/tree/main/stageshow) kit 을 원본에서 받아 필요한 파일만 사용(`kit-pick.mjs`), 촬영·측정은 `film-lite.mjs`                                                                                                                      |
| `ui-patterns`            | 스킬   | 닮았지만 쓰임이 다른 디자인 요소 21묶음(고르기·입력, 띄우는 창, 알림, 로딩, 이동, 빈 화면, 제스처, 공유, AI 채팅, 완료 피드백, 디자인 스타일, 선택 심리, 버튼 위계, 폼 흐름, 온보딩, 오류·권한, 표, 모션 이름 등)을 알려 주고, 화면 상황에 맞는 것을 추천해 고르게 한 뒤 네이티브 HTML 우선으로 적용. `uicheck.js` 로 잘못 고른 자리(토스트에 버튼, 가짜 모달, 칸 나눈 OTP, 브레드크럼 현재 링크 등 35개 규칙)를 전·후 실측 |
| `working-style`          | 스킬   | 사용자에게 일을 넘길 때의 규칙 (검증은 끝까지, 비밀값은 터미널 앱, 막히는 단계는 `!` 한 줄)                                                                                                                                                                                                                                                                                                                                 |

## 추천 루틴

```
작업 → /gv-workflow:daily-end → /gv-workflow:improve
매주 → /gv-workflow:improve week explore
```

`daily-end` 로 일지를 쌓아 두면 `improve week` 가 여러 날에 걸쳐 반복된 문제를 근거로 개선안을 냅니다.

## 원칙

- **제안 → 승인 → 적용.** 설정·훅·메모리는 승인 없이 바꾸지 않습니다
- **안전장치는 풀지 않습니다.** 머지·배포·강제 푸시를 자동 허용하는 권한 규칙은 만들지 않습니다
- **비밀값 원문은 어디에도 적지 않습니다** (일지·메모리 포함)

## 함께 쓰면 좋은 것

이 플러그인에 복사하지 않고 원본을 그대로 쓰길 권합니다.

- [ECC (everything-claude-code)](https://github.com/affaan-m/ECC) — TDD·계획·리뷰 커맨드, 에이전트, 훅 모음
- [superpowers](https://github.com/obra/superpowers) — 서브에이전트 오케스트레이션·검증 패턴
- [ponytail](https://github.com/DietrichGebert/ponytail) — 과설계를 막는 최소 구현 모드
- [giting hangul-wrap](https://github.com/hanmariyang/giting-skills/tree/main/plugins/hangul-wrap) — 더 정밀한 한글 줄바꿈 실측(글리프 위치 재구성, 확대 상태 버튼 잘림). 위 `hangul-wrap` 스킬의 상위 호환 (`/plugin marketplace add hanmariyang/giting-skills` → `/plugin install hangul-wrap@giting`)
- [oh-my-design](https://github.com/kwakseongjae/oh-my-design) — 회사별 DESIGN.md 아카이브와 적용 스킬 (값은 웹 실측)
- [k-style-ui-ux](https://github.com/vmc-inner-circle/k-style-ui-ux) — PRD 로 한국 앱 스타일 모바일 화면을 처음부터 생성

## 라이선스

MIT
