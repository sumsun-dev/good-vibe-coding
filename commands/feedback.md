# /feedback — 팀원 피드백

프로젝트 팀원에 대한 피드백을 남기고, 팀원의 성장에 기여합니다.

## Step 1: 프로젝트 선택

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js list-projects
```

## Step 2: 팀원별 피드백

각 팀원에 대해 AskUserQuestion으로 피드백을 수집하세요:

1. 평점 (1-5): "이 팀원의 기여도를 평가해주세요"
   - 1: 부족, 2: 미흡, 3: 보통, 4: 좋음, 5: 훌륭함
2. 코멘트: "구체적인 피드백을 남겨주세요" (자유 입력)

각 피드백을 저장:

```bash
echo '{"projectId":"{id}","roleId":"{role}","rating":{N},"comment":"..."}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js add-feedback
```

## Step 3: 팀 통계 표시

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js team-stats
```

역할별 누적 통계를 보여주세요:

```
📊 팀 성과 통계
━━━━━━━━━━━━━━━
| 역할 | 평균 평점 | 프로젝트 수 |
|------|----------|------------|
```

## Step 4: 안내

```
피드백이 저장되었습니다!
다음 프로젝트에서 이 피드백이 팀원 역량 향상에 반영됩니다.
- `/new-project` — 새 프로젝트 시작
- `/projects` — 프로젝트 목록
```
