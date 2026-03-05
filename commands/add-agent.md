# /add-agent - 에이전트 추가

추천 카탈로그에서 에이전트를 검색하고 선택한 에이전트를 설치합니다.

## 실행 방법
`/add-agent` 또는 `/add-agent [에이전트명]`

## 진행 절차

### Step 1: 설치 현황 조회

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js list-installed
```

### Step 2: 카탈로그에서 에이전트 목록 표시

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js recommendation-catalog
```

응답의 `agents` 배열을 AskUserQuestion으로 보여줍니다.
이미 설치된 에이전트는 [설치됨] 표시합니다.

직접 에이전트명이 지정된 경우 (`/add-agent code-reviewer-kr`), 해당 에이전트를 바로 Step 3으로 진행합니다.

### Step 3: 에이전트 설치

사용자가 에이전트를 선택하면:

```bash
echo '{"items":["선택된에이전트id"]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js install-setup
```

설치 결과의 `formatted` 필드를 표시합니다.

### Step 4: 완료 안내
```
설치된 에이전트: [에이전트명]
전체 에이전트 목록: /my-config에서 확인
추가 설치: /add-agent를 다시 실행
```

## 에러 처리
- **이미 설치된 에이전트**: "이 에이전트는 이미 설치되어 있습니다."
- **존재하지 않는 에이전트**: "해당 에이전트를 찾을 수 없습니다. 카탈로그를 확인해주세요."
- **파일 쓰기 실패**: "에이전트 설치에 실패했습니다. 파일 권한을 확인해주세요."
