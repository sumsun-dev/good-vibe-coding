import { vi, describe, it, expect, afterEach } from 'vitest';

import {
  writeTemporaryProject,
  attemptBuild,
  attemptTests,
  cleanup,
  BUILD_STRATEGIES,
} from './helpers.js';

// --- attemptBuild ---

describe('attemptBuild', () => {
  const tempDirs = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      cleanup(dir);
    }
    tempDirs.length = 0;
  });

  it('package.json이 없어도 JS 파일 syntax check로 빌드한다 (web-app)', () => {
    const blocks = [{ language: 'javascript', filename: 'index.js', content: 'const x = 1;\n' }];
    const { tempDir } = writeTemporaryProject(blocks, 'web-app');
    tempDirs.push(tempDir);

    const result = attemptBuild(tempDir, 'web-app');
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  it('package.json이 없어도 JS 파일 syntax check로 빌드한다 (api-server)', () => {
    const blocks = [{ language: 'javascript', filename: 'server.js', content: 'const x = 1;\n' }];
    const { tempDir } = writeTemporaryProject(blocks, 'api-server');
    tempDirs.push(tempDir);

    const result = attemptBuild(tempDir, 'api-server');
    expect(result.success).toBe(true);
  });

  it('올바른 JS 파일에 대해 syntax check를 통과한다 (cli-tool)', () => {
    const blocks = [{ language: 'javascript', filename: 'index.js', content: 'const x = 1;\n' }];
    const { tempDir } = writeTemporaryProject(blocks, 'cli-tool');
    tempDirs.push(tempDir);

    const result = attemptBuild(tempDir, 'cli-tool');
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  it('구문 오류가 있는 JS 파일은 실패한다 (cli-tool)', () => {
    const blocks = [{ language: 'javascript', filename: 'broken.js', content: 'const x = {{\n' }];
    const { tempDir } = writeTemporaryProject(blocks, 'cli-tool');
    tempDirs.push(tempDir);

    const result = attemptBuild(tempDir, 'cli-tool');
    expect(result.success).toBe(false);
    expect(result.exitCode).not.toBe(0);
  });

  it('JS 파일이 없으면 실패한다 (cli-tool)', () => {
    const blocks = [{ language: 'json', filename: 'config.json', content: '{}' }];
    const { tempDir } = writeTemporaryProject(blocks, 'cli-tool');
    tempDirs.push(tempDir);

    const result = attemptBuild(tempDir, 'cli-tool');
    expect(result.success).toBe(false);
    expect(result.output).toContain('no .js files found');
  });

  it('지원하지 않는 프로젝트 유형이지만 JS 파일이 있으면 node 전략으로 빌드한다', () => {
    const blocks = [{ language: 'javascript', filename: 'index.js', content: 'const x = 1;\n' }];
    const { tempDir } = writeTemporaryProject(blocks, 'unknown-type');
    tempDirs.push(tempDir);

    const result = attemptBuild(tempDir, 'unknown-type');
    expect(result.success).toBe(true);
  });

  it('감지할 수 없는 파일만 있으면 unsupported를 반환한다', () => {
    const blocks = [{ language: 'xml', filename: 'data.xml', content: '<root/>' }];
    const { tempDir } = writeTemporaryProject(blocks, 'unknown-type');
    tempDirs.push(tempDir);

    const result = attemptBuild(tempDir, 'unknown-type');
    expect(result.success).toBe(false);
    expect(result.output).toContain('unsupported project type');
  });

  it('결과 형식이 올바르다', () => {
    const blocks = [{ language: 'javascript', filename: 'index.js', content: 'const x = 1;\n' }];
    const { tempDir } = writeTemporaryProject(blocks, 'cli-tool');
    tempDirs.push(tempDir);

    const result = attemptBuild(tempDir, 'cli-tool');
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('output');
    expect(result).toHaveProperty('exitCode');
    expect(typeof result.success).toBe('boolean');
    expect(typeof result.output).toBe('string');
    expect(typeof result.exitCode).toBe('number');
  });
});

// --- attemptTests ---

describe('attemptTests', () => {
  const tempDirs = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      cleanup(dir);
    }
    tempDirs.length = 0;
  });

  it('테스트 파일이 없으면 null 결과를 반환한다', () => {
    const blocks = [{ language: 'javascript', filename: 'index.js', content: 'const x = 1;' }];
    const { tempDir } = writeTemporaryProject(blocks, 'cli-tool');
    tempDirs.push(tempDir);

    const result = attemptTests(tempDir, 'cli-tool');
    expect(result.success).toBeNull();
    expect(result.output).toBe('no tests found');
    expect(result.exitCode).toBeNull();
  });

  it('테스트 파일이 있지만 package.json이 없으면 null 결과를 반환한다', () => {
    const blocks = [
      { language: 'javascript', filename: 'index.test.js', content: 'test("works", () => {});' },
    ];
    const { tempDir } = writeTemporaryProject(blocks, 'cli-tool');
    tempDirs.push(tempDir);

    const result = attemptTests(tempDir, 'cli-tool');
    expect(result.success).toBeNull();
    expect(result.output).toContain('no package.json');
  });
});

// --- attemptTests 에러 경로 ---

describe('attemptTests — 에러 경로', () => {
  const tempDirs = [];

  afterEach(() => {
    for (const dir of tempDirs) cleanup(dir);
    tempDirs.length = 0;
    vi.restoreAllMocks();
  });

  it('ENOENT 발생 시 not found를 반환한다', () => {
    const blocks = [
      { language: 'javascript', filename: 'index.test.js', content: 'test("x", () => {});' },
      { language: 'json', filename: 'package.json', content: '{"scripts":{"test":"vitest"}}' },
    ];
    const { tempDir } = writeTemporaryProject(blocks, 'cli-tool');
    tempDirs.push(tempDir);

    const enoentError = new Error('npm not found');
    enoentError.code = 'ENOENT';
    enoentError.path = 'npm';
    vi.spyOn(BUILD_STRATEGIES.node, 'test').mockImplementation(() => {
      throw enoentError;
    });

    const result = attemptTests(tempDir, 'cli-tool');
    expect(result.success).toBe(false);
    expect(result.output).toContain('not found');
    expect(result.exitCode).toBe(1);
  });

  it('ENOENT에서 err.path가 없으면 runtime을 표시한다', () => {
    const blocks = [
      { language: 'javascript', filename: 'index.test.js', content: 'test("x", () => {});' },
      { language: 'json', filename: 'package.json', content: '{"scripts":{"test":"vitest"}}' },
    ];
    const { tempDir } = writeTemporaryProject(blocks, 'cli-tool');
    tempDirs.push(tempDir);

    const enoentError = new Error('command not found');
    enoentError.code = 'ENOENT';
    vi.spyOn(BUILD_STRATEGIES.node, 'test').mockImplementation(() => {
      throw enoentError;
    });

    const result = attemptTests(tempDir, 'cli-tool');
    expect(result.output).toBe('runtime not found');
  });

  it('일반 예외 시 stderr를 우선 반환한다', () => {
    const blocks = [
      { language: 'javascript', filename: 'index.test.js', content: 'test("x", () => {});' },
      { language: 'json', filename: 'package.json', content: '{"scripts":{"test":"vitest"}}' },
    ];
    const { tempDir } = writeTemporaryProject(blocks, 'cli-tool');
    tempDirs.push(tempDir);

    const error = new Error('tests failed');
    error.stderr = 'AssertionError: expected true';
    error.status = 1;
    vi.spyOn(BUILD_STRATEGIES.node, 'test').mockImplementation(() => {
      throw error;
    });

    const result = attemptTests(tempDir, 'cli-tool');
    expect(result.success).toBe(false);
    expect(result.output).toContain('AssertionError');
    expect(result.exitCode).toBe(1);
  });

  it('stderr 없으면 message를 사용하고, status 없으면 기본값 1', () => {
    const blocks = [
      { language: 'javascript', filename: 'index.test.js', content: 'test("x", () => {});' },
      { language: 'json', filename: 'package.json', content: '{"scripts":{"test":"vitest"}}' },
    ];
    const { tempDir } = writeTemporaryProject(blocks, 'cli-tool');
    tempDirs.push(tempDir);

    const error = new Error('unknown failure');
    vi.spyOn(BUILD_STRATEGIES.node, 'test').mockImplementation(() => {
      throw error;
    });

    const result = attemptTests(tempDir, 'cli-tool');
    expect(result.output).toBe('unknown failure');
    expect(result.exitCode).toBe(1);
  });
});

// --- shell injection 방지 (#16) ---

describe('shell injection 방지 (execFileSync)', () => {
  const tempDirs = [];

  afterEach(() => {
    for (const dir of tempDirs) cleanup(dir);
    tempDirs.length = 0;
  });

  it('shell 메타문자가 포함된 JS 파일명도 안전하게 syntax check 한다', () => {
    const blocks = [
      { language: 'javascript', filename: 'file$(whoami).js', content: 'const x = 1;\n' },
    ];
    const { tempDir } = writeTemporaryProject(blocks, 'cli-tool');
    tempDirs.push(tempDir);

    const result = attemptBuild(tempDir, 'cli-tool');
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  it('공백이 포함된 JS 파일명도 안전하게 처리한다', () => {
    const blocks = [{ language: 'javascript', filename: 'my file.js', content: 'const x = 1;\n' }];
    const { tempDir } = writeTemporaryProject(blocks, 'cli-tool');
    tempDirs.push(tempDir);

    const result = attemptBuild(tempDir, 'cli-tool');
    expect(result.success).toBe(true);
  });
});
