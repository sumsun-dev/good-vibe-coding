// prompt-builder.js — Improver/Reviewer/Fixer/ReReviewer 프롬프트 생성 (Node.js 버전)
// Shell에서 호출: node prompt-builder.js <role> <json-args>

import { readFileSync } from 'fs';

/**
 * PR 번호를 안전한 정수로 변환 (prompt injection 방지)
 * @param {string|number} prNumber
 * @returns {number}
 */
function safePrNumber(prNumber) {
  const num = parseInt(prNumber, 10);
  if (Number.isNaN(num) || num <= 0) {
    throw new Error(`유효하지 않은 PR 번호: ${prNumber}`);
  }
  return num;
}

/**
 * Improver 프롬프트 생성 (Phase 1)
 * @param {object} params
 * @param {string} params.historySummary - 히스토리 요약 텍스트
 * @param {string} params.existingIssues - 기존 이슈 JSON 문자열
 * @param {string} params.runDir - RUN_DIR 경로
 * @returns {string}
 */
export function buildImproverPrompt({ historySummary = '', existingIssues = '[]', runDir = '' }) {
  return `먼저 CLAUDE.md 파일을 읽고 프로젝트 컨벤션을 반드시 준수하세요.

## 사전 점검 데이터
다음 파일을 참조하세요:
- ${runDir}/eslint-report.json (ESLint 결과)
- ${runDir}/test-report.json (테스트 커버리지)
- ${runDir}/recent-changes.txt (최근 7일 변경 파일)
- ${runDir}/existing-issues.json (기존 improvement 이슈)

## 기존 이슈 (중복 방지)
${existingIssues}

${historySummary}

## 분석 범위

### 1. 코드 품질
- 50줄 초과 함수, 4단계 초과 중첩, 800줄 초과 파일
- console.log 잔존, 미사용 import/변수
- magic number, 3회 이상 반복 패턴

### 2. 보안
- 하드코딩 시크릿/토큰/API키
- path traversal (assertWithinRoot 누락)
- exec/execSync에 사용자 입력 직접 전달
- requireFields 등 입력 검증 누락

### 3. 성능
- 핫패스의 동기 I/O
- 루프 내 반복 I/O (N+1)
- 캐시 가능한 중복 연산

## 종료 판단 (중요)

분석은 충분히 깊게, 하지만 무의미하게 오래 하지 마세요.
- critical/important 발견이 없으면 → 이슈/수정 없이 바로 종료
- 발견한 것을 모두 수정하고 커밋/PR까지 완료했으면 → 종료
- 같은 패턴을 반복 탐색하고 있다면 → 중단하고 현재까지 결과로 마무리
- 수정이 lint/test를 통과하지 못하고 2회 이상 재시도했으면 → 이슈만 남기고 종료

## 실행 규칙

1. existing-issues.json 확인 → 동일 주제 이슈 열려있으면 SKIP
2. critical/important만 처리, minor는 무시
3. 각 발견 사항:
   a. \`gh issue create\`로 이슈 생성
      - 제목: "[Daily Improvement] {quality|security|performance}: {요약}"
      - 라벨: automated,improvement,{category}
      - 본문: 파일 경로, 라인, 현재 코드, 개선안
   b. 코드 직접 수정
4. 수정 후 \`npm run lint && npm test\` 실행, 통과 확인
5. 실패 시 수정 롤백 (\`git checkout -- .\`), 이슈만 생성
6. 변경사항 없으면 아무것도 하지 말 것 (빈 PR 금지)
7. 커밋: conventional commit (fix|refactor|chore(scope): 설명)
8. 변경사항이 있으면 PR 생성:
   - 제목: "[Daily Improvement] YYYY-MM-DD 코드 개선"
   - 라벨: automated,improvement
   - 본문에 분석 결과 + \`closes #이슈번호\` 포함
9. 모든 작업이 끝나면 반드시 종료. 추가로 찾을 것이 없는지 재탐색하지 마세요`;
}

/**
 * Reviewer 프롬프트 생성 (Phase 2)
 * @param {object} params
 * @param {string|number} params.prNumber - PR 번호
 * @returns {string}
 */
export function buildReviewerPrompt({ prNumber }) {
  const num = safePrNumber(prNumber);
  return `당신은 **독립 코드 리뷰어**입니다. PR #${num}을 깊이 있게 리뷰하세요.

## 리뷰 절차

1. **CLAUDE.md 읽기** — 프로젝트 컨벤션 파악
2. \`gh pr diff ${num}\`으로 변경사항 확인
3. 변경된 파일의 **전체 원본**을 읽어서 맥락 파악 (diff만 보지 마세요!)
4. PR에 연결된 이슈를 읽고, 이슈가 실제로 해결되었는지 확인
5. 부작용 체크: 수정이 다른 기능에 영향 주는지 (import/export/함수 시그니처 변경)
6. 테스트 커버리지: 수정된 코드에 대한 테스트가 있는지 확인

## MUST (reject 사유) — 하나라도 해당하면 request-changes

- 보안 취약점 도입 또는 미해결 (하드코딩 시크릿, injection, path traversal)
- 기존 테스트 깨뜨림 (로직적으로 깨뜨리는 경우)
- 명백한 로직 오류 (off-by-one, null 미처리, 조건 반전)
- CLAUDE.md 컨벤션 위반 (import .js 확장자 누락, 직접 throw new Error, 50줄 초과 함수)
- 이슈와 수정 불일치 (이슈에서 말한 문제를 실제로 안 고친 경우)
- 새로운 문제 도입 (수정하면서 다른 곳을 깨뜨린 경우)

## SHOULD (코멘트만, reject 안 함)

- 더 나은 구현 방법 제안 (성능, 가독성)
- 테스트 커버리지 부족
- 네이밍/코멘트 개선
- 리팩토링 기회

## 결과 실행

리뷰 결과에 따라 **반드시** 다음 중 하나를 실행하세요:

- MUST 이슈가 없으면:
  \`gh pr review ${num} --comment --body "## [APPROVED] 리뷰 통과. [SHOULD] 사항은 코멘트 참조."\`

- MUST 이슈가 있으면:
  \`gh pr review ${num} --comment --body "## [CHANGES_REQUESTED] 이슈 목록:
1. [MUST] 구체적인 문제 설명
2. [MUST] 구체적인 문제 설명

[SHOULD] 참고사항:
- 개선 제안"\`

리뷰를 완료한 후 반드시 종료하세요. 코드를 직접 수정하지 마세요.`;
}

/**
 * Fixer 프롬프트 생성 (Phase 3 — 수정 세션)
 * @param {object} params
 * @param {string|number} params.prNumber
 * @param {number} params.cycle - 현재 사이클 번호
 * @param {number} params.maxCycles - 최대 사이클 수
 * @param {string} params.reviewBody - 리뷰 본문
 * @returns {string}
 */
export function buildFixerPrompt({ prNumber, cycle, maxCycles, reviewBody = '' }) {
  const num = safePrNumber(prNumber);
  return `PR #${num}의 리뷰에서 [MUST] 이슈가 발견되어 수정이 필요합니다.
현재 수정 사이클: ${cycle}/${maxCycles}

## 리뷰 피드백
${reviewBody}

## 수정 규칙

1. CLAUDE.md를 읽고 프로젝트 컨벤션을 확인하세요
2. [MUST] 태그가 붙은 이슈만 수정하세요 ([SHOULD]는 무시)
3. 각 [MUST] 이슈에 대해:
   a. 해당 파일 전체를 읽고 맥락 파악
   b. 수정 적용
   c. 수정이 다른 기능에 영향 없는지 확인
4. 수정 후 \`npm run lint && npm test\` 실행
5. 실패 시 \`git checkout -- .\`로 롤백 후, 성공하는 수정만 적용
6. conventional commit으로 커밋:
   \`fix(review): [MUST] 이슈 수정 — cycle ${cycle}\`
7. \`git push\`로 푸시

모든 [MUST] 이슈를 수정했으면 반드시 종료하세요.`;
}

/**
 * Re-reviewer 프롬프트 생성 (Phase 3 — 재리뷰 세션)
 * @param {object} params
 * @param {string|number} params.prNumber
 * @param {number} params.cycle
 * @param {number} params.maxCycles
 * @param {string} params.previousMust - 이전 [MUST] 이슈 목록
 * @returns {string}
 */
export function buildReReviewerPrompt({ prNumber, cycle, maxCycles, previousMust = '' }) {
  const num = safePrNumber(prNumber);
  return `PR #${num}의 **재리뷰**입니다. 수정 사이클 ${cycle}/${maxCycles} 후 리뷰.

## 이전 [MUST] 이슈 (해결 확인 필요)
${previousMust}

## 재리뷰 절차

1. CLAUDE.md를 읽고 프로젝트 컨벤션 확인
2. \`gh pr diff ${num}\`으로 최신 변경사항 확인
3. 이전 [MUST] 이슈가 **실제로 해결되었는지** 1:1 매칭 확인
4. 수정 과정에서 **새로운 [MUST] 이슈**가 도입되지 않았는지 확인
5. 최근 커밋 메시지를 참고하여 수정 맥락 파악

## MUST / SHOULD 기준

Reviewer와 동일한 기준 적용:
- MUST: 보안, 테스트 깨뜨림, 로직 오류, 컨벤션 위반, 이슈-수정 불일치, 새 문제 도입
- SHOULD: 개선 제안, 커버리지, 네이밍

## 결과 실행

- 모든 이전 [MUST] 해결 + 새 [MUST] 없음:
  \`gh pr review ${num} --comment --body "## [APPROVED] 이전 이슈 모두 해결됨."\`

- 미해결 또는 새 [MUST] 있음:
  \`gh pr review ${num} --comment --body "## [CHANGES_REQUESTED] 미해결/신규 이슈:\\n1. [MUST] 설명"\`

리뷰 완료 후 반드시 종료하세요.`;
}

/**
 * Evaluator 프롬프트 생성 (Phase Eval — read-only 평가)
 * @param {object} params
 * @param {number} params.round - 현재 라운드 번호
 * @param {string} params.runDir - RUN_DIR 경로
 * @param {string} [params.previousFeedback] - 이전 라운드 피드백
 * @returns {string}
 */
export function buildEvaluatorPrompt({ round = 1, runDir = '', previousFeedback = '' }) {
  const prevSection = previousFeedback
    ? `\n## 이전 라운드 피드백\n${previousFeedback}\n\n위 피드백 대비 개선되었는지 확인하세요.\n`
    : '';

  return `당신은 **코드베이스 품질 평가자**입니다. 코드를 수정하지 마세요. 읽기 전용 평가만 수행합니다.
Round ${round} 평가.

## 사전 점검 데이터
다음 파일을 참조하세요:
- ${runDir}/eslint-report.json (ESLint 결과)
- ${runDir}/test-report.json (테스트 커버리지)
- CLAUDE.md (프로젝트 컨벤션)
${prevSection}
## 평가 영역 (7가지)

각 영역을 0-10 스케일로 점수를 매기세요:

1. **architecture** — 모듈 구조, 의존성, SRP, 레이어 분리
2. **safety** — 보안 취약점, 입력 검증, path traversal, injection 방지
3. **promptQuality** — AI 프롬프트 명확성, 탈출 방지, 출력 형식 강제
4. **reflection** — 히스토리 반영, 적응형 분석, 이전 피드백 수용도
5. **errorHandling** — AppError 사용, graceful degradation, 에러 전파
6. **testCoverage** — 테스트 존재/품질, 커버리지, edge case
7. **docConsistency** — CLAUDE.md/README.md와 코드 일치, 주석 정확성

## 출력 형식 (반드시 JSON)

\`\`\`json
{
  "scores": {
    "architecture": 7.5,
    "safety": 8.0,
    "promptQuality": 6.5,
    "reflection": 7.0,
    "errorHandling": 8.0,
    "testCoverage": 7.0,
    "docConsistency": 6.0
  },
  "summary": "전반적 평가 요약 (1-2문장)"
}
\`\`\`

## 규칙
- 반드시 위 JSON 형식으로 출력하세요
- 각 점수는 0-10 범위 소수점 1자리
- 코드를 수정하지 마세요 (read-only)
- 평가를 완료한 후 반드시 종료하세요`;
}

/**
 * Round Improver 프롬프트 생성 (Round 2+ — 이전 피드백 기반)
 * @param {object} params
 * @param {number} params.round - 현재 라운드 번호
 * @param {string} params.evalFeedback - SLA 미달 영역 피드백
 * @param {Record<string, number>} [params.previousScores] - 이전 라운드 점수
 * @param {string} [params.unresolvedIssues] - 미해결 이슈 목록
 * @param {string} [params.historySummary] - 히스토리 요약
 * @param {string} [params.existingIssues] - 기존 이슈 JSON
 * @param {string} [params.runDir] - RUN_DIR 경로
 * @returns {string}
 */
export function buildRoundImproverPrompt({
  round = 2,
  evalFeedback = '',
  previousScores = null,
  unresolvedIssues = '',
  historySummary = '',
  existingIssues = '[]',
  runDir = '',
}) {
  const basePrompt = buildImproverPrompt({ historySummary, existingIssues, runDir });

  const scoresSection = previousScores
    ? `\n## 이전 라운드 점수\n${JSON.stringify(previousScores, null, 2)}\n`
    : '';

  const unresolvedSection = unresolvedIssues
    ? `\n## 미해결 이슈 (이전 라운드)\n${unresolvedIssues}\n`
    : '';

  return `${basePrompt}

## Round ${round} 추가 지침

이전 수정을 유지하면서 SLA 미달 영역에 집중하세요.
이전에 성공한 수정을 되돌리지 마세요.
${scoresSection}${unresolvedSection}
${evalFeedback}`;
}

// CLI 진입점
if (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
) {
  const [role, jsonArgs] = process.argv.slice(2);

  let params;
  if (jsonArgs) {
    try {
      params = JSON.parse(jsonArgs);
    } catch {
      // jsonArgs가 파일 경로인 경우 (runDir)
      params = { runDir: jsonArgs };
    }
  } else {
    params = {};
  }

  // runDir인 경우 파일에서 데이터 로드
  if (role === 'improver' && params.runDir) {
    const runDir = params.runDir;
    try {
      params.historySummary = readFileSync(`${runDir}/history-summary.txt`, 'utf-8');
    } catch {
      params.historySummary = '실행 이력 없음';
    }
    try {
      params.existingIssues = readFileSync(`${runDir}/existing-issues.json`, 'utf-8');
    } catch {
      params.existingIssues = '[]';
    }
  }

  switch (role) {
    case 'improver':
      console.log(buildImproverPrompt(params));
      break;
    case 'reviewer':
      console.log(buildReviewerPrompt(params));
      break;
    case 'fixer':
      console.log(buildFixerPrompt(params));
      break;
    case 'rereviewer':
      console.log(buildReReviewerPrompt(params));
      break;
    case 'evaluator': {
      if (params.runDir) {
        try {
          params.previousFeedback = readFileSync(`${params.runDir}/eval-feedback-round${(params.round || 1) - 1}.txt`, 'utf-8');
        } catch {
          params.previousFeedback = '';
        }
      }
      console.log(buildEvaluatorPrompt(params));
      break;
    }
    case 'round-improver': {
      if (params.runDir) {
        const runDir = params.runDir;
        try {
          params.historySummary = readFileSync(`${runDir}/history-summary.txt`, 'utf-8');
        } catch {
          params.historySummary = '실행 이력 없음';
        }
        try {
          params.existingIssues = readFileSync(`${runDir}/existing-issues.json`, 'utf-8');
        } catch {
          params.existingIssues = '[]';
        }
        try {
          params.evalFeedback = readFileSync(`${runDir}/eval-feedback-round${(params.round || 2) - 1}.txt`, 'utf-8');
        } catch {
          params.evalFeedback = '';
        }
        try {
          params.previousScores = JSON.parse(readFileSync(`${runDir}/prev-scores.json`, 'utf-8'));
        } catch {
          params.previousScores = null;
        }
        try {
          params.unresolvedIssues = readFileSync(`${runDir}/unresolved-issues.txt`, 'utf-8');
        } catch {
          params.unresolvedIssues = '';
        }
      }
      console.log(buildRoundImproverPrompt(params));
      break;
    }
    default:
      console.error(`Unknown role: ${role}`);
      process.exit(1);
  }
}
