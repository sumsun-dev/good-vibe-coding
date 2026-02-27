# /feedback — 에이전트 피드백 (프로젝트 결과 기반)

## 이 커맨드를 실행하면?

프로젝트 결과를 분석하여 각 팀원의 성과를 평가하고, 개선 제안을 만듭니다.
승인한 제안은 다음 프로젝트부터 자동 적용됩니다.

- **소요시간:** 2-5분
- **결과물:** 팀원별 개선 제안 + 오버라이드 저장
- **선택사항:** 이 단계는 건너뛸 수 있습니다

---

프로젝트 결과를 분석하여 에이전트 .md 수정안을 자동 제안하고, 승인된 수정을 오버라이드 파일로 저장합니다.

## Step 1: completed 프로젝트 선택

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js list-projects
```

completed 상태인 프로젝트 목록을 사용자에게 보여주고 선택하게 하세요.
AskUserQuestion으로 프로젝트를 선택합니다.

## Step 2: 프로젝트 결과 수집

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js get-project --id {프로젝트ID}
```

## Step 3: 팀원별 성과 추출

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js extract-performance --id {프로젝트ID}
```

결과: 각 역할의 tasks, reviews, issues 데이터

## Step 4: 각 에이전트에 대해 수정 제안 생성

각 팀원에 대해 **병렬로** 다음을 수행합니다:

1. 현재 .md 읽기 (agents/team-{roleId}.md)
2. 기존 오버라이드 확인:
   ```bash
   node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js load-agent-override --role {roleId}
   ```
3. 수정 제안 프롬프트 생성:
   ```bash
   echo '{"roleId":"{roleId}","performance":{성과데이터},"agentMd":"..."}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js improvement-prompt
   ```
4. 생성된 프롬프트를 **Task tool**로 실행 (분석 에이전트 호출)
5. 분석 결과 파싱:
   ```bash
   echo '{"analysisText":"..."}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js parse-suggestions
   ```

이슈가 없는 에이전트는 건너뛰세요.

## Step 5: 사용자에게 제안 표시 + 승인/거절

각 제안에 대해 AskUserQuestion으로 승인/거절/수정을 받습니다:

```
📝 {roleId} 에이전트 수정 제안

섹션: {section}
현재: {current}
제안: {suggested}
이유: {reason}

이 수정을 적용할까요?
```

옵션: 승인 / 거절 / 수정 (사용자가 내용 수정)

## Step 6: 승인된 수정을 오버라이드로 저장

승인된 제안을 마크다운으로 구성하여 저장:

```bash
echo '{"roleId":"{roleId}","content":"# 오버라이드\n- 수정사항..."}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js save-agent-override
```

저장 경로: `~/.claude/good-vibe/agent-overrides/{roleId}.md`

## Step 7: 안내

```
에이전트 피드백이 저장되었습니다!
다음 프로젝트부터 수정된 에이전트 설정이 적용됩니다.

저장된 오버라이드:
- {roleId}: {수정 요약}

관련 커맨드:
- `/new` — 새 프로젝트 시작
- `/status` — 프로젝트 상태 확인
```
