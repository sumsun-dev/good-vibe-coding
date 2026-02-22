/**
 * discussion-engine — 팀 토론 프롬프트 생성 모듈
 * 실제 토론은 Claude가 커맨드 실행 시 수행한다. 이 모듈은 프롬프트 생성기.
 */

/**
 * 팀 토론 프롬프트를 생성한다.
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
      if (m.growthContext) {
        lines.push(`- 📈 성장 이력: ${m.growthContext.split('\n')[0].replace(/[*📈]/g, '').trim()}`);
      }
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
