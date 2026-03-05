---
description: '접근법 비교 평가 — 단일 프롬프트 vs 멀티에이전트'
---

# good-vibe:eval — 접근법 비교 평가

## 이 커맨드를 실행하면?

"단일 프롬프트" vs "멀티에이전트 팀" 접근법의 품질을 동일 프로젝트에 대해 비교 평가합니다.

- **소요시간:** 10-20분 (두 접근법 순차 실행)
- **결과물:** 완성도, 기술 깊이, 비용 효율 비교 보고서
- **목적:** 멀티에이전트 오케스트레이션의 실질적 가치를 정량적으로 검증

---

## Step 1: 프로젝트 설명 수집

```
질문: "평가할 프로젝트를 설명해주세요"
header: "프로젝트"
```

사용자 입력을 `projectDescription`에 저장합니다.

## Step 2: 평가 세션 생성

```bash
echo '{"projectDescription": "{projectDescription}", "approaches": ["single-prompt", "multi-agent"]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js eval-create
```

`sessionId`를 저장합니다.

## Step 3: 접근법 A — 단일 프롬프트 실행

### 3.1: 베이스라인 프롬프트 생성

```bash
echo '{"description": "{projectDescription}"}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js eval-baseline-prompt
```

### 3.2: Task 에이전트로 실행

생성된 프롬프트를 **단일 Task 에이전트** (general-purpose)로 실행합니다.

시작 시간을 기록하고, 에이전트 결과를 받으면 종료 시간을 기록합니다.

```
단일 프롬프트 접근법을 실행 중입니다...
(1명의 에이전트가 전체 분석을 수행합니다)
```

### 3.3: 결과 기록

```bash
echo '{"sessionId": "{sessionId}", "approach": "single-prompt", "result": {"output": "{에이전트 출력}", "tokenCount": {추정 토큰수}, "apiCalls": 1, "durationMs": {소요시간ms}, "agentCount": 1}}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js eval-record
```

토큰 수 추정: 출력 문자 수 / 4 (근사값)

## Step 4: 접근법 B — 멀티에이전트 팀 실행

### 4.1: 팀 추천 및 구성

프로젝트 유형에 맞는 팀을 추천합니다:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js recommend-team --type {projectType}
```

팀 구성:

```bash
echo '{"roleIds": [...], "personalityChoices": {}}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js build-team
```

### 4.2: 멀티에이전트 오케스트레이션 (1라운드)

tier별 병렬 디스패치를 실행합니다:

```bash
echo '{"team": [...]}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js group-agents
```

각 tier의 에이전트를 Task 에이전트로 **병렬** 실행합니다. 시작 시간을 기록합니다.

```
멀티에이전트 접근법을 실행 중입니다...
({팀 크기}명의 에이전트가 역할별로 분석합니다)
```

### 4.3: 결과 종합

모든 에이전트 출력을 수집하여 종합합니다:

```bash
echo '{"project": {...}, "agentOutputs": [...], "round": 1}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js synthesis-prompt
```

종합 프롬프트를 Task 에이전트로 실행하여 기획서를 생성합니다.

### 4.4: 결과 기록

```bash
echo '{"sessionId": "{sessionId}", "approach": "multi-agent", "result": {"output": "{종합 기획서}", "tokenCount": {총 토큰수}, "apiCalls": {총 API 호출 수}, "durationMs": {총 소요시간ms}, "agentCount": {에이전트 수}}}' | node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js eval-record
```

## Step 5: 비교 분석

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js eval-compare --session-id {sessionId}
```

## Step 6: 보고서 생성 및 표시

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/cli.js eval-report --session-id {sessionId}
```

보고서를 마크다운으로 표시합니다:

```
## 평가 결과

| 접근법 | 완성도 | 기술 깊이 | 비용 효율 | 종합 |
|--------|--------|-----------|-----------|------|
| single-prompt | {점수} | {점수} | {점수} | {점수} |
| multi-agent   | {점수} | {점수} | {점수} | {점수} |

### 분석
- 완성도: 아키텍처, 작업 분해, 기술 스택, 위험 분석, 타임라인 포함 여부
- 기술 깊이: 구체적 라이브러리, 코드 예시, API 설계, DB 스키마, 에러 처리
- 비용 효율: 토큰 사용량 대비 품질 (낮을수록 효율적)

### 권장사항
{comparison.summary}
```

## Step 7: 다음 단계

```
평가가 완료되었습니다!
- 세션 ID: {sessionId}
- 다른 프로젝트로 재평가하려면 good-vibe:eval을 다시 실행하세요
- 이전 평가 목록: eval-list CLI 명령 사용
```
