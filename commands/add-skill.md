# /add-skill - 스킬 추가

현재 역할에 맞는 추천 스킬을 보여주고 선택한 스킬을 추가합니다.

## 실행 방법
`/add-skill` 또는 `/add-skill [스킬명]`

## 진행 절차

### Step 1: 현재 역할 확인
`~/.claude/CLAUDE.md` 파일을 읽어 현재 설정된 역할을 확인합니다.

### Step 2: 역할별 추천 스킬 표시

AskUserQuestion 도구로 추천 스킬을 보여줍니다:

| 역할 | 추천 스킬 | 설명 |
|------|----------|------|
| 개발자 | `side-impact` | 코드 변경 전 영향 범위 분석 |
| 개발자 | `tdd-workflow` | TDD RED→GREEN→REFACTOR 가이드 |
| 개발자 | `verify` | build/lint/typecheck/test 검증 |
| 개발자 | `code-review` | 보안/성능/확장성 체크리스트 |
| PM | `prd-writer` | PRD 작성 도우미 |
| PM | `meeting-notes` | 회의록 정리 |
| PM | `issue-tracker` | 이슈 관리 자동화 |
| 디자이너 | `design-system` | 디자인 토큰/컴포넌트 관리 |
| 디자이너 | `css-helper` | CSS 작업 도우미 |
| 리서처 | `data-collector` | 데이터 수집/정리 |
| 리서처 | `report-writer` | 리포트 작성 도우미 |
| 콘텐츠 | `blog-writer` | 블로그 작성 도우미 |
| 콘텐츠 | `seo-checker` | SEO 최적화 검사 |
| 콘텐츠 | `content-calendar` | 콘텐츠 캘린더 관리 |
| 학생 | `beginner-guide` | 입문자 학습 가이드 |

이미 설치된 스킬은 ✅ 표시합니다.

### Step 3: 스킬 설치

사용자가 스킬을 선택하면:

1. 해당 스킬의 `SKILL.md` 파일을 `~/.claude/skills/[스킬명]/SKILL.md`에 복사합니다
2. `~/.claude/CLAUDE.md`의 Skills 섹션에 스킬을 추가합니다

```
✅ 스킬 "tdd-workflow"가 설치되었습니다!
   위치: ~/.claude/skills/tdd-workflow/SKILL.md

💡 사용법: 워크플로우 관련 질문을 하면 자동으로 활성화됩니다.
```

### Step 4: 완료 안내
```
설치된 스킬: [스킬명]
전체 스킬 목록: /my-config에서 확인
추가 설치: /add-skill을 다시 실행
```

## 에러 처리
- **역할 미설정**: "먼저 /onboarding으로 역할을 설정해주세요."
- **이미 설치된 스킬**: "이 스킬은 이미 설치되어 있습니다. ✅"
- **존재하지 않는 스킬**: "해당 스킬을 찾을 수 없습니다. 추천 스킬 목록을 확인해주세요."
- **파일 쓰기 실패**: "스킬 설치에 실패했습니다. 파일 권한을 확인해주세요."
