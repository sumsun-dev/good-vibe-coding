# /add-skill - 스킬 추가

추천 카탈로그에서 스킬을 검색하고 선택한 스킬을 설치합니다.

## 실행 방법
`/add-skill` 또는 `/add-skill [스킬명]`

## 진행 절차

### Step 1: 설치 현황 조회

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js list-installed
```

### Step 2: 카탈로그에서 스킬 목록 표시

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js recommendation-catalog
```

응답의 `skills` 배열을 AskUserQuestion으로 보여줍니다.
이미 설치된 스킬은 [설치됨] 표시합니다.

직접 스킬명이 지정된 경우 (`/add-skill project-setup`), 해당 스킬을 바로 Step 3으로 진행합니다.

### Step 3: 스킬 설치

사용자가 스킬을 선택하면:

```bash
echo '{"items":["선택된스킬id"]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js install-setup
```

설치 결과의 `formatted` 필드를 표시합니다.

### Step 4: 완료 안내
```
설치된 스킬: [스킬명]
전체 스킬 목록: /my-config에서 확인
추가 설치: /add-skill을 다시 실행
```

## 에러 처리
- **이미 설치된 스킬**: "이 스킬은 이미 설치되어 있습니다."
- **존재하지 않는 스킬**: "해당 스킬을 찾을 수 없습니다. 카탈로그를 확인해주세요."
- **파일 쓰기 실패**: "스킬 설치에 실패했습니다. 파일 권한을 확인해주세요."
