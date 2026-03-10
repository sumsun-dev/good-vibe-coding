import { describe, it, expect } from 'vitest';
import {
  analyzeMessagePatterns,
  generateMessageAnalysisSection,
} from '../scripts/lib/engine/message-analyzer.js';

describe('analyzeMessagePatterns', () => {
  it('빈 stats는 hasData=false를 반환한다', () => {
    const result = analyzeMessagePatterns({});
    expect(result.hasData).toBe(false);
  });

  it('totalMessages=0이면 hasData=false', () => {
    const result = analyzeMessagePatterns({ totalMessages: 0, byType: {}, byAgent: {} });
    expect(result.hasData).toBe(false);
  });

  it('타입 분포를 계산한다', () => {
    const stats = {
      totalMessages: 10,
      threadCount: 2,
      byType: { question: 4, answer: 4, consultation: 2 },
      byAgent: {
        cto: { sent: 3, received: 2 },
        qa: { sent: 4, received: 3 },
        backend: { sent: 3, received: 5 },
      },
    };
    const result = analyzeMessagePatterns(stats);
    expect(result.hasData).toBe(true);
    expect(result.totalMessages).toBe(10);
    expect(result.typeDistribution).toBeDefined();
    expect(result.typeDistribution.question).toBe(4);
  });

  it('에이전트 활동도를 정렬한다', () => {
    const stats = {
      totalMessages: 6,
      threadCount: 1,
      byType: { question: 3, answer: 3 },
      byAgent: {
        cto: { sent: 1, received: 1 },
        qa: { sent: 4, received: 3 },
      },
    };
    const result = analyzeMessagePatterns(stats);
    expect(result.agentActivity[0].agent).toBe('qa');
    expect(result.agentActivity[0].total).toBe(7);
  });

  it('인사이트를 생성한다', () => {
    const stats = {
      totalMessages: 10,
      threadCount: 3,
      byType: { question: 5, answer: 3, consultation: 2 },
      byAgent: {
        cto: { sent: 6, received: 2 },
        qa: { sent: 2, received: 4 },
        backend: { sent: 2, received: 4 },
      },
    };
    const result = analyzeMessagePatterns(stats);
    expect(result.insights).toBeDefined();
    expect(Array.isArray(result.insights)).toBe(true);
  });
});

describe('generateMessageAnalysisSection', () => {
  it('hasData=false면 빈 문자열을 반환한다', () => {
    const result = generateMessageAnalysisSection({ hasData: false });
    expect(result).toBe('');
  });

  it('마크다운 포맷으로 생성한다', () => {
    const analysis = {
      hasData: true,
      totalMessages: 10,
      threadCount: 3,
      typeDistribution: { question: 4, answer: 4, consultation: 2 },
      agentActivity: [
        { agent: 'qa', sent: 4, received: 3, total: 7 },
        { agent: 'cto', sent: 3, received: 2, total: 5 },
      ],
      insights: ['QA가 가장 활발한 커뮤니케이터', '질문-답변 비율 균형'],
    };
    const result = generateMessageAnalysisSection(analysis);
    expect(result).toContain('## 팀 커뮤니케이션 분석');
    expect(result).toContain('10');
    expect(result).toContain('qa');
    expect(result).toContain('QA가 가장 활발한 커뮤니케이터');
  });
});
