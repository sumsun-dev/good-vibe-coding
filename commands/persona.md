# /persona — 커스텀 페르소나 관리

커스텀 역할과 페르소나 변형을 생성/수정/삭제합니다.

## 사용법

```
/persona                    # 현재 커스텀 페르소나 목록
/persona create-role        # 새 역할 생성 마법사
/persona create-variant     # 새 변형 생성 마법사
/persona delete-role <id>   # 역할 삭제
```

## 동작

### Step 1: 현재 커스텀 페르소나 조회

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js list-custom-roles
```

커스텀 역할이 있으면 보여주세요:

```
🎭 커스텀 페르소나 현황
━━━━━━━━━━━━━━━━━━━━━━

📌 커스텀 역할 ({n}개)
  {emoji} {displayName} ({id}) — {description}
    변형: {variant1.name}, {variant2.name}

📌 내장 역할에 추가된 변형
  🏗️ CTO에 추가: {variant.name}
  🔧 Backend에 추가: {variant.name}

📌 오버라이드
  🏗️ CTO / 비전가: trait 수정됨
```

### Step 2-A: 역할 생성 마법사

사용자에게 다음을 순서대로 질문하세요:

1. **역할 ID**: kebab-case (예: `ai-engineer`)
2. **표시 이름**: (예: `AI Engineer`)
3. **이모지**: (예: `🤖`)
4. **카테고리**: `leadership`, `engineering`, `design`, `support` 중 선택
5. **설명**: 역할 설명 (한국어)
6. **기본 도구**: 콤마로 구분 (예: `Read, Grep, Glob, Bash`)
7. **모델**: `sonnet`, `haiku`, `opus` 중 선택
8. **토론 우선순위**: 1-10 숫자
9. **스킬**: 콤마로 구분 (예: `llm, rag, prompt-engineering`)

수집 후 CLI로 생성:

```bash
echo '{"id":"ai-engineer","displayName":"AI Engineer",...}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js create-custom-role
```

생성 후 자동으로 변형 생성 마법사로 이동하세요.

### Step 2-B: 변형 생성 마법사

1. **역할 선택**: 커스텀 역할 또는 내장 역할 ID
2. **변형 ID**: kebab-case (예: `creative-ai`)
3. **변형 이름**: (예: `창의적 AI 빌더`)
4. **이모지**: (역할 이모지와 동일 권장)
5. **기본 이름**: 팀원 이름 (예: `재현`)
6. **성격 특성**: (예: `창의적이고 실험적인`)
7. **설명**: 변형 설명
8. **말투**: (예: `자유롭고 실험적인 스타일`)
9. **인사말**: (예: `AI로 새로운 걸 만들어봅시다!`)

```bash
echo '{"roleId":"ai-engineer","variant":{...}}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js add-custom-variant
```

### Step 3: 역할 삭제

```bash
echo '{"id":"ai-engineer"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js delete-custom-role
```

삭제 전 확인을 요청하세요: "역할과 연관된 모든 변형이 삭제됩니다. 계속하시겠습니까?"

## 팁

- 새 역할을 만든 후 `/new-project`에서 팀 구성 시 해당 역할을 선택할 수 있습니다
- 내장 역할에 변형을 추가하면 기존 변형은 유지되고 새 변형이 추가됩니다
- `/edit-persona`로 기존 페르소나의 특정 필드를 빠르게 수정할 수 있습니다
