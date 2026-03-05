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
  - label: "콘텐츠/마케팅"
    description: "블로거 / 마케터 / 카피라이터"
  - label: "학습"
    description: "학생 / 입문자 / 직무전환자"
```

역할 → 프리셋 매핑:

- 개발 → `developer`
- 기획/관리 → `pm`
- 디자인 → `designer`
- 리서치/분석 → `researcher`
- 콘텐츠/마케팅 → `content-creator`
- 학습 → `student`

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

**디자이너:**

```
질문: "주요 작업 영역은?"
header: "영역"
options:
  - label: "UI/UX 디자인"
    description: "화면 설계, 프로토타이핑"
  - label: "웹 퍼블리싱"
    description: "HTML/CSS 마크업, 반응형"
  - label: "디자인 시스템"
    description: "토큰, 컴포넌트 라이브러리"
  - label: "접근성 검수"
    description: "WCAG, 스크린리더 테스트"
```

**리서처:**

```
질문: "주요 리서치 영역은?"
header: "영역"
options:
  - label: "UX 리서치"
    description: "사용자 인터뷰, 설문, 사용성 테스트"
  - label: "데이터 분석"
    description: "정량 분석, 통계, 시각화"
  - label: "시장 조사"
    description: "경쟁사 분석, 트렌드 리서치"
  - label: "학술 연구"
    description: "논문 리뷰, 실험 설계"
```

**콘텐츠/마케팅:**

```
질문: "주로 작성하는 콘텐츠는?"
header: "콘텐츠"
options:
  - label: "블로그/기술 문서"
    description: "기술 블로그, 가이드, 튜토리얼"
  - label: "SNS 콘텐츠"
    description: "트위터, 인스타그램, 링크드인"
  - label: "뉴스레터"
    description: "정기 이메일 뉴스레터"
  - label: "광고 카피"
    description: "광고 문구, 랜딩페이지"
```

**학습:**

```
질문: "현재 학습 단계는?"
header: "단계"
options:
  - label: "프로그래밍 입문"
    description: "처음 코딩을 배우는 단계"
  - label: "특정 기술 학습"
    description: "새로운 프레임워크/언어 배우기"
  - label: "프로젝트 실습"
    description: "배운 것을 프로젝트로 만들기"
  - label: "직무 전환"
    description: "비개발 → 개발 전환 준비"
```

### 4단계: 워크플로우 선택

```
질문: "선호하는 워크플로우 스타일은?"
header: "워크플로우"
```

### 4A단계: 팀원 스타일 선택

역할 프리셋의 에이전트 목록에 대해 각각 성격 변형을 선택합니다.

**진행:**

1. `personality-builder`의 `getPersonalityVariants(agentName)`로 변형 조회
2. AskUserQuestion으로 스타일 선택 (기본값 + 스킵 옵션 포함)
3. 선택 결과를 `choices.personalities` 객체에 저장

**예시 (code-reviewer-kr):**

```
질문: "코드 리뷰어의 스타일을 선택해 주세요"
header: "리뷰 스타일"
options:
  - label: "꼼꼼한 검토자 (Recommended)"
    description: "세심하게 체크하고 개선점을 정확히 제시합니다"
  - label: "친절한 멘토"
    description: "좋은 점을 먼저 짚고, 개선점을 부드럽게 제안합니다"
  - label: "기본 스타일로 진행"
    description: "기본값을 사용합니다"
```

**완료 시 팀 소개 출력:**

```
당신의 팀이 구성되었습니다!

  준영 (꼼꼼한 검토자) — 코드 리뷰어
  하윤 (엄격한 코치) — TDD 코치
```

### 5단계: 설정 생성

- `project-setup` 스킬을 호출하여 파일 생성
- 생성된 파일 목록을 보여줌
- 다음 단계 안내 (/learn, /my-config, /add-skill, /add-agent)

## 중요 규칙

- 항상 한국어로 안내
- AskUserQuestion 도구를 사용하여 대화형 진행
- 사용자의 선택을 존중하고 강요하지 않기
- 에러 발생 시 친절하게 안내
