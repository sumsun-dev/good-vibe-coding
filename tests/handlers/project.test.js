/**
 * handlers/project — CLI 핸들러 e2e 테스트
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { resolve } from 'path';
import { mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';

const CLI_PATH = resolve('scripts/cli.js');
const TMP_BASE = resolve(tmpdir(), 'good-vibe-test-project-handler');

/** CLI 자식 프로세스에 전달할 환경변수 (임시 디렉토리 사용) */
const childEnv = { ...process.env, GOOD_VIBE_BASE_DIR: TMP_BASE };

function cliExec(command, input) {
  return JSON.parse(
    execSync(`node ${CLI_PATH} ${command}`, {
      input: JSON.stringify(input),
      encoding: 'utf-8',
      timeout: 10_000,
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
      timeout: 10_000,
      env: childEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { exitCode: 0, stdout, stderr: '' };
  } catch (err) {
    return { exitCode: err.status, stdout: '', stderr: err.stderr || '' };
  }
}

describe('handlers/project', () => {
  const createdIds = [];

  beforeAll(() => {
    mkdirSync(TMP_BASE, { recursive: true });
  });

  afterAll(() => {
    rmSync(TMP_BASE, { recursive: true, force: true });
  });

  afterEach(() => {
    // cleanup: 생성된 프로젝트 상태를 archived로 변경
    for (const id of createdIds) {
      try {
        cliExec('update-status', { id, status: 'archived' });
      } catch {
        /* ignore */
      }
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
    expect(list.some((p) => p.id === project.id)).toBe(true);
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

  it('create-project에 prd, infraPath, githubUrl을 전달한다', () => {
    const testInfraPath = resolve(TMP_BASE, 'infra-test');
    const project = cliExec('create-project', {
      name: 'infra-test',
      type: 'web-app',
      description: 'infra test project',
      mode: 'plan-only',
      prd: '## PRD\n기능 목록...',
      infraPath: testInfraPath,
      githubUrl: 'https://github.com/test/repo',
    });
    createdIds.push(project.id);

    expect(project.prd).toBe('## PRD\n기능 목록...');
    expect(project.infraPath).toBe(testInfraPath);
    expect(project.githubUrl).toBe('https://github.com/test/repo');
  });

  it('create-project에 잘못된 infraPath 전달 시 INPUT_ERROR', () => {
    const result = cliExecRaw('create-project', {
      name: 'bad-path',
      type: 'web-app',
      infraPath: 123,
    });
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('INPUT_ERROR');
  });

  it('create-project에 잘못된 githubUrl 전달 시 INPUT_ERROR', () => {
    const result = cliExecRaw('create-project', {
      name: 'bad-url',
      type: 'web-app',
      githubUrl: 'not-a-url',
    });
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('INPUT_ERROR');
  });

  it('create-project에 path traversal infraPath 전달 시 INPUT_ERROR', () => {
    const result = cliExecRaw('create-project', {
      name: 'traversal-test',
      type: 'web-app',
      infraPath: '/../../../etc/passwd',
    });
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('INPUT_ERROR');
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
