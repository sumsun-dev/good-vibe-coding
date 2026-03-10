# 커맨드와 스킬

## 커맨드

플러그인 접두사로 시작하는 명령어입니다. Claude Code 대화창에 `good-vibe:new`처럼 입력하면 실행됩니다.

### 기본 플로우 (7개)

프로젝트 하나를 처음부터 끝까지 만드는 순서입니다.

```
good-vibe:hello → good-vibe:new → good-vibe:discuss → good-vibe:approve → good-vibe:execute → good-vibe:report → good-vibe:modify
```

| 커맨드              | 뭘 하나요?                                     | 언제?                |
| ------------------- | ---------------------------------------------- | -------------------- |
| `good-vibe:hello`   | 환경 설정 + 개인 설정 (도구 확인, CLAUDE.md)   | 맨 처음              |
| `good-vibe:new`     | 아이디어 입력, 복잡도 분석, 팀 자동 구성       | good-vibe:hello 후   |
| `good-vibe:discuss` | 팀원들이 토론해서 기획서 작성                  | good-vibe:new 후     |
| `good-vibe:approve` | 기획서 확인하고 승인하거나 수정 요청           | good-vibe:discuss 후 |
| `good-vibe:execute` | 팀원들이 작업하고 서로 리뷰, 문제 시 자동 수정 | good-vibe:approve 후 |
| `good-vibe:report`  | 전체 과정 정리 보고서                          | good-vibe:execute 후 |
| `good-vibe:modify`  | 완료된 프로젝트 기능 추가/수정                 | good-vibe:report 후  |

### 관리 커맨드

| 커맨드               | 뭘 하나요?                 | 예시                                          |
| -------------------- | -------------------------- | --------------------------------------------- |
| `good-vibe:status`   | 프로젝트 현황 확인         | 진행 상황 궁금할 때                           |
| `good-vibe:feedback` | 팀원 성과 분석 + 개선 제안 | 프로젝트 끝난 후                              |
| `good-vibe:my-team`  | 팀 구성 + 역할 카탈로그    | 팀원 정보 확인                                |
| `good-vibe:learn`    | 학습 가이드                | `good-vibe:learn 기초`, `good-vibe:learn TDD` |

### 고급 커맨드

| 커맨드                  | 뭘 하나요?                               | 예시                    |
| ----------------------- | ---------------------------------------- | ----------------------- |
| `good-vibe:new-project` | 수동 프로젝트 생성 (타입/모드 직접 선택) | 세부 설정이 필요할 때   |
| `good-vibe:my-config`   | 현재 설정 확인                           | 설정 점검               |
| `good-vibe:scaffold`    | 프로젝트 템플릿으로 코드 생성            | 초기 코드 빠르게 만들기 |
| `good-vibe:add-skill`   | 스킬 추가 설치                           | 새 기능 추가            |
| `good-vibe:add-agent`   | 에이전트 추가 설치                       | 전문 도우미 추가        |
| `good-vibe:preset`      | 프리셋 적용                              | 역할/스택 변경          |
| `good-vibe:projects`    | 전체 프로젝트 목록                       | 여러 프로젝트 관리 시   |
| `good-vibe:reset`       | 설정 초기화                              | 초기 상태로 복원        |
| `good-vibe:eval`        | 접근법 A/B 비교                          | 어떤 방식이 나은지 평가 |

### 커맨드 입력 방법

Claude Code 대화창에서 슬래시와 함께 입력합니다:

```
> good-vibe:new                 # 새 프로젝트 시작 (추천)
> good-vibe:learn 사용법        # 기본 사용법 가이드
> good-vibe:hello                # 환경 + 개인 설정
```

---

## 스킬

스킬은 특정 작업의 절차와 규칙을 정의한 가이드입니다.
커맨드가 "리모컨 버튼"이라면, 스킬은 "버튼을 누르면 실행되는 프로그램"입니다.

### 내장 스킬

| 스킬                | 뭘 하나요?                     | 언제 켜지나요?                   |
| ------------------- | ------------------------------ | -------------------------------- |
| `onboarding-wizard` | 대화형 온보딩 진행             | `good-vibe:hello` 입력 시        |
| `project-setup`     | 프로젝트 폴더/파일 생성        | `good-vibe:new` 입력 시          |
| `multi-review`      | 멀티 AI 리뷰 설정 및 결과 검증 | `good-vibe:execute` 실행 시      |
| `korean-workflow`   | 역할별 워크플로우 안내         | "워크플로우 보여줘" 같은 질문 시 |
| `beginner-guide`    | 입문자 학습 가이드             | `good-vibe:learn` 입력 시        |

### 스킬이 켜지는 두 가지 방식

1. 자동: 특정 키워드나 커맨드를 인식하면 알아서 작동
   - 예: "워크플로우 보여줘" → `korean-workflow` 자동 활성화
2. 수동: `good-vibe:add-skill`로 설치한 뒤 직접 호출
   - 예: `good-vibe:add-skill beginner-guide` → 입문자 가이드 스킬 설치

---

## 커맨드 vs 스킬

|           | 커맨드                | 스킬                         |
| --------- | --------------------- | ---------------------------- |
| 실행 방법 | `/이름`으로 직접 입력 | 자동 감지 또는 커맨드가 호출 |
| 역할      | 사용자 입력 진입점    | 실제 작업 로직               |
| 파일 위치 | `commands/*.md`       | `skills/*/SKILL.md`          |

---

## 역할별 추천 조합

| 역할      | 추천 커맨드                                  | 추천 에이전트/스킬                 |
| --------- | -------------------------------------------- | ---------------------------------- |
| 개발자    | `good-vibe:add-agent`, `good-vibe:add-skill` | tdd-coach-kr, code-reviewer-kr     |
| PM/기획자 | `good-vibe:preset`, `good-vibe:learn`        | korean-workflow, doc-reviewer-kr   |
| 디자이너  | `good-vibe:add-agent`, `good-vibe:learn`     | accessibility-checker, mentor-kr   |
| 리서처    | `good-vibe:learn`, `good-vibe:preset`        | data-analyst-kr, content-editor-kr |
| 학생      | `good-vibe:learn`, `good-vibe:hello`         | beginner-guide, mentor-kr          |

---

다음: [에이전트 이해하기](./04-agents.md)
