# /report — 최종 보고서 생성

프로젝트의 전체 보고서를 생성합니다.

## Step 1: 프로젝트 선택

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js list-projects
```

## Step 2: 보고서 생성

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js report --id {프로젝트ID}
```

## Step 3: 보고서 표시

생성된 보고서를 마크다운으로 표시하세요.
보고서에는 다음이 포함됩니다:
- 프로젝트 개요
- 팀원별 기여
- 기획서
- 작업 통계

## Step 4: 다음 단계

```
보고서가 생성되었습니다!
- `/feedback` — 팀원별 피드백 남기기
- `/projects` — 전체 프로젝트 목록
```
