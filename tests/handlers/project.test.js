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

  it('create-project에 clarityAnalysis, complexityAnalysis를 전달한다', () => {
    const project = cliExec('create-project', {
      name: 'analysis-test',
      type: 'web-app',
      description: '분석 테스트',
      clarityAnalysis: { clarity: 0.85, dimensions: { scope: 0.9 } },
      complexityAnalysis: { level: 'medium', score: 0.6 },
    });
    createdIds.push(project.id);

    expect(project.clarityAnalysis).toEqual({ clarity: 0.85, dimensions: { scope: 0.9 } });
    expect(project.complexityAnalysis).toEqual({ level: 'medium', score: 0.6 });
  });

  it('add-modify-history 수정 이력 추가', () => {
    const project = cliExec('create-project', {
      name: 'modify-test',
      type: 'web-app',
    });
    createdIds.push(project.id);

    const updated = cliExec('add-modify-history', {
      id: project.id,
      modifiedPrd: '수정 PRD',
      complexity: 'medium',
      affectedAreas: [{ file: 'src/app.js', reason: '변경', changeType: 'modify' }],
    });
    expect(updated.modifyHistory).toHaveLength(1);
    expect(updated.modifyHistory[0].modifiedPrd).toBe('수정 PRD');
    expect(updated.modifyHistory[0].complexity).toBe('medium');
    expect(updated.modifyHistory[0].modifiedAt).toBeTruthy();
  });

  it('add-modify-history 필수 필드 누락 시 INPUT_ERROR', () => {
    const project = cliExec('create-project', {
      name: 'modify-err-test',
      type: 'web-app',
    });
    createdIds.push(project.id);

    const result = cliExecRaw('add-modify-history', { id: project.id });
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('INPUT_ERROR');
  });

  it('add-modify-history — invalid complexity 거부', () => {
    const project = cliExec('create-project', {
      name: 'complexity-validate',
      type: 'web-app',
    });
    createdIds.push(project.id);

    const result = cliExecRaw('add-modify-history', {
      id: project.id,
      modifiedPrd: '수정 PRD',
      complexity: 'extreme',
    });
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('simple/medium/complex');
  });

  it('add-modify-history — modifiedPrd가 숫자일 때 거부', () => {
    const project = cliExec('create-project', {
      name: 'prd-type-validate',
      type: 'web-app',
    });
    createdIds.push(project.id);

    const result = cliExecRaw('add-modify-history', {
      id: project.id,
      modifiedPrd: 12345,
      complexity: 'simple',
    });
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('문자열');
  });

  it('add-modify-history — affectedAreas가 문자열일 때 거부', () => {
    const project = cliExec('create-project', {
      name: 'areas-type-validate',
      type: 'web-app',
    });
    createdIds.push(project.id);

    const result = cliExecRaw('add-modify-history', {
      id: project.id,
      modifiedPrd: '수정 PRD',
      complexity: 'medium',
      affectedAreas: 'not-an-array',
    });
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('배열');
  });

  it('create-project — clarityAnalysis가 배열일 때 거부', () => {
    const result = cliExecRaw('create-project', {
      name: 'clarity-validate',
      type: 'web-app',
      clarityAnalysis: [1, 2, 3],
    });
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('객체');
  });

  it('create-project — complexityAnalysis가 문자열일 때 거부', () => {
    const result = cliExecRaw('create-project', {
      name: 'complexity-obj-validate',
      type: 'web-app',
      complexityAnalysis: 'not-an-object',
    });
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('객체');
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

  it('save-tasks 정상 저장', () => {
    const project = cliExec('create-project', {
      name: 'save-tasks-test',
      type: 'web-app',
    });
    createdIds.push(project.id);

    const result = cliExec('save-tasks', {
      id: project.id,
      tasks: [
        { id: 'task-1', title: 'API 설계', assignee: 'backend', status: 'pending' },
        { id: 'task-2', title: 'UI 구현', assignee: 'frontend', status: 'pending' },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
  });

  it('save-tasks 필수 필드 누락 시 INPUT_ERROR', () => {
    const result = cliExecRaw('save-tasks', { id: 'some-id' });
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('INPUT_ERROR');
  });

  it('save-tasks tasks가 배열이 아닐 때 INPUT_ERROR', () => {
    const project = cliExec('create-project', {
      name: 'save-tasks-err',
      type: 'web-app',
    });
    createdIds.push(project.id);

    const result = cliExecRaw('save-tasks', {
      id: project.id,
      tasks: 'not-an-array',
    });
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('배열');
  });

  it('classify-intent 입력 없이 → create', () => {
    const result = cliExec('classify-intent', { input: '' });
    expect(result.intent).toBe('create');
    expect(typeof result.hasExistingProjects).toBe('boolean');
    expect(Array.isArray(result.projects)).toBe(true);
  });

  it('classify-intent 프로젝트 생성 후 → hasExistingProjects: true', () => {
    const project = cliExec('create-project', {
      name: 'intent-test',
      type: 'web-app',
    });
    createdIds.push(project.id);

    const result = cliExec('classify-intent', { input: '' });
    expect(result.hasExistingProjects).toBe(true);
    expect(result.projects.length).toBeGreaterThanOrEqual(1);
  });

  it('classify-intent 재개 패턴 + 미완료 프로젝트 → resume', () => {
    const project = cliExec('create-project', {
      name: 'resume-intent-test',
      type: 'web-app',
    });
    createdIds.push(project.id);

    const result = cliExec('classify-intent', { input: '이어서' });
    expect(result.intent).toBe('resume');
    expect(result.suggestedProject).not.toBeNull();
    expect(result.route).not.toBeNull();
  });
});
