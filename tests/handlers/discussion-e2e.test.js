/**
 * handlers/discussion — CLI 핸들러 E2E 테스트
 * vi.mock 없이 실제 CLI를 실행하여 통합 검증
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

describe('generate-prd-prompt E2E', () => {
  it('description + clarityDimensions → prompt 반환', () => {
    const result = cliExec('generate-prd-prompt', {
      description: '팀 채팅 앱',
      clarityDimensions: { scope: { score: 0.8 } },
    });
    expect(result.prompt).toContain('팀 채팅 앱');
    expect(result.prompt).toContain('PRD 작성 지침');
  });

  it('codebaseInfo 포함 시 코드베이스 섹션이 프롬프트에 반영된다', () => {
    const result = cliExec('generate-prd-prompt', {
      description: '웹 대시보드',
      clarityDimensions: { scope: { score: 0.9 } },
      codebaseInfo: { techStack: ['React', 'Express'], fileStructure: 'src/' },
    });
    expect(result.prompt).toContain('React');
    expect(result.prompt).toContain('코드베이스 정보');
  });

  it('빈 description → 빈 prompt 반환', () => {
    const result = cliExec('generate-prd-prompt', {
      description: '',
      clarityDimensions: {},
    });
    expect(result.prompt).toBe('');
  });

  it('필수 필드 누락 시 INPUT_ERROR', () => {
    const result = cliExecRaw('generate-prd-prompt', { description: '앱' });
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('INPUT_ERROR');
  });
});

describe('parse-prd E2E', () => {
  it('rawOutput → prd + formatted 반환', () => {
    const rawOutput = JSON.stringify({
      overview: '채팅앱',
      coreFeatures: ['실시간 메시지'],
      userScenarios: ['팀 채팅'],
      technicalRequirements: { stack: ['Node.js'], integrations: [], constraints: [] },
      successCriteria: ['메시지 전송'],
      estimatedScope: { complexity: 'medium', reasoning: '기본 기능' },
    });
    const result = cliExec('parse-prd', { rawOutput });
    expect(result.prd.overview).toBe('채팅앱');
    expect(result.prd.coreFeatures).toContain('실시간 메시지');
    expect(result.formatted).toContain('프로젝트 개요');
    expect(result.formatted).toContain('채팅앱');
  });

  it('잘못된 JSON rawOutput → 빈 PRD 반환', () => {
    const result = cliExec('parse-prd', { rawOutput: 'not valid json' });
    expect(result.prd.overview).toBe('');
    expect(result.prd.coreFeatures).toEqual([]);
  });

  it('필수 필드 누락 시 INPUT_ERROR', () => {
    const result = cliExecRaw('parse-prd', {});
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('INPUT_ERROR');
  });
});
