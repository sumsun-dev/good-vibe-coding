/**
 * handlers/feedback — CLI 핸들러 e2e 테스트
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
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { exitCode: 0, stdout, stderr: '' };
  } catch (err) {
    return { exitCode: err.status, stdout: '', stderr: err.stderr || '' };
  }
}

describe('handlers/feedback', () => {
  it('improvement-prompt → roleId 필수 검증', () => {
    const result = cliExecRaw('improvement-prompt', {});
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('INPUT_ERROR');
    expect(result.stderr).toContain('roleId');
  });

  it('improvement-prompt → 정상 응답', () => {
    const result = cliExec('improvement-prompt', {
      roleId: 'cto',
      performance: { tasks: [], reviews: [], issues: [] },
      agentMd: '# CTO Agent',
    });
    expect(result.prompt).toContain('cto');
  });

  it('parse-suggestions → 빈 입력 → 빈 배열', () => {
    const result = cliExec('parse-suggestions', { analysisText: '' });
    expect(result).toEqual([]);
  });

  it('save-agent-override → roleId/content 필수 검증', () => {
    const result = cliExecRaw('save-agent-override', { roleId: 'cto' });
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('content');
  });

  it('save-project-override → 필수 필드 검증', () => {
    const result = cliExecRaw('save-project-override', { roleId: 'cto' });
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('INPUT_ERROR');
  });

  it('load-project-override → 필수 필드 검증', () => {
    const result = cliExecRaw('load-project-override', {});
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('INPUT_ERROR');
  });

  it('list-project-overrides → 필수 필드 검증', () => {
    const result = cliExecRaw('list-project-overrides', {});
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('projectDir');
  });

  it('merge-agent-override → 병합 결과', () => {
    const result = cliExec('merge-agent-override', {
      baseMd: '# Base Agent',
      overrideMd: '추가 지시사항',
    });
    expect(result.merged).toContain('Base Agent');
    expect(result.merged).toContain('추가 지시사항');
  });

  it('list-agent-overrides → 배열 반환', () => {
    const result = cliExec('list-agent-overrides', {});
    expect(Array.isArray(result)).toBe(true);
  });

  it('evaluate-completion → --id 누락 시 에러 종료', () => {
    const result = cliExecRaw('evaluate-completion', {});
    expect(result.exitCode).not.toBe(0);
  });

  it('evaluate-completion → 존재하지 않는 프로젝트 NOT_FOUND', () => {
    const result = cliExecRaw('evaluate-completion --id nonexistent-project-id', {});
    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain('NOT_FOUND');
  });

  it('format-completion-summary → summary 필수 검증', () => {
    const result = cliExecRaw('format-completion-summary', {});
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('summary');
  });

  it('format-completion-summary → 빈 evaluations 시 안내 문구', () => {
    const result = cliExec('format-completion-summary', {
      summary: {
        projectId: 'p-test',
        processedAt: '2026-04-28T00:00:00Z',
        totals: { promoted: 0, discarded: 0, pending: 0, skipped: 0 },
        evaluations: [],
      },
    });
    expect(result.markdown).toContain('p-test');
  });

  it('list-shadow-candidates → 배열 반환 (candidate 없으면 빈 배열)', () => {
    const result = cliExec('list-shadow-candidates', {});
    expect(Array.isArray(result)).toBe(true);
  });

  it('get-provenance → --role 누락 시 INPUT_ERROR', () => {
    const result = cliExecRaw('get-provenance', {});
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('role');
  });

  it('get-provenance → 없으면 빈 entries + candidateState.exists=false', () => {
    const result = cliExec('get-provenance --role=cto-history-test', {});
    expect(result.provenance.entries).toEqual([]);
    expect(result.candidateState.exists).toBe(false);
  });

  it('format-provenance → provenance 필수 검증', () => {
    const result = cliExecRaw('format-provenance', {});
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('provenance');
  });

  it('format-provenance → 빈 entries → "학습 이력 없음"', () => {
    const result = cliExec('format-provenance', {
      provenance: { roleId: 'cto', entries: [] },
    });
    expect(result.markdown).toContain('학습 이력 없음');
  });

  it('revert-provenance-entry → --role/--entry-id 누락 시 INPUT_ERROR', () => {
    const result = cliExecRaw('revert-provenance-entry --role=cto', {});
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('entry-id');
  });

  it('revert-provenance-entry → 존재하지 않는 entry → removed=false', () => {
    const result = cliExec(
      'revert-provenance-entry --role=cto-revert-test --entry-id=ent-nonexistent',
      {},
    );
    expect(result.removed).toBe(false);
  });

  it('reset-provenance → --role 필수', () => {
    const result = cliExecRaw('reset-provenance', {});
    expect(result.exitCode).toBe(2);
  });

  it('discard-shadow-candidate → --role 필수', () => {
    const result = cliExecRaw('discard-shadow-candidate', {});
    expect(result.exitCode).toBe(2);
  });

  it('discard-shadow-candidate → 없으면 discarded=false', () => {
    const result = cliExec('discard-shadow-candidate --role=cto-discard-test', {});
    expect(result.discarded).toBe(false);
  });
});
