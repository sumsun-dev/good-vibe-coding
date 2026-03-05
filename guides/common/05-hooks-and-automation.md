# 훅과 자동화

## 훅이란?

훅(Hook)은 특정 이벤트가 발생했을 때 자동으로 실행되는 작업입니다. 예를 들어, 파일을 편집할 때마다 자동으로 포맷팅하거나, 커밋 전에 자동으로 검사를 실행할 수 있습니다.

### 훅의 장점

- 반복 작업을 자동화하여 시간 절약
- 실수를 사전에 방지 (예: .env 커밋 차단)
- 일관된 코드 품질 유지

---

## 이벤트 유형

훅이 실행되는 시점(이벤트)은 다음과 같습니다:

| 이벤트         | 설명         | 예시                                |
| -------------- | ------------ | ----------------------------------- |
| `afterEdit`    | 파일 편집 후 | 포맷팅, 린트 검사, console.log 경고 |
| `beforeCommit` | 커밋 전      | .env 차단, 테스트 실행              |
| `afterWrite`   | 파일 생성 후 | 템플릿 검증, 인코딩 확인            |
| `onStop`       | 세션 종료 시 | 잔여 console.log 검사, 정리 작업    |

---

## 기본 훅 목록

Good Vibe Coding에서 제공하는 기본 훅입니다:

### 개발자용

| 훅                   | 이벤트       | 설명                          |
| -------------------- | ------------ | ----------------------------- |
| `consolelog_warning` | afterEdit    | console.log가 남아있으면 경고 |
| `prettier_format`    | afterEdit    | Prettier로 자동 포맷팅        |
| `env_commit_block`   | beforeCommit | .env 파일 커밋 차단           |

### PM / 기획자용

| 훅               | 이벤트    | 설명                      |
| ---------------- | --------- | ------------------------- |
| `doc_format`     | afterEdit | 마크다운 문서 포맷 검사   |
| `checklist_auto` | afterEdit | 체크리스트 포함 여부 확인 |

### 디자이너용

| 훅           | 이벤트    | 설명                       |
| ------------ | --------- | -------------------------- |
| `css_format` | afterEdit | 하드코딩된 CSS 색상값 감지 |

### 콘텐츠 크리에이터용

| 훅            | 이벤트    | 설명             |
| ------------- | --------- | ---------------- |
| `spell_check` | afterEdit | 맞춤법 검사 알림 |

---

## hooks.json 구조

훅은 `hooks/hooks.json` 파일에 정의됩니다:

```json
{
  "hooks": [
    {
      "id": "consolelog_warning",
      "name": "console.log 경고",
      "description": "파일 편집 후 console.log가 남아있으면 경고합니다",
      "event": "afterEdit",
      "roles": ["developer"],
      "command": "grep -n 'console.log' \"$FILE\" && echo '경고 메시지' || true"
    }
  ]
}
```

### 필드 설명

| 필드          | 설명                                   |
| ------------- | -------------------------------------- |
| `id`          | 훅의 고유 식별자                       |
| `name`        | 표시 이름 (한국어)                     |
| `description` | 훅의 기능 설명                         |
| `event`       | 실행 시점 (afterEdit, beforeCommit 등) |
| `roles`       | 적용 대상 역할                         |
| `command`     | 실행할 셸 명령어                       |

---

## 역할별 추천 훅

| 역할      | 추천 훅                                               | 이유                       |
| --------- | ----------------------------------------------------- | -------------------------- |
| 개발자    | consolelog_warning, prettier_format, env_commit_block | 코드 품질 + 보안           |
| PM/기획자 | doc_format, checklist_auto                            | 문서 일관성                |
| 디자이너  | css_format                                            | 디자인 토큰 일관성         |
| 콘텐츠    | spell_check                                           | 맞춤법 품질                |
| 리서처    | -                                                     | 기본 훅 없음 (커스텀 가능) |
| 학생      | -                                                     | 기본 훅 없음 (학습 집중)   |

---

## 훅 활성화/비활성화

### 온보딩 시 자동 설정

`/onboarding`을 통해 역할을 선택하면, 해당 역할에 맞는 훅이 자동으로 활성화됩니다.

### 수동 관리

`/my-config` 커맨드로 현재 활성화된 훅을 확인할 수 있습니다.

## 이전 가이드

- [에이전트 이해하기](./04-agents.md) → 전문 AI 도우미 활용법

## 다음 가이드

- [외부 서비스 연동](./06-integrations.md) → GitHub, Supabase, Vercel, n8n 연결
