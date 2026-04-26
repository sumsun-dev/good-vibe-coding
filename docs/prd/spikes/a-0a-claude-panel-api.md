# Spike A-0a — Claude Code 패널 API 검증

| 항목        | 값                                                 |
| ----------- | -------------------------------------------------- |
| 스파이크 ID | A-0a                                               |
| PRD 참조    | #235 §7-4, §10 (Phase A 진입 게이트), §12 (리스크) |
| 일자        | 2026-04-26                                         |
| 상태        | **완료 — fallback B 확정**                         |

## 조사 질문

플러그인이나 슬래시 커맨드 실행 중 메인 대화 영역과 별도로 사용자에게 라이브 패널/대시보드(진행률 + 비용 + 위험 신호)를 렌더링할 수 있는 Claude Code API가 존재하는가?

## 결과 요약

**패널 API 없음.** Claude Code는 메인 대화와 별도의 사이드 패널/위젯 렌더링 API를 제공하지 않는다.

## 가용 메커니즘

| 메커니즘                     | 가능 여부 | 용도                                                                               |
| ---------------------------- | --------- | ---------------------------------------------------------------------------------- |
| Sidebar/Widget API           | ❌        | 별도 패널 렌더링 — 미지원                                                          |
| **Statusline**               | ✅        | 하단 상태 바. 쉘 스크립트 + JSON 입력, `refreshInterval` 주기 갱신, ANSI 색상/링크 |
| **stdout markdown**          | ✅        | Claude Code가 마크다운 자동 렌더링. 진행 블록·표·코드 펜스 모두 가능               |
| Fullscreen 모드              | △         | 전체 화면만 — 패널 X                                                               |
| Streaming Output (Agent SDK) | △         | 텍스트 스트리밍만, 대시보드 렌더링 X                                               |

문서: https://code.claude.com/docs/en/statusline.md

## 결정 — Option B (stdout markdown) + statusline 보조

PRD §12의 fallback 정책 그대로:

- **`claude-panel-renderer.js`는 구조화된 stdout markdown 출력으로 구현**
- 진행률, 비용 누적, 위험 신호를 마크다운 표/헤더/코드 블록으로 갱신마다 출력
- 보조: **statusline 통합**(선택) — 하단 바에 누적 비용/현재 단계 같은 단일 라인 정보 표시
- 이 결정은 §7 신규 모듈 4번에 반영됨 ("패널 API 미지원 시 구조화된 stdout으로 자동 fallback")

## Phase B 영향

- 모듈명은 `claude-panel-renderer.js` 유지하되 내부 구현은 stdout 기반
- 인터페이스: `render(metrics, journalEvents, riskSignal) → markdown string`
- 출력 형식 표준화 (헤더 깊이, 표 컬럼 순서)는 Phase B 시작 시 결정
- statusline 통합은 별도 옵션. PRD §10 Phase B 백로그에 추가 가능.

## Phase A 게이트 통과

PRD §10 Phase A → B 진입 게이트 중 "A-0a 결과 → `claude-panel-renderer.js` 인터페이스 확정"이 이 노트로 충족됨.
