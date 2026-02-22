# /status — 프로젝트 상태 확인

현재 프로젝트의 전체 상태를 대시보드 형태로 보여줍니다.

## Step 1: 프로젝트 로드

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js list-projects
```

프로젝트가 여러 개면 가장 최근 프로젝트를 표시합니다.

## Step 2: 상태 표시

아래 형식으로 대시보드를 출력하세요:

```
📊 프로젝트 상태: {이름}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 상태: {status}
🎯 모드: {mode}
📅 생성일: {createdAt}

👥 팀 ({N}명)
{각 팀원 emoji + 이름 + 역할}

📋 작업 현황
총 {N}개 | 완료: {N} | 진행중: {N} | 대기: {N}

{작업 목록 표}
```

## Step 3: 다음 단계 안내

현재 상태에 따라 적절한 다음 단계를 안내하세요:

- `planning` → `/discuss` (토론 시작/계속)
- `approved` → `/execute` (작업 실행) 또는 `/report` (보고서)
- `executing` → 진행 상황 표시
- `completed` → `/report`, `/feedback`
