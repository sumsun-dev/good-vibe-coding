# Spike A-0 — v1 Baseline 측정

| 항목        | 값                                                             |
| ----------- | -------------------------------------------------------------- |
| 스파이크 ID | A-0                                                            |
| PRD 참조    | #235 §11 (KPI 베이스라인)                                      |
| 일자        | 2026-04-26                                                     |
| 상태        | **데이터 부재 — KPI는 v2 운영 시점에 baseline 누적 후 재측정** |

## 측정 목표

`~/.claude/good-vibe/projects/*/journal.jsonl` 및 `project.json`에서 다음 추출:

1. 작업당 평균 CEO 개입 횟수 (escalation 카운트)
2. 평균 작업 완료 시간 (startedAt → completedAt)
3. 작업당 평균 토큰 사용량 (`metrics.totalInputTokens + totalOutputTokens`)
4. 주간 사용 횟수 (project.json metadata)

## 결과 — 데이터 부재

| 지표                                  | 결과                                               |
| ------------------------------------- | -------------------------------------------------- |
| 발견된 프로젝트 디렉토리              | 29개                                               |
| `journal.jsonl` 존재 (>100 byte)      | **0개**                                            |
| `metrics.totalCostUsd > 0`인 프로젝트 | **0개**                                            |
| `status === 'completed'` 프로젝트     | **0개**                                            |
| 5KB 이상 `project.json`               | 1개 (`web3-news-dashboard`) — 그러나 실행 메트릭 0 |

전부 `status-test`, `test-handler-project` 같은 테스트용 자동 생성 데이터로 확인됨. 실제 v1 사용 흔적이 없음.

## 결정 — KPI는 v2 운영 시점부터 누적

PRD §11 KPI 표의 베이스라인 컬럼은 다음과 같이 처리:

| 지표                        | 처리 방향                                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| 작업당 CEO 개입             | "데이터 부재 — v2 운영 첫 1주 누적값을 v2 자체 베이스라인으로 사용. 목표는 누적 2주 시점에 재설정" |
| 평균 작업 완료 시간         | 위와 동일                                                                                          |
| 비용 효율                   | 위와 동일                                                                                          |
| 사용자 재방문               | 위와 동일                                                                                          |
| Intent Router 정확도 (단위) | A-0b 픽스처 100개 기준 — task-router PR(#240)에서 100% 측정 완료 ✓                                 |
| Intent Router 정확도 (운영) | v2 운영 시 journal에서 재라우팅 비율로 측정                                                        |

## 향후 작업

- **Phase B 진입 후**: v2 운영 1주 시점에 첫 baseline 스냅샷, 2주 시점에 KPI 목표 재설정
- 본 노트는 v2 운영 시작 직전 PRD §11에 결과를 다시 채우는 트리거가 됨
- 운영 시점 측정 스크립트는 별도 issue로 분할 예정 (`internal/baseline-collector.js` 같은 형태)

## Phase A 게이트 통과

PRD §10 Phase A → B 진입 게이트 중 "A-0 v1 baseline 측정"은 데이터 부재로 직접 측정 불가하나, **v2 자체 누적으로 baseline을 잡는 정책으로 대체**한다. Phase B 진입을 차단할 사유 아님.
