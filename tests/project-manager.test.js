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
  saveTaskOutput,
  addTaskReviews,
  updateTaskStatus,
  addTaskMaterializationResult,
  getExecutionProgress,
  addDiscussionRound,
  recordMetrics,
  recordContributions,
} from '../scripts/lib/project/project-manager.js';
import { AppError } from '../scripts/lib/core/validators.js';

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

  it('metrics 필드가 초기화된다', async () => {
    const project = await createProject('메트릭스 테스트', 'cli-tool', '설명');
    expect(project.metrics).toBeDefined();
    expect(project.metrics.totalInputTokens).toBe(0);
    expect(project.metrics.totalOutputTokens).toBe(0);
    expect(project.metrics.totalCostUsd).toBe(0);
    expect(project.metrics.agentCalls).toEqual([]);
    expect(project.metrics.byRole).toEqual({});
    expect(project.metrics.byProvider).toEqual({});
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

describe('saveTaskOutput', () => {
  it('태스크에 출력을 저장한다', async () => {
    const project = await createProject('봇', 'telegram-bot', '설명');
    await addProjectTasks(project.id, [
      { id: 'task-1', title: 'API 설계', assignee: 'backend', status: 'pending' },
    ]);
    const updated = await saveTaskOutput(project.id, 'task-1', '결과 출력입니다');
    expect(updated.tasks[0].taskOutput).toBe('결과 출력입니다');
  });

  it('maxLines 초과 시 truncate한다', async () => {
    const project = await createProject('봇', 'telegram-bot', '설명');
    await addProjectTasks(project.id, [
      { id: 'task-1', title: 'API 설계', assignee: 'backend', status: 'pending' },
    ]);
    const longOutput = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join('\n');
    const updated = await saveTaskOutput(project.id, 'task-1', longOutput, { maxLines: 3 });
    expect(updated.tasks[0].taskOutput).toContain('line 1');
    expect(updated.tasks[0].taskOutput).toContain('line 3');
    expect(updated.tasks[0].taskOutput).toContain('...(truncated)');
    expect(updated.tasks[0].taskOutput).not.toContain('line 4');
  });

  it('존재하지 않는 프로젝트는 에러', async () => {
    await expect(saveTaskOutput('no-exist', 'task-1', '출력')).rejects.toThrow('프로젝트를 찾을 수 없습니다');
  });

  it('존재하지 않는 태스크는 에러', async () => {
    const project = await createProject('봇', 'telegram-bot', '설명');
    await expect(saveTaskOutput(project.id, 'no-task', '출력')).rejects.toThrow('태스크를 찾을 수 없습니다');
  });

  it('null/undefined taskOutput은 빈 문자열로 저장된다', async () => {
    const project = await createProject('봇', 'telegram-bot', '설명');
    await addProjectTasks(project.id, [
      { id: 'task-1', title: 'API 설계', assignee: 'backend', status: 'pending' },
    ]);
    const updated = await saveTaskOutput(project.id, 'task-1', null);
    expect(updated.tasks[0].taskOutput).toBe('');
  });
});

describe('addTaskReviews', () => {
  it('태스크에 리뷰를 추가한다', async () => {
    const project = await createProject('봇', 'telegram-bot', '설명');
    await addProjectTasks(project.id, [
      { id: 'task-1', title: 'API 설계', assignee: 'backend', status: 'pending' },
    ]);
    const reviews = [{ verdict: 'approve', issues: [] }];
    const updated = await addTaskReviews(project.id, 'task-1', reviews);
    expect(updated.tasks[0].reviews).toHaveLength(1);
    expect(updated.tasks[0].reviews[0].verdict).toBe('approve');
  });

  it('기존 리뷰에 추가한다', async () => {
    const project = await createProject('봇', 'telegram-bot', '설명');
    await addProjectTasks(project.id, [
      { id: 'task-1', title: 'API 설계', assignee: 'backend', status: 'pending' },
    ]);
    await addTaskReviews(project.id, 'task-1', [{ verdict: 'approve', issues: [] }]);
    const updated = await addTaskReviews(project.id, 'task-1', [{ verdict: 'request-changes', issues: [{ severity: 'critical' }] }]);
    expect(updated.tasks[0].reviews).toHaveLength(2);
  });

  it('존재하지 않는 프로젝트는 에러', async () => {
    await expect(addTaskReviews('no-exist', 'task-1', [])).rejects.toThrow('프로젝트를 찾을 수 없습니다');
  });

  it('존재하지 않는 태스크는 에러', async () => {
    const project = await createProject('봇', 'telegram-bot', '설명');
    await expect(addTaskReviews(project.id, 'no-task', [])).rejects.toThrow('태스크를 찾을 수 없습니다');
  });
});

describe('updateTaskStatus', () => {
  it('태스크 상태를 업데이트한다', async () => {
    const project = await createProject('봇', 'telegram-bot', '설명');
    await addProjectTasks(project.id, [
      { id: 'task-1', title: 'API 설계', assignee: 'backend', status: 'pending' },
    ]);
    const updated = await updateTaskStatus(project.id, 'task-1', 'completed');
    expect(updated.tasks[0].status).toBe('completed');
  });

  it('존재하지 않는 프로젝트는 에러', async () => {
    await expect(updateTaskStatus('no-exist', 'task-1', 'completed')).rejects.toThrow('프로젝트를 찾을 수 없습니다');
  });

  it('존재하지 않는 태스크는 에러', async () => {
    const project = await createProject('봇', 'telegram-bot', '설명');
    await expect(updateTaskStatus(project.id, 'no-task', 'completed')).rejects.toThrow('태스크를 찾을 수 없습니다');
  });
});

describe('addTaskMaterializationResult', () => {
  it('태스크에 materialization 결과를 추가한다', async () => {
    const project = await createProject('봇', 'telegram-bot', '설명');
    await addProjectTasks(project.id, [
      { id: 'task-1', title: 'API 설계', assignee: 'backend', status: 'pending' },
    ]);
    const materializeResult = { totalBlocks: 2, materializedCount: 2 };
    const updated = await addTaskMaterializationResult(project.id, 'task-1', materializeResult);
    expect(updated.tasks[0].materialization).toHaveLength(1);
    expect(updated.tasks[0].materialization[0].totalBlocks).toBe(2);
    expect(updated.tasks[0].materialization[0].timestamp).toBeTruthy();
  });

  it('여러 번 추가할 수 있다', async () => {
    const project = await createProject('봇', 'telegram-bot', '설명');
    await addProjectTasks(project.id, [
      { id: 'task-1', title: 'API 설계', assignee: 'backend', status: 'pending' },
    ]);
    await addTaskMaterializationResult(project.id, 'task-1', { totalBlocks: 1 });
    const updated = await addTaskMaterializationResult(project.id, 'task-1', { totalBlocks: 3 });
    expect(updated.tasks[0].materialization).toHaveLength(2);
  });

  it('존재하지 않는 프로젝트는 에러', async () => {
    await expect(addTaskMaterializationResult('no-exist', 'task-1', {})).rejects.toThrow('프로젝트를 찾을 수 없습니다');
  });

  it('존재하지 않는 태스크는 에러', async () => {
    const project = await createProject('봇', 'telegram-bot', '설명');
    await expect(addTaskMaterializationResult(project.id, 'no-task', {})).rejects.toThrow('태스크를 찾을 수 없습니다');
  });
});

describe('getExecutionProgress', () => {
  it('빈 프로젝트는 0%를 반환한다', () => {
    const progress = getExecutionProgress({ tasks: [] });
    expect(progress.totalTasks).toBe(0);
    expect(progress.completedTasks).toBe(0);
    expect(progress.percentage).toBe(0);
  });

  it('모든 태스크 완료 시 100%를 반환한다', () => {
    const progress = getExecutionProgress({
      tasks: [
        { id: 't1', status: 'completed', phase: 1 },
        { id: 't2', status: 'completed', phase: 1 },
      ],
    });
    expect(progress.totalTasks).toBe(2);
    expect(progress.completedTasks).toBe(2);
    expect(progress.percentage).toBe(100);
  });

  it('부분 완료 시 올바른 퍼센트를 반환한다', () => {
    const progress = getExecutionProgress({
      tasks: [
        { id: 't1', status: 'completed', phase: 1 },
        { id: 't2', status: 'pending', phase: 2 },
        { id: 't3', status: 'pending', phase: 2 },
        { id: 't4', status: 'pending', phase: 3 },
      ],
    });
    expect(progress.totalTasks).toBe(4);
    expect(progress.completedTasks).toBe(1);
    expect(progress.percentage).toBe(25);
    expect(progress.currentPhase).toBe(2);
    expect(progress.totalPhases).toBe(3);
  });

  it('phase가 없는 태스크도 처리한다', () => {
    const progress = getExecutionProgress({
      tasks: [
        { id: 't1', status: 'completed' },
        { id: 't2', status: 'pending' },
      ],
    });
    expect(progress.totalTasks).toBe(2);
    expect(progress.completedTasks).toBe(1);
    expect(progress.percentage).toBe(50);
    expect(progress.totalPhases).toBe(1);
  });

  it('tasks가 undefined이면 0을 반환한다', () => {
    const progress = getExecutionProgress({});
    expect(progress.totalTasks).toBe(0);
    expect(progress.percentage).toBe(0);
  });

  it('currentPhase가 올바르게 계산된다', () => {
    const progress = getExecutionProgress({
      tasks: [
        { id: 't1', status: 'completed', phase: 1 },
        { id: 't2', status: 'completed', phase: 1 },
        { id: 't3', status: 'pending', phase: 2 },
      ],
    });
    expect(progress.currentPhase).toBe(2);
  });
});

describe('saveProject concurrency', () => {
  it('동시 쓰기가 직렬화되어 마지막 값이 보존된다', async () => {
    const project = await createProject('봇', 'telegram-bot', '설명');
    const updates = Array.from({ length: 5 }, (_, i) =>
      setProjectPlan(project.id, `plan-${i}`)
    );
    const results = await Promise.all(updates);
    const final = await getProject(project.id);
    // All promises should resolve without error
    expect(results).toHaveLength(5);
    // The last write wins (serialized order matches dispatch order)
    expect(final.discussion.planDocument).toBe('plan-4');
  });

  it('쓰기 실패 후 다음 쓰기가 정상 동작한다', async () => {
    const project = await createProject('봇', 'telegram-bot', '설명');
    // Force a failure by updating a non-existent project
    await expect(setProjectPlan('no-exist-id', 'plan')).rejects.toThrow();
    // Next write to the valid project should still work
    const updated = await setProjectPlan(project.id, '정상 기획서');
    expect(updated.discussion.planDocument).toBe('정상 기획서');
  });

  it('10개 동시 쓰기가 모두 보존된다 (스트레스 테스트)', async () => {
    const project = await createProject('스트레스', 'telegram-bot', '설명');
    const updates = Array.from({ length: 10 }, (_, i) =>
      setProjectPlan(project.id, `plan-${i}`)
    );
    const results = await Promise.all(updates);
    const final = await getProject(project.id);
    expect(results).toHaveLength(10);
    expect(final.discussion.planDocument).toBe('plan-9');
  });

  it('서로 다른 projectId 간 병렬 쓰기는 비간섭이다', async () => {
    const p1 = await createProject('프로젝트A', 'web-app', '설명A');
    const p2 = await createProject('프로젝트B', 'cli-tool', '설명B');
    await Promise.all([
      setProjectPlan(p1.id, 'A의 기획서'),
      setProjectPlan(p2.id, 'B의 기획서'),
    ]);
    const r1 = await getProject(p1.id);
    const r2 = await getProject(p2.id);
    expect(r1.discussion.planDocument).toBe('A의 기획서');
    expect(r2.discussion.planDocument).toBe('B의 기획서');
  });
});

describe('addDiscussionRound', () => {
  it('토론 라운드를 추가한다', async () => {
    const project = await createProject('봇', 'telegram-bot', '설명');
    const roundData = { round: 1, agentOutputs: [], synthesis: '기획서', reviews: [], converged: false };
    const updated = await addDiscussionRound(project.id, roundData);
    expect(updated.discussion.rounds).toHaveLength(1);
    expect(updated.discussion.planDocument).toBe('기획서');
  });

  it('여러 라운드를 추가할 수 있다', async () => {
    const project = await createProject('봇', 'telegram-bot', '설명');
    await addDiscussionRound(project.id, { round: 1, synthesis: 'v1' });
    const updated = await addDiscussionRound(project.id, { round: 2, synthesis: 'v2' });
    expect(updated.discussion.rounds).toHaveLength(2);
    expect(updated.discussion.planDocument).toBe('v2');
  });
});

// --- recordMetrics ---

describe('recordMetrics', () => {
  it('에이전트 호출 이벤트를 기록한다', async () => {
    const project = await createProject('메트릭스', 'cli-tool', '설명');
    const updated = await recordMetrics(project.id, {
      type: 'agent-call',
      roleId: 'cto',
      provider: 'claude',
      inputTokens: 1000,
      outputTokens: 500,
    });
    expect(updated.metrics.totalInputTokens).toBe(1000);
    expect(updated.metrics.totalOutputTokens).toBe(500);
    expect(updated.metrics.totalCostUsd).toBeGreaterThan(0);
    expect(updated.metrics.byRole.cto.callCount).toBe(1);
  });

  it('페이즈 완료 이벤트를 기록한다', async () => {
    const project = await createProject('메트릭스2', 'cli-tool', '설명');
    const updated = await recordMetrics(project.id, {
      type: 'phase-completion',
      phase: 1,
      durationMs: 5000,
      taskCount: 3,
    });
    expect(updated.metrics.phaseMetrics['phase-1']).toBeDefined();
    expect(updated.metrics.phaseMetrics['phase-1'].taskCount).toBe(3);
  });

  it('존재하지 않는 프로젝트는 에러를 던진다', async () => {
    await expect(recordMetrics('nonexistent', { type: 'agent-call' }))
      .rejects.toThrow('프로젝트를 찾을 수 없습니다');
  });
});

describe('에러 타입 검증 (Phase 2)', () => {
  it('존재하지 않는 프로젝트는 NOT_FOUND AppError를 던진다', async () => {
    try {
      await updateProjectStatus('no-exist', 'approved');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect(e.code).toBe('NOT_FOUND');
      expect(e.message).toContain('프로젝트를 찾을 수 없습니다');
    }
  });

  it('유효하지 않은 상태는 INPUT_ERROR AppError를 던진다', async () => {
    const project = await createProject('에러테스트', 'web-app', '설명');
    try {
      await updateProjectStatus(project.id, 'invalid');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect(e.code).toBe('INPUT_ERROR');
      expect(e.message).toContain('유효하지 않은 상태');
    }
  });

  it('존재하지 않는 태스크는 NOT_FOUND AppError를 던진다', async () => {
    const project = await createProject('에러테스트2', 'web-app', '설명');
    try {
      await updateTaskStatus(project.id, 'no-task', 'completed');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect(e.code).toBe('NOT_FOUND');
      expect(e.message).toContain('태스크를 찾을 수 없습니다');
    }
  });

  it('유효하지 않은 모드는 INPUT_ERROR AppError를 던진다', async () => {
    try {
      await createProject('에러테스트3', 'web-app', '설명', { mode: 'bad-mode' });
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect(e.code).toBe('INPUT_ERROR');
      expect(e.message).toContain('유효하지 않은 모드');
    }
  });
});

describe('recordContributions', () => {
  it('기여도를 정상 기록한다', async () => {
    const project = await createProject('기여도 테스트', 'web-app', '설명');
    const contributions = [
      { roleId: 'qa', contributionScore: 3.5, criticalsCaught: 2 },
      { roleId: 'security', contributionScore: 2.0, criticalsCaught: 1 },
    ];
    const updated = await recordContributions(project.id, contributions);
    expect(updated.contributions).toBeTruthy();
    expect(updated.contributions.qa.totalScore).toBe(3.5);
    expect(updated.contributions.qa.reviewCount).toBe(1);
    expect(updated.contributions.qa.criticalsCaught).toBe(2);
    expect(updated.contributions.security.totalScore).toBe(2.0);
  });

  it('기존 기여도에 누적한다', async () => {
    const project = await createProject('누적 테스트', 'web-app', '설명');
    await recordContributions(project.id, [
      { roleId: 'qa', contributionScore: 2.0, criticalsCaught: 1 },
    ]);
    const updated = await recordContributions(project.id, [
      { roleId: 'qa', contributionScore: 3.0, criticalsCaught: 2 },
    ]);
    expect(updated.contributions.qa.totalScore).toBe(5.0);
    expect(updated.contributions.qa.reviewCount).toBe(2);
    expect(updated.contributions.qa.criticalsCaught).toBe(3);
  });

  it('contributionScore가 없으면 0으로 처리한다', async () => {
    const project = await createProject('기본값 테스트', 'web-app', '설명');
    const updated = await recordContributions(project.id, [
      { roleId: 'cto' },
    ]);
    expect(updated.contributions.cto.totalScore).toBe(0);
    expect(updated.contributions.cto.reviewCount).toBe(1);
    expect(updated.contributions.cto.criticalsCaught).toBe(0);
  });
});
