---
description: '에이전트 피드백 — 프로젝트 결과 기반 성과 평가'
---

# good-vibe:feedback — 에이전트 피드백 (프로젝트 결과 기반)

## 이 커맨드를 실행하면?

프로젝트 결과를 분석하여 각 팀원의 성과를 평가하고, 개선 제안을 만듭니다.
승인한 제안은 다음 프로젝트부터 자동 적용됩니다.

- **소요시간:** 2-5분
- **결과물:** 팀원별 개선 제안 + 오버라이드 저장
- **선택사항:** 이 단계는 건너뛸 수 있습니다

---

프로젝트 결과를 분석하여 에이전트 .md 수정안을 자동 제안하고, 승인된 수정을 오버라이드 파일로 저장합니다.

## Step 1: completed 프로젝트 선택

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js list-projects
```

completed 상태인 프로젝트 목록을 사용자에게 보여주고 선택하게 하세요.
AskUserQuestion으로 프로젝트를 선택합니다.

## Step 2: 전체 피드백 분석 (Task tool)

**하나의 Task tool**로 다음 작업을 모두 수행합니다:

```
Task: 프로젝트 피드백 분석 및 개선 제안 생성

컨텍스트:
- CLAUDE_PLUGIN_ROOT: ${CLAUDE_PLUGIN_ROOT}
- 선택된 프로젝트 ID: {프로젝트ID}

작업 지시:
1. get-project로 프로젝트 정보 로드
2. extract-performance로 팀원별 성과 데이터 추출
3. 각 팀원에 대해:
   - load-agent-override로 기존 오버라이드 확인
   - improvement-prompt로 분석 프롬프트 생성
   - 분석 수행 (이슈 패턴, 리뷰 품질, 반복 실수)
   - parse-suggestions로 구조화된 제안 파싱
4. 크로스프로젝트 학습 (동일 역할의 다른 프로젝트 이슈 패턴 집계)

반환 형식 (JSON):
{
  "suggestions": [
    {
      "roleId": "backend",
      "roleName": "Backend Developer",
      "sections": [
        {
          "section": "코드 품질",
          "current": "현재 내용...",
          "suggested": "제안 내용...",
          "reason": "이유..."
        }
      ],
      "performance": {
        "tasksCompleted": 5,
        "criticalIssues": 2,
        "uniqueIssues": 8
      }
    }
  ],
  "crossProjectPatterns": [
    {
      "roleId": "backend",
      "category": "security",
      "count": 3,
      "note": "입력 검증 누락 반복 발견"
    }
  ]
}

제약:
- 이슈가 없는 에이전트는 suggestions에서 제외
- 반환 텍스트 2000자 이내 (요약 포함)
- CLI 호출 실패 시 해당 에이전트 건너뛰고 계속 진행
```

## Step 3: 제안 표시 및 일괄 승인

Task tool 결과를 CEO에게 포맷팅하여 표시:

```
=== 에이전트 피드백 분석 완료 ===

[Backend Developer]
  섹션: 코드 품질
  현재: ...
  제안: ...
  이유: ...

  섹션: 보안
  현재: ...
  제안: ...
  이유: ...

[QA]
  섹션: 테스트 커버리지
  ...

크로스프로젝트 학습:
- backend: security 이슈 3회 반복 (입력 검증 누락)
- qa: testCoverage 이슈 2회 반복 (엣지 케이스 미흡)
```

AskUserQuestion으로 일괄 승인 또는 개별 선택:

```
어떤 제안을 적용할까요?

옵션:
1. 모두 적용
2. 역할별 선택
3. 취소
```

역할별 선택 시: 체크박스 형식으로 역할 목록 제시

## Step 4: 승인된 오버라이드 저장 (Task tool)

**하나의 Task tool**로 승인된 모든 오버라이드를 저장합니다:

```
Task: 에이전트 오버라이드 저장

컨텍스트:
- CLAUDE_PLUGIN_ROOT: ${CLAUDE_PLUGIN_ROOT}
- 승인된 역할: {approvedRoleIds}
- 제안 데이터: {suggestions}

작업 지시:
1. 승인된 각 역할에 대해:
   - 제안을 마크다운 형식으로 조합
   - save-agent-override로 저장
2. 저장 결과 요약 반환

반환 형식 (JSON):
{
  "saved": [
    {
      "roleId": "backend",
      "sectionsCount": 2,
      "path": "~/.claude/good-vibe/agent-overrides/backend.md"
    }
  ],
  "failed": []
}

제약:
- 반환 텍스트 500자 이내
- CLI 실패 시 해당 역할을 failed 배열에 포함하고 계속 진행
```

## Step 5: 결과 안내

Task tool 결과를 기반으로 CEO에게 안내:

```
=== 에이전트 피드백 저장 완료 ===

저장된 오버라이드:
- backend: 코드 품질 2개 섹션 (경로: ~/.claude/good-vibe/agent-overrides/backend.md)
- qa: 테스트 커버리지 1개 섹션 (경로: ~/.claude/good-vibe/agent-overrides/qa.md)

다음 프로젝트부터 수정된 에이전트 설정이 자동 적용됩니다.

관련 커맨드:
- good-vibe:new — 새 프로젝트 시작
- good-vibe:status — 프로젝트 상태 확인
- good-vibe:my-team — 현재 팀 설정 보기
```

---

## Thin Controller 준수

이 커맨드는 Thin Controller 원칙을 준수합니다:

**메인 세션 역할:**

- Step 1: 프로젝트 목록 조회 (단일 read-only CLI)
- Step 1: CEO에게 프로젝트 선택 질문 (AskUserQuestion)
- Step 2: Task tool 실행 후 결과 표시
- Step 3: CEO에게 승인 질문 (AskUserQuestion)
- Step 4: Task tool 실행 후 결과 표시
- Step 5: 최종 안내 출력

**Task tool 역할:**

- Step 2: 모든 분석 작업 (CLI 체인, 에이전트별 루프, LLM 호출)
- Step 4: 모든 저장 작업 (승인된 역할별 루프, CLI 호출)

**원칙:**

- 두 CEO 터치포인트(Step 1→2, Step 3→4) 사이의 모든 작업을 하나의 Task tool로 묶음
- 메인 세션에서는 에이전트별 루프나 다단계 CLI 체인 제거
- 컨텍스트 보호: Task tool에 CLAUDE_PLUGIN_ROOT 명시, 반환 텍스트 제한
