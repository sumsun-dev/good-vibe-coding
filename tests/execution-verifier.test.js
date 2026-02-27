import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, readFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  extractCodeBlocks,
  classifyCodeBlocks,
  writeTemporaryProject,
  attemptBuild,
  attemptTests,
  verifyExecution,
  verifyAndMaterialize,
  cleanup,
  BUILD_STRATEGIES,
  detectBuildStrategy,
} from '../scripts/lib/execution-verifier.js';

// --- extractCodeBlocks ---

describe('extractCodeBlocks', () => {
  it('JavaScript 코드 블록을 추출한다', () => {
    const md = '설명 텍스트\n```javascript\nconst x = 1;\n```\n끝';
    const blocks = extractCodeBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe('javascript');
    expect(blocks[0].content).toBe('const x = 1;\n');
    expect(blocks[0].filename).toBeNull();
  });

  it('TypeScript 코드 블록을 추출한다', () => {
    const md = '```typescript\nconst x: number = 1;\n```';
    const blocks = extractCodeBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe('typescript');
  });

  it('Python 코드 블록을 추출한다', () => {
    const md = '```python\nprint("hello")\n```';
    const blocks = extractCodeBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe('python');
  });

  it('여러 코드 블록을 추출한다', () => {
    const md = '```js\nconst a = 1;\n```\n텍스트\n```css\nbody {}\n```';
    const blocks = extractCodeBlocks(md);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].language).toBe('js');
    expect(blocks[1].language).toBe('css');
  });

  it('빈 입력은 빈 배열을 반환한다', () => {
    expect(extractCodeBlocks('')).toEqual([]);
    expect(extractCodeBlocks(null)).toEqual([]);
    expect(extractCodeBlocks(undefined)).toEqual([]);
  });

  it('코드 블록이 없는 마크다운은 빈 배열을 반환한다', () => {
    const md = '# 제목\n일반 텍스트입니다.';
    expect(extractCodeBlocks(md)).toEqual([]);
  });

  it('info string에서 파일명을 감지한다', () => {
    const md = '```javascript src/app.js\nconst x = 1;\n```';
    const blocks = extractCodeBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].filename).toBe('src/app.js');
  });

  it('주석에서 파일명을 감지한다 (// filename: ...)', () => {
    const md = '```javascript\n// filename: src/utils.js\nconst x = 1;\n```';
    const blocks = extractCodeBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].filename).toBe('src/utils.js');
  });

  it('주석에서 파일명을 감지한다 (# filename: ...)', () => {
    const md = '```python\n# filename: app.py\nprint("hello")\n```';
    const blocks = extractCodeBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].filename).toBe('app.py');
  });

  it('info string 파일명이 주석 파일명보다 우선한다', () => {
    const md = '```javascript src/main.js\n// filename: src/other.js\nconst x = 1;\n```';
    const blocks = extractCodeBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].filename).toBe('src/main.js');
  });

  it('언어 태그가 없는 코드 블록도 추출한다', () => {
    const md = '```\nsome code\n```';
    const blocks = extractCodeBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe('');
  });
});

// --- classifyCodeBlocks ---

describe('classifyCodeBlocks', () => {
  it('실행 가능한 언어를 올바르게 분류한다', () => {
    const blocks = [
      { language: 'javascript', filename: null, content: '' },
      { language: 'typescript', filename: null, content: '' },
      { language: 'python', filename: null, content: '' },
      { language: 'sh', filename: null, content: '' },
      { language: 'bash', filename: null, content: '' },
    ];
    const classified = classifyCodeBlocks(blocks);
    expect(classified.every(b => b.type === 'executable')).toBe(true);
  });

  it('설정 파일 언어를 올바르게 분류한다', () => {
    const blocks = [
      { language: 'json', filename: null, content: '' },
      { language: 'yaml', filename: null, content: '' },
      { language: 'toml', filename: null, content: '' },
    ];
    const classified = classifyCodeBlocks(blocks);
    expect(classified.every(b => b.type === 'config')).toBe(true);
  });

  it('마크업 언어를 올바르게 분류한다', () => {
    const blocks = [
      { language: 'html', filename: null, content: '' },
      { language: 'css', filename: null, content: '' },
      { language: 'md', filename: null, content: '' },
    ];
    const classified = classifyCodeBlocks(blocks);
    expect(classified.every(b => b.type === 'markup')).toBe(true);
  });

  it('알 수 없는 언어는 unknown으로 분류한다', () => {
    const blocks = [
      { language: 'fortran', filename: null, content: '' },
      { language: '', filename: null, content: '' },
    ];
    const classified = classifyCodeBlocks(blocks);
    expect(classified.every(b => b.type === 'unknown')).toBe(true);
  });

  it('빈 입력은 빈 배열을 반환한다', () => {
    expect(classifyCodeBlocks([])).toEqual([]);
    expect(classifyCodeBlocks(null)).toEqual([]);
    expect(classifyCodeBlocks(undefined)).toEqual([]);
  });

  it('원본 필드를 유지하면서 type 필드를 추가한다', () => {
    const blocks = [{ language: 'js', filename: 'app.js', content: 'code' }];
    const classified = classifyCodeBlocks(blocks);
    expect(classified[0]).toEqual({
      language: 'js',
      filename: 'app.js',
      content: 'code',
      type: 'executable',
    });
  });
});

// --- writeTemporaryProject ---

describe('writeTemporaryProject', () => {
  const tempDirs = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      cleanup(dir);
    }
    tempDirs.length = 0;
  });

  it('임시 디렉토리에 파일을 생성한다', () => {
    const blocks = [
      { language: 'javascript', filename: 'index.js', content: 'const x = 1;' },
    ];
    const { tempDir, files } = writeTemporaryProject(blocks, 'cli-tool');
    tempDirs.push(tempDir);

    expect(existsSync(tempDir)).toBe(true);
    expect(files).toEqual(['index.js']);

    const content = readFileSync(`${tempDir}/index.js`, 'utf-8');
    expect(content).toBe('const x = 1;');
  });

  it('중첩 디렉토리 구조를 생성한다', () => {
    const blocks = [
      { language: 'javascript', filename: 'src/utils/helper.js', content: 'export const a = 1;' },
    ];
    const { tempDir, files } = writeTemporaryProject(blocks, 'cli-tool');
    tempDirs.push(tempDir);

    expect(files).toEqual(['src/utils/helper.js']);
    expect(existsSync(`${tempDir}/src/utils/helper.js`)).toBe(true);
  });

  it('파일명이 없으면 자동 생성한다', () => {
    const blocks = [
      { language: 'javascript', filename: null, content: 'const x = 1;' },
    ];
    const { tempDir, files } = writeTemporaryProject(blocks, 'cli-tool');
    tempDirs.push(tempDir);

    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/file-0\.js$/);
  });

  it('빈 블록이면 빈 디렉토리를 생성한다', () => {
    const { tempDir, files } = writeTemporaryProject([], 'cli-tool');
    tempDirs.push(tempDir);

    expect(existsSync(tempDir)).toBe(true);
    expect(files).toEqual([]);
  });

  it('여러 파일을 동시에 생성한다', () => {
    const blocks = [
      { language: 'javascript', filename: 'a.js', content: 'const a = 1;' },
      { language: 'json', filename: 'package.json', content: '{}' },
      { language: 'css', filename: 'style.css', content: 'body {}' },
    ];
    const { tempDir, files } = writeTemporaryProject(blocks, 'web-app');
    tempDirs.push(tempDir);

    expect(files).toHaveLength(3);
    expect(existsSync(`${tempDir}/a.js`)).toBe(true);
    expect(existsSync(`${tempDir}/package.json`)).toBe(true);
    expect(existsSync(`${tempDir}/style.css`)).toBe(true);
  });
});

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
    const blocks = [
      { language: 'javascript', filename: 'index.js', content: 'const x = 1;\n' },
    ];
    const { tempDir } = writeTemporaryProject(blocks, 'web-app');
    tempDirs.push(tempDir);

    const result = attemptBuild(tempDir, 'web-app');
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  it('package.json이 없어도 JS 파일 syntax check로 빌드한다 (api-server)', () => {
    const blocks = [
      { language: 'javascript', filename: 'server.js', content: 'const x = 1;\n' },
    ];
    const { tempDir } = writeTemporaryProject(blocks, 'api-server');
    tempDirs.push(tempDir);

    const result = attemptBuild(tempDir, 'api-server');
    expect(result.success).toBe(true);
  });

  it('올바른 JS 파일에 대해 syntax check를 통과한다 (cli-tool)', () => {
    const blocks = [
      { language: 'javascript', filename: 'index.js', content: 'const x = 1;\n' },
    ];
    const { tempDir } = writeTemporaryProject(blocks, 'cli-tool');
    tempDirs.push(tempDir);

    const result = attemptBuild(tempDir, 'cli-tool');
    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  it('구문 오류가 있는 JS 파일은 실패한다 (cli-tool)', () => {
    const blocks = [
      { language: 'javascript', filename: 'broken.js', content: 'const x = {{\n' },
    ];
    const { tempDir } = writeTemporaryProject(blocks, 'cli-tool');
    tempDirs.push(tempDir);

    const result = attemptBuild(tempDir, 'cli-tool');
    expect(result.success).toBe(false);
    expect(result.exitCode).not.toBe(0);
  });

  it('JS 파일이 없으면 실패한다 (cli-tool)', () => {
    const blocks = [
      { language: 'json', filename: 'config.json', content: '{}' },
    ];
    const { tempDir } = writeTemporaryProject(blocks, 'cli-tool');
    tempDirs.push(tempDir);

    const result = attemptBuild(tempDir, 'cli-tool');
    expect(result.success).toBe(false);
    expect(result.output).toContain('no .js files found');
  });

  it('지원하지 않는 프로젝트 유형이지만 JS 파일이 있으면 node 전략으로 빌드한다', () => {
    const blocks = [
      { language: 'javascript', filename: 'index.js', content: 'const x = 1;\n' },
    ];
    const { tempDir } = writeTemporaryProject(blocks, 'unknown-type');
    tempDirs.push(tempDir);

    const result = attemptBuild(tempDir, 'unknown-type');
    expect(result.success).toBe(true);
  });

  it('감지할 수 없는 파일만 있으면 unsupported를 반환한다', () => {
    const blocks = [
      { language: 'xml', filename: 'data.xml', content: '<root/>' },
    ];
    const { tempDir } = writeTemporaryProject(blocks, 'unknown-type');
    tempDirs.push(tempDir);

    const result = attemptBuild(tempDir, 'unknown-type');
    expect(result.success).toBe(false);
    expect(result.output).toContain('unsupported project type');
  });

  it('결과 형식이 올바르다', () => {
    const blocks = [
      { language: 'javascript', filename: 'index.js', content: 'const x = 1;\n' },
    ];
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
    const blocks = [
      { language: 'javascript', filename: 'index.js', content: 'const x = 1;' },
    ];
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

// --- verifyExecution ---

describe('verifyExecution', () => {
  it('코드 블록이 없으면 null verified를 반환한다', async () => {
    const result = await verifyExecution('일반 텍스트만 있는 출력', { id: 'task-1' });
    expect(result.verified).toBeNull();
    expect(result.reason).toBe('no-code-blocks');
    expect(result.codeBlockCount).toBe(0);
  });

  it('빈 입력도 null verified를 반환한다', async () => {
    const result = await verifyExecution('', { id: 'task-1' });
    expect(result.verified).toBeNull();
    expect(result.reason).toBe('no-code-blocks');
  });

  it('올바른 코드 블록이 있으면 검증을 수행한다 (cli-tool)', async () => {
    const md = '결과:\n```javascript\nconst x = 1;\n```';
    const task = { id: 'task-1', projectType: 'cli-tool' };
    const result = await verifyExecution(md, task);

    expect(result.codeBlockCount).toBe(1);
    expect(result.buildResult).toBeDefined();
    expect(result.testResult).toBeDefined();
    expect(result.verified).toBe(true);
  });

  it('구문 오류가 있는 코드는 verified false를 반환한다 (cli-tool)', async () => {
    const md = '결과:\n```javascript\nconst x = {{\n```';
    const task = { id: 'task-1', projectType: 'cli-tool' };
    const result = await verifyExecution(md, task);

    expect(result.verified).toBe(false);
    expect(result.buildResult.success).toBe(false);
  });

  it('결과 형식이 올바르다', async () => {
    const md = '```javascript\nconst x = 1;\n```';
    const task = { id: 'task-1', projectType: 'cli-tool' };
    const result = await verifyExecution(md, task);

    expect(result).toHaveProperty('verified');
    expect(result).toHaveProperty('buildResult');
    expect(result).toHaveProperty('testResult');
    expect(result).toHaveProperty('codeBlockCount');
  });

  it('검증 성공 시 임시 디렉토리를 정리한다', async () => {
    const md = '```javascript\nconst x = 1;\n```';
    const task = { id: 'task-1', projectType: 'cli-tool' };
    const result = await verifyExecution(md, task);

    expect(result.verified).toBe(true);
    if (result.tempDir) {
      expect(existsSync(result.tempDir)).toBe(false);
    }
  });

  it('검증 실패 시 임시 디렉토리를 보존한다 (디버깅용)', async () => {
    const md = '결과:\n```javascript\nconst x = {{\n```';
    const task = { id: 'task-1', projectType: 'cli-tool' };
    const result = await verifyExecution(md, task);

    expect(result.verified).toBe(false);
    expect(result.tempDir).toBeTruthy();
    expect(existsSync(result.tempDir)).toBe(true);

    // cleanup
    cleanup(result.tempDir);
  });

  it('task가 없으면 기본 projectType을 사용한다', async () => {
    const md = '```javascript\nconst x = 1;\n```';
    const result = await verifyExecution(md, null);

    expect(result.codeBlockCount).toBe(1);
    expect(result.verified).toBe(true);
  });
});

// --- cleanup ---

describe('cleanup', () => {
  it('임시 디렉토리를 삭제한다', () => {
    const blocks = [
      { language: 'javascript', filename: 'index.js', content: 'const x = 1;' },
    ];
    const { tempDir } = writeTemporaryProject(blocks, 'cli-tool');
    expect(existsSync(tempDir)).toBe(true);

    cleanup(tempDir);
    expect(existsSync(tempDir)).toBe(false);
  });

  it('존재하지 않는 디렉토리에 대해 오류를 발생시키지 않는다', () => {
    expect(() => cleanup('/tmp/non-existent-dir-abc123')).not.toThrow();
  });

  it('null 입력에 대해 오류를 발생시키지 않는다', () => {
    expect(() => cleanup(null)).not.toThrow();
  });

  it('빈 문자열에 대해 오류를 발생시키지 않는다', () => {
    expect(() => cleanup('')).not.toThrow();
  });
});

// --- verifyAndMaterialize ---

describe('verifyAndMaterialize', () => {
  const tempDirs = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      cleanup(dir);
    }
    tempDirs.length = 0;
  });

  function createTempDir() {
    const dir = mkdtempSync(join(tmpdir(), 'gvc-vam-test-'));
    tempDirs.push(dir);
    return dir;
  }

  it('검증 성공 시 프로젝트에 파일을 기록한다', async () => {
    const dir = createTempDir();
    const md = '결과:\n```javascript src/app.js\nconst x = 1;\n```';
    const task = { id: 'task-1', projectType: 'cli-tool' };

    const result = await verifyAndMaterialize(md, task, dir);

    expect(result.verified).toBe(true);
    expect(result.buildResult.success).toBe(true);
    expect(result.materializeResult).toBeDefined();
    expect(result.materializeResult.materializedCount).toBe(1);
    expect(existsSync(join(dir, 'src/app.js'))).toBe(true);
  });

  it('검증 실패 시 프로젝트에 파일을 기록하지 않는다', async () => {
    const dir = createTempDir();
    const md = '결과:\n```javascript src/broken.js\nconst x = {{\n```';
    const task = { id: 'task-1', projectType: 'cli-tool' };

    const result = await verifyAndMaterialize(md, task, dir);

    expect(result.verified).toBe(false);
    expect(result.materializeResult).toBeUndefined();
    expect(existsSync(join(dir, 'src/broken.js'))).toBe(false);

    // 실패 시 tempDir 보존 확인
    if (result.tempDir) {
      expect(existsSync(result.tempDir)).toBe(true);
      cleanup(result.tempDir);
    }
  });

  it('코드 블록이 없으면 null verified를 반환한다', async () => {
    const dir = createTempDir();
    const result = await verifyAndMaterialize('텍스트만', { id: 'task-1' }, dir);

    expect(result.verified).toBeNull();
    expect(result.reason).toBe('no-code-blocks');
    expect(result.materializeResult).toBeUndefined();
  });

  it('codeBlockCount를 올바르게 보고한다', async () => {
    const dir = createTempDir();
    const md = '```javascript src/a.js\nconst a = 1;\n```\n```javascript src/b.js\nconst b = 2;\n```';
    const task = { id: 'task-1', projectType: 'cli-tool' };

    const result = await verifyAndMaterialize(md, task, dir);

    expect(result.codeBlockCount).toBe(2);
  });

  it('검증 성공 시 buildResult와 testResult를 포함한다', async () => {
    const dir = createTempDir();
    const md = '```javascript src/x.js\nconst x = 1;\n```';
    const task = { id: 'task-1', projectType: 'cli-tool' };

    const result = await verifyAndMaterialize(md, task, dir);

    expect(result.buildResult).toBeDefined();
    expect(result.testResult).toBeDefined();
  });

  it('검증 실패 시 buildResult를 포함한다', async () => {
    const dir = createTempDir();
    const md = '```javascript src/err.js\nconst x = {{\n```';
    const task = { id: 'task-1', projectType: 'cli-tool' };

    const result = await verifyAndMaterialize(md, task, dir);

    expect(result.verified).toBe(false);
    expect(result.buildResult).toBeDefined();
    expect(result.buildResult.success).toBe(false);

    if (result.tempDir) cleanup(result.tempDir);
  });

  it('materialize 옵션을 전달한다', async () => {
    const dir = createTempDir();
    const md = '```javascript src/f.js\nconst f = 1;\n```';
    const task = { id: 'task-1', projectType: 'cli-tool' };

    const result = await verifyAndMaterialize(md, task, dir, { dryRun: true });

    expect(result.verified).toBe(true);
    expect(result.materializeResult.files[0].written).toBe(false);
    expect(existsSync(join(dir, 'src/f.js'))).toBe(false);
  });

  it('task가 null이어도 동작한다', async () => {
    const dir = createTempDir();
    const md = '```javascript src/g.js\nconst g = 1;\n```';

    const result = await verifyAndMaterialize(md, null, dir);

    expect(result.verified).toBe(true);
    expect(result.materializeResult.materializedCount).toBe(1);
  });

  it('다중 파일 검증+기록', async () => {
    const dir = createTempDir();
    const md = '```javascript src/a.js\nconst a = 1;\n```\n```javascript src/b.js\nconst b = 2;\n```';
    const task = { id: 'task-1', projectType: 'cli-tool' };

    const result = await verifyAndMaterialize(md, task, dir);

    expect(result.verified).toBe(true);
    expect(result.materializeResult.materializedCount).toBe(2);
    expect(existsSync(join(dir, 'src/a.js'))).toBe(true);
    expect(existsSync(join(dir, 'src/b.js'))).toBe(true);
  });
});

// --- BUILD_STRATEGIES ---

describe('BUILD_STRATEGIES', () => {
  it('4개 전략이 존재한다 (node, python, go, java)', () => {
    expect(Object.keys(BUILD_STRATEGIES)).toEqual(['node', 'python', 'go', 'java']);
  });

  it('각 전략에 detect, build, test 메서드가 있다', () => {
    for (const [, strategy] of Object.entries(BUILD_STRATEGIES)) {
      expect(typeof strategy.detect).toBe('function');
      expect(typeof strategy.build).toBe('function');
      expect(typeof strategy.test).toBe('function');
    }
  });

  it('node 전략이 package.json을 감지한다', () => {
    expect(BUILD_STRATEGIES.node.detect(['package.json', 'index.js'])).toBe(true);
    expect(BUILD_STRATEGIES.node.detect(['main.py'])).toBe(false);
  });

  it('node 전략이 .js 파일도 감지한다', () => {
    expect(BUILD_STRATEGIES.node.detect(['index.js'])).toBe(true);
  });

  it('python 전략이 requirements.txt를 감지한다', () => {
    expect(BUILD_STRATEGIES.python.detect(['requirements.txt', 'app.py'])).toBe(true);
    expect(BUILD_STRATEGIES.python.detect(['package.json'])).toBe(false);
  });

  it('python 전략이 pyproject.toml을 감지한다', () => {
    expect(BUILD_STRATEGIES.python.detect(['pyproject.toml'])).toBe(true);
  });

  it('python 전략이 setup.py를 감지한다', () => {
    expect(BUILD_STRATEGIES.python.detect(['setup.py'])).toBe(true);
  });

  it('go 전략이 go.mod를 감지한다', () => {
    expect(BUILD_STRATEGIES.go.detect(['go.mod', 'main.go'])).toBe(true);
    expect(BUILD_STRATEGIES.go.detect(['package.json'])).toBe(false);
  });

  it('java 전략이 pom.xml을 감지한다', () => {
    expect(BUILD_STRATEGIES.java.detect(['pom.xml', 'App.java'])).toBe(true);
    expect(BUILD_STRATEGIES.java.detect(['go.mod'])).toBe(false);
  });
});

// --- detectBuildStrategy ---

describe('detectBuildStrategy', () => {
  it('명시적 프로젝트 타입 매핑을 우선한다', () => {
    const result = detectBuildStrategy(['go.mod'], 'web-app');
    expect(result.strategyId).toBe('node');
  });

  it('python-app 타입은 python 전략으로 매핑한다', () => {
    const result = detectBuildStrategy([], 'python-app');
    expect(result.strategyId).toBe('python');
  });

  it('go-service 타입은 go 전략으로 매핑한다', () => {
    const result = detectBuildStrategy([], 'go-service');
    expect(result.strategyId).toBe('go');
  });

  it('java-app 타입은 java 전략으로 매핑한다', () => {
    const result = detectBuildStrategy([], 'java-app');
    expect(result.strategyId).toBe('java');
  });

  it('매핑이 없으면 파일 기반으로 자동 감지한다', () => {
    const result = detectBuildStrategy(['go.mod', 'main.go'], undefined);
    expect(result.strategyId).toBe('go');
  });

  it('파일 기반 감지도 실패하면 null을 반환한다', () => {
    const result = detectBuildStrategy(['unknown.xyz'], 'unknown-type');
    expect(result).toBeNull();
  });

  it('전략을 감지할 수 없으면 unsupported를 반환한다', () => {
    const blocks = [{ language: 'xml', filename: 'data.xml', content: '<root/>' }];
    const { tempDir } = writeTemporaryProject(blocks, 'custom');
    const result = attemptBuild(tempDir, 'nonexistent-type-xyz');
    expect(result.success).toBe(false);
    expect(result.output).toContain('unsupported project type');
    cleanup(tempDir);
  });
});

// --- writeTemporaryProject langExtMap 확장 ---

describe('writeTemporaryProject (다언어)', () => {
  const tempDirs = [];

  afterEach(() => {
    for (const dir of tempDirs) cleanup(dir);
    tempDirs.length = 0;
  });

  it('Go 파일을 올바른 확장자로 생성한다', () => {
    const blocks = [{ language: 'go', filename: null, content: 'package main' }];
    const { tempDir, files } = writeTemporaryProject(blocks, 'go-service');
    tempDirs.push(tempDir);
    expect(files[0]).toMatch(/\.go$/);
  });

  it('Java 파일을 올바른 확장자로 생성한다', () => {
    const blocks = [{ language: 'java', filename: null, content: 'class App {}' }];
    const { tempDir, files } = writeTemporaryProject(blocks, 'java-app');
    tempDirs.push(tempDir);
    expect(files[0]).toMatch(/\.java$/);
  });

  it('Kotlin 파일을 올바른 확장자로 생성한다', () => {
    const blocks = [{ language: 'kotlin', filename: null, content: 'fun main() {}' }];
    const { tempDir, files } = writeTemporaryProject(blocks, 'java-app');
    tempDirs.push(tempDir);
    expect(files[0]).toMatch(/\.kt$/);
  });

  it('Rust 파일을 올바른 확장자로 생성한다', () => {
    const blocks = [{ language: 'rust', filename: null, content: 'fn main() {}' }];
    const { tempDir, files } = writeTemporaryProject(blocks, 'custom');
    tempDirs.push(tempDir);
    expect(files[0]).toMatch(/\.rs$/);
  });
});

// --- classifyCodeBlocks (다언어 확장) ---

describe('classifyCodeBlocks (다언어)', () => {
  it('Go, Java, Kotlin, Rust를 executable로 분류한다', () => {
    const blocks = [
      { language: 'go', filename: null, content: '' },
      { language: 'java', filename: null, content: '' },
      { language: 'kotlin', filename: null, content: '' },
      { language: 'rust', filename: null, content: '' },
    ];
    const classified = classifyCodeBlocks(blocks);
    expect(classified.every(b => b.type === 'executable')).toBe(true);
  });
});
