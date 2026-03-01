/**
 * handlers/project — CLI 핸들러 e2e 테스트
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

describe('handlers/project', () => {
  const createdIds = [];

  afterEach(async () => {
    // cleanup: 생성된 프로젝트 상태를 archived로 변경
    for (const id of createdIds) {
      try {
        cliExec('update-status', { id, status: 'archived' });
      } catch { /* ignore */ }
    }
    createdIds.length = 0;
  });

  it('create-project → get-project → list-projects 플로우', () => {
    // 생성
    const project = cliExec('create-project', {
      name: 'test-handler-project',
      type: 'web-app',
      description: '핸들러 테스트용',
    });
    createdIds.push(project.id);

    expect(project.name).toBe('test-handler-project');
    expect(project.type).toBe('web-app');

    // 조회
    const fetched = cliExec(`get-project --id ${project.id}`, {});
    expect(fetched.name).toBe('test-handler-project');

    // 목록
    const list = cliExec('list-projects', {});
    expect(Array.isArray(list)).toBe(true);
    expect(list.some(p => p.id === project.id)).toBe(true);
  });

  it('create-project 필수 필드 누락 시 INPUT_ERROR', () => {
    const result = cliExecRaw('create-project', {});
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('INPUT_ERROR');
  });

  it('get-project 존재하지 않는 ID → NOT_FOUND', () => {
    const result = cliExecRaw('get-project --id nonexistent-xyz-123', {});
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain('NOT_FOUND');
  });

  it('update-status 상태 변경', () => {
    const project = cliExec('create-project', {
      name: 'status-test',
      type: 'cli-tool',
    });
    createdIds.push(project.id);

    const updated = cliExec('update-status', { id: project.id, status: 'planning' });
    expect(updated.status).toBe('planning');
  });
});
