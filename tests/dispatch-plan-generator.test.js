import { describe, it, expect } from 'vitest';
import { buildDiscussionDispatchPlan, buildExecutionDispatchPlan } from '../scripts/lib/engine/dispatch-plan-generator.js';

const SAMPLE_PROJECT = {
  id: 'test-2025-01',
  name: '테스트 프로젝트',
  type: 'web-app',
  description: '웹 앱 프로젝트',
};

const SAMPLE_TEAM = [
  {
    roleId: 'cto',
    displayName: '민준',
    emoji: '🏗️',
    role: 'CTO',
    trait: '비전있는',
    speakingStyle: '전략적',
    skills: ['architecture', 'tech-stack'],
    model: 'sonnet',
    discussionPriority: 1,
    workDomains: ['architecture'],
    reviewDomains: ['architecture', 'code-quality'],
  },
  {
    roleId: 'backend',
    displayName: '도윤',
    emoji: '🔧',
    role: 'Backend Developer',
    trait: '꼼꼼한',
    speakingStyle: '체계적',
    skills: ['api', 'database'],
    model: 'sonnet',
    discussionPriority: 3,
    workDomains: ['api', 'database'],
    reviewDomains: ['api', 'database'],
  },
  {
    roleId: 'qa',
    displayName: '지민',
    emoji: '🧪',
    role: 'QA Engineer',
    trait: '꼼꼼한',
    speakingStyle: '분석적',
    skills: ['testing', 'quality'],
    model: 'sonnet',
    discussionPriority: 5,
    workDomains: ['testing'],
    reviewDomains: ['testing', 'code-quality'],
  },
];

const SAMPLE_TASKS = [
  { id: 'task-1', title: 'API 설계', assignee: 'backend', description: 'REST API 설계', phase: 1, dependencies: [], status: 'pending' },
  { id: 'task-2', title: '테스트 전략', assignee: 'qa', description: '테스트 계획 수립', phase: 1, dependencies: [], status: 'pending' },
  { id: 'task-3', title: 'API 구현', assignee: 'backend', description: 'API 엔드포인트 구현', phase: 2, dependencies: ['task-1'], status: 'pending' },
];

// --- buildDiscussionDispatchPlan ---

describe('buildDiscussionDispatchPlan', () => {
  it('구조화된 토론 계획을 생성한다', () => {
    const plan = buildDiscussionDispatchPlan(SAMPLE_PROJECT, SAMPLE_TEAM);
    expect(plan.type).toBe('discussion');
    expect(plan.project.id).toBe('test-2025-01');
    expect(plan.round).toBe(1);
    expect(plan.tiers.length).toBeGreaterThan(0);
    expect(plan.synthesisPrompt).toBeTruthy();
    expect(plan.reviewPrompts).toHaveLength(3);
    expect(plan.convergenceConfig.threshold).toBe(0.8);
    expect(plan.convergenceConfig.maxRounds).toBe(3);
  });

  it('tier별로 에이전트를 그룹화한다', () => {
    const plan = buildDiscussionDispatchPlan(SAMPLE_PROJECT, SAMPLE_TEAM);
    // CTO: priority 1 → tier 1, backend: priority 3 → tier 2, qa: priority 5 → tier 3
    const allAgents = plan.tiers.flatMap(t => t.agents);
    expect(allAgents).toHaveLength(3);
    expect(allAgents.find(a => a.roleId === 'cto')).toBeTruthy();
  });

  it('각 에이전트에 프롬프트를 포함한다', () => {
    const plan = buildDiscussionDispatchPlan(SAMPLE_PROJECT, SAMPLE_TEAM);
    for (const tier of plan.tiers) {
      for (const agent of tier.agents) {
        expect(agent.prompt).toBeTruthy();
        expect(agent.roleId).toBeTruthy();
        expect(agent.displayName).toBeTruthy();
      }
    }
  });

  it('라운드와 maxRounds를 커스텀 설정할 수 있다', () => {
    const plan = buildDiscussionDispatchPlan(SAMPLE_PROJECT, SAMPLE_TEAM, {
      round: 2,
      maxRounds: 5,
    });
    expect(plan.round).toBe(2);
    expect(plan.convergenceConfig.maxRounds).toBe(5);
  });

  it('이전 종합 결과를 포함할 수 있다', () => {
    const plan = buildDiscussionDispatchPlan(SAMPLE_PROJECT, SAMPLE_TEAM, {
      round: 2,
      previousSynthesis: '이전 기획서 내용',
    });
    const allAgents = plan.tiers.flatMap(t => t.agents);
    expect(allAgents[0].prompt).toContain('이전 기획서 내용');
  });

  it('빈 팀은 빈 계획을 반환한다', () => {
    const plan = buildDiscussionDispatchPlan(SAMPLE_PROJECT, []);
    expect(plan.tiers).toEqual([]);
    expect(plan.project).toBeNull();
  });

  it('null 프로젝트는 빈 계획을 반환한다', () => {
    const plan = buildDiscussionDispatchPlan(null, SAMPLE_TEAM);
    expect(plan.project).toBeNull();
    expect(plan.tiers).toEqual([]);
  });

  it('리뷰 프롬프트에 팀원 정보가 포함된다', () => {
    const plan = buildDiscussionDispatchPlan(SAMPLE_PROJECT, SAMPLE_TEAM);
    expect(plan.reviewPrompts[0].roleId).toBe('cto');
    expect(plan.reviewPrompts[0].prompt).toContain('민준');
  });
});

// --- buildExecutionDispatchPlan ---

describe('buildExecutionDispatchPlan', () => {
  it('구조화된 실행 계획을 생성한다', () => {
    const plan = buildExecutionDispatchPlan(SAMPLE_PROJECT, SAMPLE_TASKS, SAMPLE_TEAM);
    expect(plan.type).toBe('execution');
    expect(plan.project.id).toBe('test-2025-01');
    expect(plan.phases.length).toBeGreaterThan(0);
    expect(plan.reviewConfig.minReviewers).toBe(2);
    expect(plan.reviewConfig.maxRevisionRounds).toBe(2);
  });

  it('execute와 review 페이즈를 교대로 생성한다', () => {
    const plan = buildExecutionDispatchPlan(SAMPLE_PROJECT, SAMPLE_TASKS, SAMPLE_TEAM);
    const types = plan.phases.map(p => p.type);
    // 각 execute 페이즈 뒤에 review 페이즈가 있다
    for (let i = 0; i < types.length - 1; i += 2) {
      expect(types[i]).toBe('execute');
      expect(types[i + 1]).toBe('review');
    }
  });

  it('코드 태스크에 TDD 프롬프트를 사용한다', () => {
    const plan = buildExecutionDispatchPlan(SAMPLE_PROJECT, SAMPLE_TASKS, SAMPLE_TEAM);
    const executPhase = plan.phases.find(p => p.type === 'execute');
    const apiTask = executPhase.tasks.find(t => t.id === 'task-3');
    if (apiTask && apiTask.isCodeTask) {
      expect(apiTask.prompt).toContain('TDD');
    }
  });

  it('리뷰 페이즈에 리뷰어 정보를 포함한다', () => {
    const plan = buildExecutionDispatchPlan(SAMPLE_PROJECT, SAMPLE_TASKS, SAMPLE_TEAM);
    const reviewPhase = plan.phases.find(p => p.type === 'review');
    expect(reviewPhase).toBeTruthy();
    for (const task of reviewPhase.tasks) {
      expect(task.reviewers).toBeTruthy();
      expect(task.reviewers.length).toBeGreaterThanOrEqual(0);
    }
  });

  it('빈 태스크는 빈 계획을 반환한다', () => {
    const plan = buildExecutionDispatchPlan(SAMPLE_PROJECT, [], SAMPLE_TEAM);
    expect(plan.phases).toEqual([]);
    expect(plan.project).toBeNull();
  });

  it('빈 팀은 빈 계획을 반환한다', () => {
    const plan = buildExecutionDispatchPlan(SAMPLE_PROJECT, SAMPLE_TASKS, []);
    expect(plan.project).toBeNull();
  });

  it('null 프로젝트는 빈 계획을 반환한다', () => {
    const plan = buildExecutionDispatchPlan(null, SAMPLE_TASKS, SAMPLE_TEAM);
    expect(plan.project).toBeNull();
  });

  it('의존 관계를 포함한다', () => {
    const plan = buildExecutionDispatchPlan(SAMPLE_PROJECT, SAMPLE_TASKS, SAMPLE_TEAM);
    expect(plan.dependencies).toBeDefined();
    expect(plan.dependencies['task-3']).toContain('task-1');
  });

  it('기획 결정사항을 전달할 수 있다', () => {
    const plan = buildExecutionDispatchPlan(SAMPLE_PROJECT, SAMPLE_TASKS, SAMPLE_TEAM, {
      planExcerpt: 'REST API 사용',
    });
    const executPhase = plan.phases.find(p => p.type === 'execute');
    const taskWithPrompt = executPhase.tasks.find(t => t.prompt);
    if (taskWithPrompt) {
      expect(taskWithPrompt.prompt).toContain('REST API 사용');
    }
  });

  it('팀에 없는 assignee의 태스크도 처리한다', () => {
    const tasks = [{ id: 'task-x', title: '디자인', assignee: 'uiux', description: 'UI 설계', phase: 1, dependencies: [] }];
    const plan = buildExecutionDispatchPlan(SAMPLE_PROJECT, tasks, SAMPLE_TEAM);
    const executPhase = plan.phases.find(p => p.type === 'execute');
    expect(executPhase.tasks[0].prompt).toBeNull();
  });

  it('실행 계획 태스크에 model 필드가 포함된다', () => {
    const plan = buildExecutionDispatchPlan(SAMPLE_PROJECT, SAMPLE_TASKS, SAMPLE_TEAM);
    const executPhase = plan.phases.find(p => p.type === 'execute');
    for (const task of executPhase.tasks) {
      expect(task.model).toBeTruthy();
      expect(typeof task.model).toBe('string');
    }
  });

  it('리뷰어에 model 필드가 포함된다', () => {
    const plan = buildExecutionDispatchPlan(SAMPLE_PROJECT, SAMPLE_TASKS, SAMPLE_TEAM);
    const reviewPhase = plan.phases.find(p => p.type === 'review');
    for (const task of reviewPhase.tasks) {
      for (const reviewer of task.reviewers) {
        expect(reviewer.model).toBeTruthy();
        expect(typeof reviewer.model).toBe('string');
      }
    }
  });

  it('팀에 없는 assignee의 model은 sonnet 기본값이다', () => {
    const tasks = [{ id: 'task-x', title: '디자인', assignee: 'uiux', description: 'UI 설계', phase: 1, dependencies: [] }];
    const plan = buildExecutionDispatchPlan(SAMPLE_PROJECT, tasks, SAMPLE_TEAM);
    const executPhase = plan.phases.find(p => p.type === 'execute');
    expect(executPhase.tasks[0].model).toBe('sonnet');
  });
});
