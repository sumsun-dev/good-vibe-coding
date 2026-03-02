import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'fs/promises';
import { resolve } from 'path';
import {
  createProject, getProject, updateProjectStatus, setProjectTeam,
  setProjectPlan, addProjectTasks, setProjectReport, listProjects, setBaseDir,
} from '../scripts/lib/project/project-manager.js';
import { recommendTeam, buildTeam, getTeamSummary, clearCaches } from '../scripts/lib/agent/team-builder.js';
import { buildDiscussionPrompt, buildPlanDocument } from '../scripts/lib/engine/discussion-engine.js';
import { buildTaskDistributionPrompt, buildExecutionPlan } from '../scripts/lib/engine/task-distributor.js';
import { generateReport, generateProjectStats } from '../scripts/lib/output/report-generator.js';
import {
  scaffold, loadTemplate, listTemplates, validateTemplate, setCustomTemplatesDir,
} from '../scripts/lib/project/template-scaffolder.js';

const TMP_DIR = resolve('.tmp-test-integration');

beforeEach(async () => {
  await mkdir(TMP_DIR, { recursive: true });
  setBaseDir(TMP_DIR);
  clearCaches();
});

afterEach(async () => {
  await rm(TMP_DIR, { recursive: true, force: true });
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

  it('템플릿 스캐폴딩: next-app 전체 스캐폴딩 검증', async () => {
    const targetDir = resolve(TMP_DIR, 'scaffold-next');
    const result = await scaffold('next-app', targetDir, {
      projectName: 'my-web-app',
      description: '통합 테스트용 웹앱',
    });

    expect(result.files.length).toBeGreaterThan(0);
    expect(result.files.every(f => f.written)).toBe(true);
    expect(result.postScaffoldMessage).toContain('npm install');

    const { readFile } = await import('fs/promises');
    const pkg = JSON.parse(await readFile(resolve(targetDir, 'package.json'), 'utf-8'));
    expect(pkg.name).toBe('my-web-app');
    expect(pkg.dependencies.next).toBeDefined();

    const readme = await readFile(resolve(targetDir, 'README.md'), 'utf-8');
    expect(readme).toContain('my-web-app');
    expect(readme).toContain('통합 테스트용 웹앱');
  });

  it('템플릿 스캐폴딩: express-api 전체 스캐폴딩 검증', async () => {
    const targetDir = resolve(TMP_DIR, 'scaffold-express');
    const result = await scaffold('express-api', targetDir, {
      projectName: 'my-api',
      description: 'API 통합 테스트',
      port: '8080',
    });

    expect(result.files.every(f => f.written)).toBe(true);

    const { readFile } = await import('fs/promises');
    const indexJs = await readFile(resolve(targetDir, 'src/index.js'), 'utf-8');
    expect(indexJs).toContain('8080');
    expect(indexJs).toContain('express');
  });

  it('템플릿 스캐폴딩: custom 템플릿 로딩 + 스캐폴딩', async () => {
    const customDir = resolve(TMP_DIR, 'custom-templates');
    await mkdir(customDir, { recursive: true });
    setCustomTemplatesDir(customDir);

    const customTemplate = {
      name: 'my-custom',
      displayName: 'Custom Template',
      version: '1.0.0',
      files: [
        { path: 'index.js', content: 'export const name = "{{projectName}}";' },
        { path: 'README.md', content: '# {{projectName}}' },
      ],
    };
    const { writeFile } = await import('fs/promises');
    await writeFile(resolve(customDir, 'my-custom.json'), JSON.stringify(customTemplate));

    const template = await loadTemplate('my-custom');
    expect(template.name).toBe('my-custom');

    const targetDir = resolve(TMP_DIR, 'scaffold-custom');
    const result = await scaffold('my-custom', targetDir, { projectName: 'custom-app' });
    expect(result.files.length).toBe(2);

    const { readFile } = await import('fs/promises');
    const content = await readFile(resolve(targetDir, 'index.js'), 'utf-8');
    expect(content).toContain('custom-app');
  });

  it('템플릿 스캐폴딩: 모든 built-in 템플릿 유효성 확인', async () => {
    const templates = await listTemplates();
    const builtinNames = ['next-app', 'express-api', 'cli-app', 'telegram-bot', 'npm-library'];
    for (const name of builtinNames) {
      const template = templates.find(t => t.name === name);
      expect(template).toBeDefined();
      const result = validateTemplate(template);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    }
  });
});
