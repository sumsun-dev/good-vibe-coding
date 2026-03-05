# /preset - 프리셋 적용

사전 정의된 프리셋을 일괄 적용합니다.

## 실행 방법

`/preset` 또는 `/preset [프리셋명]`

## 진행 절차

### Step 1: 카테고리 선택

AskUserQuestion 도구를 사용합니다:

```
질문: "어떤 종류의 프리셋을 적용하시겠어요?"
header: "카테고리"
options:
  - label: "역할 (Roles)"
    description: "개발자, PM, 디자이너, 리서처, 콘텐츠 크리에이터, 학생"
  - label: "기술 스택 (Stacks)"
    description: "Next.js + Supabase, React + Node.js 등"
```

### Step 2: 프리셋 목록 표시

선택한 카테고리의 프리셋을 `listPresets()` 함수로 조회하여 보여줍니다.

**역할 프리셋:**
| 프리셋 | 이름 | 설명 |
|--------|------|------|
| `developer` | 개발자 | 풀스택/프론트/백엔드 개발 |
| `pm` | PM / 기획자 | 프로젝트 관리, 기획 |
| `designer` | 디자이너 | UI/UX, 웹 퍼블리싱 |
| `researcher` | 리서처 / 분석가 | 데이터 분석, 리서치 |
| `content-creator` | 콘텐츠 크리에이터 | 블로그, SNS, 마케팅 |
| `student` | 학생 / 입문자 | 프로그래밍 학습 |

**스택 프리셋:**
| 프리셋 | 이름 | 설명 |
|--------|------|------|
| `nextjs-supabase` | Next.js + Supabase | 풀스택 웹 앱 개발 |
| `react-node` | React + Node.js | 프론트/백엔드 분리 |

### Step 3: 변경 사항 미리보기

선택한 프리셋과 현재 설정의 차이점을 보여줍니다:

```
변경 사항 미리보기:

현재 역할: 개발자
적용할 스택: Next.js + Supabase

추가되는 항목:
  + Stack Rules: 8개 규칙
    - Next.js App Router 사용
    - Supabase RLS 정책 필수
    - ...

변경되는 파일:
  ~/.claude/CLAUDE.md
  ~/.claude/rules/core.md
```

### Step 4: 적용 확인

AskUserQuestion 도구로 확인합니다:

```
질문: "이 프리셋을 적용하시겠어요?"
header: "확인"
options:
  - label: "적용 (Recommended)"
    description: "위 변경 사항을 적용합니다"
  - label: "취소"
    description: "변경하지 않고 돌아갑니다"
```

### Step 5: 프리셋 적용

확인 후 설정 파일을 직접 재생성합니다 (CLAUDE.md, rules 등).

완료 메시지:

```
프리셋이 적용되었습니다!

적용된 프리셋: Next.js + Supabase
변경된 파일:
  ~/.claude/CLAUDE.md
  ~/.claude/rules/core.md

/my-config로 현재 설정을 확인할 수 있습니다.
```

## 에러 처리

- **프리셋 없음**: "해당 프리셋을 찾을 수 없습니다. `/preset`으로 목록을 확인해주세요."
- **파일 쓰기 실패**: "프리셋 적용에 실패했습니다. 기존 설정은 백업되어 있습니다."
- **취소**: "프리셋 적용이 취소되었습니다."
