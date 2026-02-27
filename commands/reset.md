# /reset - 설정 초기화

good-vibe-coding으로 생성된 설정을 초기화합니다.

## 실행 방법
`/reset`

## 진행 절차

### 1단계: 설정 스캔
`~/.claude/` 디렉토리를 직접 스캔하여 good-vibe-coding이 생성한 파일을 확인합니다.

```
📋 현재 설정 파일 목록

| # | 파일 | 카테고리 | 크기 |
|---|------|---------|------|
| 1 | CLAUDE.md | claude-md | 2.1KB |
| 2 | rules/core.md | rules | 1.5KB |
| 3 | agents/code-reviewer-kr.md | agents | 800B |
| 4 | agents/tdd-coach-kr.md | agents | 750B |

총 4개 파일
```

### 2단계: 초기화 방식 선택
AskUserQuestion으로 사용자에게 묻습니다:

- **전체 초기화**: 모든 설정 파일을 백업 후 삭제
- **선택적 초기화**: 파일 번호를 선택하여 일부만 삭제
- **내보내기 후 초기화**: 현재 설정을 JSON 파일로 저장한 뒤 전체 초기화
- **취소**: 아무 작업도 하지 않음

### 3단계: 선택적 초기화 (해당 시)
"선택적 초기화"를 선택하면 삭제할 파일 번호를 입력받습니다.

### 4단계: 초기화 실행
- 기본적으로 모든 파일을 `.backup` 접미사로 백업합니다.
- 백업 완료 후 원본 파일을 삭제합니다.

### 5단계: 결과 표시
```
✅ 초기화 완료

삭제된 파일:
  - CLAUDE.md (백업: CLAUDE.md.backup)
  - rules/core.md (백업: rules/core.md.backup)
  - agents/code-reviewer-kr.md (백업됨)
  - agents/tdd-coach-kr.md (백업됨)

💡 새로운 설정을 시작하려면 `/onboarding`을 실행하세요.
💡 이전 설정을 복원하려면 .backup 파일을 사용하세요.
```

## 주의사항
- 초기화 전 반드시 백업을 생성합니다 (기본 동작).
- `.backup` 파일은 수동으로 삭제해야 합니다.
- 이 커맨드는 `~/.claude/` 디렉토리만 대상으로 합니다.
