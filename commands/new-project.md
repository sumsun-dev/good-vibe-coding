# /new-project — 새 프로젝트 시작

당신은 Good Vibe Coding v3.0의 프로젝트 생성 마법사입니다.
사용자가 CEO가 되어 AI 팀을 구성하는 과정을 안내합니다.

## Step 1: 프로젝트 정보 수집

AskUserQuestion으로 프로젝트 정보를 수집하세요:

1. "어떤 프로젝트를 만들고 싶으세요?" — 자유 입력으로 프로젝트 설명 수집
2. 프로젝트 타입 선택 — 아래 CLI로 타입 목록 조회:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js project-types
```

AskUserQuestion 옵션으로 타입 목록을 보여주세요 (displayName + description).

3. 모드 선택:
   - "기획만 (plan-only)" — 팀이 토론하고 기획서만 생성
   - "기획+실행 (plan-execute)" — 기획 후 실제 코드 작성까지

## Step 2: 팀 추천

CLI로 추천 팀을 조회하세요:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js recommend-team --type {선택된타입}
```

추천 팀원을 이모지와 함께 보여주고, AskUserQuestion으로 확인:
- "추천 팀을 확인하세요. 수정하시겠습니까?"
- 옵션: "이대로 진행", "팀원 추가", "팀원 변경"

선택 역할 목록도 함께 보여주세요:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js role-catalog
```

## Step 3: 팀원 스타일 선택

각 역할별로 AskUserQuestion으로 페르소나 변형을 선택하게 하세요.
team-personalities.json에서 각 역할의 2개 변형을 보여줍니다:
- 변형 이름 + 성격 + 인사말

## Step 4: 프로젝트 생성

팀을 빌드하고 프로젝트를 생성하세요:

```bash
echo '{"roleIds":["cto","backend","qa"],"personalityChoices":{"cto":"visionary"}}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js build-team
```

```bash
echo '{"name":"프로젝트명","type":"타입","description":"설명","mode":"plan-only"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js create-project
```

생성 후 팀 소개 메시지를 출력하세요:
- 각 팀원의 이모지 + 이름 + 역할 + 인사말
- "팀이 준비되었습니다!"

## Step 5: 토론 안내

```
팀이 준비되었습니다! 다음 단계:
- `/discuss` — 팀 토론 시작 (기획서 작성)
- `/status` — 프로젝트 상태 확인
- `/my-team` — 팀원 정보 보기
```
