import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import {
  extractCodeBlocks,
  classifyCodeBlocks,
  writeTemporaryProject,
  attemptBuild,
  attemptTests,
  verifyExecution,
  cleanup,
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

  it('package.json이 없으면 실패를 반환한다 (web-app)', () => {
    const blocks = [
      { language: 'javascript', filename: 'index.js', content: 'const x = 1;' },
    ];
    const { tempDir } = writeTemporaryProject(blocks, 'web-app');
    tempDirs.push(tempDir);

    const result = attemptBuild(tempDir, 'web-app');
    expect(result.success).toBe(false);
    expect(result.output).toContain('package.json not found');
    expect(result.exitCode).toBe(1);
  });

  it('package.json이 없으면 실패를 반환한다 (api-server)', () => {
    const blocks = [
      { language: 'javascript', filename: 'server.js', content: 'const x = 1;' },
    ];
    const { tempDir } = writeTemporaryProject(blocks, 'api-server');
    tempDirs.push(tempDir);

    const result = attemptBuild(tempDir, 'api-server');
    expect(result.success).toBe(false);
    expect(result.output).toContain('package.json not found');
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

  it('지원하지 않는 프로젝트 유형은 실패한다', () => {
    const blocks = [
      { language: 'javascript', filename: 'index.js', content: 'const x = 1;\n' },
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

  it('임시 디렉토리를 정리한다', async () => {
    const md = '```javascript\nconst x = 1;\n```';
    const task = { id: 'task-1', projectType: 'cli-tool' };
    const result = await verifyExecution(md, task);

    // verifyExecution이 finally 블록에서 cleanup을 호출하므로
    // tempDir는 결과에 포함되지만 이미 삭제되었어야 한다
    if (result.tempDir) {
      expect(existsSync(result.tempDir)).toBe(false);
    }
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
