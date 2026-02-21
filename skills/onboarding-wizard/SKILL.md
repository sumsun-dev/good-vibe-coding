# Onboarding Wizard

Claude Code 초기 설정을 대화형으로 진행하는 온보딩 마법사입니다.

## 트리거
- `/onboarding` 커맨드 실행 시 자동 활성화

## 플로우

### 1단계: 환경 감지
- OS, Claude Code 버전, 기존 설정 존재 여부를 확인합니다
- 기존 설정이 있으면 백업 여부를 묻습니다

### 2단계: 역할 선택
AskUserQuestion 도구를 사용합니다:

```
질문: "어떤 일을 주로 하시나요?"
header: "역할"
options:
  - label: "개발"
    description: "풀스택 / 프론트엔드 / 백엔드 / 데이터 엔지니어링"
  - label: "기획/관리"
    description: "PM / PO / 프로젝트 매니저"
  - label: "디자인"
    description: "UI/UX 디자이너 / 웹 퍼블리셔"
  - label: "리서치/분석"
    description: "UX 리서처 / 데이터 분석가 / 시장조사"
```

역할 → 프리셋 매핑:
- 개발 → `developer`
- 기획/관리 → `pm`
- 디자인 → `designer` (Phase 2)
- 리서치/분석 → `researcher` (Phase 2)

### 3단계: 세부 선택
역할에 따라 추가 질문을 합니다.

**개발자:**
```
질문: "주로 사용하는 기술 스택은?"
header: "스택"
options:
  - label: "Next.js + Supabase"
    description: "풀스택 웹 앱 개발"
  - label: "React + Node.js"
    description: "프론트엔드 + 백엔드 분리"
  - label: "Python + FastAPI"
    description: "백엔드 / API / 데이터"
```

**PM:**
```
질문: "주로 하는 업무는?"
header: "업무"
multiSelect: true
options:
  - label: "PRD/기획서 작성"
  - label: "이슈/티켓 관리"
  - label: "데이터 분석/리포트"
  - label: "회의록/문서 정리"
```

### 4단계: 워크플로우 선택
```
질문: "선호하는 워크플로우 스타일은?"
header: "워크플로우"
```

### 5단계: 설정 생성
- `config-generator` 스킬을 호출하여 파일 생성
- 생성된 파일 목록을 보여줌
- 다음 단계 안내 (/learn, /my-config)

## 중요 규칙
- 항상 한국어로 안내
- AskUserQuestion 도구를 사용하여 대화형 진행
- 사용자의 선택을 존중하고 강요하지 않기
- 에러 발생 시 친절하게 안내
