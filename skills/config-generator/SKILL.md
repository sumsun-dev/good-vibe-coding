# Config Generator

사용자의 선택을 기반으로 Claude Code 설정 파일을 생성합니다.

## 트리거
- 온보딩 마법사의 마지막 단계에서 호출
- `/preset` 커맨드에서 호출

## 입력
온보딩에서 수집된 사용자 선택:
- `role`: 역할 (developer, pm, designer, researcher, content-creator, student)
- `tasks`: 선택한 업무 목록
- `stack`: 기술 스택 (개발자용, 선택)
- `workflowStyle`: 워크플로우 스타일
- `options`: 추가 옵션 (hooks, formatting 등)

## 처리 과정

### 1. 프리셋 로딩
```
scripts/lib/preset-loader.js의 loadPreset()을 사용하여
역할 프리셋을 로딩합니다.

스택 프리셋이 있으면 mergePresets()로 병합합니다.
```

### 2. 템플릿 렌더링
```
scripts/lib/template-engine.js의 renderTemplate()을 사용하여
Handlebars 템플릿을 데이터와 결합합니다.

렌더링 대상:
- templates/claude-md.hbs → ~/.claude/CLAUDE.md
- templates/rules/core.md.hbs → ~/.claude/rules/core.md
```

### 3. 파일 쓰기
```
scripts/lib/file-writer.js의 safeWriteFile()을 사용하여
기존 파일이 있으면 백업 후 생성합니다.
```

## 출력
생성된 파일 목록과 각 파일의 상태:
```
✅ ~/.claude/CLAUDE.md (새로 생성)
✅ ~/.claude/rules/core.md (새로 생성)
📦 ~/.claude/CLAUDE.md.backup (기존 파일 백업)
```

## 중요 규칙
- 기존 파일이 있으면 반드시 백업
- 파일 쓰기 전 사용자 확인 필수
- 에러 발생 시 롤백 안내
