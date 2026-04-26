# internal/ — 자율 개선 파이프라인

> Good Vibe Coding 코드베이스 **자체**를 자동 개선하는 CI/CD 파이프라인. 사용자용 기능이 아님.
>
> **현황 (2026-04-26):** VPS cron 제거됨. 마지막 자동 PR — Daily #221 (4/4), UX #204 (3/31). 코드는 보존되어 있으나 정기 실행은 중단. 수동 실행만 가능.

## Daily Improvement 파이프라인

코드베이스를 **Round Loop**로 자동 분석 → 이슈 생성 → 코드 수정 → PR 생성 → 독립 리뷰 → 수정 루프 → SLA 평가 → SLA 달성까지 반복 → 보고서 → 머지 요청.

```
daily-improvement.sh (오케스트레이터)
  ├─ Phase 0: 사전 준비 [1회]
  │  flock → git pull → npm ci → 데이터 수집 → 브랜치 생성
  ├─── Round Loop (SLA 달성까지) ─────────────────────┐
  │ ├─ Phase 1: 분석 + 수정 + PR (Claude Improver)    │
  │ ├─ Phase 1.5: 이슈 검증 (issue-manager)           │
  │ ├─ Phase 2: 독립 리뷰 (Claude Reviewer)           │
  │ ├─ Phase 3: 수정 루프 (최대 5사이클)              │
  │ └─ Phase Eval: 7영역 SLA 평가                     │
  │    SLA 달성 / 개선 정체 → break                    │
  └────────────────────────────────────────────────────┘
  └─ Phase 4: 보고서 + 머지 요청 [1회]
```

### 7영역 SLA 평가

| 영역           | 평가 대상                              |
| -------------- | -------------------------------------- |
| architecture   | 모듈 구조, 의존성, SRP, 레이어 분리    |
| safety         | 보안 취약점, 입력 검증, injection 방지 |
| promptQuality  | AI 프롬프트 명확성, 출력 형식 강제     |
| reflection     | 히스토리 반영, 적응형 분석             |
| errorHandling  | AppError 사용, graceful degradation    |
| testCoverage   | 테스트 존재/품질, 커버리지             |
| docConsistency | CLAUDE.md/README.md와 코드 일치        |

- SLA 목표: 7.0/10 (`SLA_TARGET` env)
- 개선 정체: 라운드 간 평균 개선폭 < 0.3 → 조기 종료

### 타임아웃

| Phase       | 타임아웃    |
| ----------- | ----------- |
| Improver    | 4h          |
| Reviewer    | 2h          |
| Fixer       | 1.5h/사이클 |
| Re-reviewer | 1h/사이클   |
| Eval        | 1h          |
| 전체        | 14h         |

### 안전장치

- **동시 실행 방지**: `flock -n /tmp/gv-daily-improvement.lock`
- **master 직접 커밋 방지**: `assert_not_on_master()`
- **lint/test 실패 롤백**: `git reset HEAD && git checkout -- .`
- **세션 한도 재시도**: 5분 대기 후 재시도 (최대 3회)
- **Checkpoint/재개**: `checkpoint.json`에 라운드/Phase 진행상황 저장
- **긴급 정지**: `/tmp/gv-daily-improvement.stop` 감지 시 즉시 중단
- **30일 로그 정리**: `find -mtime +30 -delete`

### 리뷰 품질 기준

- **MUST (reject):** 보안 취약점, 테스트 깨뜨림, 로직 오류, CLAUDE.md 컨벤션 위반, 새 문제 도입
- **SHOULD (코멘트만):** 개선 제안, 커버리지 부족, 네이밍 개선, 리팩토링 기회

## UX Improvement 파이프라인

사용자 경험(UX) 관점에서 자동 개선. 매 실행마다 다른 관점으로 분석 (rotation).

### 8가지 관점 순환

| #   | 관점               | 분석 대상                           |
| --- | ------------------ | ----------------------------------- |
| 0   | first-time-user    | hello → new 흐름, 진입 장벽         |
| 1   | command-flow       | 상태 전이, 다음 단계 안내           |
| 2   | error-recovery     | 에러 메시지 품질, 복구 가이드       |
| 3   | guide-coverage     | guides/ vs 실제 기능 매칭           |
| 4   | sdk-dx             | import 패턴, API 일관성             |
| 5   | mode-confusion     | 모드 구분 명확성                    |
| 6   | onboarding-quality | 프리셋, 템플릿, CLAUDE.md 생성 품질 |
| 7   | intermediate-user  | 고급 커맨드, 커스터마이징           |

### 5영역 UX SLA

| 영역               | 설명                 |
| ------------------ | -------------------- |
| flowClarity        | 커맨드 플로우 명확성 |
| errorQuality       | 에러 메시지 품질     |
| guideCompleteness  | 가이드/문서 완성도   |
| onboardingFriction | 온보딩 마찰도        |
| sdkUsability       | SDK 사용성           |

목표: 7.0/10 (`UX_SLA_TARGET` env)

### 자동 머지 (모든 조건 충족 시)

1. `npm test` 전체 통과
2. PR 리뷰 APPROVED
3. 변경 파일이 안전 경로만 (commands/, guides/, templates/, presets/, agents/, skills/)
4. 코어 로직 파일 변경 없음

## Daily vs UX 차이

| 항목      | Daily                            | UX                            |
| --------- | -------------------------------- | ----------------------------- |
| 관점      | 코드 품질/보안/성능              | 사용자 경험 (8관점 순환)      |
| SLA       | 7영역                            | 5영역                         |
| 자동 머지 | APPROVED 시                      | 안전 경로만                   |
| lock      | `/tmp/gv-daily-improvement.lock` | `/tmp/gv-ux-improvement.lock` |
| stop      | `/tmp/gv-daily-improvement.stop` | `/tmp/gv-ux-improvement.stop` |
| 브랜치    | `improve/`                       | `ux-improve/`                 |

## 파일 구조

```
internal/
  daily-improvement.sh              # Daily 오케스트레이터
  ux-improvement.sh                 # UX 오케스트레이터
  improvement/                      # Daily Phase 스크립트 + config
  ux-improvement/                   # UX Phase 스크립트 + config
  lib/
    prompt-builder.js               # Improver/Reviewer/Fixer/Evaluator 프롬프트
    history-analyzer.js             # history.jsonl CRUD + 요약
    sla-evaluator.js                # 7영역 SLA 점수 파싱/판정
    ux-prompt-builder.js            # UX 프롬프트
    ux-sla-evaluator.js             # UX SLA 평가
    perspective-manager.js          # 관점 순환 관리
    issue-manager.js                # 이슈 검증, closes 연결
    review-parser.js                # 리뷰 결과 파싱
    pipeline-utils.js               # 파이프라인 유틸리티
logs/
  daily-improvement/history.jsonl
  ux-improvement/history.jsonl
```

## 수동 실행

```bash
bash internal/daily-improvement.sh
bash internal/ux-improvement.sh
```

- **인증**: Claude Max Plan OAuth (별도 API key 불필요)
- **이슈 템플릿**: `.github/ISSUE_TEMPLATE/improvement.md`
- **중단 조건**: SLA 달성, 개선 정체, 시간 제한, 세션/주간 한도 소진, 빈 결과 3회 연속
