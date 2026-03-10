/**
 * message-analyzer — 프로젝트 메시지 패턴 분석 모듈
 * messageBus.getStats() 결과를 분석하여 팀 커뮤니케이션 인사이트를 생성한다.
 */

/**
 * 메시지 통계를 분석하여 패턴 인사이트를 생성한다.
 * @param {object} stats - messageBus.getStats() 결과
 * @returns {{ hasData: boolean, totalMessages?: number, threadCount?: number, typeDistribution?: object, agentActivity?: Array, insights?: Array<string> }}
 */
export function analyzeMessagePatterns(stats) {
  if (!stats || !stats.totalMessages) {
    return { hasData: false };
  }

  const { totalMessages, threadCount, byType, byAgent } = stats;

  // 에이전트 활동도 정렬 (total = sent + received)
  const agentActivity = Object.entries(byAgent || {})
    .map(([agent, counts]) => ({
      agent,
      sent: counts.sent || 0,
      received: counts.received || 0,
      total: (counts.sent || 0) + (counts.received || 0),
    }))
    .sort((a, b) => b.total - a.total);

  // 인사이트 생성
  const insights = [];

  if (agentActivity.length > 0) {
    const top = agentActivity[0];
    insights.push(`${top.agent.toUpperCase()}가 가장 활발한 커뮤니케이터 (${top.total}건)`);
  }

  const questionCount = byType?.question || 0;
  const answerCount = byType?.answer || 0;
  if (questionCount > 0 && answerCount > 0) {
    const ratio = answerCount / questionCount;
    if (ratio >= 0.8 && ratio <= 1.2) {
      insights.push('질문-답변 비율 균형');
    } else if (ratio < 0.8) {
      insights.push(`미답변 질문 존재 (질문 ${questionCount}, 답변 ${answerCount})`);
    }
  }

  const consultationCount = byType?.consultation || 0;
  if (consultationCount > 0) {
    insights.push(`전문가 상담 ${consultationCount}건 발생`);
  }

  if (threadCount > 0) {
    const avgMsgPerThread = totalMessages / threadCount;
    if (avgMsgPerThread > 3) {
      insights.push(`스레드당 평균 ${avgMsgPerThread.toFixed(1)}건 — 깊이 있는 논의`);
    }
  }

  return {
    hasData: true,
    totalMessages,
    threadCount,
    typeDistribution: byType || {},
    agentActivity,
    insights,
  };
}

/**
 * 분석 결과를 마크다운 보고서 섹션으로 변환한다.
 * @param {object} analysis - analyzeMessagePatterns 결과
 * @returns {string} 마크다운 섹션 (hasData=false면 빈 문자열)
 */
export function generateMessageAnalysisSection(analysis) {
  if (!analysis || !analysis.hasData) return '';

  let section = `## 팀 커뮤니케이션 분석

| 항목 | 값 |
|------|-----|
| 총 메시지 | ${analysis.totalMessages}건 |
| 스레드 | ${analysis.threadCount}개 |`;

  // 타입 분포
  const types = analysis.typeDistribution || {};
  const typeEntries = Object.entries(types).filter(([, v]) => v > 0);
  if (typeEntries.length > 0) {
    section += '\n\n### 메시지 유형';
    section += '\n\n| 유형 | 건수 |\n|------|------|\n';
    section += typeEntries.map(([type, count]) => `| ${type} | ${count} |`).join('\n');
  }

  // 에이전트 활동
  const agents = analysis.agentActivity || [];
  if (agents.length > 0) {
    section += '\n\n### 에이전트 활동';
    section += '\n\n| 에이전트 | 발신 | 수신 | 합계 |\n|----------|------|------|------|\n';
    section += agents
      .map((a) => `| ${a.agent} | ${a.sent} | ${a.received} | ${a.total} |`)
      .join('\n');
  }

  // 인사이트
  const insights = analysis.insights || [];
  if (insights.length > 0) {
    section += '\n\n### 인사이트\n';
    section += insights.map((i) => `- ${i}`).join('\n');
  }

  return section;
}
