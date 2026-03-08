import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { verifyExecution, verifyAndMaterialize, cleanup } from './helpers.js';

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
    const md =
      '```javascript src/a.js\nconst a = 1;\n```\n```javascript src/b.js\nconst b = 2;\n```';
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
    const md =
      '```javascript src/a.js\nconst a = 1;\n```\n```javascript src/b.js\nconst b = 2;\n```';
    const task = { id: 'task-1', projectType: 'cli-tool' };

    const result = await verifyAndMaterialize(md, task, dir);

    expect(result.verified).toBe(true);
    expect(result.materializeResult.materializedCount).toBe(2);
    expect(existsSync(join(dir, 'src/a.js'))).toBe(true);
    expect(existsSync(join(dir, 'src/b.js'))).toBe(true);
  });
});

// --- verifyAndMaterialize 반환 객체 완전성 ---

describe('verifyAndMaterialize — 반환 객체 완전성', () => {
  const tempDirs = [];

  afterEach(() => {
    for (const dir of tempDirs) cleanup(dir);
    tempDirs.length = 0;
  });

  function createTempDir() {
    const dir = mkdtempSync(join(tmpdir(), 'gvc-vam-comp-'));
    tempDirs.push(dir);
    return dir;
  }

  it('verified=null일 때 buildResult/testResult/tempDir가 undefined', async () => {
    const dir = createTempDir();
    const result = await verifyAndMaterialize('텍스트만', { id: 'task-1' }, dir);

    expect(result.verified).toBeNull();
    expect(result.codeBlockCount).toBe(0);
    expect(result.buildResult).toBeUndefined();
    expect(result.testResult).toBeUndefined();
    expect(result.tempDir).toBeUndefined();
  });

  it('verified=true일 때 tempDir/reason 필드가 없다', async () => {
    const dir = createTempDir();
    const md = '```javascript src/x.js\nconst x = 1;\n```';
    const result = await verifyAndMaterialize(md, { id: 'task-1', projectType: 'cli-tool' }, dir);

    expect(result.verified).toBe(true);
    expect('tempDir' in result).toBe(false);
    expect('reason' in result).toBe(false);
    expect(result.materializeResult).toBeDefined();
    expect(result.codeBlockCount).toBe(1);
  });

  it('verified=false일 때 buildResult/testResult/tempDir가 모두 있다', async () => {
    const dir = createTempDir();
    const md = '```javascript src/broken.js\nconst x = {{\n```';
    const result = await verifyAndMaterialize(md, { id: 'task-1', projectType: 'cli-tool' }, dir);

    expect(result.verified).toBe(false);
    expect(result.buildResult).toBeDefined();
    expect(result.testResult).toBeDefined();
    expect(result.tempDir).toBeTruthy();
    expect(result.codeBlockCount).toBe(1);
    expect(result.reason).toBeUndefined();

    if (result.tempDir) cleanup(result.tempDir);
  });
});
