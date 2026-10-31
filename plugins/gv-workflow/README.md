# gv-workflow

Claude Code 로 매일 일하면서 쓰는 작업 습관 묶음. [good-vibe](../../README.md) 마켓플레이스에 함께 들어 있는 별도 플러그인입니다.

## 설치

```
/plugin marketplace add sumsun-dev/good-vibe-coding
/plugin install gv-workflow@good-vibe
```

## 들어 있는 것

| 이름                     | 종류   | 하는 일                                                                                                                     |
| ------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| `/gv-workflow:end`       | 커맨드 | 열린 PR·이슈·브랜치 점검 → 머지·닫기·삭제 (`review` 는 점검만)                                                              |
| `/gv-workflow:daily-end` | 커맨드 | 오늘 한 일·막힌 것·다음 할 일을 `~/daily-logs/<프로젝트>/YYYY-MM-DD.md` 로 저장                                             |
| `/gv-workflow:improve`   | 커맨드 | 대화 회고 → 메모리·규칙·CLAUDE.md·커맨드·훅 개선안 제안, 승인한 것만 적용. `week`(최근 7일 일지), `explore`(외부 도구 탐색) |
| `/gv-workflow:qa-design` | 커맨드 | 디자인 토큰·컴포넌트·반응형·접근성 4개 관점 병렬 감사                                                                       |
| `/gv-workflow:qa-data`   | 커맨드 | 스키마·평가 로직·커버리지·정합성 4개 관점 병렬 감사                                                                         |
| `/gv-workflow:qa-full`   | 커맨드 | 위 두 감사 8개를 한 번에, 통합 리포트                                                                                       |
| `working-style`          | 스킬   | 사용자에게 일을 넘길 때의 규칙 (검증은 끝까지, 비밀값은 터미널 앱, 막히는 단계는 `!` 한 줄)                                 |

## 추천 루틴

```
작업 → /gv-workflow:end → /gv-workflow:daily-end → /gv-workflow:improve
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

## 라이선스

MIT
