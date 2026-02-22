import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'fs/promises';
import { resolve } from 'path';
import {
  createProject, getProject, updateProjectStatus, setProjectTeam,
  setProjectPlan, addProjectTasks, setProjectReport, listProjects, setBaseDir,
} from '../scripts/lib/project-manager.js';
import { recommendTeam, buildTeam, getTeamSummary, clearCaches } from '../scripts/lib/team-builder.js';
import { buildDiscussionPrompt, buildPlanDocument } from '../scripts/lib/discussion-engine.js';
import { buildTaskDistributionPrompt, buildExecutionPlan } from '../scripts/lib/task-distributor.js';
import { generateReport, generateProjectStats } from '../scripts/lib/report-generator.js';
import { addFeedback, getTeamStats, setFeedbackDir } from '../scripts/lib/feedback-manager.js';

const TMP_DIR = resolve('.tmp-test-integration');
const FEEDBACK_DIR = resolve('.tmp-test-integration-feedback');

beforeEach(async () => {
  await mkdir(TMP_DIR, { recursive: true });
  await mkdir(FEEDBACK_DIR, { recursive: true });
  setBaseDir(TMP_DIR);
  setFeedbackDir(FEEDBACK_DIR);
  clearCaches();
});

afterEach(async () => {
  await rm(TMP_DIR, { recursive: true, force: true });
  await rm(FEEDBACK_DIR, { recursive: true, force: true });
});

describe('통합 테스트: 전체 프로젝트 플로우', () => {
  it('plan-only: 프로젝트 생성 → 팀 구성 → 토론 → 기획서 → 보고서', async () => {
    // 1. 팀 추천
    const { recommended } = await recommendTeam('telegram-bot');
    expect(recommended).toEqual(['cto', 'backend', 'qa']);

    // 2. 팀 빌드
    const team = await buildTeam(recommended);
    expect(team.length).toBe(3);

    // 3. 프로젝트 생성
    const project = await createProject('텔레그램 봇', 'telegram-bot', '날씨 봇', { mode: 'plan-only' });
    expect(project.status).toBe('planning');

    // 4. 팀 설정
    const teamData = team.map(m => ({
      roleId: m.roleId, personalityVariant: m.personalityVariant,
      displayName: m.displayName, emoji: m.emoji,
    }));
    await setProjectTeam(project.id, teamData);

    // 5. 토론 프롬프트 생성
    const updatedProject = await getProject(project.id);
    const prompt = buildDiscussionPrompt(updatedProject, team, 1);
    expect(prompt).toContain('텔레그램 봇');

    // 6. 기획서 생성 (시뮬레이션)
    const planDoc = buildPlanDocument(updatedProject, [
      { role: 'CTO', content: '아키텍처: Node.js + telegraf' },
      { role: 'Backend', content: 'API: OpenWeatherMap' },
    ]);
    await setProjectPlan(project.id, planDoc);

    // 7. 상태 업데이트
    await updateProjectStatus(project.id, 'approved');

    // 8. 작업 추가
    const tasks = [
      { id: 'task-1', title: '아키텍처 설계', assignee: 'cto', phase: 1, dependencies: [], status: 'completed' },
      { id: 'task-2', title: 'API 연동', assignee: 'backend', phase: 2, dependencies: ['task-1'], status: 'completed' },
      { id: 'task-3', title: '테스트', assignee: 'qa', phase: 3, dependencies: ['task-2'], status: 'pending' },
    ];
    await addProjectTasks(project.id, tasks);

    // 9. 보고서 생성
    const finalProject = await getProject(project.id);
    finalProject.team = team.map(m => ({ roleId: m.roleId, displayName: m.displayName, emoji: m.emoji, role: m.role }));
    const report = generateReport(finalProject);
    expect(report).toContain('텔레그램 봇');
    expect(report).toContain('민준');
    expect(report).toContain('3개');

    // 10. 통계 확인
    const stats = generateProjectStats(finalProject);
    expect(stats.totalTasks).toBe(3);
    expect(stats.completed).toBe(2);
  });

  it('plan-execute: 모드 구분 확인', async () => {
    const project = await createProject('웹앱', 'web-app', '쇼핑몰', { mode: 'plan-execute' });
    expect(project.mode).toBe('plan-execute');

    const report = generateReport({
      ...project,
      team: [{ roleId: 'cto', displayName: '민준', emoji: '🏗️', role: 'CTO' }],
    });
    expect(report).toContain('plan-execute');
  });

  it('피드백 플로우: 피드백 추가 → 통계 확인', async () => {
    const project = await createProject('봇', 'telegram-bot', '설명');

    // 피드백 추가
    await addFeedback(project.id, 'cto', 5, '아키텍처 설계 훌륭');
    await addFeedback(project.id, 'backend', 4, 'API 깔끔');
    await addFeedback(project.id, 'qa', 3, '테스트 커버리지 부족');

    // 통계 확인
    const stats = await getTeamStats();
    expect(stats.length).toBe(3);
    const ctoStat = stats.find(s => s.roleId === 'cto');
    expect(ctoStat.avgRating).toBe(5);
  });

  it('다수 프로젝트 관리', async () => {
    await createProject('프로젝트A', 'web-app', 'A');
    await createProject('프로젝트B', 'cli-tool', 'B');
    await createProject('프로젝트C', 'telegram-bot', 'C');

    const list = await listProjects();
    expect(list.length).toBe(3);
  });

  it('실행 계획 생성', async () => {
    const tasks = [
      { id: 'task-1', title: 'A', assignee: 'cto', phase: 1, dependencies: [] },
      { id: 'task-2', title: 'B', assignee: 'backend', phase: 1, dependencies: [] },
      { id: 'task-3', title: 'C', assignee: 'qa', phase: 2, dependencies: ['task-1', 'task-2'] },
    ];
    const team = await buildTeam(['cto', 'backend', 'qa']);
    const plan = buildExecutionPlan(tasks, team);
    expect(plan.phases.length).toBe(2);
    expect(plan.phases[0].tasks.length).toBe(2);
    expect(plan.dependencies['task-3']).toEqual(['task-1', 'task-2']);
  });
});
