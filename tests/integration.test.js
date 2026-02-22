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
import { analyzeGrowth, getGrowthProfiles, formatGrowthReport } from '../scripts/lib/growth-manager.js';
import { generateGrowthSection } from '../scripts/lib/report-generator.js';
import {
  setCustomPersonaDir, createCustomRole, addCustomVariant, setOverride, getAvailableVariants,
} from '../scripts/lib/persona-manager.js';
import {
  scaffold, loadTemplate, listTemplates, validateTemplate, setCustomTemplatesDir,
} from '../scripts/lib/template-scaffolder.js';

const TMP_DIR = resolve('.tmp-test-integration');
const FEEDBACK_DIR = resolve('.tmp-test-integration-feedback');
const PERSONA_DIR = resolve('.tmp-test-integration-persona');

beforeEach(async () => {
  await mkdir(TMP_DIR, { recursive: true });
  await mkdir(FEEDBACK_DIR, { recursive: true });
  await mkdir(PERSONA_DIR, { recursive: true });
  setBaseDir(TMP_DIR);
  setFeedbackDir(FEEDBACK_DIR);
  setCustomPersonaDir(PERSONA_DIR);
  clearCaches();
});

afterEach(async () => {
  await rm(TMP_DIR, { recursive: true, force: true });
  await rm(FEEDBACK_DIR, { recursive: true, force: true });
  await rm(PERSONA_DIR, { recursive: true, force: true });
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

  it('성장 시스템: 피드백 → 성장 분석 → 프롬프트 반영', async () => {
    // 1. 피드백 누적
    await addFeedback('proj-1', 'cto', 5, '아키텍처 설계가 훌륭합니다');
    await addFeedback('proj-2', 'cto', 4, '좋은 기술 의사결정');
    await addFeedback('proj-3', 'cto', 5, '리더십이 뛰어남');
    await addFeedback('proj-1', 'backend', 3, 'API 깔끔하지만 테스트 부족');
    await addFeedback('proj-2', 'backend', 4, '안정적인 코드');

    // 2. 성장 분석
    const ctoProfile = await analyzeGrowth('cto');
    expect(ctoProfile.level).toBe(3);
    expect(ctoProfile.levelName).toBe('Competent');
    expect(ctoProfile.avgRating).toBeCloseTo(4.67, 1);

    const backendProfile = await analyzeGrowth('backend');
    expect(backendProfile.level).toBe(2);
    expect(backendProfile.levelName).toBe('Growing');

    // 3. 성장 프로필로 팀 빌드 (withGrowth)
    const team = await buildTeam(['cto', 'backend', 'qa'], {}, { withGrowth: true });
    expect(team[0].growthContext).toContain('Competent');
    expect(team[1].growthContext).toContain('Growing');
    expect(team[2].growthContext).toContain('Beginner');

    // 4. 토론 프롬프트에 성장 이력 반영
    const project = await createProject('테스트앱', 'web-app', '테스트');
    const prompt = buildDiscussionPrompt(project, team, 1);
    expect(prompt).toContain('성장 이력');

    // 5. 성장 리포트 생성
    const profiles = await getGrowthProfiles(['cto', 'backend', 'qa']);
    const growthReport = formatGrowthReport(profiles);
    expect(growthReport).toContain('Competent');
    expect(growthReport).toContain('Growing');
    expect(growthReport).toContain('Beginner');
  });

  it('성장 시스템: 보고서에 성장 분석 섹션 포함', async () => {
    // 피드백 추가
    await addFeedback('proj-1', 'cto', 4, '아키텍처 우수');
    await addFeedback('proj-2', 'cto', 5, '리더십 훌륭');
    await addFeedback('proj-1', 'backend', 3, '코드 안정적');

    // 프로젝트 + 보고서
    const project = await createProject('성장테스트', 'web-app', '테스트');
    const team = await buildTeam(['cto', 'backend'], {}, { withGrowth: true });
    const teamData = team.map(m => ({ roleId: m.roleId, displayName: m.displayName, emoji: m.emoji, role: m.role }));
    await setProjectTeam(project.id, teamData);

    const tasks = [
      { id: 'task-1', title: '설계', assignee: 'cto', status: 'completed' },
      { id: 'task-2', title: '구현', assignee: 'backend', status: 'pending' },
    ];
    await addProjectTasks(project.id, tasks);

    const finalProject = await getProject(project.id);
    finalProject.team = teamData;

    const growthProfiles = await getGrowthProfiles(['cto', 'backend']);
    const report = generateReport(finalProject, { growthProfiles });
    expect(report).toContain('팀원 성장 분석');
    expect(report).toContain('성장테스트');
  });

  it('성장 시스템: 피드백 없는 상태에서도 안전하게 동작', async () => {
    const profiles = await getGrowthProfiles(['cto', 'backend', 'qa']);
    expect(profiles.size).toBe(3);
    for (const [, profile] of profiles) {
      expect(profile.level).toBe(1);
      expect(profile.levelName).toBe('Beginner');
    }
    const report = formatGrowthReport(profiles);
    expect(report).toContain('Beginner');
  });

  it('커스텀 페르소나: 역할 생성 → 변형 추가 → 팀 빌드 → 프로젝트 생성', async () => {
    // 1. 커스텀 역할 생성
    await createCustomRole({
      id: 'ai-engineer',
      displayName: 'AI Engineer',
      emoji: '🤖',
      category: 'engineering',
      description: 'AI 파이프라인 구축',
      defaultTools: ['Read', 'Grep', 'Glob', 'Bash'],
      model: 'sonnet',
      discussionPriority: 5,
      skills: ['llm', 'rag'],
    });

    // 2. 변형 추가
    await addCustomVariant('ai-engineer', {
      id: 'creative-ai',
      name: '창의적 AI 빌더',
      emoji: '🤖',
      defaultName: '재현',
      trait: '창의적이고 실험적인',
      description: 'AI 파이프라인을 창의적으로 구축합니다',
      speakingStyle: '자유롭고 실험적인 스타일',
      greeting: 'AI로 새로운 걸 만들어봅시다!',
    });

    // 3. 내장 역할에 커스텀 오버라이드
    await setOverride('cto', 'visionary', { trait: '전략적이지만 실행력도 갖춘' });

    // 4. 팀 빌드 (커스텀 + 내장)
    clearCaches();
    const team = await buildTeam(['cto', 'ai-engineer', 'qa']);
    expect(team.length).toBe(3);
    expect(team[0].trait).toBe('전략적이지만 실행력도 갖춘');
    expect(team[1].roleId).toBe('ai-engineer');
    expect(team[1].displayName).toBe('재현');
    expect(team[2].roleId).toBe('qa');

    // 5. 프로젝트 생성 + 팀 설정
    const project = await createProject('AI 챗봇', 'web-app', 'RAG 기반 챗봇');
    const teamData = team.map(m => ({
      roleId: m.roleId, personalityVariant: m.personalityVariant,
      displayName: m.displayName, emoji: m.emoji,
    }));
    await setProjectTeam(project.id, teamData);

    // 6. 토론 프롬프트에 커스텀 역할 포함
    const updatedProject = await getProject(project.id);
    const prompt = buildDiscussionPrompt(updatedProject, team, 1);
    expect(prompt).toContain('AI 챗봇');
    expect(prompt).toContain('재현');
  });

  it('커스텀 페르소나: 내장 역할에 변형 추가 후 선택', async () => {
    // 1. CTO에 스타트업 변형 추가
    await addCustomVariant('cto', {
      id: 'startup-cto',
      name: '스타트업 CTO',
      emoji: '🏗️',
      defaultName: '태호',
      trait: '빠른 실행력의',
      description: '스타트업 환경에서 빠르게 결정합니다',
      speakingStyle: '간결하고 빠른 스타일',
      greeting: '빠르게 갑시다!',
    });

    // 2. 선택 가능한 variant 확인
    const variants = await getAvailableVariants('cto');
    expect(variants.length).toBe(3); // visionary + pragmatic + startup-cto

    // 3. 새 variant로 팀 빌드
    clearCaches();
    const team = await buildTeam(['cto'], { cto: 'startup-cto' });
    expect(team[0].personalityVariant).toBe('startup-cto');
    expect(team[0].displayName).toBe('태호');
    expect(team[0].greeting).toBe('빠르게 갑시다!');
  });

  it('커스텀 페르소나: 오버라이드 적용 후 보고서 생성', async () => {
    await setOverride('backend', 'architect', { trait: '체계적이면서도 빠른' });
    clearCaches();

    const project = await createProject('API 서버', 'api-server', 'REST API');
    const team = await buildTeam(['cto', 'backend', 'qa']);
    expect(team[1].trait).toBe('체계적이면서도 빠른');

    const teamData = team.map(m => ({
      roleId: m.roleId, displayName: m.displayName, emoji: m.emoji, role: m.role,
    }));
    await setProjectTeam(project.id, teamData);

    const tasks = [
      { id: 'task-1', title: 'API 설계', assignee: 'backend', status: 'completed' },
    ];
    await addProjectTasks(project.id, tasks);

    const finalProject = await getProject(project.id);
    finalProject.team = teamData;
    const report = generateReport(finalProject);
    expect(report).toContain('API 서버');
    expect(report).toContain('도윤');
  });

  it('성장 시스템: 실행 프롬프트에 성장 컨텍스트 반영', async () => {
    await addFeedback('proj-1', 'backend', 4, 'API 설계가 좋습니다');
    await addFeedback('proj-2', 'backend', 3, '테스트가 부족합니다');
    await addFeedback('proj-3', 'backend', 4, '안정적');

    const team = await buildTeam(['backend'], {}, { withGrowth: true });
    const task = { id: 'task-1', title: 'API 구현', description: 'REST API', assignee: 'backend' };
    const { buildExecutionPrompt } = await import('../scripts/lib/task-distributor.js');
    const prompt = buildExecutionPrompt(task, team[0]);
    expect(prompt).toContain('## 성장 컨텍스트');
    expect(prompt).toContain('Competent');
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
