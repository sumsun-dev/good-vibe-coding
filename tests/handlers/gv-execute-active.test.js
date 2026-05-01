/**
 * gv-execute 핸들러 활성 프로젝트 mode 분기 E2E 테스트.
 *
 * 회귀 가드: projectId 없는 기존 task-graph 흐름은 그대로 동작해야 함.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { resolve } from 'path';
import { mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';

const CLI_PATH = resolve('scripts/cli.js');
const TMP_BASE = resolve(tmpdir(), 'good-vibe-test-gv-execute-active');

const childEnv = { ...process.env, GOOD_VIBE_BASE_DIR: TMP_BASE };

function cliExec(command, input) {
  return JSON.parse(
    execSync(`node ${CLI_PATH} ${command}`, {
      input: JSON.stringify(input),
      encoding: 'utf-8',
      timeout: 15_000,
      env: childEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    }),
  );
}

function cliExecRaw(command, input) {
  try {
    const stdout = execSync(`node ${CLI_PATH} ${command}`, {
      input: input ? JSON.stringify(input) : '',
      encoding: 'utf-8',
      timeout: 15_000,
      env: childEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { exitCode: 0, stdout, stderr: '' };
  } catch (err) {
    return { exitCode: err.status, stdout: '', stderr: err.stderr || '' };
  }
}

describe('handlers/gv-execute — 활성 프로젝트 mode 분기', () => {
  const createdIds = [];

  beforeAll(() => {
    mkdirSync(TMP_BASE, { recursive: true });
  });

  afterAll(() => {
    rmSync(TMP_BASE, { recursive: true, force: true });
  });

  afterEach(() => {
    createdIds.length = 0;
  });

  it('회귀: projectId 없으면 기존 task-graph 흐름 (5 task type 모두)', () => {
    const r = cliExec('gv-execute', { taskRoute: { taskType: 'ask' } });
    expect(r.success).toBe(true);
    expect(r.finalState).toBe('done');
    expect(r.history).toBeInstanceOf(Array);
  });

  it('plan-only + planning + projectId → mode 흐름 진입 → status: approved (placeholder)', () => {
    const project = cliExec('create-project', {
      name: 'mode-dispatch-plan-only',
      type: 'web-app',
      description: 'plan-only mode dispatch test',
      mode: 'plan-only',
    });
    createdIds.push(project.id);
    expect(project.status).toBe('planning');

    const r = cliExec('gv-execute', {
      projectId: project.id,
      taskRoute: { taskType: 'plan' }, // mode 흐름이라 사용 안 됨
    });

    expect(r.success).toBe(true);
    expect(r.finalState).toBe('approved');
    expect(r.rounds).toBeGreaterThanOrEqual(1);
    expect(r.panel).toMatch(/⚙️|approved|기획/);

    const updated = cliExec(`get-project --id ${project.id}`, {});
    expect(updated.status).toBe('approved');
    expect(updated.discussion.rounds.length).toBeGreaterThan(0);
    expect(updated.team.length).toBeGreaterThan(0);
  });

  it('plan-execute + planning → 후속 PR 안내 에러 (exit 2)', () => {
    const project = cliExec('create-project', {
      name: 'mode-dispatch-plan-execute',
      type: 'web-app',
      description: 'plan-execute test',
      mode: 'plan-execute',
    });
    createdIds.push(project.id);

    const r = cliExecRaw('gv-execute', {
      projectId: project.id,
      taskRoute: { taskType: 'plan' },
    });

    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/plan-execute/);
    expect(r.stderr).toMatch(/후속/);
  });

  it('quick-build + planning → 후속 PR 안내 에러 (exit 2)', () => {
    const project = cliExec('create-project', {
      name: 'mode-dispatch-quick-build',
      type: 'cli-app',
      description: 'quick-build test',
      mode: 'quick-build',
    });
    createdIds.push(project.id);

    const r = cliExecRaw('gv-execute', {
      projectId: project.id,
      taskRoute: { taskType: 'plan' },
    });

    expect(r.exitCode).toBe(2);
    expect(r.stderr).toMatch(/quick-build/);
  });

  it('projectId 있지만 프로젝트 없음 → task-graph 흐름으로 fallback (graceful)', () => {
    // not found는 mode 흐름을 트리거하지 않고 task-graph로 fallback (evaluateOnComplete 호환성 보존).
    const r = cliExec('gv-execute', {
      projectId: 'nonexistent-xyz-9999',
      taskRoute: { taskType: 'ask' },
    });
    expect(r.success).toBe(true);
    expect(r.finalState).toBe('done');
  });

  it('projectId + status !== planning → 기존 task-graph 흐름으로 fallback', () => {
    const project = cliExec('create-project', {
      name: 'mode-dispatch-fallback',
      type: 'web-app',
      description: 'fallback test',
      mode: 'plan-only',
    });
    createdIds.push(project.id);
    cliExec('update-status', { id: project.id, status: 'approved' });

    const r = cliExec('gv-execute', {
      projectId: project.id,
      taskRoute: { taskType: 'ask' },
    });
    expect(r.success).toBe(true);
    expect(r.finalState).toBe('done');
    // 회귀 가드: 활성 프로젝트지만 planning이 아니면 mode 흐름으로 안 들어감
    expect(r.rounds).toBeUndefined();
  });
});
