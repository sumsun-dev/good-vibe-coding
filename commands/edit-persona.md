# /edit-persona — 페르소나 빠른 수정

기존 페르소나의 특정 필드를 빠르게 수정합니다.

## 사용법

```
/edit-persona <roleId> <variantId>    # 커스텀 변형 수정
/edit-persona override <roleId> <variantId>  # 내장 변형 오버라이드
/edit-persona remove-override <roleId> <variantId>  # 오버라이드 제거
```

## 동작

### 커스텀 변형 수정

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js get-custom-variants --role <roleId>
```

현재 변형 정보를 보여주고, 수정할 필드를 물어보세요:

```
🎭 변형 수정: {variant.name} ({roleId}/{variantId})
━━━━━━━━━━━━━━━━━━━━━━

현재 값:
- 이름: {name}
- 성격: {trait}
- 설명: {description}
- 말투: {speakingStyle}
- 인사말: {greeting}

수정할 필드를 선택하세요 (콤마로 다중 선택):
```

수정할 값을 받은 후:

```bash
echo '{"roleId":"...", "variantId":"...", "patch":{...}}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-custom-variant
```

### 내장 변형 오버라이드

내장 페르소나의 원본을 보존하면서 특정 필드만 수정합니다:

```bash
echo '{"roleId":"cto", "variantId":"visionary", "patch":{"trait":"수정됨"}}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js set-override
```

수정 전 현재 값과 원본 값을 함께 보여주세요.

### 오버라이드 제거

```bash
echo '{"roleId":"cto", "variantId":"visionary"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js remove-override
```

원본으로 복원됨을 안내하세요.

### 현재 오버라이드 목록 확인

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js get-overrides
```

## 팁

- 오버라이드는 원본 JSON을 수정하지 않습니다 (별도 파일로 관리)
- 오버라이드를 제거하면 즉시 원본으로 복원됩니다
- 커스텀 변형은 직접 수정되지만, 내장 변형은 오버라이드 방식으로만 수정 가능합니다
