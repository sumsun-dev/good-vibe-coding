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

**Task tool로 위임:** 전체 A 접근법 실행 (프롬프트 생성 → 실행 → 결과 기록)

```
접근법 A (단일 프롬프트)를 실행합니다...
- 베이스라인 프롬프트 생성
- Task 에이전트 실행 (general-purpose)
- 시간/토큰 측정
- 결과 자동 기록
```

**Task 에이전트 프롬프트:**

```
당신은 평가 시스템의 접근법 A 실행자입니다.

목표: 단일 프롬프트 접근법으로 프로젝트를 분석하고 결과를 기록하세요.

## 작업 순서

1. eval-baseline-prompt CLI로 베이스라인 프롬프트 생성
2. 생성된 프롬프트로 단일 Task 에이전트 실행 (시작 시간 기록)
3. 에이전트 결과 수신 (종료 시간 기록)
4. eval-record CLI로 결과 기록:
   - tokenCount: 출력 문자 수 / 4 (근사값)
   - apiCalls: 1
   - agentCount: 1
   - durationMs: 소요시간

## 입력
- sessionId: {sessionId}
- projectDescription: {projectDescription}

## 출력 제한
- 최대 100줄 (결과 요약만)
- 포함: 완료 상태, 토큰 수, 소요 시간
- 제외: 전체 에이전트 출력 (세션에만 저장)

## 컨텍스트 보호
메인 세션은 CEO UI입니다. 무거운 LLM 호출과 CLI 체인은 이 Task 내부에서만 수행하세요.
```

**반환 형식:**

```json
{
  "approach": "single-prompt",
  "completed": true,
  "metrics": {
    "tokenCount": 1234,
    "apiCalls": 1,
    "durationMs": 45000,
    "agentCount": 1
  }
}
```

## Step 4: 접근법 B — 멀티에이전트 팀 실행

**Task tool로 위임:** 전체 B 접근법 실행 (팀 구성 → 오케스트레이션 → 종합 → 결과 기록)

```
접근법 B (멀티에이전트)를 실행합니다...
- 팀 추천 및 구성
- Tier별 병렬 분석 (1라운드)
- 결과 종합
- 시간/토큰 측정
- 결과 자동 기록
```

**Task 에이전트 프롬프트:**

```
당신은 평가 시스템의 접근법 B 실행자입니다.

목표: 멀티에이전트 팀 접근법으로 프로젝트를 분석하고 결과를 기록하세요.

## 작업 순서

1. recommend-team CLI로 프로젝트 유형에 맞는 팀 추천
2. build-team CLI로 팀 구성
3. group-agents CLI로 tier별 그룹화
4. Tier별 병렬 디스패치 (시작 시간 기록):
   - Tier 1 (CTO, PO, Market Researcher)
   - Tier 2 (Fullstack, UI/UX, Frontend, Backend)
   - Tier 3 (QA, Security, DevOps, Data)
   - Tier 4 (Tech Writer)
5. synthesis-prompt CLI로 종합 프롬프트 생성
6. 종합 프롬프트를 Task 에이전트로 실행 (종료 시간 기록)
7. eval-record CLI로 결과 기록:
   - tokenCount: 모든 에이전트 + 종합 토큰 합계
   - apiCalls: 에이전트 수 + 1 (종합)
   - agentCount: 팀 크기
   - durationMs: 총 소요시간

## 입력
- sessionId: {sessionId}
- projectDescription: {projectDescription}

## 출력 제한
- 최대 100줄 (결과 요약만)
- 포함: 완료 상태, 팀 크기, 토큰 수, 소요 시간
- 제외: 전체 에이전트 출력들 (세션에만 저장)

## 컨텍스트 보호
메인 세션은 CEO UI입니다. 팀 구성, 오케스트레이션, 종합은 이 Task 내부에서만 수행하세요.
```

**반환 형식:**

```json
{
  "approach": "multi-agent",
  "completed": true,
  "metrics": {
    "tokenCount": 5678,
    "apiCalls": 6,
    "durationMs": 180000,
    "agentCount": 5
  }
}
```

## Step 5: 비교 분석 및 보고서 생성

**Task tool로 위임:** 두 접근법 비교 분석 + 보고서 생성

```
두 접근법을 비교 분석합니다...
- 완성도 평가 (아키텍처, 작업 분해, 기술 스택, 위험, 타임라인)
- 기술 깊이 평가 (구체적 라이브러리, 코드 예시, API/DB 설계)
- 비용 효율 계산 (토큰 대비 품질)
- 종합 보고서 생성
```

**Task 에이전트 프롬프트:**

```
당신은 평가 시스템의 비교 분석자입니다.

목표: 두 접근법의 결과를 비교 분석하고 보고서를 생성하세요.

## 작업 순서

1. eval-compare CLI로 비교 분석 실행
2. eval-report CLI로 보고서 생성
3. 결과를 마크다운 형식으로 반환

## 입력
- sessionId: {sessionId}

## 출력 제한
- 최대 200줄 (전체 보고서)
- 포함: 비교 표, 분석 설명, 권장사항
- 제외: 원본 에이전트 출력 (이미 세션에 저장됨)

## 컨텍스트 보호
메인 세션은 CEO UI입니다. 비교 분석과 보고서 생성은 이 Task 내부에서만 수행하세요.
```

**반환 형식:** 마크다운 보고서

## Step 6: 보고서 표시

Task tool에서 반환된 보고서를 그대로 표시합니다:

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
