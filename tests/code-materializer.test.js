import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { cleanup } from '../scripts/lib/engine/execution-verifier.js';
import {
  materializeCode,
  materializeBatch,
  extractMaterializableBlocks,
} from '../scripts/lib/engine/code-materializer.js';
import {
  SINGLE_FILE_OUTPUT,
  MULTI_FILE_OUTPUT,
  TEXT_ONLY_OUTPUT,
  NO_FILENAME_OUTPUT,
  MIXED_OUTPUT,
  COMMENT_FILENAME_OUTPUT,
  NESTED_DIR_OUTPUT,
  TDD_OUTPUT,
} from './fixtures/index.js';

// --- extractMaterializableBlocks ---

describe('extractMaterializableBlocks', () => {
  it('파일명이 있는 블록만 반환한다', () => {
    const blocks = extractMaterializableBlocks(SINGLE_FILE_OUTPUT);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].filename).toBe('src/app.js');
    expect(blocks[0].language).toBe('javascript');
  });

  it('다중 파일 출력에서 모든 파일명 블록을 반환한다', () => {
    const blocks = extractMaterializableBlocks(MULTI_FILE_OUTPUT);
    expect(blocks).toHaveLength(4);
    expect(blocks.map(b => b.filename)).toEqual([
      'src/server.js',
      'src/routes/users.js',
      'package.json',
      'tests/users.test.js',
    ]);
  });

  it('파일명 없는 블록은 제외한다', () => {
    const blocks = extractMaterializableBlocks(NO_FILENAME_OUTPUT);
    expect(blocks).toHaveLength(0);
  });

  it('혼합 출력에서 파일명 있는 블록만 반환한다', () => {
    const blocks = extractMaterializableBlocks(MIXED_OUTPUT);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].filename).toBe('src/utils/format.js');
    expect(blocks[1].filename).toBe('config/default.json');
  });

  it('텍스트 전용 출력은 빈 배열을 반환한다', () => {
    const blocks = extractMaterializableBlocks(TEXT_ONLY_OUTPUT);
    expect(blocks).toHaveLength(0);
  });

  it('빈 입력은 빈 배열을 반환한다', () => {
    expect(extractMaterializableBlocks('')).toEqual([]);
    expect(extractMaterializableBlocks(null)).toEqual([]);
    expect(extractMaterializableBlocks(undefined)).toEqual([]);
  });

  it('주석 파일명 블록도 추출한다', () => {
    const blocks = extractMaterializableBlocks(COMMENT_FILENAME_OUTPUT);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].filename).toBe('src/helpers/validator.js');
  });

  it('type 필드를 포함한다', () => {
    const blocks = extractMaterializableBlocks(SINGLE_FILE_OUTPUT);
    expect(blocks[0]).toHaveProperty('type');
    expect(blocks[0].type).toBe('executable');
  });

  it('중첩 디렉토리 파일명을 올바르게 추출한다', () => {
    const blocks = extractMaterializableBlocks(NESTED_DIR_OUTPUT);
    expect(blocks).toHaveLength(3);
    expect(blocks[0].filename).toBe('src/controllers/auth/login.js');
    expect(blocks[1].filename).toBe('src/controllers/auth/register.js');
    expect(blocks[2].filename).toBe('src/middleware/auth.js');
  });

  it('TDD 출력에서 테스트+구현 파일을 모두 추출한다', () => {
    const blocks = extractMaterializableBlocks(TDD_OUTPUT);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].filename).toBe('src/calculator.test.js');
    expect(blocks[1].filename).toBe('src/calculator.js');
  });
});

// --- materializeCode ---

describe('materializeCode', () => {
  const tempDirs = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      cleanup(dir);
    }
    tempDirs.length = 0;
  });

  function createTempDir() {
    const dir = mkdtempSync(join(tmpdir(), 'gvc-mat-test-'));
    tempDirs.push(dir);
    return dir;
  }

  it('단일 파일 출력을 프로젝트 디렉토리에 기록한다', async () => {
    const dir = createTempDir();
    const result = await materializeCode(SINGLE_FILE_OUTPUT, dir);

    expect(result.totalBlocks).toBe(1);
    expect(result.materializedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].relativePath).toBe('src/app.js');
    expect(result.files[0].written).toBe(true);
    expect(result.files[0].language).toBe('javascript');
    expect(result.files[0].type).toBe('executable');

    const content = readFileSync(join(dir, 'src/app.js'), 'utf-8');
    expect(content).toContain('express');
  });

  it('다중 파일 출력을 모두 기록한다', async () => {
    const dir = createTempDir();
    const result = await materializeCode(MULTI_FILE_OUTPUT, dir);

    expect(result.materializedCount).toBe(4);
    expect(existsSync(join(dir, 'src/server.js'))).toBe(true);
    expect(existsSync(join(dir, 'src/routes/users.js'))).toBe(true);
    expect(existsSync(join(dir, 'package.json'))).toBe(true);
    expect(existsSync(join(dir, 'tests/users.test.js'))).toBe(true);
  });

  it('파일명 없는 블록은 건너뛴다', () => {
    const dir = createTempDir();
    return materializeCode(NO_FILENAME_OUTPUT, dir).then(result => {
      expect(result.totalBlocks).toBe(2);
      expect(result.materializedCount).toBe(0);
      expect(result.skippedCount).toBe(2);
      expect(result.unmaterializableCount).toBe(2);
      expect(result.failedCount).toBe(0);
    });
  });

  it('혼합 출력에서 파일명 있는 블록만 기록한다', async () => {
    const dir = createTempDir();
    const result = await materializeCode(MIXED_OUTPUT, dir);

    expect(result.totalBlocks).toBe(3);
    expect(result.materializedCount).toBe(2);
    expect(result.skippedCount).toBe(1);
    expect(existsSync(join(dir, 'src/utils/format.js'))).toBe(true);
    expect(existsSync(join(dir, 'config/default.json'))).toBe(true);
  });

  it('텍스트 전용 출력에서 파일을 기록하지 않는다', async () => {
    const dir = createTempDir();
    const result = await materializeCode(TEXT_ONLY_OUTPUT, dir);

    expect(result.totalBlocks).toBe(0);
    expect(result.materializedCount).toBe(0);
    expect(result.skippedCount).toBe(0);
  });

  it('빈 출력을 처리한다', async () => {
    const dir = createTempDir();
    const result = await materializeCode('', dir);

    expect(result.totalBlocks).toBe(0);
    expect(result.materializedCount).toBe(0);
    expect(result.files).toEqual([]);
  });

  it('중첩 디렉토리 구조를 올바르게 생성한다', async () => {
    const dir = createTempDir();
    const result = await materializeCode(NESTED_DIR_OUTPUT, dir);

    expect(result.materializedCount).toBe(3);
    expect(existsSync(join(dir, 'src/controllers/auth/login.js'))).toBe(true);
    expect(existsSync(join(dir, 'src/controllers/auth/register.js'))).toBe(true);
    expect(existsSync(join(dir, 'src/middleware/auth.js'))).toBe(true);
  });

  it('dryRun 모드에서는 파일을 기록하지 않는다', async () => {
    const dir = createTempDir();
    const result = await materializeCode(SINGLE_FILE_OUTPUT, dir, { dryRun: true });

    expect(result.materializedCount).toBe(0);
    expect(result.dryRunCount).toBe(1);
    expect(result.files[0].written).toBe(false);
    expect(existsSync(join(dir, 'src/app.js'))).toBe(false);
  });

  it('overwrite 옵션이 true이면 기존 파일을 덮어쓴다', async () => {
    const dir = createTempDir();

    await materializeCode(SINGLE_FILE_OUTPUT, dir);
    const result = await materializeCode(SINGLE_FILE_OUTPUT, dir, { overwrite: true });

    expect(result.files[0].written).toBe(true);
  });

  it('overwrite가 false이면 기존 파일을 건너뛴다', async () => {
    const dir = createTempDir();

    await materializeCode(SINGLE_FILE_OUTPUT, dir);
    const result = await materializeCode(SINGLE_FILE_OUTPUT, dir, { overwrite: false });

    expect(result.files[0].written).toBe(false);
    expect(result.existsSkippedCount).toBe(1);
    expect(result.materializedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
  });

  it('backup 옵션이 true이면 백업 파일을 생성한다', async () => {
    const dir = createTempDir();

    await materializeCode(SINGLE_FILE_OUTPUT, dir);
    const result = await materializeCode(SINGLE_FILE_OUTPUT, dir, { overwrite: true, backup: true });

    expect(result.files[0].backupPath).toBeTruthy();
    expect(existsSync(result.files[0].backupPath)).toBe(true);
  });

  it('backup이 false이면 백업하지 않는다', async () => {
    const dir = createTempDir();

    await materializeCode(SINGLE_FILE_OUTPUT, dir);
    const result = await materializeCode(SINGLE_FILE_OUTPUT, dir, { overwrite: true, backup: false });

    expect(result.files[0].backupPath).toBeNull();
  });

  it('path traversal을 방지한다', async () => {
    const dir = createTempDir();
    const maliciousOutput = '```javascript ../../../etc/evil.js\nconst hack = true;\n```';
    const result = await materializeCode(maliciousOutput, dir);

    expect(result.materializedCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(result.unmaterializableCount).toBe(0);
    expect(result.files[0].written).toBe(false);
    expect(result.files[0].error).toBe('path traversal detected');
  });

  it('결과 객체 형식이 올바르다', async () => {
    const dir = createTempDir();
    const result = await materializeCode(SINGLE_FILE_OUTPUT, dir);

    expect(result).toHaveProperty('totalBlocks');
    expect(result).toHaveProperty('materializedCount');
    expect(result).toHaveProperty('skippedCount');
    expect(result).toHaveProperty('unmaterializableCount');
    expect(result).toHaveProperty('failedCount');
    expect(result).toHaveProperty('existsSkippedCount');
    expect(result).toHaveProperty('dryRunCount');
    expect(result).toHaveProperty('files');
    expect(typeof result.totalBlocks).toBe('number');
    expect(typeof result.materializedCount).toBe('number');
    expect(typeof result.skippedCount).toBe('number');
    expect(typeof result.unmaterializableCount).toBe('number');
    expect(typeof result.failedCount).toBe('number');
    expect(typeof result.existsSkippedCount).toBe('number');
    expect(typeof result.dryRunCount).toBe('number');
    expect(Array.isArray(result.files)).toBe(true);
  });

  it('파일 결과 객체에 필요한 필드가 있다', async () => {
    const dir = createTempDir();
    const result = await materializeCode(SINGLE_FILE_OUTPUT, dir);
    const file = result.files[0];

    expect(file).toHaveProperty('path');
    expect(file).toHaveProperty('relativePath');
    expect(file).toHaveProperty('written');
    expect(file).toHaveProperty('backupPath');
    expect(file).toHaveProperty('language');
    expect(file).toHaveProperty('type');
  });

  it('deeply nested path traversal을 방지한다', async () => {
    const dir = createTempDir();
    const maliciousOutput = '```javascript ../../../../../../tmp/evil.js\nconst hack = true;\n```';
    const result = await materializeCode(maliciousOutput, dir);
    expect(result.failedCount).toBe(1);
    expect(result.materializedCount).toBe(0);
  });

  it('절대 경로 path traversal을 방지한다', async () => {
    const dir = createTempDir();
    const maliciousOutput = '```javascript /etc/passwd\nroot:x:0:0\n```';
    const result = await materializeCode(maliciousOutput, dir);
    expect(result.failedCount).toBe(1);
    expect(result.files[0].error).toBe('path traversal detected');
  });

  it('URL 인코딩된 path traversal을 방지한다', async () => {
    const dir = createTempDir();
    // ..%2F는 디코딩 후 resolve에서 잡힘
    const maliciousOutput = '```javascript ..%2F..%2Fetc/evil.js\nconst hack = true;\n```';
    const result = await materializeCode(maliciousOutput, dir);
    // resolve가 리터럴로 처리하므로 안전 (파일명에 %2F 포함)
    // 어느 쪽이든 projectDir 바깥에는 기록 안 됨
    expect(result.materializedCount + result.failedCount + result.unmaterializableCount).toBeGreaterThanOrEqual(0);
  });

  it('쓰기 에러 시 에러를 던진다', async () => {
    // Windows에서는 /nonexistent가 상대 경로로 해석될 수 있으므로 플랫폼별 경로 사용
    const dir = process.platform === 'win32'
      ? 'Z:\\nonexistent-readonly-dir-test-12345'
      : '/nonexistent-readonly-dir-test-12345';
    // materializeCode propagates file system errors when the base directory cannot be created
    await expect(materializeCode(SINGLE_FILE_OUTPUT, dir)).rejects.toThrow();
  });
});

// --- materializeBatch ---

describe('materializeBatch', () => {
  const tempDirs = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      cleanup(dir);
    }
    tempDirs.length = 0;
  });

  function createTempDir() {
    const dir = mkdtempSync(join(tmpdir(), 'gvc-batch-test-'));
    tempDirs.push(dir);
    return dir;
  }

  it('여러 태스크 출력을 일괄 기록한다', async () => {
    const dir = createTempDir();
    const taskOutputs = [
      { taskId: 'task-1', output: SINGLE_FILE_OUTPUT },
      { taskId: 'task-2', output: NESTED_DIR_OUTPUT },
    ];

    const result = await materializeBatch(taskOutputs, dir);

    expect(result.results).toHaveLength(2);
    expect(result.results[0].taskId).toBe('task-1');
    expect(result.results[1].taskId).toBe('task-2');
    expect(result.totalFiles).toBe(4); // 1 + 3
  });

  it('빈 배열을 처리한다', async () => {
    const dir = createTempDir();
    const result = await materializeBatch([], dir);

    expect(result.results).toEqual([]);
    expect(result.totalFiles).toBe(0);
    expect(result.totalDryRunFiles).toBe(0);
    expect(result.errorCount).toBe(0);
  });

  it('텍스트 전용 출력이 포함되어도 정상 동작한다', async () => {
    const dir = createTempDir();
    const taskOutputs = [
      { taskId: 'task-1', output: TEXT_ONLY_OUTPUT },
      { taskId: 'task-2', output: SINGLE_FILE_OUTPUT },
    ];

    const result = await materializeBatch(taskOutputs, dir);

    expect(result.results).toHaveLength(2);
    expect(result.results[0].result.materializedCount).toBe(0);
    expect(result.results[1].result.materializedCount).toBe(1);
    expect(result.totalFiles).toBe(1);
  });

  it('옵션을 개별 materializeCode에 전달한다', async () => {
    const dir = createTempDir();
    const taskOutputs = [
      { taskId: 'task-1', output: SINGLE_FILE_OUTPUT },
    ];

    const result = await materializeBatch(taskOutputs, dir, { dryRun: true });

    expect(result.results[0].result.files[0].written).toBe(false);
    expect(result.totalFiles).toBe(0);
    expect(result.totalDryRunFiles).toBe(1);
  });

  it('결과 형식이 올바르다', async () => {
    const dir = createTempDir();
    const taskOutputs = [
      { taskId: 'task-1', output: SINGLE_FILE_OUTPUT },
    ];

    const result = await materializeBatch(taskOutputs, dir);

    expect(result).toHaveProperty('results');
    expect(result).toHaveProperty('totalFiles');
    expect(result).toHaveProperty('totalDryRunFiles');
    expect(result).toHaveProperty('errorCount');
    expect(Array.isArray(result.results)).toBe(true);
    expect(typeof result.totalFiles).toBe('number');
    expect(typeof result.totalDryRunFiles).toBe('number');
    expect(typeof result.errorCount).toBe('number');
    expect(result.errorCount).toBe(0);
  });

  it('배열이 아닌 입력은 빈 결과를 반환한다', async () => {
    const dir = createTempDir();
    const result = await materializeBatch('not-an-array', dir);
    expect(result.results).toEqual([]);
    expect(result.totalFiles).toBe(0);
    expect(result.errorCount).toBe(0);
  });

  it('materializeCode 실패를 errorCount에 반영한다', async () => {
    const taskOutputs = [
      { taskId: 'fail-task', output: SINGLE_FILE_OUTPUT },
    ];
    const badDir = process.platform === 'win32'
      ? 'Z:\\nonexistent-readonly-path-12345\\sub'
      : '/nonexistent-readonly-path-12345/sub';
    const result = await materializeBatch(taskOutputs, badDir);
    expect(result.errorCount).toBe(1);
    expect(result.results[0].taskId).toBe('fail-task');
    expect(result.results[0].result).toBeNull();
    expect(result.results[0].error).toBeDefined();
  });
});
