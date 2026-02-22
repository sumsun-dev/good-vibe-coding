# 커맨드와 스킬 활용하기

## 커맨드란?

슬래시(/)로 시작하는 단축 명령어입니다. 자주 반복하는 작업을 한 번의 입력으로 실행합니다.

### 커맨드 목록

| 커맨드 | 설명 | 사용 예시 |
|--------|------|----------|
| `/onboarding` | 초기 설정 마법사 | 처음 시작할 때 |
| `/learn` | 학습 가이드 | `/learn 기초`, `/learn TDD` |
| `/my-config` | 현재 설정 확인 | 설정 상태 점검 |
| `/add-skill` | 스킬 추가 | 새로운 기능 추가 |
| `/add-agent` | 에이전트 추가 | 전문 도우미 추가 |
| `/preset` | 프리셋 적용 | 역할/스택 변경 |

### 커맨드 사용 방법

Claude Code 대화창에서 슬래시와 함께 입력합니다:

```
> /onboarding          # 온보딩 시작
> /learn 사용법        # 기본 사용법 가이드
> /add-skill tdd       # TDD 스킬 추가
```

---

## 스킬이란?

특정 작업의 절차와 규칙을 정의한 가이드입니다. 스킬이 활성화되면 Claude Code가 해당 절차에 따라 작업을 수행합니다.

### 스킬 목록

| 스킬 | 설명 | 활성화 방식 |
|------|------|------------|
| `onboarding-wizard` | 대화형 온보딩 진행 | `/onboarding` 시 자동 |
| `config-generator` | 설정 파일 생성 | 온보딩 완료 시 자동 |
| `korean-workflow` | 역할별 워크플로우 안내 | 워크플로우 질문 시 자동 |
| `beginner-guide` | 입문자 학습 가이드 | `/learn` 시 자동 |

### 스킬 활성화 방식

스킬은 두 가지 방식으로 활성화됩니다:

1. **자동 활성화**: 특정 키워드나 커맨드를 감지하면 자동으로 작동
   - 예: "워크플로우 보여줘" → `korean-workflow` 자동 활성화
2. **수동 활성화**: `/add-skill`로 설치 후 명시적으로 호출
   - 예: `/add-skill tdd-workflow` → TDD 스킬 설치

---

## 커맨드 vs 스킬 차이

| | 커맨드 | 스킬 |
|---|--------|------|
| 실행 방법 | `/이름`으로 직접 실행 | 자동 감지 또는 커맨드가 호출 |
| 역할 | 사용자의 입력 진입점 | 실제 작업 수행 로직 |
| 비유 | 리모컨 버튼 | 버튼을 눌렀을 때 동작하는 프로그램 |
| 파일 위치 | `commands/*.md` | `skills/*/SKILL.md` |

---

## 역할별 추천

| 역할 | 추천 커맨드 | 추천 스킬 |
|------|-----------|----------|
| 개발자 | `/add-skill`, `/add-agent` | tdd-workflow, code-review, side-impact |
| PM/기획자 | `/preset`, `/learn` | prd-writer, issue-tracker |
| 디자이너 | `/add-agent`, `/learn` | design-system, css-helper |
| 리서처 | `/learn`, `/preset` | data-collector, report-writer |
| 콘텐츠 | `/add-skill`, `/learn` | blog-writer, seo-checker |
| 학생 | `/learn`, `/onboarding` | beginner-guide |

## 다음 단계
- [에이전트 이해하기](./04-agents.md) → 전문 AI 도우미 활용법
