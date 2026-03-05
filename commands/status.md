# /status — 프로젝트 상태 확인

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
  /hello  → 프로젝트 인프라 셋업
  /new    → 스마트 프로젝트 시작
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

- `planning` → `/discuss` (토론 시작/계속)
- `approved` → `/execute` (작업 실행) 또는 `/report` (보고서)
- `executing` → 진행 상황 표시
- `reviewing` → 리뷰 진행 중, 완료 대기
- `completed` → `/report`, `/feedback`
