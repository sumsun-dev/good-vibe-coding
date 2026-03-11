import { describe, it, expect } from 'vitest';
import {
  buildAgentAnalysisPrompt,
  buildSynthesisPrompt,
  buildReviewPrompt,
  parseReviewOutput,
  checkConvergence,
  groupAgentsForParallelDispatch,
  trackConvergenceEvolution,
  compressPreviousContext,
  selectDiscussionReviewers,
  extractKeyDecisions,
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
  it('{ system, user } 객체를 반환한다', () => {
    const result = buildAgentAnalysisPrompt(SAMPLE_PROJECT, SAMPLE_TEAM[0]);
    expect(result).toHaveProperty('system');
    expect(result).toHaveProperty('user');
    expect(typeof result.system).toBe('string');
    expect(typeof result.user).toBe('string');
  });

  it('프로젝트 정보는 user에 포함한다', () => {
    const { user } = buildAgentAnalysisPrompt(SAMPLE_PROJECT, SAMPLE_TEAM[0]);
    expect(user).toContain('텔레그램 봇');
    expect(user).toContain('telegram-bot');
    expect(user).toContain('날씨를 알려주는');
  });

  it('팀원 페르소나 정보는 system에 포함한다', () => {
    const { system } = buildAgentAnalysisPrompt(SAMPLE_PROJECT, SAMPLE_TEAM[0]);
    expect(system).toContain('민준');
    expect(system).toContain('CTO');
    expect(system).toContain('전략적이고 큰 그림을 보는');
    expect(system).toContain('확신 있고 명확한 기술 리더 스타일');
  });

  it('기본 라운드는 1이다 (user에 포함)', () => {
    const { user } = buildAgentAnalysisPrompt(SAMPLE_PROJECT, SAMPLE_TEAM[0]);
    expect(user).toContain('라운드 1');
  });

  it('라운드를 컨텍스트로 전달할 수 있다 (user에 반영)', () => {
    const { user } = buildAgentAnalysisPrompt(SAMPLE_PROJECT, SAMPLE_TEAM[0], { round: 3 });
    expect(user).toContain('라운드 3');
  });

  it('이전 라운드 기획서가 있으면 user에 포함한다', () => {
    const { user } = buildAgentAnalysisPrompt(SAMPLE_PROJECT, SAMPLE_TEAM[0], {
      previousSynthesis: '## 기획서\n### 기술 스택\nNode.js',
    });
    expect(user).toContain('이전 라운드 기획서');
    expect(user).toContain('Node.js');
  });

  it('피드백이 있으면 user에 포함한다', () => {
    const { user } = buildAgentAnalysisPrompt(SAMPLE_PROJECT, SAMPLE_TEAM[0], {
      feedbackForMe: 'QA: 테스트 전략이 부족합니다',
    });
    expect(user).toContain('다른 팀원의 피드백');
    expect(user).toContain('테스트 전략이 부족합니다');
  });

  it('skills가 없는 팀원도 처리한다', () => {
    const member = { ...SAMPLE_TEAM[0], skills: undefined };
    const { system } = buildAgentAnalysisPrompt(SAMPLE_PROJECT, member);
    expect(system).toContain('민준');
  });

  it('컨텍스트가 비어있으면 user에 동적 섹션이 없다', () => {
    const { user } = buildAgentAnalysisPrompt(SAMPLE_PROJECT, SAMPLE_TEAM[0], {});
    expect(user).toContain('분석 요청');
    expect(user).not.toContain('이전 라운드');
    expect(user).not.toContain('피드백');
  });

  it('모든 컨텍스트 필드가 동시에 있으면 모두 user에 포함한다', () => {
    const { user } = buildAgentAnalysisPrompt(SAMPLE_PROJECT, SAMPLE_TEAM[0], {
      round: 2,
      previousSynthesis: '기획서 내용',
      feedbackForMe: '피드백 내용',
    });
    expect(user).toContain('라운드 2');
    expect(user).toContain('기획서 내용');
    expect(user).toContain('피드백 내용');
  });

  it('ceoFeedback이 있으면 user에 CEO 피드백 섹션을 포함한다', () => {
    const { user } = buildAgentAnalysisPrompt(SAMPLE_PROJECT, SAMPLE_TEAM[0], {
      ceoFeedback: '마이크로서비스 대신 모놀리스로 가주세요',
    });
    expect(user).toContain('CEO 피드백 (최우선)');
    expect(user).toContain('마이크로서비스 대신 모놀리스로 가주세요');
  });

  it('ceoFeedback이 없으면 user에 CEO 피드백 섹션이 없다', () => {
    const { user } = buildAgentAnalysisPrompt(SAMPLE_PROJECT, SAMPLE_TEAM[0], {});
    expect(user).not.toContain('CEO 피드백');
  });

  it('messages가 있으면 user에 다른 에이전트 메시지 섹션을 포함한다', () => {
    const { user } = buildAgentAnalysisPrompt(SAMPLE_PROJECT, SAMPLE_TEAM[0], {
      messages: [
        { from: 'qa', type: 'question', content: '보안 검증 방법은?' },
        { from: 'backend', type: 'fyi', content: 'REST API 설계 완료' },
      ],
    });
    expect(user).toContain('다른 에이전트 메시지');
    expect(user).toContain('보안 검증 방법은?');
    expect(user).toContain('REST API 설계 완료');
  });

  it('messages가 비어있으면 user에 메시지 섹션이 없다', () => {
    const { user } = buildAgentAnalysisPrompt(SAMPLE_PROJECT, SAMPLE_TEAM[0], { messages: [] });
    expect(user).not.toContain('다른 에이전트 메시지');
  });

  it('system은 같은 에이전트라면 라운드가 달라도 동일하다 (캐시 안정성)', () => {
    const { system: system1 } = buildAgentAnalysisPrompt(SAMPLE_PROJECT, SAMPLE_TEAM[0], {
      round: 1,
    });
    const { system: system2 } = buildAgentAnalysisPrompt(SAMPLE_PROJECT, SAMPLE_TEAM[0], {
      round: 2,
      previousSynthesis: '이전 기획서 내용',
    });
    expect(system1).toBe(system2);
  });

  it('user는 라운드가 다르면 달라진다', () => {
    const { user: user1 } = buildAgentAnalysisPrompt(SAMPLE_PROJECT, SAMPLE_TEAM[0], {
      round: 1,
    });
    const { user: user2 } = buildAgentAnalysisPrompt(SAMPLE_PROJECT, SAMPLE_TEAM[0], {
      round: 2,
    });
    expect(user1).not.toBe(user2);
  });
});

// --- buildSynthesisPrompt ---

describe('buildSynthesisPrompt', () => {
  const agentOutputs = [
    { roleId: 'cto', role: 'CTO', emoji: '', analysis: 'Node.js + telegraf 추천' },
    { roleId: 'backend', role: 'Backend Developer', emoji: '', analysis: 'REST API 설계 필요' },
    { roleId: 'qa', role: 'QA Engineer', emoji: '', analysis: '테스트 전략 수립' },
  ];

  it('{ system, user } 객체를 반환한다', () => {
    const result = buildSynthesisPrompt(SAMPLE_PROJECT, agentOutputs, 1);
    expect(result).toHaveProperty('system');
    expect(result).toHaveProperty('user');
    expect(typeof result.system).toBe('string');
    expect(typeof result.user).toBe('string');
  });

  it('프로젝트 정보는 user에 포함한다', () => {
    const { user } = buildSynthesisPrompt(SAMPLE_PROJECT, agentOutputs, 1);
    expect(user).toContain('텔레그램 봇');
    expect(user).toContain('telegram-bot');
  });

  it('모든 에이전트 분석 결과는 user에 포함한다', () => {
    const { user } = buildSynthesisPrompt(SAMPLE_PROJECT, agentOutputs, 1);
    expect(user).toContain('Node.js + telegraf 추천');
    expect(user).toContain('REST API 설계 필요');
    expect(user).toContain('테스트 전략 수립');
  });

  it('라운드 번호는 user에 포함한다', () => {
    const { user } = buildSynthesisPrompt(SAMPLE_PROJECT, agentOutputs, 2);
    expect(user).toContain('라운드 2');
  });

  it('기획서 출력 형식 가이드는 system에 포함한다', () => {
    const { system } = buildSynthesisPrompt(SAMPLE_PROJECT, agentOutputs, 1);
    expect(system).toContain('프로젝트 개요');
    expect(system).toContain('기술 스택');
    expect(system).toContain('아키텍처');
    expect(system).toContain('역할별 작업 분배');
  });

  it('에이전트 수는 user에 표시한다', () => {
    const { user } = buildSynthesisPrompt(SAMPLE_PROJECT, agentOutputs, 1);
    expect(user).toContain('3명');
  });

  it('빈 agentOutputs이면 에러를 throw한다', () => {
    expect(() => buildSynthesisPrompt(SAMPLE_PROJECT, [], 1)).toThrow();
    expect(() => buildSynthesisPrompt(SAMPLE_PROJECT, null, 1)).toThrow();
  });

  it('context.ceoFeedback이 있으면 user에 CEO 피드백 섹션을 포함한다', () => {
    const { user } = buildSynthesisPrompt(SAMPLE_PROJECT, agentOutputs, 1, {
      ceoFeedback: 'UI를 더 단순하게 해주세요',
    });
    expect(user).toContain('## CEO 피드백');
    expect(user).toContain('UI를 더 단순하게 해주세요');
  });

  it('context.ceoFeedback이 없으면 user에 CEO 피드백 섹션이 없다', () => {
    const { user } = buildSynthesisPrompt(SAMPLE_PROJECT, agentOutputs, 1, {});
    expect(user).not.toContain('CEO 피드백');
  });

  it('context가 생략되면 기본 동작을 유지한다', () => {
    const { user } = buildSynthesisPrompt(SAMPLE_PROJECT, agentOutputs, 1);
    expect(user).toContain('텔레그램 봇');
    expect(user).not.toContain('CEO 피드백');
  });

  it('Mermaid 아키텍처 다이어그램 지시가 system에 포함된다', () => {
    const { system } = buildSynthesisPrompt(SAMPLE_PROJECT, agentOutputs, 1);
    expect(system).toContain('아키텍처 다이어그램');
    expect(system).toContain('Mermaid');
  });

  it('system은 라운드가 달라도 동일하다 (캐시 안정성)', () => {
    const { system: system1 } = buildSynthesisPrompt(SAMPLE_PROJECT, agentOutputs, 1);
    const { system: system2 } = buildSynthesisPrompt(SAMPLE_PROJECT, agentOutputs, 2);
    expect(system1).toBe(system2);
  });
});

// --- buildReviewPrompt ---

describe('buildReviewPrompt', () => {
  const plan = '## 기획서\n### 기술 스택\nNode.js + telegraf';

  it('{ system, user } 객체를 반환한다', () => {
    const result = buildReviewPrompt(SAMPLE_TEAM[0], plan, 1);
    expect(result).toHaveProperty('system');
    expect(result).toHaveProperty('user');
    expect(typeof result.system).toBe('string');
    expect(typeof result.user).toBe('string');
  });

  it('팀원 정보는 system에 포함한다', () => {
    const { system } = buildReviewPrompt(SAMPLE_TEAM[0], plan, 1);
    expect(system).toContain('민준');
    expect(system).toContain('CTO');
  });

  it('기획서 내용은 user에 포함한다', () => {
    const { user } = buildReviewPrompt(SAMPLE_TEAM[0], plan, 1);
    expect(user).toContain('Node.js + telegraf');
  });

  it('라운드 번호는 user에 포함한다', () => {
    const { user } = buildReviewPrompt(SAMPLE_TEAM[0], plan, 2);
    expect(user).toContain('라운드 2');
  });

  it('JSON 출력 형식 가이드는 system에 포함한다', () => {
    const { system } = buildReviewPrompt(SAMPLE_TEAM[0], plan, 1);
    expect(system).toContain('approved');
    expect(system).toContain('feedback');
    expect(system).toContain('issues');
  });

  it('system은 같은 에이전트라면 라운드가 달라도 동일하다 (캐시 안정성)', () => {
    const { system: s1 } = buildReviewPrompt(SAMPLE_TEAM[0], plan, 1);
    const { system: s2 } = buildReviewPrompt(SAMPLE_TEAM[0], '완전히 다른 기획서', 2);
    expect(s1).toBe(s2);
  });

  it('user는 기획서 내용이 달라지면 달라진다', () => {
    const { user: u1 } = buildReviewPrompt(SAMPLE_TEAM[0], '기획서 A', 1);
    const { user: u2 } = buildReviewPrompt(SAMPLE_TEAM[0], '기획서 B', 1);
    expect(u1).not.toBe(u2);
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

// --- compressPreviousContext ---

describe('compressPreviousContext', () => {
  it('빈 입력이면 빈 문자열을 반환한다', () => {
    expect(compressPreviousContext('')).toBe('');
    expect(compressPreviousContext(null)).toBe('');
    expect(compressPreviousContext(undefined)).toBe('');
  });

  it('maxLength 이하의 짧은 입력은 그대로 반환한다', () => {
    const short = '## 기획서\n### 결정 사항\n- Node.js 사용';
    const result = compressPreviousContext(short, 2000);
    expect(result).toBe(short);
  });

  it('긴 입력은 maxLength 이하로 압축한다', () => {
    const longText = '## 기획서\n' + '장황한 설명 내용. '.repeat(500);
    const result = compressPreviousContext(longText, 500);
    expect(result.length).toBeLessThanOrEqual(500 + 50); // suffix 여유
  });

  it('핵심 섹션(결정, 리스크, 역할, 기술 스택)을 우선 추출한다', () => {
    // maxLength를 충분히 크게 설정하여 압축된 핵심 섹션이 포함되도록 함
    const synthesis = `## 기획서

### 프로젝트 개요
이 프로젝트는 날씨 정보를 제공하는 텔레그램 봇입니다. 매우 긴 설명이 여기에 들어갑니다.
${'긴 설명. '.repeat(200)}

### 기술 스택
- Node.js
- Telegraf
- Weather API

### 결정 사항
- 모놀리스 아키텍처로 결정
- PostgreSQL 사용

### 역할별 작업 분배
- CTO: 아키텍처 설계
- Backend: API 구현`;

    // maxLength를 2000으로 설정하면 핵심 섹션이 충분히 추출됨
    const result = compressPreviousContext(synthesis, 2000);
    // 압축 결과에 핵심 섹션 정보가 포함되어야 함
    expect(result).toContain('기술 스택');
    expect(result).toContain('Node.js');
  });

  it('파싱 실패 시 단순 절단(fallback)으로 대응한다', () => {
    const veryLong = 'a'.repeat(5000);
    const result = compressPreviousContext(veryLong, 1000);
    expect(result.length).toBeLessThanOrEqual(1100); // suffix 포함 여유
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

describe('checkConvergence earlyExit', () => {
  it('승인율 0.86, blockers 0 → earlyExit=true, converged=true', () => {
    // 7명 중 6명 승인 → 6/7 ≈ 0.857
    const reviews = [
      { approved: true, feedback: 'OK', issues: [] },
      { approved: true, feedback: 'OK', issues: [] },
      { approved: true, feedback: 'OK', issues: [] },
      { approved: true, feedback: 'OK', issues: [] },
      { approved: true, feedback: 'OK', issues: [] },
      { approved: true, feedback: 'OK', issues: [] },
      {
        approved: false,
        feedback: '개선 필요',
        issues: [{ severity: 'minor', description: '사소한 이슈' }],
      },
    ];
    const result = checkConvergence(reviews);
    expect(result.earlyExit).toBe(true);
    expect(result.converged).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it('승인율 0.86, blockers 1 → earlyExit=false', () => {
    // 7명 중 6명 승인이지만 critical 블로커 존재
    const reviews = [
      { approved: true, feedback: 'OK', issues: [] },
      { approved: true, feedback: 'OK', issues: [] },
      { approved: true, feedback: 'OK', issues: [] },
      { approved: true, feedback: 'OK', issues: [] },
      { approved: true, feedback: 'OK', issues: [] },
      { approved: true, feedback: 'OK', issues: [] },
      {
        approved: false,
        feedback: '보안 문제',
        issues: [{ severity: 'critical', description: 'SQL 인젝션' }],
      },
    ];
    const result = checkConvergence(reviews);
    expect(result.earlyExit).toBe(false);
    expect(result.blockers).toEqual(['SQL 인젝션']);
  });

  it('승인율 0.70, blockers 0 → earlyExit=false, converged=false', () => {
    // 10명 중 7명 승인 → 0.7, critical 블로커 없음
    const reviews = Array.from({ length: 7 }, () => ({
      approved: true,
      feedback: 'OK',
      issues: [],
    }));
    reviews.push(
      {
        approved: false,
        feedback: '개선 필요',
        issues: [{ severity: 'minor', description: '사소' }],
      },
      { approved: false, feedback: '개선 필요', issues: [] },
      { approved: false, feedback: '개선 필요', issues: [] },
    );
    const result = checkConvergence(reviews);
    expect(result.approvalRate).toBeCloseTo(0.7, 5);
    expect(result.earlyExit).toBe(false);
    expect(result.converged).toBe(false);
    expect(result.blockers).toEqual([]);
  });
});

describe('buildSynthesisPrompt 프롬프트 크기 제한', () => {
  it('3000자 초과 analysis를 user에서 절단한다', () => {
    const longAnalysis = 'A'.repeat(5000);
    const agentOutputs = [{ roleId: 'cto', role: 'CTO', emoji: '', analysis: longAnalysis }];
    const { user } = buildSynthesisPrompt(SAMPLE_PROJECT, agentOutputs, 1);
    expect(user).not.toContain('A'.repeat(5000));
    expect(user).not.toContain('A'.repeat(3000));
    expect(user).toContain('...(이하 생략)');
    // truncateText는 suffix 포함하여 maxLen을 보장하므로 3000 - suffix.length 만큼 포함
    expect(user).toContain('A'.repeat(2989));
  });

  it('3000자 이하 analysis는 user에서 절단하지 않는다', () => {
    const shortAnalysis = 'B'.repeat(2000);
    const agentOutputs = [{ roleId: 'cto', role: 'CTO', emoji: '', analysis: shortAnalysis }];
    const { user } = buildSynthesisPrompt(SAMPLE_PROJECT, agentOutputs, 1);
    expect(user).toContain(shortAnalysis);
    expect(user).not.toContain('...(이하 생략)');
  });
});

// --- 명확화 + 외부 서비스 관련 ---

describe('buildAgentAnalysisPrompt 명확화', () => {
  it('요구사항 명확화 섹션을 system에 포함한다', () => {
    const { system } = buildAgentAnalysisPrompt(SAMPLE_PROJECT, SAMPLE_TEAM[0]);
    expect(system).toContain('## 요구사항 명확화');
    expect(system).toContain('외부 데이터 소스');
    expect(system).toContain('외부 서비스 API 키');
    expect(system).toContain('명확화 필요 사항');
  });
});

describe('buildSynthesisPrompt 외부 서비스', () => {
  it('외부 서비스 연동 섹션을 system에 포함한다', () => {
    const agentOutputs = [{ roleId: 'cto', role: 'CTO', emoji: '', analysis: '분석 결과' }];
    const { system } = buildSynthesisPrompt(SAMPLE_PROJECT, agentOutputs, 1);
    expect(system).toContain('### 외부 서비스 연동');
    expect(system).toContain('환경변수명');
  });

  it('CEO 결정 필요 사항 섹션을 system에 포함한다', () => {
    const agentOutputs = [{ roleId: 'cto', role: 'CTO', emoji: '', analysis: '분석' }];
    const { system } = buildSynthesisPrompt(SAMPLE_PROJECT, agentOutputs, 1);
    expect(system).toContain('### CEO 결정 필요 사항');
  });

  it('명확화 필요 사항 종합 원칙을 system에 포함한다', () => {
    const agentOutputs = [{ roleId: 'cto', role: 'CTO', emoji: '', analysis: '분석' }];
    const { system } = buildSynthesisPrompt(SAMPLE_PROJECT, agentOutputs, 1);
    expect(system).toContain('명확화 필요 사항');
  });
});

// --- selectDiscussionReviewers ---

describe('selectDiscussionReviewers', () => {
  it('팀 규모가 maxReviewers 이하면 전원 반환한다', () => {
    const small = SAMPLE_TEAM.slice(0, 2);
    const result = selectDiscussionReviewers(small, 3);
    expect(result).toEqual(small);
  });

  it('유니버셜 리뷰어(cto, qa)를 우선 선정한다', () => {
    const result = selectDiscussionReviewers(SAMPLE_TEAM, 3);
    const roleIds = result.map((r) => r.roleId);
    expect(roleIds).toContain('cto');
    expect(roleIds).toContain('qa');
    expect(result.length).toBe(3);
  });

  it('maxReviewers를 초과하지 않는다', () => {
    const result = selectDiscussionReviewers(SAMPLE_TEAM, 2);
    expect(result.length).toBe(2);
  });

  it('빈 배열이면 빈 배열을 반환한다', () => {
    expect(selectDiscussionReviewers([], 3)).toEqual([]);
    expect(selectDiscussionReviewers(null, 3)).toEqual([]);
  });

  it('유니버셜 외 나머지는 priority 순으로 채운다', () => {
    const result = selectDiscussionReviewers(SAMPLE_TEAM, 3);
    const roleIds = result.map((r) => r.roleId);
    // cto(1), qa(6) 포함, 나머지 1자리는 po(2)
    expect(roleIds).toContain('po');
  });
});

// --- extractKeyDecisions ---

describe('extractKeyDecisions', () => {
  it('빈 입력이면 빈 문자열을 반환한다', () => {
    expect(extractKeyDecisions('')).toBe('');
    expect(extractKeyDecisions(null)).toBe('');
  });

  it('짧은 입력은 그대로 반환한다', () => {
    const short = '### 기술 스택\n- Node.js';
    expect(extractKeyDecisions(short, 1200)).toBe(short);
  });

  it('결정/아키텍처/리스크 섹션만 추출한다', () => {
    const synthesis = `## 기획서

### 프로젝트 개요
이 프로젝트는 날씨 봇입니다.
${'매우 긴 설명 내용이 여기에 들어갑니다. '.repeat(200)}

### 기술 스택
- Node.js
- PostgreSQL

### 결정 사항
- 모놀리스 아키텍처 채택
- REST API 사용

### 리스크 및 대응
- API 키 노출 위험
- 레이트 리밋 초과 가능성

### 일반 참고사항
이 부분은 추출 대상이 아닙니다.`;

    // maxLength를 기본값(1200)으로 사용하여 실제 압축 동작 검증
    const result = extractKeyDecisions(synthesis);
    expect(result).toContain('기술 스택');
    expect(result).toContain('Node.js');
    expect(result).toContain('결정 사항');
    expect(result).toContain('모놀리스 아키텍처 채택');
    expect(result).toContain('리스크');
    expect(result).not.toContain('매우 긴 설명');
  });

  it('maxLength를 초과하면 절단한다', () => {
    const synthesis = `### 기술 스택\n${'- 기술항목\n'.repeat(200)}\n### 결정 사항\n${'- 결정항목\n'.repeat(200)}`;
    const result = extractKeyDecisions(synthesis, 500);
    expect(result.length).toBeLessThanOrEqual(510);
  });
});

// --- buildAgentAnalysisPrompt 라운드별 압축 ---

describe('buildAgentAnalysisPrompt 라운드별 컨텍스트 압축', () => {
  it('라운드 3에서는 핵심 결정 사항 중심으로 압축한다', () => {
    const longSynthesis = `### 기술 스택\n- Node.js\n### 프로젝트 개요\n${'설명 '.repeat(500)}\n### 결정 사항\n- 결정1`;
    const { user } = buildAgentAnalysisPrompt(SAMPLE_PROJECT, SAMPLE_TEAM[0], {
      round: 3,
      previousSynthesis: longSynthesis,
    });
    expect(user).toContain('핵심 결정 사항');
    expect(user).toContain('블로커 해결에 집중');
  });

  it('라운드 2에서는 기존 압축을 사용한다', () => {
    const { user } = buildAgentAnalysisPrompt(SAMPLE_PROJECT, SAMPLE_TEAM[0], {
      round: 2,
      previousSynthesis: '## 기획서\n### 기술 스택\n- Node.js',
    });
    expect(user).toContain('수정/보완 의견');
  });
});
