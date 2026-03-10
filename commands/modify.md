---
description: '기존 프로젝트 수정 — 완료된 프로젝트에 기능 추가/변경/개선'
---

# good-vibe:modify — 프로젝트 수정

완료된 프로젝트에 기능을 추가하거나, 기존 기능을 수정합니다.
"알림 기능 추가해줘", "UI 변경해줘" 같이 자연스럽게 요청하면 됩니다.

---

## Step 1: 프로젝트 선택

completed 상태의 프로젝트를 조회합니다:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js list-projects
```

- completed 프로젝트가 **없으면**: "완료된 프로젝트가 없습니다. `good-vibe:new`로 새 프로젝트를 시작하세요." 안내 후 종료
- completed 프로젝트가 **1개면**: 자동 선택
- completed 프로젝트가 **여러 개면**: AskUserQuestion으로 선택

## Step 2: 수정 내용 확인

사용자가 이미 수정 내용을 설명했으면 (예: "알림 기능 추가해줘") 그대로 사용합니다.
아직 구체적인 수정 내용이 없으면 AskUserQuestion으로 수집합니다:

```
질문: "어떤 수정이 필요한가요? 자유롭게 설명해주세요."
header: "수정 내용"
options:
  - label: "기능 추가"
    description: "새로운 기능을 추가합니다"
  - label: "기능 수정"
    description: "기존 기능을 변경합니다"
  - label: "버그 수정"
    description: "문제를 고칩니다"
  - label: "UI/UX 개선"
    description: "디자인이나 사용성을 개선합니다"
```

사용자가 선택 후 구체적인 설명을 입력하면 다음 단계로 진행합니다.

## Step 3: 수정 분석 + 코드베이스 탐색 + PRD (Task tool)

> **Thin Controller 원칙:** 기존 프로젝트의 맥락(PRD + 기획서 + 실행 결과)과 **실제 코드 상태**를 Task tool이 분석하고, 메인 세션은 수정 방향 확인만 합니다.

Task tool 프롬프트:

```
프로젝트 ID: {ID}의 수정 사항을 분석하세요.

수정 요청: {사용자 수정 설명}

## Phase 1: 메타데이터 수집

node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js get-project --id {ID}
→ 기존 PRD, 기획서, 팀 구성, 실행 결과, infraPath 확인

## Phase 2: 코드베이스 구조 스캔

infraPath가 있으면:
  node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js scan-codebase --path {infraPath}
  → techStack, dependencies, fileStructure 확보

infraPath가 없으면:
  Phase 2-3 건너뛰기. codebaseInsights에 경고 포함:
  "infraPath 없음 — 메타데이터 기반 분석만 수행됨"

## Phase 3: 심층 코드 탐색 (Plan Mode 수준)

infraPath가 있을 때만 수행:

1. Glob으로 수정 요청 관련 파일 패턴 검색
   예: "알림 추가" → **/*notif*, **/*alert*, **/*push*
2. Read로 핵심 파일 최대 5개 읽기 (구현 상태 파악)
   - 엔트리 포인트, 라우터, 핵심 모듈 우선
3. Grep으로 import/require 추적 (영향 범위 산출)
   - 수정 대상 파일을 참조하는 다른 파일 확인
4. Glob으로 기존 테스트 파일 확인 (**/*.test.*, **/*.spec.*)

## Phase 4: 수정 PRD 생성

Phase 1-3 정보를 바탕으로 incremental PRD를 마크다운으로 작성:
- **유지 항목**: 기존 기능 중 변경 없는 것 (간략 목록)
- **수정 항목**: 변경이 필요한 기존 기능 (변경 전/후 비교, 실제 파일 경로 포함)
- **추가 항목**: 새로 추가할 기능 (상세 설명)
- **영향 범위**: 수정으로 영향 받는 기존 파일과 모듈 (Phase 3 결과 기반)
- **기술 요구사항**: 추가 필요한 기술 스택/라이브러리

복잡도를 simple/medium/complex로 평가.

반환 형식 (JSON):
{
  "modifiedPrd": "수정 PRD (마크다운, 1000자 이내)",
  "codebaseInsights": {
    "techStack": ["실제 감지된 기술"],
    "hasTests": true/false,
    "implementationPattern": "감지된 아키텍처 패턴 (예: MVC, 모듈러, 레이어드)"
  },
  "affectedAreas": [
    { "file": "src/bot.js", "reason": "알림 발송 로직 추가", "changeType": "modify" },
    { "file": "src/notification.js", "reason": "알림 서비스 신규 생성", "changeType": "create" }
  ],
  "migrationRisks": ["기존 API 시그니처 변경 시 호출부 수정 필요", "..."],
  "complexity": "simple|medium|complex",
  "estimatedPhases": 숫자,
  "suggestedTeam": ["역할1", "역할2"]
}

CLAUDE_PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}
```

## Step 4: CEO 확인

수정 PRD를 CEO에게 표시합니다:

- `modifiedPrd` 마크다운 원문
- `codebaseInsights`가 있으면 기술 스택 + 테스트 유무 + 아키텍처 패턴 요약
- `affectedAreas`를 파일별로 표시: `[changeType] file — reason` 형식
- `migrationRisks`가 있으면 위험 요소 목록

AskUserQuestion:

```
질문: "이 수정 방향으로 진행할까요?"
header: "수정 확인"
options:
  - label: "이대로 진행 (Recommended)"
    description: "수정 작업을 시작합니다"
  - label: "수정 요청"
    description: "다른 방향으로 수정합니다"
  - label: "취소"
    description: "수정을 취소하고 프로젝트를 유지합니다"
```

- **"이대로 진행"** → Step 5
- **"수정 요청"** → 추가 입력 수집 후 Step 3 재실행
- **"취소"** → 종료

## Step 5: 작업 분배 + 실행 초기화 (Task tool)

> **Thin Controller 원칙:** 상태 전이, 작업 분배, 실행 초기화는 모두 하나의 Task tool 안에서 처리합니다.

Task tool 프롬프트:

```
프로젝트 ID: {ID}의 수정 작업을 준비하세요.

**[필수] CLI에 JSON 전달 시 Write tool 사용:**
- LLM 응답, PRD, 작업 목록 등 큰 JSON은 반드시 Write tool로 /tmp/gv-*.json 파일에 저장한 뒤 --input-file 플래그로 CLI에 전달하세요.
- echo/cat/heredoc(<<)로 큰 JSON을 bash에 직접 전달하면 보안 탐지에 걸려 자동승인이 중단됩니다.

수정 PRD: {Step 3의 modifiedPrd}

1. 수정 이력 저장:
   → 수정 데이터를 Write tool로 /tmp/gv-modify-history.json에 저장 (형식: {"id":"{ID}","modifiedPrd":"{Step 3의 modifiedPrd}","codebaseInsights":{Step 3의 codebaseInsights 또는 null},"affectedAreas":{Step 3의 affectedAreas},"migrationRisks":{Step 3의 migrationRisks},"complexity":"{Step 3의 complexity}"})
   → node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js add-modify-history --input-file /tmp/gv-modify-history.json

2. 상태 복귀:
   echo '{"id":"{ID}","status":"approved"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status

3. 작업 분배:
   수정 PRD를 기반으로 작업을 분배합니다.
   node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js task-distribution-prompt --id {ID}
   → 생성된 프롬프트를 LLM으로 실행 → 작업 목록 생성
   → 수정/추가 작업만 포함 (기존 완료 작업은 제외)
   → 리뷰 Phase 자동 삽입

4. 작업 목록 저장:
   → 작업 데이터를 Write tool로 /tmp/gv-tasks.json에 저장 (형식: {"id":"{ID}","tasks":[...생성된 작업 배열...]})
   → node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js save-tasks --input-file /tmp/gv-tasks.json

5. 실행 초기화:
   echo '{"id":"{ID}","mode":"auto"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js init-execution

6. 상태 변경:
   echo '{"id":"{ID}","status":"executing"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status

반환 형식 (JSON):
{
  "phaseCount": 숫자,
  "taskCount": 숫자,
  "taskSummary": "작업 요약 (200자 이내)"
}

CLAUDE_PLUGIN_ROOT: {CLAUDE_PLUGIN_ROOT}
```

## Step 6: Phase별 실행

execute.md의 Phase별 실행 흐름을 따릅니다.

> `good-vibe:execute`의 Step 2~4와 동일한 실행 흐름입니다.
> 실행 모드는 auto로 초기화됩니다. 에스컬레이션만 CEO에게 올라갑니다.

## Step 7: 완료

```bash
echo '{"id":"{프로젝트ID}","status":"completed"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js update-status
```

완료 후 안내:

```
프로젝트 수정이 완료되었습니다!

→ good-vibe:report — 수정 결과 확인
→ good-vibe:modify — 추가 수정이 필요하면
→ good-vibe:feedback — 팀원 성과 피드백
```
