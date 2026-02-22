import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, readFile } from 'fs/promises';
import { resolve } from 'path';
import {
  createProject,
  getProject,
  listProjects,
  updateProjectStatus,
  setProjectTeam,
  setProjectPlan,
  addProjectTasks,
  setProjectReport,
  getProjectDir,
  generateProjectId,
  setBaseDir,
} from '../scripts/lib/project-manager.js';

const TMP_DIR = resolve('.tmp-test-project-manager');

beforeEach(async () => {
  await mkdir(TMP_DIR, { recursive: true });
  setBaseDir(TMP_DIR);
});

afterEach(async () => {
  await rm(TMP_DIR, { recursive: true, force: true });
});

describe('generateProjectId', () => {
  it('영어 이름을 kebab-case + YYYY-MM로 변환한다', () => {
    const id = generateProjectId('Telegram Bot');
    expect(id).toMatch(/^telegram-bot-\d{4}-\d{2}$/);
  });

  it('한글 이름도 처리한다', () => {
    const id = generateProjectId('텔레그램 봇');
    expect(id).toMatch(/^텔레그램-봇-\d{4}-\d{2}$/);
  });

  it('특수문자를 제거한다', () => {
    const id = generateProjectId('My App! (v2)');
    expect(id).toMatch(/^my-app-v2-\d{4}-\d{2}$/);
  });

  it('연속 하이픈을 하나로 줄인다', () => {
    const id = generateProjectId('my   app');
    expect(id).toMatch(/^my-app-\d{4}-\d{2}$/);
  });
});

describe('createProject', () => {
  it('정상적으로 프로젝트를 생성한다', async () => {
    const project = await createProject('텔레그램 봇', 'telegram-bot', '봇 설명');
    expect(project.name).toBe('텔레그램 봇');
    expect(project.type).toBe('telegram-bot');
    expect(project.description).toBe('봇 설명');
    expect(project.status).toBe('planning');
    expect(project.mode).toBe('plan-only');
    expect(project.team).toEqual([]);
    expect(project.discussion).toEqual({ rounds: [], planDocument: '' });
    expect(project.tasks).toEqual([]);
    expect(project.report).toBeNull();
    expect(project.feedback).toEqual([]);
    expect(project.createdAt).toBeTruthy();
  });

  it('mode 옵션을 설정할 수 있다', async () => {
    const project = await createProject('앱', 'web-app', '설명', { mode: 'plan-execute' });
    expect(project.mode).toBe('plan-execute');
  });

  it('프로젝트 파일이 디스크에 저장된다', async () => {
    const project = await createProject('테스트', 'cli-tool', '설명');
    const dir = getProjectDir(project.id);
    const content = await readFile(resolve(dir, 'project.json'), 'utf-8');
    const saved = JSON.parse(content);
    expect(saved.id).toBe(project.id);
    expect(saved.name).toBe('테스트');
  });

  it('필수 필드가 없으면 에러를 던진다', async () => {
    await expect(createProject('', 'web-app', '설명')).rejects.toThrow('name');
    await expect(createProject('앱', '', '설명')).rejects.toThrow('type');
  });

  it('유효하지 않은 모드로 생성하면 에러', async () => {
    await expect(createProject('봇', 'telegram-bot', '설명', { mode: 'invalid' })).rejects.toThrow('유효하지 않은 모드');
  });

  it('description이 없으면 빈 문자열로 설정된다', async () => {
    const project = await createProject('봇', 'telegram-bot', null);
    expect(project.description).toBe('');
  });
});

describe('getProject', () => {
  it('존재하는 프로젝트를 반환한다', async () => {
    const created = await createProject('봇', 'telegram-bot', '설명');
    const found = await getProject(created.id);
    expect(found).not.toBeNull();
    expect(found.id).toBe(created.id);
    expect(found.name).toBe('봇');
  });

  it('존재하지 않는 프로젝트에 null을 반환한다', async () => {
    const result = await getProject('nonexistent-2099-01');
    expect(result).toBeNull();
  });
});

describe('listProjects', () => {
  it('빈 목록을 반환한다', async () => {
    const list = await listProjects();
    expect(list).toEqual([]);
  });

  it('여러 프로젝트를 반환한다', async () => {
    await createProject('프로젝트A', 'web-app', 'A설명');
    await createProject('프로젝트B', 'cli-tool', 'B설명');
    const list = await listProjects();
    expect(list.length).toBe(2);
    expect(list.map(p => p.name)).toContain('프로젝트A');
    expect(list.map(p => p.name)).toContain('프로젝트B');
  });

  it('존재하지 않는 baseDir에서 빈 목록을 반환한다', async () => {
    setBaseDir(resolve(TMP_DIR, 'nonexistent-sub-path'));
    const list = await listProjects();
    expect(list).toEqual([]);
  });
});

describe('updateProjectStatus', () => {
  it('정상적으로 상태를 전이한다', async () => {
    const project = await createProject('봇', 'telegram-bot', '설명');
    const updated = await updateProjectStatus(project.id, 'approved');
    expect(updated.status).toBe('approved');
  });

  it('유효하지 않은 상태로 전이하면 에러', async () => {
    const project = await createProject('봇', 'telegram-bot', '설명');
    await expect(updateProjectStatus(project.id, 'invalid')).rejects.toThrow();
  });

  it('존재하지 않는 프로젝트는 에러', async () => {
    await expect(updateProjectStatus('no-exist', 'approved')).rejects.toThrow();
  });
});

describe('setProjectTeam', () => {
  it('팀을 설정한다', async () => {
    const project = await createProject('봇', 'telegram-bot', '설명');
    const team = [
      { roleId: 'cto', personalityVariant: 'visionary', displayName: '민준', emoji: '🏗️' },
    ];
    const updated = await setProjectTeam(project.id, team);
    expect(updated.team).toEqual(team);
  });

  it('팀을 교체한다', async () => {
    const project = await createProject('봇', 'telegram-bot', '설명');
    await setProjectTeam(project.id, [{ roleId: 'cto', personalityVariant: 'visionary', displayName: '민준', emoji: '🏗️' }]);
    const newTeam = [{ roleId: 'backend', personalityVariant: 'architect', displayName: '도윤', emoji: '🔧' }];
    const updated = await setProjectTeam(project.id, newTeam);
    expect(updated.team).toEqual(newTeam);
    expect(updated.team.length).toBe(1);
  });
});

describe('setProjectPlan', () => {
  it('기획서를 설정한다', async () => {
    const project = await createProject('봇', 'telegram-bot', '설명');
    const plan = '# 기획서\n## 개요\n텔레그램 봇 기획서';
    const updated = await setProjectPlan(project.id, plan);
    expect(updated.discussion.planDocument).toBe(plan);
  });
});

describe('addProjectTasks', () => {
  it('작업을 추가한다', async () => {
    const project = await createProject('봇', 'telegram-bot', '설명');
    const tasks = [
      { id: 'task-1', title: 'API 설계', assignee: 'backend', status: 'pending' },
    ];
    const updated = await addProjectTasks(project.id, tasks);
    expect(updated.tasks.length).toBe(1);
    expect(updated.tasks[0].title).toBe('API 설계');
  });
});

describe('setProjectReport', () => {
  it('보고서를 설정한다', async () => {
    const project = await createProject('봇', 'telegram-bot', '설명');
    const report = '# 보고서\n완료';
    const updated = await setProjectReport(project.id, report);
    expect(updated.report).toBe(report);
  });
});
