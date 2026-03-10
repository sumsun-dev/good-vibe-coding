---
description: '프로젝트 상태 확인 — 대시보드 형태로 조회'
---

# good-vibe:status — 프로젝트 상태 확인

현재 프로젝트의 전체 상태를 대시보드 형태로 보여줍니다.

## Step 1: 프로젝트 로드

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js list-projects
```

프로젝트가 여러 개면 가장 최근 프로젝트를 표시합니다.

프로젝트가 없으면 아래와 같이 안내하세요:

```
프로젝트가 아직 없습니다.

시작하려면:
  good-vibe:hello  → 환경 설정 + 개인 설정 (첫 사용 시)
  good-vibe:new    → 스마트 프로젝트 시작
```

## Step 2: 상태 표시

아래 형식으로 대시보드를 출력하세요:

```
프로젝트 상태: {이름}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
상태: {status}
모드: {mode}
생성일: {createdAt}

팀 ({N}명)
{각 팀원 이름 + 역할}

작업 현황
총 {N}개 | 완료: {N} | 진행중: {N} | 대기: {N}

{작업 목록 표}

### 실행 세부 상태 (executing/reviewing 상태일 때만)

executionState가 존재하고 status가 executing 또는 reviewing이면 아래를 추가 표시합니다:

```

실행 상태
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
실행 모드: {executionState.mode}
현재 Phase: {executionState.currentPhase} / {총 Phase 수}
현재 단계: {phaseStep 한국어} ({executionState.phaseStep})
수정 시도: {executionState.fixAttempt}회
완료 Phase: {executionState.completedPhases.length}개
시작: {executionState.startedAt}
{pendingEscalation이 있으면: "에스컬레이션 대기 중"}
{브랜치가 있으면: "브랜치: {executionState.branchName}"}

```

phaseStep 한국어 매핑:
- execute-tasks → "작업 수행 중"
- materialize → "코드 생성 중"
- review → "검토 중"
- quality-gate → "품질 검증 중"
- fix → "수정 중"
- commit → "커밋 중"
- build-context → "다음 Phase 준비 중"

executionState가 없거나 status가 executing/reviewing이 아니면 이 섹션을 생략합니다.

비용: ${totalCostUsd} (입력: {inputTokens} / 출력: {outputTokens} 토큰)
```

비용/토큰 정보는 프로젝트에 메트릭스 데이터가 있을 때만 표시합니다.
메트릭스가 없으면 이 라인을 생략하세요.

### 실패 이력 (실행 중/완료 프로젝트만)

executionState.journal이 있으면 실패/에스컬레이션 이력을 요약합니다:

```
{formatFailureHistory(executionState.journal)}
```

실패가 없으면 이 섹션을 생략합니다.

## Step 3: 다음 단계 안내

현재 상태에 따라 적절한 다음 단계를 안내하세요:

| 상태        | 다음 단계                                                                                     |
| ----------- | --------------------------------------------------------------------------------------------- |
| `planning`  | `good-vibe:discuss` — 토론 계속, 또는 `good-vibe:approve` — 기획서 승인                       |
| `approved`  | `good-vibe:execute` — 작업 실행 시작                                                          |
| `executing` | 실행 진행 중. `good-vibe:execute` — 중단된 작업 재개                                          |
| `reviewing` | 리뷰 진행 중. `good-vibe:execute` — 중단된 작업 재개                                          |
| `completed` | `good-vibe:report` — 보고서, `good-vibe:feedback` — 팀 피드백, `good-vibe:modify` — 추가 수정 |
