# /execute — 작업 실행

plan-execute 모드에서 분배된 작업을 팀원(에이전트)에게 위임하여 실행합니다.

## Step 1: 프로젝트 로드

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js list-projects
```

approved 상태인 프로젝트를 선택합니다.

## Step 2: 상태 변경

```bash
echo '{"id":"{프로젝트ID}","status":"executing"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status
```

## Step 3: 실행 계획 표시

프로젝트의 tasks를 phase별로 그룹핑하여 보여주세요:

```
Phase 1:
  - [task-1] 아키텍처 설계 → 민준 (CTO) 🏗️
  - [task-2] API 설계 → 도윤 (Backend) 🔧

Phase 2:
  - [task-3] 테스트 작성 → 지민 (QA) 🧪
```

## Step 4: Phase별 실행

각 phase를 순서대로 실행합니다.
같은 phase의 작업은 순차적으로 실행하세요.

각 작업 실행 시:
1. 해당 팀원의 에이전트(team-{roleId})를 Task 도구로 호출
2. 작업 내용과 팀원 페르소나를 전달
3. 결과를 프로젝트에 저장

```
{emoji} {이름}이(가) "{작업제목}" 작업을 수행 중입니다...
```

## Step 5: 완료

모든 작업이 완료되면:

```bash
echo '{"id":"{프로젝트ID}","status":"completed"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status
```

## Step 6: 다음 단계

```
모든 작업이 완료되었습니다!
- `/report` — 최종 보고서 생성
- `/feedback` — 팀원 피드백
- `/status` — 최종 상태 확인
```
