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

  it('코드블록 안의 잘못된 JSON은 빈 배열을 반환한다', () => {
    const raw = '```json\n{invalid json[}\n```';
    const tasks = parseTaskList(raw);
    expect(tasks).toEqual([]);
  });

  it('텍스트 안에 포함된 배열 패턴을 추출한다', () => {
    const raw = '결과:\n[{"id":"task-1","title":"설계"}]\n끝.';
    const tasks = parseTaskList(raw);
    expect(tasks.length).toBe(1);
    expect(tasks[0].id).toBe('task-1');
  });

  it('배열 패턴이 잘못된 JSON이면 빈 배열을 반환한다', () => {
    const raw = '결과: [not valid json]';
    const tasks = parseTaskList(raw);
    expect(tasks).toEqual([]);
  });

  it('null 또는 undefined 입력은 빈 배열을 반환한다', () => {
    expect(parseTaskList(null)).toEqual([]);
    expect(parseTaskList(undefined)).toEqual([]);
    expect(parseTaskList('  ')).toEqual([]);
  });

  it('JSON이 배열이 아닌 객체이면 빈 배열을 반환한다', () => {
    const raw = '{"not": "array"}';
    const tasks = parseTaskList(raw);
    expect(tasks).toEqual([]);
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

  it('description이 없으면 기본 텍스트를 표시한다', () => {
    const task = { id: 'task-1', title: 'API 설계', assignee: 'backend' };
    const prompt = buildExecutionPrompt(task, SAMPLE_TEAM_MEMBER);
    expect(prompt).toContain('(상세 설명 없음)');
  });

  it('skills가 없는 팀원도 처리한다', () => {
    const member = { ...SAMPLE_TEAM_MEMBER, skills: undefined };
    const task = { id: 'task-1', title: 'A', description: 'B', assignee: 'backend' };
    const prompt = buildExecutionPrompt(task, member);
    expect(prompt).toContain('도윤');
  });

  it('growthContext가 있으면 성장 컨텍스트 섹션을 추가한다', () => {
    const member = { ...SAMPLE_TEAM_MEMBER, growthContext: '📈 **성장 이력** (Lv.3 Competent)\n- 강점: API 설계' };
    const task = { id: 'task-1', title: 'API 설계', description: '설명', assignee: 'backend' };
    const prompt = buildExecutionPrompt(task, member);
    expect(prompt).toContain('## 성장 컨텍스트');
    expect(prompt).toContain('Lv.3 Competent');
  });

  it('growthContext가 없으면 성장 컨텍스트 섹션이 없다', () => {
    const task = { id: 'task-1', title: 'API 설계', description: '설명', assignee: 'backend' };
    const prompt = buildExecutionPrompt(task, SAMPLE_TEAM_MEMBER);
    expect(prompt).not.toContain('## 성장 컨텍스트');
  });

  it('growthContext가 빈 문자열이면 섹션 미추가', () => {
    const member = { ...SAMPLE_TEAM_MEMBER, growthContext: '' };
    const task = { id: 'task-1', title: 'A', description: 'B', assignee: 'backend' };
    const prompt = buildExecutionPrompt(task, member);
    expect(prompt).not.toContain('## 성장 컨텍스트');
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

  it('phase가 없는 작업은 phase 1로 처리한다', () => {
    const tasks = [
      { id: 'task-1', title: 'A', assignee: 'cto' },
      { id: 'task-2', title: 'B', assignee: 'backend' },
    ];
    const plan = buildExecutionPlan(tasks, []);
    expect(plan.phases.length).toBe(1);
    expect(plan.phases[0].phase).toBe(1);
    expect(plan.phases[0].tasks.length).toBe(2);
  });

  it('의존관계가 없는 작업은 dependencies에 포함되지 않는다', () => {
    const tasks = [
      { id: 'task-1', title: 'A', assignee: 'cto', phase: 1, dependencies: [] },
    ];
    const plan = buildExecutionPlan(tasks, []);
    expect(plan.dependencies).toEqual({});
  });
});
