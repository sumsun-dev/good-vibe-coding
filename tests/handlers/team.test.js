/**
 * handlers/team — CLI 핸들러 e2e 테스트
 */
import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { resolve } from 'path';

const CLI_PATH = resolve('scripts/cli.js');

function cliExec(command, input) {
  return JSON.parse(
    execSync(`node ${CLI_PATH} ${command}`, {
      input: JSON.stringify(input),
      encoding: 'utf-8',
      timeout: 10_000,
    }),
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

describe('handlers/team', () => {
  it('recommend-team → 타입 필수', () => {
    const result = cliExecRaw('recommend-team', {});
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('INPUT_ERROR');
    expect(result.stderr).toContain('--type');
  });

  it('recommend-team --type web-app → 팀 추천', () => {
    const result = cliExec('recommend-team --type web-app', {});
    expect(result).toHaveProperty('recommended');
    expect(Array.isArray(result.recommended)).toBe(true);
    expect(result.recommended.length).toBeGreaterThan(0);
  });

  it('build-team → roleIds 필수', () => {
    const result = cliExecRaw('build-team', {});
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('INPUT_ERROR');
    expect(result.stderr).toContain('roleIds');
  });

  it('build-team → 팀 구성', () => {
    const result = cliExec('build-team', { roleIds: ['cto', 'backend'] });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(result[0]).toHaveProperty('displayName');
    expect(result[0]).toHaveProperty('role');
  });

  it('role-catalog → 역할 카탈로그 반환', () => {
    const result = cliExec('role-catalog', {});
    expect(result).toHaveProperty('roles');
    expect(Object.keys(result.roles).length).toBeGreaterThan(0);
  });

  it('project-types → 프로젝트 타입 객체', () => {
    const result = cliExec('project-types', {});
    expect(result).toHaveProperty('types');
    expect(Object.keys(result.types).length).toBeGreaterThan(0);
  });

  it('team-summary → 팀 요약 + 팀원 정보', () => {
    const result = cliExec('team-summary', { roleIds: ['cto', 'backend', 'qa'] });
    expect(result.summary).toBeDefined();
    expect(result.team).toHaveLength(3);
  });

  it('optimized-team → 프로젝트 타입별 최적 팀', () => {
    const result = cliExec('optimized-team', {
      projectType: 'web-app',
      complexity: 'medium',
    });
    expect(result).toHaveProperty('roles');
    expect(Array.isArray(result.roles)).toBe(true);
    expect(result.roles.length).toBeGreaterThan(0);
  });
});
