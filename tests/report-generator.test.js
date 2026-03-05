import { describe, it, expect } from 'vitest';
import {
  generateReport,
  generateRoleSummary,
  generateProjectStats,
  generateExecutiveSummary,
} from '../scripts/lib/output/report-generator.js';

const SAMPLE_PROJECT = {
  id: 'telegram-bot-2026-02',
  name: '텔레그램 봇',
  type: 'telegram-bot',
  description: '날씨를 알려주는 텔레그램 봇',
  status: 'completed',
  mode: 'plan-execute',
  team: [
    { roleId: 'cto', displayName: '민준', emoji: '', role: 'CTO' },
    { roleId: 'backend', displayName: '도윤', emoji: '', role: 'Backend Developer' },
    { roleId: 'qa', displayName: '지민', emoji: '', role: 'QA Engineer' },
  ],
  discussion: { rounds: [], planDocument: '# 기획서\n내용' },
  tasks: [
    { id: 'task-1', title: '아키텍처 설계', assignee: 'cto', status: 'completed' },
    { id: 'task-2', title: 'API 구현', assignee: 'backend', status: 'completed' },
    { id: 'task-3', title: 'DB 설계', assignee: 'backend', status: 'completed' },
    { id: 'task-4', title: '테스트 작성', assignee: 'qa', status: 'pending' },
  ],
};

describe('generateReport', () => {
  it('전체 보고서 구조를 포함한다', () => {
    const report = generateReport(SAMPLE_PROJECT);
    expect(report).toContain('텔레그램 봇');
    expect(report).toContain('보고서');
    expect(report).toContain('3명');
    expect(report).toContain('4개');
  });

  it('모든 팀원을 포함한다', () => {
    const report = generateReport(SAMPLE_PROJECT);
    expect(report).toContain('민준');
    expect(report).toContain('도윤');
    expect(report).toContain('지민');
    expect(report).toContain('CTO');
  });

  it('모드를 표시한다', () => {
    const report = generateReport(SAMPLE_PROJECT);
    expect(report).toContain('plan-execute');
  });

  it('기획서를 포함한다', () => {
    const report = generateReport(SAMPLE_PROJECT);
    expect(report).toContain('기획서');
  });
});

describe('generateRoleSummary', () => {
  it('역할별 요약을 생성한다', () => {
    const member = {
      roleId: 'backend',
      displayName: '도윤',
      emoji: '',
      role: 'Backend Developer',
    };
    const tasks = [
      { id: 'task-2', title: 'API 구현', assignee: 'backend', status: 'completed' },
      { id: 'task-3', title: 'DB 설계', assignee: 'backend', status: 'completed' },
    ];
    const summary = generateRoleSummary(member, tasks);
    expect(summary).toContain('도윤');
    expect(summary).toContain('Backend Developer');
    expect(summary).toContain('2개');
  });

  it('작업 없는 역할도 처리한다', () => {
    const member = { roleId: 'qa', displayName: '지민', emoji: '', role: 'QA Engineer' };
    const summary = generateRoleSummary(member, []);
    expect(summary).toContain('지민');
    expect(summary).toContain('0개');
  });
});

describe('generateProjectStats', () => {
  it('통계를 정확히 계산한다', () => {
    const stats = generateProjectStats(SAMPLE_PROJECT);
    expect(stats.totalTasks).toBe(4);
    expect(stats.completed).toBe(3);
    expect(stats.byRole.cto).toBe(1);
    expect(stats.byRole.backend).toBe(2);
    expect(stats.byRole.qa).toBe(1);
  });

  it('작업 없는 프로젝트를 처리한다', () => {
    const project = { ...SAMPLE_PROJECT, tasks: [] };
    const stats = generateProjectStats(project);
    expect(stats.totalTasks).toBe(0);
    expect(stats.completed).toBe(0);
  });
});

// --- 비용/성능 섹션 ---

describe('generateReport (비용/성능)', () => {
  it('메트릭스가 있으면 비용 섹션을 포함한다', () => {
    const project = {
      ...SAMPLE_PROJECT,
      metrics: {
        totalInputTokens: 5000,
        totalOutputTokens: 2000,
        totalCostUsd: 0.045,
        agentCalls: [],
        phaseMetrics: {},
        byRole: {
          cto: { callCount: 2, inputTokens: 2000, outputTokens: 1000, costUsd: 0.02 },
          backend: { callCount: 3, inputTokens: 3000, outputTokens: 1000, costUsd: 0.025 },
        },
        byProvider: {
          claude: { callCount: 5, inputTokens: 5000, outputTokens: 2000, costUsd: 0.045 },
        },
      },
    };
    const report = generateReport(project);
    expect(report).toContain('비용/성능');
    expect(report).toContain('총 비용');
    expect(report).toContain('에이전트 기여도');
  });

  it('메트릭스가 없으면 비용 섹션을 포함하지 않는다', () => {
    const project = { ...SAMPLE_PROJECT };
    delete project.metrics;
    const report = generateReport(project);
    expect(report).not.toContain('비용/성능');
  });
});

// --- Executive Summary ---

describe('generateExecutiveSummary', () => {
  it('완료율과 팀 규모를 포함한다', () => {
    const stats = generateProjectStats(SAMPLE_PROJECT);
    const summary = generateExecutiveSummary(SAMPLE_PROJECT, stats);
    expect(summary).toContain('Executive Summary');
    expect(summary).toContain('75%'); // 3/4
    expect(summary).toContain('3명');
  });

  it('실행 상태가 있으면 품질 게이트 통과율을 포함한다', () => {
    const project = {
      ...SAMPLE_PROJECT,
      executionState: {
        startedAt: '2026-03-01T00:00:00Z',
        completedAt: '2026-03-01T01:30:00Z',
        phaseResults: {
          1: { qualityGate: { passed: true } },
          2: { qualityGate: { passed: false } },
        },
      },
    };
    const stats = generateProjectStats(project);
    const summary = generateExecutiveSummary(project, stats);
    expect(summary).toContain('1/2 Phase 통과');
    expect(summary).toContain('1시간 30분');
  });

  it('completed 프로젝트에 적절한 다음 단계를 제안한다', () => {
    const stats = generateProjectStats(SAMPLE_PROJECT);
    const summary = generateExecutiveSummary(SAMPLE_PROJECT, stats);
    expect(summary).toContain('/report');
    expect(summary).toContain('/feedback');
  });

  it('planning 프로젝트에 적절한 다음 단계를 제안한다', () => {
    const project = { ...SAMPLE_PROJECT, status: 'planning' };
    const stats = generateProjectStats(project);
    const summary = generateExecutiveSummary(project, stats);
    expect(summary).toContain('/discuss');
    expect(summary).toContain('/approve');
  });

  it('generateReport에 Executive Summary가 포함된다', () => {
    const report = generateReport(SAMPLE_PROJECT);
    expect(report).toContain('Executive Summary');
    expect(report).toContain('완료율');
  });
});
