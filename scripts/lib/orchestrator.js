/**
 * orchestrator — 멀티에이전트 오케스트레이션 모듈
 * 롤플레이 대신 각 역할을 독립 Task 에이전트로 디스패치하고 결과를 종합한다.
 */

import { detectRedundantAgents } from './agent-optimizer.js';

/**
 * 개별 에이전트 분석 프롬프트를 생성한다 (역할별 독립 분석).
 * @param {object} project - 프로젝트 정보
 * @param {object} teamMember - 팀원 정보
 * @param {object} context - 추가 컨텍스트
 * @param {number} [context.round] - 현재 라운드
 * @param {string} [context.previousSynthesis] - 이전 라운드 종합 결과
 * @param {string} [context.feedbackForMe] - 이 역할에 대한 다른 에이전트의 피드백
 * @returns {string} 에이전트 분석 프롬프트
 */
export function buildAgentAnalysisPrompt(project, teamMember, context = {}) {
  const round = context.round || 1;

  let prompt = `당신은 ${teamMember.emoji} **${teamMember.displayName}** (${teamMember.role})입니다.

## 당신의 성격
- 특성: ${teamMember.trait}
- 말투: ${teamMember.speakingStyle}
- 전문 분야: ${(teamMember.skills || []).join(', ')}

## 프로젝트 정보
- 이름: ${project.name}
- 유형: ${project.type}
- 설명: ${project.description}

## 분석 요청 (라운드 ${round})
당신의 역할과 전문성에 기반하여 이 프로젝트를 분석하세요.
당신의 말투와 성격으로 응답하세요.

다음 항목에 대해 의견을 제시하세요:
1. 프로젝트 관점에서의 핵심 고려사항
2. 기술/설계/전략 제안
3. 잠재적 리스크와 대응 방안
4. 다른 역할과의 협업 포인트`;

  if (teamMember.growthContext) {
    prompt += `\n\n## 성장 컨텍스트\n${teamMember.growthContext}`;
  }

  if (context.previousSynthesis) {
    prompt += `\n\n## 이전 라운드 기획서\n다음은 이전 라운드에서 종합된 기획서입니다. 이를 기반으로 수정/보완 의견을 제시하세요.\n\n${context.previousSynthesis}`;
  }

  if (context.feedbackForMe) {
    prompt += `\n\n## 다른 팀원의 피드백\n다음은 다른 팀원들이 당신의 이전 분석에 대해 준 피드백입니다:\n\n${context.feedbackForMe}`;
  }

  prompt += `\n\n## 출력 형식
당신의 역할 관점에서 구조화된 분석을 제공하세요.
마크다운 형식으로 작성하세요.`;

  return prompt;
}

/**
 * 모든 에이전트 분석 결과를 하나의 기획서로 종합하는 프롬프트를 생성한다.
 * @param {object} project - 프로젝트 정보
 * @param {Array<{roleId: string, role: string, emoji: string, analysis: string}>} agentOutputs - 에이전트 분석 결과 배열
 * @param {number} round - 현재 라운드
 * @returns {string} 종합 프롬프트
 */
export function buildSynthesisPrompt(project, agentOutputs, round) {
  if (!agentOutputs || agentOutputs.length === 0) {
    return '';
  }

  const analysisSection = agentOutputs
    .map(o => `### ${o.emoji} ${o.role} (${o.roleId})\n${o.analysis}`)
    .join('\n\n---\n\n');

  return `다음은 프로젝트 "${project.name}"에 대한 ${agentOutputs.length}명의 팀원 분석 결과입니다.
이것은 라운드 ${round}의 종합입니다.

## 프로젝트 정보
- 이름: ${project.name}
- 유형: ${project.type}
- 설명: ${project.description}

## 팀원별 분석 결과

${analysisSection}

## 종합 지시사항

위 분석 결과를 종합하여 하나의 통합 기획서를 작성하세요.

### 종합 원칙
1. 모든 팀원의 핵심 의견을 반영
2. 의견 충돌 시 각 관점의 장단점을 비교하여 결정
3. 구체적이고 실행 가능한 계획 수립
4. 미합의 사항은 명시적으로 기록

### 출력 형식

## 기획서

### 프로젝트 개요
### 기술 스택
### 아키텍처
### 역할별 작업 분배
### 일정 (마일스톤)
### 리스크 및 대응
### 미합의 사항 (있는 경우)`;
}

/**
 * 종합된 기획서를 각 에이전트가 자기 역할 관점에서 리뷰하는 프롬프트를 생성한다.
 * @param {object} teamMember - 팀원 정보
 * @param {string} synthesizedPlan - 종합된 기획서
 * @param {number} round - 현재 라운드
 * @returns {string} 리뷰 프롬프트
 */
export function buildReviewPrompt(teamMember, synthesizedPlan, round) {
  return `당신은 ${teamMember.emoji} **${teamMember.displayName}** (${teamMember.role})입니다.

## 당신의 성격
- 특성: ${teamMember.trait}
- 말투: ${teamMember.speakingStyle}
- 전문 분야: ${(teamMember.skills || []).join(', ')}

## 리뷰 대상 (라운드 ${round} 기획서)

${synthesizedPlan}

## 리뷰 지시사항

당신의 역할 관점에서 이 기획서를 리뷰하세요.

### 리뷰 항목
1. 당신의 전문 분야에서 누락되거나 부정확한 내용
2. 리스크나 우려사항
3. 개선 제안

### 출력 형식 (반드시 아래 JSON 형식으로 출력)

\`\`\`json
{
  "approved": true 또는 false,
  "feedback": "전체적인 리뷰 의견",
  "issues": [
    {
      "severity": "critical 또는 important 또는 minor",
      "description": "이슈 설명"
    }
  ]
}
\`\`\`

- approved: 이 기획서로 진행해도 되면 true, 수정이 필요하면 false
- critical 이슈가 있으면 반드시 approved를 false로 설정
- issues가 없어도 feedback은 반드시 작성`;
}

/**
 * 리뷰 결과 출력을 파싱한다.
 * @param {string} rawOutput - 리뷰 결과 원문
 * @returns {{ approved: boolean, feedback: string, issues: Array<{severity: string, description: string}> }}
 */
export function parseReviewOutput(rawOutput) {
  if (!rawOutput || rawOutput.trim() === '') {
    return { approved: false, feedback: '', issues: [] };
  }

  // JSON 직접 파싱
  try {
    const parsed = JSON.parse(rawOutput.trim());
    return normalizeReviewResult(parsed);
  } catch {
    // JSON 블록 추출
  }

  // ```json ... ``` 블록 추출
  const jsonBlockMatch = rawOutput.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1].trim());
      return normalizeReviewResult(parsed);
    } catch {
      // 파싱 실패
    }
  }

  // { ... } 패턴 추출
  const objMatch = rawOutput.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      const parsed = JSON.parse(objMatch[0]);
      return normalizeReviewResult(parsed);
    } catch {
      // 파싱 실패
    }
  }

  return { approved: false, feedback: rawOutput.trim(), issues: [] };
}

/**
 * 파싱된 리뷰 결과를 정규화한다.
 * @param {object} parsed - 파싱된 JSON
 * @returns {{ approved: boolean, feedback: string, issues: Array }}
 */
function normalizeReviewResult(parsed) {
  return {
    approved: Boolean(parsed.approved),
    feedback: parsed.feedback || '',
    issues: Array.isArray(parsed.issues)
      ? parsed.issues.map(i => ({
          severity: i.severity || 'minor',
          description: i.description || '',
        }))
      : [],
  };
}

/**
 * 수렴 여부를 확인한다. 80% 이상 승인 시 수렴으로 판단.
 * @param {Array<{approved: boolean, feedback: string, issues: Array}>} reviews - 리뷰 결과 배열
 * @returns {{ converged: boolean, approvalRate: number, blockers: Array<string> }}
 */
export function checkConvergence(reviews) {
  if (!reviews || reviews.length === 0) {
    return { converged: false, approvalRate: 0, blockers: [] };
  }

  const approvedCount = reviews.filter(r => r.approved).length;
  const approvalRate = approvedCount / reviews.length;
  const converged = approvalRate >= 0.8;

  const blockers = reviews
    .filter(r => !r.approved)
    .flatMap(r =>
      (r.issues || [])
        .filter(i => i.severity === 'critical')
        .map(i => i.description)
    );

  return { converged, approvalRate, blockers };
}

/**
 * 팀을 priority tier별로 그룹화한다 (병렬 디스패치용).
 * catalog.json의 discussionPriority 기준:
 *   Tier 1 (priority 1-2): CTO, PO, Market Researcher, Business Researcher — 전략/요구사항
 *   Tier 2 (priority 3-4): Fullstack, UI/UX, Frontend, Backend — 구현 관점
 *   Tier 3 (priority 5-7): QA, Security, DevOps, Data, Tech Researcher, Design Researcher — 검증 관점
 *   Tier 4 (priority 8+): Tech Writer — 부가 분석
 * @param {Array<object>} team - 팀원 배열
 * @returns {Array<Array<object>>} tier별 팀원 그룹 배열
 */
export function groupAgentsForParallelDispatch(team) {
  if (!team || team.length === 0) return [];

  const tierBounds = [
    { max: 2 },  // Tier 1: priority 1-2
    { max: 4 },  // Tier 2: priority 3-4
    { max: 7 },  // Tier 3: priority 5-7
    { max: Infinity }, // Tier 4: priority 8+
  ];

  const tiers = tierBounds.map(() => []);

  for (const member of team) {
    const priority = member.discussionPriority || 5;
    const tierIdx = tierBounds.findIndex(b => priority <= b.max);
    tiers[tierIdx >= 0 ? tierIdx : tiers.length - 1].push(member);
  }

  return tiers.filter(tier => tier.length > 0);
}

/**
 * 에이전트 출력 효율성을 분석한다 (중복 에이전트 탐지).
 * synthesis 단계 이후 정보 제공 목적으로 호출한다.
 * @param {Array<{roleId: string, output: string}>} agentOutputs - 에이전트 출력 배열
 * @returns {{ redundancies: Array<{roleId: string, similarTo: string, similarity: number}> }}
 */
export function analyzeAgentEfficiency(agentOutputs) {
  const redundancies = detectRedundantAgents(agentOutputs);
  return { redundancies };
}
