import { describe, it, expect } from 'vitest';
import {
  buildTaskDistributionPrompt,
  parseTaskList,
  buildExecutionPrompt,
  buildExecutionPlan,
} from '../scripts/lib/task-distributor.js';

const SAMPLE_PROJECT = {
  id: 'telegram-bot-2026-02',
  name: '텔레그램 봇',
  type: 'telegram-bot',
  description: '날씨를 알려주는 텔레그램 봇',
};

const SAMPLE_PLAN = `# 기획서
## 기술 스택
Node.js, telegraf
## 아키텍처
모놀리식
## 역할별 작업 분배
- CTO: 아키텍처 설계
- Backend: API 구현
- QA: 테스트 작성`;

const SAMPLE_TEAM_MEMBER = {
  roleId: 'backend',
  displayName: '도윤',
  emoji: '🔧',
  role: 'Backend Developer',
  trait: '체계적이고 설계 중심의',
  speakingStyle: '논리적이고 구조화된 설명 스타일',
  skills: ['api', 'database', 'auth'],
  tools: ['Read', 'Grep', 'Glob', 'Bash', 'Edit', 'Write'],
};

describe('buildTaskDistributionPrompt', () => {
  it('프로젝트 정보를 포함한다', () => {
    const prompt = buildTaskDistributionPrompt(SAMPLE_PROJECT, SAMPLE_PLAN);
    expect(prompt).toContain('텔레그램 봇');
    expect(prompt).toContain('telegram-bot');
  });

  it('기획서 내용을 포함한다', () => {
    const prompt = buildTaskDistributionPrompt(SAMPLE_PROJECT, SAMPLE_PLAN);
    expect(prompt).toContain('Node.js, telegraf');
    expect(prompt).toContain('아키텍처 설계');
  });

  it('작업 출력 형식 가이드를 포함한다', () => {
    const prompt = buildTaskDistributionPrompt(SAMPLE_PROJECT, SAMPLE_PLAN);
    expect(prompt).toContain('title');
    expect(prompt).toContain('assignee');
    expect(prompt).toContain('phase');
  });
});

describe('parseTaskList', () => {
  it('JSON 작업 목록을 파싱한다', () => {
    const raw = JSON.stringify([
      { id: 'task-1', title: 'API 설계', assignee: 'backend', phase: 1, dependencies: [] },
      { id: 'task-2', title: '테스트', assignee: 'qa', phase: 2, dependencies: ['task-1'] },
    ]);
    const tasks = parseTaskList(raw);
    expect(tasks.length).toBe(2);
    expect(tasks[0].id).toBe('task-1');
    expect(tasks[1].dependencies).toContain('task-1');
  });

  it('빈 목록을 처리한다', () => {
    const tasks = parseTaskList('[]');
    expect(tasks).toEqual([]);
  });

  it('유효하지 않은 JSON은 빈 배열을 반환한다', () => {
    const tasks = parseTaskList('not json');
    expect(tasks).toEqual([]);
  });

  it('JSON이 배열을 포함한 텍스트에서 추출한다', () => {
    const raw = `작업 목록:\n\`\`\`json\n[{"id":"task-1","title":"API"}]\n\`\`\``;
    const tasks = parseTaskList(raw);
    expect(tasks.length).toBe(1);
  });
});

describe('buildExecutionPrompt', () => {
  it('작업 내용을 포함한다', () => {
    const task = { id: 'task-1', title: 'API 설계', description: 'REST API를 설계하세요', assignee: 'backend' };
    const prompt = buildExecutionPrompt(task, SAMPLE_TEAM_MEMBER);
    expect(prompt).toContain('API 설계');
    expect(prompt).toContain('REST API를 설계하세요');
  });

  it('팀원 페르소나를 포함한다', () => {
    const task = { id: 'task-1', title: 'API 설계', description: '설명', assignee: 'backend' };
    const prompt = buildExecutionPrompt(task, SAMPLE_TEAM_MEMBER);
    expect(prompt).toContain('도윤');
    expect(prompt).toContain('Backend Developer');
    expect(prompt).toContain('체계적이고 설계 중심의');
  });
});

describe('buildExecutionPlan', () => {
  it('phase별로 그룹핑한다', () => {
    const tasks = [
      { id: 'task-1', title: 'A', assignee: 'cto', phase: 1, dependencies: [] },
      { id: 'task-2', title: 'B', assignee: 'backend', phase: 1, dependencies: [] },
      { id: 'task-3', title: 'C', assignee: 'qa', phase: 2, dependencies: ['task-1'] },
    ];
    const team = [
      { roleId: 'cto', displayName: '민준' },
      { roleId: 'backend', displayName: '도윤' },
      { roleId: 'qa', displayName: '지민' },
    ];
    const plan = buildExecutionPlan(tasks, team);
    expect(plan.phases.length).toBe(2);
    expect(plan.phases[0].tasks.length).toBe(2);
    expect(plan.phases[1].tasks.length).toBe(1);
  });

  it('의존관계를 포함한다', () => {
    const tasks = [
      { id: 'task-1', title: 'A', assignee: 'cto', phase: 1, dependencies: [] },
      { id: 'task-2', title: 'B', assignee: 'backend', phase: 2, dependencies: ['task-1'] },
    ];
    const plan = buildExecutionPlan(tasks, []);
    expect(plan.dependencies).toEqual({ 'task-2': ['task-1'] });
  });
});
