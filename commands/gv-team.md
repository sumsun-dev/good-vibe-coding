---
description: '활성 프로젝트의 팀 구성을 보거나 편집 (v2 보조 슬래시)'
---

# /gv:team — 팀 구성 조회/편집

활성 프로젝트의 AI 팀 구성(15개 역할 중 선정된 3-8명)과 각 역할의 담당 영역을 표시합니다.

- **소요시간:** 즉시
- **결과물:** 팀 멤버 목록 + 모델 분포 + 도메인 매트릭스

## 실행 흐름

### Step 1: 활성 프로젝트 ID 확인

세션 컨텍스트에 이미 알고 있다면 그 값을 사용. 모르면 다음 명령으로 가장 최근 프로젝트를 조회:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" list-projects
```

### Step 2: 팀 정보 조회

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/cli.js" team-summary --id <projectId>
```

### Step 3: 결과 표시

CEO에게:

1. **팀 멤버**: roleId, name, model(opus/sonnet/haiku), priority
2. **모델 분포**: 각 모델별 멤버 수 (비용 가시성)
3. **편집 옵션 안내** (자연어 진입):
   - 새 역할 추가: `/gv "Frontend 개발자 추가해줘"` 또는 `/gv "Security 전문가 합류시켜줘"`
   - 역할 제거/변경: `/gv "QA 빼고 Tech Writer로 교체"`

추가 가공/LLM 호출 금지.
