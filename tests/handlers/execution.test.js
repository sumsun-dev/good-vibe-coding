/**
 * handlers/execution — CLI 핸들러 e2e 테스트
 */
import { describe, it, expect, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { resolve } from 'path';

const CLI_PATH = resolve('scripts/cli.js');

function cliExec(command, input) {
  return JSON.parse(
    execSync(`node ${CLI_PATH} ${command}`, {
      input: JSON.stringify(input),
      encoding: 'utf-8',
      timeout: 10_000,
    })
  );
}

function cliExecRaw(command, input) {
  try {
    const stdout = execSync(`node ${CLI_PATH} ${command}`, {
      input: input ? JSON.stringify(input) : '',
      encoding: 'utf-8',
      timeout: 10_000,
    });
    return { exitCode: 0, stdout, stderr: '' };
  } catch (err) {
    return { exitCode: err.status, stdout: '', stderr: err.stderr || '' };
  }
}

describe('handlers/execution', () => {
  const createdIds = [];

  afterEach(() => {
    for (const id of createdIds) {
      try {
        cliExec('update-status', { id, status: 'archived' });
      } catch { /* ignore */ }
    }
    createdIds.length = 0;
  });

  it('init-execution → 프로젝트 없으면 NOT_FOUND', () => {
    const result = cliExecRaw('init-execution', { id: 'nonexistent-xyz' });
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain('NOT_FOUND');
  });

  it('next-step → 프로젝트 없으면 NOT_FOUND', () => {
    const result = cliExecRaw('next-step --id nonexistent-xyz', {});
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain('NOT_FOUND');
  });

  it('execution-prompt → 프롬프트 생성', () => {
    const result = cliExec('execution-prompt', {
      task: { id: 'task-1', title: '테스트 태스크', description: '설명' },
      teamMember: {
        roleId: 'backend',
        displayName: '도윤',
        role: 'Backend Developer',
        trait: '체계적',
        speakingStyle: '논리적',
      },
    });
    expect(result.prompt).toContain('도윤');
    expect(result.prompt).toContain('테스트 태스크');
  });

  it('execution-plan → 실행 계획 생성', () => {
    const tasks = [
      { id: 'task-1', title: '태스크 1', assignee: 'backend', phase: 1 },
      { id: 'task-2', title: '태스크 2', assignee: 'frontend', phase: 1 },
    ];
    const team = [
      { roleId: 'backend', displayName: '도윤', role: 'Backend Developer' },
      { roleId: 'frontend', displayName: '서연', role: 'Frontend Developer' },
    ];
    const result = cliExec('execution-plan', { tasks, team });
    expect(result.phases).toBeDefined();
  });

  it('execution-summary → 프로젝트 없으면 NOT_FOUND', () => {
    const result = cliExecRaw('execution-summary --id nonexistent-xyz', {});
    expect(result.exitCode).toBe(3);
  });

  it('get-failure-context → 프로젝트 없으면 NOT_FOUND', () => {
    const result = cliExecRaw('get-failure-context --id nonexistent-xyz', {});
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain('NOT_FOUND');
  });

  it('handle-escalation → 필수 필드 누락 시 INPUT_ERROR', () => {
    const result = cliExecRaw('handle-escalation', { id: 'test' });
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('INPUT_ERROR');
  });

  it('handle-escalation → 유효하지 않은 decision', () => {
    const result = cliExecRaw('handle-escalation', { id: 'test', decision: 'invalid' });
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('INPUT_ERROR');
  });
});
