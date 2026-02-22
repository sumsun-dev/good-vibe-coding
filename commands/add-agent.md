# /add-agent - 에이전트 추가

현재 역할에 맞는 추천 에이전트를 보여주고 선택한 에이전트를 추가합니다.

## 실행 방법
`/add-agent` 또는 `/add-agent [에이전트명]`

## 진행 절차

### Step 1: 현재 역할 확인
`~/.claude/CLAUDE.md` 파일을 읽어 현재 설정된 역할을 확인합니다.

### Step 2: 역할별 추천 에이전트 표시

AskUserQuestion 도구로 추천 에이전트를 보여줍니다:

| 역할 | 에이전트 | 모델 | 설명 |
|------|---------|------|------|
| 공통 | `onboarding-guide` | sonnet | 온보딩 마법사 진행자 |
| 개발자 | `code-reviewer-kr` | sonnet | 한국어 코드 리뷰어 |
| 개발자 | `tdd-coach-kr` | haiku | TDD 코치 |
| PM | `doc-reviewer-kr` | sonnet | 문서 검토기 |
| 디자이너 | `accessibility-checker` | haiku | 접근성 검사 |
| 리서처 | `data-analyst-kr` | sonnet | 데이터 분석 도우미 |
| 콘텐츠 | `content-editor-kr` | sonnet | 글 편집기 |
| 학생 | `mentor-kr` | haiku | 학습 멘토 |

이미 설치된 에이전트는 ✅ 표시합니다.

### Step 3: 에이전트 설치

사용자가 에이전트를 선택하면:

1. 해당 에이전트의 `.md` 파일을 `~/.claude/agents/[에이전트명].md`에 복사합니다
2. `~/.claude/CLAUDE.md`의 Agents 섹션에 에이전트를 추가합니다

```
✅ 에이전트 "code-reviewer-kr"가 설치되었습니다!
   위치: ~/.claude/agents/code-reviewer-kr.md
   모델: sonnet

💡 사용법: "코드를 리뷰해줘"라고 요청하면 자동으로 활성화됩니다.
   또는 @code-reviewer-kr로 직접 호출할 수 있습니다.
```

### Step 4: 완료 안내
```
설치된 에이전트: [에이전트명] (모델)
전체 에이전트 목록: /my-config에서 확인
추가 설치: /add-agent를 다시 실행
```

## 에러 처리
- **역할 미설정**: "먼저 /onboarding으로 역할을 설정해주세요."
- **이미 설치된 에이전트**: "이 에이전트는 이미 설치되어 있습니다. ✅"
- **존재하지 않는 에이전트**: "해당 에이전트를 찾을 수 없습니다. 추천 목록을 확인해주세요."
- **파일 쓰기 실패**: "에이전트 설치에 실패했습니다. 파일 권한을 확인해주세요."
