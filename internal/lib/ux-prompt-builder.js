// ux-prompt-builder.js — UX Improver/Reviewer/Fixer/Evaluator 프롬프트 생성
// Shell에서 호출: node ux-prompt-builder.js <role> <json-args>

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
 * UX Improver 프롬프트 생성 (Phase 1)
 * @param {object} params
 * @param {object} params.perspective - { id, name, files }
 * @param {string} params.historySummary
 * @param {string} params.existingIssues
 * @param {string} params.runDir
 * @returns {string}
 */
export function buildUxImproverPrompt({
  perspective,
  historySummary = '',
  existingIssues = '[]',
  runDir = '',
}) {
  const filesList = (perspective.files || []).map((f) => `- ${f}`).join('\n');

  return `먼저 CLAUDE.md 파일을 읽고 프로젝트 컨벤션을 반드시 준수하세요.

## 현재 분석 관점: ${perspective.name} (${perspective.id})

### 분석 대상 파일
${filesList}

## 사전 점검 데이터
다음 파일을 참조하세요:
- ${runDir}/existing-issues.json (기존 UX 이슈)

## 기존 이슈 (중복 방지)
${existingIssues}

${historySummary}

## UX 분석 영역

### 1. 커맨드 플로우 명확성
- 상태 전이 안내가 명확한지 (다음에 어떤 커맨드를 실행해야 하는지)
- 커맨드 간 연결이 자연스러운지
- 에러 시 복구 경로가 안내되는지

### 2. 에러 메시지 품질
- 에러 메시지가 구체적인지 (무엇이 잘못되었는지, 어떻게 해결하는지)
- AppError 패턴이 일관되게 사용되는지
- hint 메시지가 도움이 되는지

### 3. 가이드/문서 완성도
- 기능 대비 문서 커버리지
- 예시 코드가 실제 동작하는지
- 가이드가 최신 코드와 일치하는지

### 4. 온보딩 마찰도
- 첫 사용까지 단계 수
- 용어 난이도
- 필수 결정 수 (모드 선택 등)

### 5. SDK 사용성
- API 일관성 (네이밍, 파라미터 패턴)
- import 편의성
- 에러 핸들링 패턴

## 안전한 수정 범위

다음 파일은 자유롭게 수정할 수 있습니다:
- commands/*.md (커맨드 설명/안내)
- guides/** (가이드 문서)
- templates/** (템플릿)
- presets/** (프리셋)
- agents/*.md (에이전트 설명)
- scripts/lib/core/validators.js (에러 메시지만)
- scripts/lib/output/*.js (출력 포맷팅만)

**코어 로직 파일 (handlers, engine, project)은 수정하지 마세요.**

## 종료 판단 (중요)

- critical/important UX 발견이 없으면 → 이슈/수정 없이 바로 종료
- 발견한 것을 모두 수정하고 커밋/PR까지 완료했으면 → 종료
- 같은 패턴을 반복 탐색하고 있다면 → 중단하고 현재까지 결과로 마무리

## 실행 규칙

1. existing-issues.json 확인 → 동일 주제 이슈 열려있으면 SKIP
2. critical/important만 처리, minor는 무시
3. 각 발견 사항:
   a. \`gh issue create\`로 이슈 생성
      - 제목: "[UX Improvement] {perspective.id}: {요약}"
      - 라벨: automated,ux-improvement,${perspective.id}
      - 본문: 파일 경로, 현재 상태, 개선안
   b. 안전 범위 내 파일만 수정
4. 수정 후 \`npm run format && npm run lint && npm test\` 실행, 통과 확인
5. 실패 시 수정 롤백 (\`git checkout -- .\`), 이슈만 생성
6. 변경사항 없으면 아무것도 하지 말 것 (빈 PR 금지)
7. 커밋: conventional commit (docs|fix|chore(scope): 설명)
8. 변경사항이 있으면 PR 생성:
   - 제목: "[UX Improvement] ${perspective.name} 개선"
   - 라벨: automated,ux-improvement,${perspective.id}
   - 본문에 분석 결과 + \`closes #이슈번호\` 포함
9. 모든 작업이 끝나면 반드시 종료`;
}

/**
 * UX Reviewer 프롬프트 생성 (Phase 2)
 * @param {object} params
 * @param {string|number} params.prNumber
 * @returns {string}
 */
export function buildUxReviewerPrompt({ prNumber }) {
  const num = safePrNumber(prNumber);
  return `당신은 **UX 리뷰어**입니다. PR #${num}을 사용자 경험 관점에서 리뷰하세요.

## 리뷰 절차

1. **CLAUDE.md 읽기** — 프로젝트 컨벤션 파악
2. \`gh pr diff ${num}\`으로 변경사항 확인
3. 변경된 파일의 **전체 원본**을 읽어서 맥락 파악
4. PR에 연결된 이슈를 읽고, 이슈가 실제로 해결되었는지 확인
5. 사용자 흐름 관점에서 개선이 실제로 도움이 되는지 평가

## MUST (reject 사유)

- 사용자 흐름을 오히려 복잡하게 만드는 변경
- 기존 커맨드 동작을 깨뜨리는 변경
- 에러 메시지가 덜 명확해지는 변경
- 가이드/문서가 실제 코드와 불일치
- CLAUDE.md 컨벤션 위반
- 코어 로직 파일 변경 (안전 범위 외)

## SHOULD (코멘트만)

- 더 나은 UX 표현 제안
- 추가 가이드 필요 영역 지적
- 다국어/접근성 개선 제안

## 결과 실행

- MUST 이슈 없음:
  \`gh pr review ${num} --comment --body "## [APPROVED] UX 리뷰 통과."\`

- MUST 이슈 있음:
  \`gh pr review ${num} --comment --body "## [CHANGES_REQUESTED] UX 이슈:\\n1. [MUST] 설명"\`

리뷰 완료 후 반드시 종료하세요.`;
}

/**
 * UX Fixer 프롬프트 생성 (Phase 3)
 * @param {object} params
 * @param {string|number} params.prNumber
 * @param {number} params.cycle
 * @param {number} params.maxCycles
 * @param {string} params.reviewBody
 * @returns {string}
 */
export function buildUxFixerPrompt({ prNumber, cycle, maxCycles, reviewBody = '' }) {
  const num = safePrNumber(prNumber);
  return `PR #${num}의 UX 리뷰에서 [MUST] 이슈가 발견되어 수정이 필요합니다.
현재 수정 사이클: ${cycle}/${maxCycles}

## 리뷰 피드백
${reviewBody}

## 수정 규칙

1. CLAUDE.md를 읽고 프로젝트 컨벤션을 확인하세요
2. [MUST] 태그가 붙은 이슈만 수정하세요 ([SHOULD]는 무시)
3. 안전 범위 내 파일만 수정 (commands/, guides/, templates/, presets/, agents/)
4. 수정 후 \`npm run format && npm run lint && npm test\` 실행
5. 실패 시 \`git checkout -- .\`로 롤백 후, 성공하는 수정만 적용
6. conventional commit으로 커밋:
   \`fix(ux-review): [MUST] 이슈 수정 — cycle ${cycle}\`
7. \`git push\`로 푸시

모든 [MUST] 이슈를 수정했으면 반드시 종료하세요.`;
}

/**
 * UX Evaluator 프롬프트 생성 (Phase Eval)
 * @param {object} params
 * @param {number} params.round
 * @param {string} params.runDir
 * @param {object} [params.perspective]
 * @param {string} [params.previousFeedback]
 * @returns {string}
 */
export function buildUxEvaluatorPrompt({
  round = 1,
  runDir: _runDir = '',
  perspective = null,
  previousFeedback = '',
}) {
  const perspectiveSection = perspective
    ? `\n현재 관점: **${perspective.name}** (${perspective.id})\n`
    : '';

  const prevSection = previousFeedback
    ? `\n## 이전 라운드 피드백\n${previousFeedback}\n\n위 피드백 대비 개선되었는지 확인하세요.\n`
    : '';

  return `당신은 **UX 품질 평가자**입니다. 코드를 수정하지 마세요. 읽기 전용 평가만 수행합니다.
Round ${round} 평가.
${perspectiveSection}
## 사전 점검 데이터
다음 파일을 참조하세요:
- CLAUDE.md (프로젝트 컨벤션)
- commands/*.md (커맨드 정의)
- guides/ (가이드 문서)
${prevSection}
## 평가 영역 (5가지)

각 영역을 0-10 스케일로 점수를 매기세요:

1. **flowClarity** — 커맨드 플로우 명확성: 상태 전이 안내, 다음 단계 명시, 커맨드 연결
2. **errorQuality** — 에러 메시지 품질: 구체성, 복구 가이드, 일관된 에러 코드
3. **guideCompleteness** — 가이드/문서 완성도: 기능 대비 문서 커버리지, 예시 코드
4. **onboardingFriction** — 온보딩 마찰도: 첫 사용까지 단계 수, 용어 난이도, 필수 결정 수
5. **sdkUsability** — SDK 사용성: API 일관성, import 편의성, 에러 핸들링

## 출력 형식 (반드시 JSON)

\`\`\`json
{
  "scores": {
    "flowClarity": 7.5,
    "errorQuality": 8.0,
    "guideCompleteness": 6.5,
    "onboardingFriction": 7.0,
    "sdkUsability": 6.0
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
 * UX Round Improver 프롬프트 생성 (Round 2+)
 * @param {object} params
 * @param {number} params.round
 * @param {string} params.evalFeedback
 * @param {Record<string, number>} [params.previousScores]
 * @param {string} [params.unresolvedIssues]
 * @param {string} [params.historySummary]
 * @param {string} [params.existingIssues]
 * @param {object} params.perspective
 * @param {string} [params.runDir]
 * @returns {string}
 */
export function buildUxRoundImproverPrompt({
  round = 2,
  evalFeedback = '',
  previousScores = null,
  unresolvedIssues = '',
  historySummary = '',
  existingIssues = '[]',
  perspective,
  runDir = '',
}) {
  const basePrompt = buildUxImproverPrompt({
    perspective,
    historySummary,
    existingIssues,
    runDir,
  });

  const scoresSection = previousScores
    ? `\n## 이전 라운드 점수\n${JSON.stringify(previousScores, null, 2)}\n`
    : '';

  const unresolvedSection = unresolvedIssues
    ? `\n## 미해결 이슈 (이전 라운드)\n${unresolvedIssues}\n`
    : '';

  return `${basePrompt}

## Round ${round} 추가 지침

이전 수정을 유지하면서 UX SLA 미달 영역에 집중하세요.
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
      params = { runDir: jsonArgs };
    }
  } else {
    params = {};
  }

  // perspective 로드 (runDir 기반)
  if ((role === 'improver' || role === 'round-improver') && params.runDir) {
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
      params.perspective = JSON.parse(readFileSync(`${runDir}/perspective.json`, 'utf-8'));
    } catch {
      params.perspective = { id: 'unknown', name: 'Unknown', files: [] };
    }
  }

  switch (role) {
    case 'improver':
      console.log(buildUxImproverPrompt(params));
      break;
    case 'reviewer':
      console.log(buildUxReviewerPrompt(params));
      break;
    case 'fixer':
      console.log(buildUxFixerPrompt(params));
      break;
    case 'evaluator': {
      if (params.runDir) {
        try {
          params.previousFeedback = readFileSync(
            `${params.runDir}/eval-feedback-round${(params.round || 1) - 1}.txt`,
            'utf-8',
          );
        } catch {
          params.previousFeedback = '';
        }
        try {
          params.perspective = JSON.parse(
            readFileSync(`${params.runDir}/perspective.json`, 'utf-8'),
          );
        } catch {
          // perspective 없음
        }
      }
      console.log(buildUxEvaluatorPrompt(params));
      break;
    }
    case 'round-improver': {
      if (params.runDir) {
        const runDir = params.runDir;
        try {
          params.evalFeedback = readFileSync(
            `${runDir}/eval-feedback-round${(params.round || 2) - 1}.txt`,
            'utf-8',
          );
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
      console.log(buildUxRoundImproverPrompt(params));
      break;
    }
    default:
      console.error(`Unknown role: ${role}`);
      process.exit(1);
  }
}
