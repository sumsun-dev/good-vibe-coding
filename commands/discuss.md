# /discuss — 팀 토론

팀원들이 각자의 역할과 성격으로 프로젝트를 토론하고 기획서를 작성합니다.

## Step 1: 프로젝트 로드

가장 최근 프로젝트를 로드하세요:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js list-projects
```

프로젝트가 여러 개면 AskUserQuestion으로 선택하게 하세요.

## Step 2: 토론 프롬프트 생성

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js discussion-prompt --id {프로젝트ID} --round 1
```

## Step 3: 토론 실행

생성된 프롬프트에 따라 **각 팀원의 관점에서** 토론을 시뮬레이션하세요:

1. 각 팀원이 discussionPriority 순서대로 발언합니다
2. 각 팀원은 자신의 **이름, 이모지, 말투**로 발언합니다
3. 발언 형식: `{emoji} **{이름}** ({역할}): "{발언 내용}"`
4. 의견이 충돌하면 건설적으로 토론합니다
5. 마지막에 합의된 기획서를 작성합니다

## Step 4: 기획서 작성

토론 결과를 바탕으로 아래 형식의 기획서를 작성하세요:

```markdown
# 기획서: {프로젝트명}

## 프로젝트 개요
## 기술 스택
## 아키텍처
## 역할별 작업 분배
## 일정 (마일스톤)
## 리스크 및 대응
```

## Step 5: 기획서 저장

```bash
echo '{"id":"{프로젝트ID}","status":"planning"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status
```

기획서를 project.json에 저장하세요 (setProjectPlan CLI 호출).

## Step 6: 다음 단계 안내

```
기획서가 완성되었습니다!
- `/approve` — 기획서를 승인하고 작업 분배
- `/discuss` — 재토론 (다른 관점에서)
- `/status` — 현재 상태 확인
```
