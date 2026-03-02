/**
 * discussion-engine — 팀 토론 프롬프트 생성 모듈
 * 실제 토론은 Claude가 커맨드 실행 시 수행한다. 이 모듈은 프롬프트 생성기.
 */

/**
 * 팀 토론 프롬프트를 생성한다.
 * @deprecated 멀티에이전트 방식으로 전환. buildSingleAgentDiscussionPrompt() 사용 권장.
 * @param {object} project - 프로젝트 정보
 * @param {Array<object>} team - 팀원 배열
 * @param {number} round - 토론 라운드 번호
 * @returns {string} 토론 프롬프트
 */
export function buildDiscussionPrompt(project, team, round) {
  const teamSection = team
    .map((m, i) => {
      const lines = [
        `### ${i + 1}. ${m.emoji} ${m.displayName} (${m.role})`,
        `- 성격: ${m.trait}`,
        `- 말투: ${m.speakingStyle}`,
        `- 전문 분야: ${(m.skills || []).join(', ')}`,
      ];
      return lines.join('\n');
    })
    .join('\n\n');

  return `당신은 프로젝트 "${project.name}"의 팀 토론을 진행합니다.
이것은 ${round}라운드 토론입니다.

## 프로젝트 정보
- 이름: ${project.name}
- 유형: ${project.type}
- 설명: ${project.description}

## 팀원 (${team.length}명)

${teamSection}

## 토론 규칙
1. 각 팀원이 자신의 역할 관점에서 의견을 제시합니다
2. 각 팀원은 자신의 말투와 성격으로 발언합니다
3. 의견 충돌 시 건설적으로 토론합니다
4. 토론 후 기획서를 작성합니다

## 출력 형식

먼저 각 팀원의 발언을 시뮬레이션한 뒤, 아래 형식의 기획서를 작성하세요:

## 기획서

### 프로젝트 개요
### 기술 스택
### 아키텍처
### 역할별 작업 분배
### 일정 (마일스톤)
### 리스크 및 대응`;
}

/**
 * 토론 출력을 파싱한다.
 * @param {string} rawOutput - 토론 결과 원문
 * @returns {{ contributions: Array, planDocument: string }}
 */
export function parseDiscussionOutput(rawOutput) {
  if (!rawOutput || rawOutput.trim() === '') {
    return { contributions: [], planDocument: '' };
  }

  const planMarker = '## 기획서';
  const planIdx = rawOutput.indexOf(planMarker);
  if (planIdx === -1) {
    return { contributions: [], planDocument: '' };
  }

  const planDocument = rawOutput.slice(planIdx + planMarker.length).trim();
  const discussionPart = rawOutput.slice(0, planIdx).trim();

  const contributions = [];
  const rolePattern = /###?\s+\d*\.?\s*[^\n]+\(([^)]+)\)/g;
  let match;
  while ((match = rolePattern.exec(discussionPart)) !== null) {
    contributions.push({ role: match[1] });
  }

  return { contributions, planDocument };
}

/**
 * 토론 결과를 정형화된 기획서 마크다운으로 변환한다.
 * @param {object} project - 프로젝트 정보
 * @param {Array<{role: string, content: string}>} discussions - 토론 내용
 * @returns {string} 기획서 마크다운
 */
/**
 * 개별 에이전트용 토론 프롬프트를 생성한다 (orchestrator에서 호출).
 * 한 명의 팀원이 독립적으로 분석하기 위한 프롬프트.
 * @param {object} project - 프로젝트 정보
 * @param {object} teamMember - 개별 팀원 정보
 * @param {object} context - 추가 컨텍스트
 * @param {number} [context.round] - 토론 라운드 번호
 * @param {string} [context.previousSynthesis] - 이전 라운드 종합 결과
 * @param {string} [context.feedbackForMe] - 이 역할에 대한 피드백
 * @param {Array<{roleId: string, role: string, analysis: string}>} [context.priorTierOutputs] - 이전 tier 분석 결과
 * @returns {string} 에이전트 토론 프롬프트
 */
export function buildSingleAgentDiscussionPrompt(project, teamMember, context = {}) {
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

## 토론 (라운드 ${round})
당신의 역할과 전문성에 기반하여 이 프로젝트를 분석하고 의견을 제시하세요.
반드시 당신의 말투와 성격으로 발언하세요.

다음 항목에 대해 의견을 제시하세요:
1. 프로젝트의 핵심 고려사항 (당신의 역할 관점)
2. 기술/설계/전략 제안
3. 잠재적 리스크와 대응 방안`;

  if (context.priorTierOutputs && context.priorTierOutputs.length > 0) {
    const priorSection = context.priorTierOutputs
      .map(o => `- **${o.role}** (${o.roleId}):\n${(o.analysis || '').split('\n').filter(l => l.trim()).slice(0, 5).join('\n')}`)
      .join('\n\n');
    prompt += `\n\n## 이전 tier 팀원 분석 요약\n${priorSection}\n\n위 분석을 참고하여 당신의 관점을 보완하세요.`;
  }

  if (context.previousSynthesis) {
    prompt += `\n\n## 이전 라운드 기획서\n${context.previousSynthesis}\n\n위 기획서를 기반으로 수정/보완 의견을 제시하세요.`;
  }

  if (context.feedbackForMe) {
    prompt += `\n\n## 다른 팀원의 피드백\n${context.feedbackForMe}`;
  }

  return prompt;
}

export function buildPlanDocument(project, discussions) {
  const discussionSummary = discussions.length > 0
    ? discussions.map(d => `- **${d.role}**: ${d.content}`).join('\n')
    : '(토론 내용 없음)';

  return `# 기획서: ${project.name}

## 프로젝트 개요
- 프로젝트명: ${project.name}
- 유형: ${project.type}
- 설명: ${project.description}

## 토론 요약
${discussionSummary}

## 기술 스택
(팀 토론에서 결정)

## 아키텍처
(팀 토론에서 결정)

## 역할별 작업 분배
(팀 토론에서 결정)

## 일정 (마일스톤)
(팀 토론에서 결정)

## 리스크 및 대응
(팀 토론에서 결정)`;
}
