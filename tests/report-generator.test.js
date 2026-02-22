import { describe, it, expect } from 'vitest';
import {
  generateReport,
  generateRoleSummary,
  generateProjectStats,
  generateGrowthSection,
} from '../scripts/lib/report-generator.js';

const SAMPLE_PROJECT = {
  id: 'telegram-bot-2026-02',
  name: '텔레그램 봇',
  type: 'telegram-bot',
  description: '날씨를 알려주는 텔레그램 봇',
  status: 'completed',
  mode: 'plan-execute',
  team: [
    { roleId: 'cto', displayName: '민준', emoji: '🏗️', role: 'CTO' },
    { roleId: 'backend', displayName: '도윤', emoji: '🔧', role: 'Backend Developer' },
    { roleId: 'qa', displayName: '지민', emoji: '🧪', role: 'QA Engineer' },
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
    const member = { roleId: 'backend', displayName: '도윤', emoji: '🔧', role: 'Backend Developer' };
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
    const member = { roleId: 'qa', displayName: '지민', emoji: '🧪', role: 'QA Engineer' };
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

describe('generateGrowthSection', () => {
  const GROWTH_PROFILES = new Map([
    ['cto', {
      roleId: 'cto', level: 4, levelName: 'Advanced',
      avgRating: 4.2, totalProjects: 5,
      strengths: ['아키텍처', '리더십'], improvements: ['문서화'],
      growthGoal: '문서화 강화', growthSummary: 'Lv.4 Advanced',
    }],
    ['backend', {
      roleId: 'backend', level: 2, levelName: 'Growing',
      avgRating: 2.5, totalProjects: 2,
      strengths: ['API 설계'], improvements: ['테스트'],
      growthGoal: '테스트 강화', growthSummary: 'Lv.2 Growing',
    }],
  ]);

  it('성장 분석 테이블을 생성한다', () => {
    const section = generateGrowthSection(SAMPLE_PROJECT.team, GROWTH_PROFILES);
    expect(section).toContain('팀원 성장 분석');
    expect(section).toContain('민준');
    expect(section).toContain('Advanced');
    expect(section).toContain('도윤');
    expect(section).toContain('Growing');
  });

  it('프로필 없는 팀원은 건너뛴다', () => {
    const section = generateGrowthSection(SAMPLE_PROJECT.team, GROWTH_PROFILES);
    // qa의 프로필은 없으므로 지민이 테이블에 없어야 함
    expect(section).not.toContain('지민');
  });

  it('강점이 없는 프로필도 처리한다', () => {
    const profiles = new Map([
      ['cto', {
        roleId: 'cto', level: 1, levelName: 'Beginner',
        avgRating: 0, totalProjects: 0,
        strengths: [], improvements: [],
        growthGoal: '첫 프로젝트', growthSummary: 'Lv.1 Beginner',
      }],
    ]);
    const section = generateGrowthSection(SAMPLE_PROJECT.team, profiles);
    expect(section).toContain('Beginner');
    expect(section).toContain('-');
  });
});

describe('generateReport with growthProfiles', () => {
  it('growthProfiles 옵션이 있으면 성장 분석 섹션이 포함된다', () => {
    const growthProfiles = new Map([
      ['cto', {
        roleId: 'cto', level: 3, levelName: 'Competent',
        avgRating: 3.5, totalProjects: 3,
        strengths: ['아키텍처'], improvements: [],
        growthGoal: '심화', growthSummary: 'Lv.3',
      }],
    ]);
    const report = generateReport(SAMPLE_PROJECT, { growthProfiles });
    expect(report).toContain('팀원 성장 분석');
  });

  it('growthProfiles 없으면 기존과 동일하다', () => {
    const report = generateReport(SAMPLE_PROJECT);
    expect(report).not.toContain('팀원 성장 분석');
  });
});
