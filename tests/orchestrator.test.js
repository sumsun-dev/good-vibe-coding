import { describe, it, expect } from 'vitest';
import {
  buildAgentAnalysisPrompt,
  buildSynthesisPrompt,
  buildReviewPrompt,
  parseReviewOutput,
  checkConvergence,
  groupAgentsForParallelDispatch,
  trackConvergenceEvolution,
} from '../scripts/lib/engine/orchestrator.js';

const SAMPLE_PROJECT = {
  id: 'telegram-bot-2026-02',
  name: '텔레그램 봇',
  type: 'telegram-bot',
  description: '날씨를 알려주는 텔레그램 봇',
};

const SAMPLE_TEAM = [
  {
    roleId: 'cto',
    displayName: '민준',
    emoji: '',
    role: 'CTO',
    trait: '전략적이고 큰 그림을 보는',
    speakingStyle: '확신 있고 명확한 기술 리더 스타일',
    skills: ['architecture', 'tech-decision', 'code-review'],
    discussionPriority: 1,
  },
  {
    roleId: 'po',
    displayName: '서윤',
    emoji: '',
    role: 'Product Owner',
    trait: '사용자 중심의',
    speakingStyle: '친절하고 체계적인 스타일',
    skills: ['requirements', 'user-story', 'prioritization'],
    discussionPriority: 2,
  },
  {
    roleId: 'fullstack',
    displayName: '현우',
    emoji: '',
    role: 'Full-stack Developer',
    trait: '실용적이고 빠른',
    speakingStyle: '간결하고 직접적인 스타일',
    skills: ['frontend', 'backend', 'database'],
    discussionPriority: 3,
  },
  {
    roleId: 'backend',
    displayName: '도윤',
    emoji: '',
    role: 'Backend Developer',
    trait: '체계적이고 설계 중심의',
    speakingStyle: '논리적이고 구조화된 설명 스타일',
    skills: ['api', 'database', 'auth'],
    discussionPriority: 4,
  },
  {
    roleId: 'qa',
    displayName: '지민',
    emoji: '',
    role: 'QA Engineer',
    trait: '빈틈없이 꼼꼼한',
    speakingStyle: '조심스럽고 혹시... 로 시작하는 스타일',
    skills: ['testing', 'e2e', 'tdd'],
    discussionPriority: 6,
  },
  {
    roleId: 'tech-writer',
    displayName: '수아',
    emoji: '',
    role: 'Technical Writer',
    trait: '명확하고 간결한',
    speakingStyle: '정리된 문서 스타일',
    skills: ['documentation', 'api-docs', 'guide'],
    discussionPriority: 8,
  },
];

// --- buildAgentAnalysisPrompt ---

describe('buildAgentAnalysisPrompt', () => {
  it('프로젝트 정보를 포함한다', () => {
    const prompt = buildAgentAnalysisPrompt(SAMPLE_PROJECT, SAMPLE_TEAM[0]);
    expect(prompt).toContain('텔레그램 봇');
    expect(prompt).toContain('telegram-bot');
    expect(prompt).toContain('날씨를 알려주는');
  });

  it('팀원 페르소나 정보를 포함한다', () => {
    const prompt = buildAgentAnalysisPrompt(SAMPLE_PROJECT, SAMPLE_TEAM[0]);
    expect(prompt).toContain('민준');
    expect(prompt).toContain('CTO');
    expect(prompt).toContain('전략적이고 큰 그림을 보는');
    expect(prompt).toContain('확신 있고 명확한 기술 리더 스타일');
  });

  it('기본 라운드는 1이다', () => {
    const prompt = buildAgentAnalysisPrompt(SAMPLE_PROJECT, SAMPLE_TEAM[0]);
    expect(prompt).toContain('라운드 1');
  });

  it('라운드를 컨텍스트로 전달할 수 있다', () => {
    const prompt = buildAgentAnalysisPrompt(SAMPLE_PROJECT, SAMPLE_TEAM[0], { round: 3 });
    expect(prompt).toContain('라운드 3');
  });

  it('이전 라운드 기획서가 있으면 포함한다', () => {
    const prompt = buildAgentAnalysisPrompt(SAMPLE_PROJECT, SAMPLE_TEAM[0], {
      previousSynthesis: '## 기획서\n### 기술 스택\nNode.js',
    });
    expect(prompt).toContain('이전 라운드 기획서');
    expect(prompt).toContain('Node.js');
  });

  it('피드백이 있으면 포함한다', () => {
    const prompt = buildAgentAnalysisPrompt(SAMPLE_PROJECT, SAMPLE_TEAM[0], {
      feedbackForMe: 'QA: 테스트 전략이 부족합니다',
    });
    expect(prompt).toContain('다른 팀원의 피드백');
    expect(prompt).toContain('테스트 전략이 부족합니다');
  });

  it('skills가 없는 팀원도 처리한다', () => {
    const member = { ...SAMPLE_TEAM[0], skills: undefined };
    const prompt = buildAgentAnalysisPrompt(SAMPLE_PROJECT, member);
    expect(prompt).toContain('민준');
  });

  it('컨텍스트가 비어있으면 기본 분석 프롬프트를 생성한다', () => {
    const prompt = buildAgentAnalysisPrompt(SAMPLE_PROJECT, SAMPLE_TEAM[0], {});
    expect(prompt).toContain('분석 요청');
    expect(prompt).not.toContain('이전 라운드');
    expect(prompt).not.toContain('피드백');
  });

  it('모든 컨텍스트 필드가 동시에 있으면 모두 포함한다', () => {
    const prompt = buildAgentAnalysisPrompt(SAMPLE_PROJECT, SAMPLE_TEAM[0], {
      round: 2,
      previousSynthesis: '기획서 내용',
      feedbackForMe: '피드백 내용',
    });
    expect(prompt).toContain('라운드 2');
    expect(prompt).toContain('기획서 내용');
    expect(prompt).toContain('피드백 내용');
  });
});

// --- buildSynthesisPrompt ---

describe('buildSynthesisPrompt', () => {
  const agentOutputs = [
    { roleId: 'cto', role: 'CTO', emoji: '', analysis: 'Node.js + telegraf 추천' },
    { roleId: 'backend', role: 'Backend Developer', emoji: '', analysis: 'REST API 설계 필요' },
    { roleId: 'qa', role: 'QA Engineer', emoji: '', analysis: '테스트 전략 수립' },
  ];

  it('프로젝트 정보를 포함한다', () => {
    const prompt = buildSynthesisPrompt(SAMPLE_PROJECT, agentOutputs, 1);
    expect(prompt).toContain('텔레그램 봇');
    expect(prompt).toContain('telegram-bot');
  });

  it('모든 에이전트 분석 결과를 포함한다', () => {
    const prompt = buildSynthesisPrompt(SAMPLE_PROJECT, agentOutputs, 1);
    expect(prompt).toContain('Node.js + telegraf 추천');
    expect(prompt).toContain('REST API 설계 필요');
    expect(prompt).toContain('테스트 전략 수립');
  });

  it('라운드 번호를 포함한다', () => {
    const prompt = buildSynthesisPrompt(SAMPLE_PROJECT, agentOutputs, 2);
    expect(prompt).toContain('라운드 2');
  });

  it('기획서 출력 형식 가이드를 포함한다', () => {
    const prompt = buildSynthesisPrompt(SAMPLE_PROJECT, agentOutputs, 1);
    expect(prompt).toContain('프로젝트 개요');
    expect(prompt).toContain('기술 스택');
    expect(prompt).toContain('아키텍처');
    expect(prompt).toContain('역할별 작업 분배');
  });

  it('에이전트 수를 표시한다', () => {
    const prompt = buildSynthesisPrompt(SAMPLE_PROJECT, agentOutputs, 1);
    expect(prompt).toContain('3명');
  });

  it('빈 agentOutputs이면 에러를 throw한다', () => {
    expect(() => buildSynthesisPrompt(SAMPLE_PROJECT, [], 1)).toThrow();
    expect(() => buildSynthesisPrompt(SAMPLE_PROJECT, null, 1)).toThrow();
  });
});

// --- buildReviewPrompt ---

describe('buildReviewPrompt', () => {
  const plan = '## 기획서\n### 기술 스택\nNode.js + telegraf';

  it('팀원 정보를 포함한다', () => {
    const prompt = buildReviewPrompt(SAMPLE_TEAM[0], plan, 1);
    expect(prompt).toContain('민준');
    expect(prompt).toContain('CTO');
  });

  it('기획서 내용을 포함한다', () => {
    const prompt = buildReviewPrompt(SAMPLE_TEAM[0], plan, 1);
    expect(prompt).toContain('Node.js + telegraf');
  });

  it('라운드 번호를 포함한다', () => {
    const prompt = buildReviewPrompt(SAMPLE_TEAM[0], plan, 2);
    expect(prompt).toContain('라운드 2');
  });

  it('JSON 출력 형식 가이드를 포함한다', () => {
    const prompt = buildReviewPrompt(SAMPLE_TEAM[0], plan, 1);
    expect(prompt).toContain('approved');
    expect(prompt).toContain('feedback');
    expect(prompt).toContain('issues');
  });
});

// --- parseReviewOutput ---

describe('parseReviewOutput', () => {
  it('JSON 리뷰를 파싱한다', () => {
    const raw = JSON.stringify({
      approved: true,
      feedback: '좋은 기획서입니다',
      issues: [],
    });
    const result = parseReviewOutput(raw);
    expect(result.approved).toBe(true);
    expect(result.feedback).toBe('좋은 기획서입니다');
    expect(result.issues).toEqual([]);
  });

  it('JSON 코드블록에서 파싱한다', () => {
    const raw =
      '리뷰 결과:\n```json\n{"approved": false, "feedback": "수정 필요", "issues": [{"severity": "critical", "description": "보안 이슈"}]}\n```';
    const result = parseReviewOutput(raw);
    expect(result.approved).toBe(false);
    expect(result.issues.length).toBe(1);
    expect(result.issues[0].severity).toBe('critical');
  });

  it('텍스트 안의 JSON 객체를 추출한다', () => {
    const raw = '의견: {"approved": true, "feedback": "OK", "issues": []}';
    const result = parseReviewOutput(raw);
    expect(result.approved).toBe(true);
  });

  it('빈 입력은 미승인으로 처리한다', () => {
    expect(parseReviewOutput('')).toEqual({
      approved: false,
      feedback: '',
      issues: [],
      parseError: true,
    });
    expect(parseReviewOutput(null)).toEqual({
      approved: false,
      feedback: '',
      issues: [],
      parseError: true,
    });
  });

  it('파싱 불가능한 텍스트는 feedback으로 사용한다', () => {
    const raw = '이 기획서는 좀 더 다듬어야 합니다';
    const result = parseReviewOutput(raw);
    expect(result.approved).toBe(false);
    expect(result.feedback).toBe(raw);
  });

  it('issues 필드가 없으면 빈 배열로 정규화한다', () => {
    const raw = JSON.stringify({ approved: true, feedback: 'OK' });
    const result = parseReviewOutput(raw);
    expect(result.issues).toEqual([]);
  });

  it('severity 기본값은 minor이다', () => {
    const raw = JSON.stringify({
      approved: false,
      feedback: '이슈 있음',
      issues: [{ description: '사소한 문제' }],
    });
    const result = parseReviewOutput(raw);
    expect(result.issues[0].severity).toBe('minor');
  });

  it('approved가 truthy 값이면 true로 변환한다', () => {
    const raw = JSON.stringify({ approved: 1, feedback: 'OK', issues: [] });
    const result = parseReviewOutput(raw);
    expect(result.approved).toBe(true);
  });

  it('approved가 falsy 값이면 false로 변환한다', () => {
    const raw = JSON.stringify({ approved: 0, feedback: 'no', issues: [] });
    const result = parseReviewOutput(raw);
    expect(result.approved).toBe(false);
  });
});

// --- checkConvergence ---

describe('checkConvergence', () => {
  it('100% 승인 시 수렴한다', () => {
    const reviews = [
      { approved: true, feedback: 'OK', issues: [] },
      { approved: true, feedback: 'Good', issues: [] },
      { approved: true, feedback: 'Fine', issues: [] },
    ];
    const result = checkConvergence(reviews);
    expect(result.converged).toBe(true);
    expect(result.approvalRate).toBe(1);
    expect(result.blockers).toEqual([]);
  });

  it('80% 승인 시 수렴한다', () => {
    const reviews = [
      { approved: true, feedback: 'OK', issues: [] },
      { approved: true, feedback: 'Good', issues: [] },
      { approved: true, feedback: 'Fine', issues: [] },
      { approved: true, feedback: 'Nice', issues: [] },
      {
        approved: false,
        feedback: '개선 필요',
        issues: [{ severity: 'minor', description: '사소한 이슈' }],
      },
    ];
    const result = checkConvergence(reviews);
    expect(result.converged).toBe(true);
    expect(result.approvalRate).toBe(0.8);
  });

  it('80% 미만이면 수렴하지 않는다', () => {
    const reviews = [
      { approved: true, feedback: 'OK', issues: [] },
      { approved: false, feedback: '불가', issues: [] },
      { approved: false, feedback: '재작업', issues: [] },
    ];
    const result = checkConvergence(reviews);
    expect(result.converged).toBe(false);
    expect(result.approvalRate).toBeCloseTo(0.333, 2);
  });

  it('critical 이슈를 blockers로 수집한다', () => {
    const reviews = [
      { approved: true, feedback: 'OK', issues: [] },
      {
        approved: false,
        feedback: '보안 문제',
        issues: [
          { severity: 'critical', description: 'SQL 인젝션 취약점' },
          { severity: 'minor', description: '코드 스타일' },
        ],
      },
    ];
    const result = checkConvergence(reviews);
    expect(result.blockers).toEqual(['SQL 인젝션 취약점']);
  });

  it('빈 리뷰 배열은 미수렴으로 처리한다', () => {
    expect(checkConvergence([])).toEqual({
      converged: false,
      approvalRate: 0,
      blockers: [],
      noReviews: true,
    });
    expect(checkConvergence(null)).toEqual({
      converged: false,
      approvalRate: 0,
      blockers: [],
      noReviews: true,
    });
  });

  it('모두 거부하면 수렴하지 않는다', () => {
    const reviews = [
      { approved: false, feedback: 'No', issues: [] },
      { approved: false, feedback: 'Nope', issues: [] },
    ];
    const result = checkConvergence(reviews);
    expect(result.converged).toBe(false);
    expect(result.approvalRate).toBe(0);
  });
});

// --- groupAgentsForParallelDispatch ---

describe('groupAgentsForParallelDispatch', () => {
  it('4개 tier로 그룹화한다', () => {
    const tiers = groupAgentsForParallelDispatch(SAMPLE_TEAM);
    expect(tiers.length).toBe(4);
  });

  it('Tier 1에 priority 1-2 멤버가 포함된다', () => {
    const tiers = groupAgentsForParallelDispatch(SAMPLE_TEAM);
    const tier1 = tiers[0];
    expect(tier1.map((m) => m.roleId)).toContain('cto');
    expect(tier1.map((m) => m.roleId)).toContain('po');
  });

  it('Tier 2에 priority 3-4 멤버가 포함된다', () => {
    const tiers = groupAgentsForParallelDispatch(SAMPLE_TEAM);
    const tier2 = tiers[1];
    expect(tier2.map((m) => m.roleId)).toContain('fullstack');
    expect(tier2.map((m) => m.roleId)).toContain('backend');
  });

  it('Tier 3에 priority 5-7 멤버가 포함된다', () => {
    const tiers = groupAgentsForParallelDispatch(SAMPLE_TEAM);
    const tier3 = tiers[2];
    expect(tier3.map((m) => m.roleId)).toContain('qa');
  });

  it('Tier 4에 priority 8+ 멤버가 포함된다', () => {
    const tiers = groupAgentsForParallelDispatch(SAMPLE_TEAM);
    const tier4 = tiers[3];
    expect(tier4.map((m) => m.roleId)).toContain('tech-writer');
  });

  it('빈 팀은 빈 배열을 반환한다', () => {
    expect(groupAgentsForParallelDispatch([])).toEqual([]);
    expect(groupAgentsForParallelDispatch(null)).toEqual([]);
  });

  it('한 tier에만 멤버가 있으면 1개 tier 배열을 반환한다', () => {
    const team = [SAMPLE_TEAM[0], SAMPLE_TEAM[1]]; // 둘 다 Tier 1
    const tiers = groupAgentsForParallelDispatch(team);
    expect(tiers.length).toBe(1);
    expect(tiers[0].length).toBe(2);
  });

  it('discussionPriority가 없으면 기본값 5로 처리한다', () => {
    const team = [{ ...SAMPLE_TEAM[0], discussionPriority: undefined }];
    const tiers = groupAgentsForParallelDispatch(team);
    expect(tiers.length).toBe(1);
    // priority 5 → Tier 3
    expect(tiers[0][0].roleId).toBe('cto');
  });
});

// --- trackConvergenceEvolution ---

describe('trackConvergenceEvolution', () => {
  it('첫 라운드 (previousRounds 빈 배열) → velocity 0, newBlockers만', () => {
    const currentResult = { converged: false, approvalRate: 0.6, blockers: ['보안 이슈'] };
    const result = trackConvergenceEvolution(currentResult, []);
    expect(result.converged).toBe(false);
    expect(result.approvalRate).toBe(0.6);
    expect(result.evolution.velocity).toBe(0);
    expect(result.evolution.newBlockers).toEqual(['보안 이슈']);
    expect(result.evolution.resolvedBlockers).toEqual([]);
    expect(result.evolution.approvalHistory).toEqual([0.6]);
  });

  it('승인율 개선 (60% → 85%) → improving, velocity 0.25', () => {
    const currentResult = { converged: true, approvalRate: 0.85, blockers: [] };
    const previousRounds = [{ approvalRate: 0.6, blockers: ['이슈A'] }];
    const result = trackConvergenceEvolution(currentResult, previousRounds);
    expect(result.evolution.velocity).toBeCloseTo(0.25, 5);
    expect(result.evolution.trend).toBe('improving');
    expect(result.evolution.approvalHistory).toEqual([0.6, 0.85]);
  });

  it('정체 감지 (75% → 77%) → stagnating, velocity 0.02', () => {
    const currentResult = { converged: false, approvalRate: 0.77, blockers: ['이슈A'] };
    const previousRounds = [{ approvalRate: 0.75, blockers: ['이슈A'] }];
    const result = trackConvergenceEvolution(currentResult, previousRounds);
    expect(result.evolution.velocity).toBeCloseTo(0.02, 5);
    expect(result.evolution.trend).toBe('stagnating');
  });

  it('후퇴 감지 (80% → 60%) → declining, velocity -0.2', () => {
    const currentResult = { converged: false, approvalRate: 0.6, blockers: ['새 이슈'] };
    const previousRounds = [{ approvalRate: 0.8, blockers: [] }];
    const result = trackConvergenceEvolution(currentResult, previousRounds);
    expect(result.evolution.velocity).toBeCloseTo(-0.2, 5);
    expect(result.evolution.trend).toBe('declining');
  });

  it('블로커 해결 추적 (이전 [a,b] → 현재 [b]) → resolved [a]', () => {
    const currentResult = { converged: false, approvalRate: 0.7, blockers: ['이슈B'] };
    const previousRounds = [{ approvalRate: 0.6, blockers: ['이슈A', '이슈B'] }];
    const result = trackConvergenceEvolution(currentResult, previousRounds);
    expect(result.evolution.resolvedBlockers).toEqual(['이슈A']);
    expect(result.evolution.newBlockers).toEqual([]);
  });

  it('새 블로커 추적 (이전 [a] → 현재 [a,c]) → new [c]', () => {
    const currentResult = { converged: false, approvalRate: 0.7, blockers: ['이슈A', '이슈C'] };
    const previousRounds = [{ approvalRate: 0.6, blockers: ['이슈A'] }];
    const result = trackConvergenceEvolution(currentResult, previousRounds);
    expect(result.evolution.newBlockers).toEqual(['이슈C']);
    expect(result.evolution.resolvedBlockers).toEqual([]);
  });

  it('다중 라운드 히스토리 (3라운드) → approvalHistory 3개', () => {
    const currentResult = { converged: true, approvalRate: 0.9, blockers: [] };
    const previousRounds = [
      { approvalRate: 0.5, blockers: ['이슈A'] },
      { approvalRate: 0.7, blockers: ['이슈B'] },
    ];
    const result = trackConvergenceEvolution(currentResult, previousRounds);
    expect(result.evolution.approvalHistory).toEqual([0.5, 0.7, 0.9]);
    expect(result.evolution.velocity).toBeCloseTo(0.2, 5);
    expect(result.evolution.trend).toBe('improving');
  });
});

describe('buildSynthesisPrompt 빈 배열 에러', () => {
  it('빈 배열 시 에러를 throw한다', () => {
    expect(() => buildSynthesisPrompt(SAMPLE_PROJECT, [], 1)).toThrow();
  });
});

describe('parseReviewOutput parseError 플래그', () => {
  it('빈 응답 시 parseError: true를 반환한다', () => {
    const result = parseReviewOutput('');
    expect(result.parseError).toBe(true);
  });
});

describe('checkConvergence 빈 reviews noReviews 플래그', () => {
  it('빈 배열 시 noReviews: true를 반환한다', () => {
    const result = checkConvergence([]);
    expect(result.noReviews).toBe(true);
    expect(result.converged).toBe(false);
  });
});

describe('buildSynthesisPrompt 프롬프트 크기 제한', () => {
  it('3000자 초과 analysis를 절단한다', () => {
    const longAnalysis = 'A'.repeat(5000);
    const agentOutputs = [{ roleId: 'cto', role: 'CTO', emoji: '', analysis: longAnalysis }];
    const prompt = buildSynthesisPrompt(SAMPLE_PROJECT, agentOutputs, 1);
    expect(prompt).not.toContain('A'.repeat(5000));
    expect(prompt).toContain('A'.repeat(3000));
    expect(prompt).toContain('...(이하 생략)');
  });

  it('3000자 이하 analysis는 절단하지 않는다', () => {
    const shortAnalysis = 'B'.repeat(2000);
    const agentOutputs = [{ roleId: 'cto', role: 'CTO', emoji: '', analysis: shortAnalysis }];
    const prompt = buildSynthesisPrompt(SAMPLE_PROJECT, agentOutputs, 1);
    expect(prompt).toContain(shortAnalysis);
    expect(prompt).not.toContain('...(이하 생략)');
  });
});

// --- 명확화 + 외부 서비스 관련 ---

describe('buildAgentAnalysisPrompt 명확화', () => {
  it('요구사항 명확화 섹션을 포함한다', () => {
    const prompt = buildAgentAnalysisPrompt(SAMPLE_PROJECT, SAMPLE_TEAM[0]);
    expect(prompt).toContain('## 요구사항 명확화');
    expect(prompt).toContain('외부 데이터 소스');
    expect(prompt).toContain('외부 서비스 API 키');
    expect(prompt).toContain('명확화 필요 사항');
  });
});

describe('buildSynthesisPrompt 외부 서비스', () => {
  it('외부 서비스 연동 섹션을 포함한다', () => {
    const agentOutputs = [{ roleId: 'cto', role: 'CTO', emoji: '', analysis: '분석 결과' }];
    const prompt = buildSynthesisPrompt(SAMPLE_PROJECT, agentOutputs, 1);
    expect(prompt).toContain('### 외부 서비스 연동');
    expect(prompt).toContain('환경변수명');
  });

  it('CEO 결정 필요 사항 섹션을 포함한다', () => {
    const agentOutputs = [{ roleId: 'cto', role: 'CTO', emoji: '', analysis: '분석' }];
    const prompt = buildSynthesisPrompt(SAMPLE_PROJECT, agentOutputs, 1);
    expect(prompt).toContain('### CEO 결정 필요 사항');
  });

  it('명확화 필요 사항 종합 원칙을 포함한다', () => {
    const agentOutputs = [{ roleId: 'cto', role: 'CTO', emoji: '', analysis: '분석' }];
    const prompt = buildSynthesisPrompt(SAMPLE_PROJECT, agentOutputs, 1);
    expect(prompt).toContain('명확화 필요 사항');
  });
});
