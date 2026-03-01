/**
 * code-materializer — 코드 구체화 모듈
 * 마크다운 태스크 출력에서 코드 블록을 추출하여 프로젝트 디렉토리에
 * 실제 파일로 기록한다.
 */

import { resolve } from 'path';
import { extractCodeBlocks, classifyCodeBlocks } from './execution-verifier.js';
import { safeWriteFile, ensureDir } from './file-writer.js';
import { assertWithinRoot, inputError } from './validators.js';

/**
 * 파일명이 있는 코드 블록만 필터링하여 반환한다.
 * @param {string} taskOutput - 마크다운 태스크 출력
 * @returns {Array<{language: string, filename: string, content: string, type: string}>} 기록 가능한 블록 배열
 */
export function extractMaterializableBlocks(taskOutput) {
  if (!taskOutput || typeof taskOutput !== 'string') {
    return [];
  }

  const blocks = extractCodeBlocks(taskOutput);
  const classified = classifyCodeBlocks(blocks);

  return classified.filter(block => block.filename);
}

/**
 * 태스크 출력에서 코드 블록을 추출하여 프로젝트 디렉토리에 파일로 기록한다.
 * @param {string} taskOutput - 마크다운 태스크 출력
 * @param {string} projectDir - 대상 프로젝트 디렉토리
 * @param {object} options - 옵션
 * @param {boolean} [options.overwrite=true] - 덮어쓰기 허용
 * @param {boolean} [options.backup=true] - 기존 파일 백업
 * @param {boolean} [options.dryRun=false] - 실제 쓰기 없이 시뮬레이션
 * @returns {Promise<{totalBlocks: number, materializedCount: number, skippedCount: number, files: Array<{path: string, relativePath: string, written: boolean, backupPath: string|null, language: string, type: string}>}>}
 */
export async function materializeCode(taskOutput, projectDir, options = {}) {
  if (!taskOutput || typeof taskOutput !== 'string') {
    return {
      totalBlocks: 0,
      materializedCount: 0,
      skippedCount: 0,
      unmaterializableCount: 0,
      failedCount: 0,
      existsSkippedCount: 0,
      dryRunCount: 0,
      files: [],
    };
  }

  if (!projectDir || typeof projectDir !== 'string') {
    throw inputError('projectDir must be a non-empty string');
  }

  const { overwrite = true, backup = true, dryRun = false } = options;

  const allBlocks = extractCodeBlocks(taskOutput);
  const totalBlocks = allBlocks.length;
  const classified = classifyCodeBlocks(allBlocks);
  const materializableBlocks = classified.filter(block => block.filename);
  const unmaterializableCount = totalBlocks - materializableBlocks.length;

  if (materializableBlocks.length === 0) {
    return {
      totalBlocks,
      materializedCount: 0,
      skippedCount: totalBlocks,
      unmaterializableCount,
      failedCount: 0,
      existsSkippedCount: 0,
      dryRunCount: 0,
      files: [],
    };
  }

  if (!dryRun) {
    await ensureDir(projectDir);
  }

  const files = [];
  let materializedCount = 0;
  let failedCount = 0;
  let dryRunCount = 0;
  let existsSkippedCount = 0;

  for (const block of materializableBlocks) {
    const fullPath = resolve(projectDir, block.filename);
    const fileRecord = {
      path: fullPath,
      relativePath: block.filename,
      written: false,
      backupPath: null,
      language: block.language,
      type: block.type,
    };

    // path traversal 방지
    try {
      assertWithinRoot(resolve(fullPath), resolve(projectDir), 'filePath');
    } catch {
      fileRecord.error = 'path traversal detected';
      files.push(fileRecord);
      failedCount++;
      continue;
    }

    if (dryRun) {
      files.push(fileRecord);
      dryRunCount++;
      continue;
    }

    try {
      const result = await safeWriteFile(fullPath, block.content, {
        overwrite,
        backup,
      });

      fileRecord.written = result.written;
      fileRecord.backupPath = result.backupPath;

      if (result.written) {
        materializedCount++;
      } else {
        existsSkippedCount++;
      }
    } catch (error) {
      fileRecord.written = false;
      fileRecord.error = error.message;
      failedCount++;
    }

    files.push(fileRecord);
  }

  const skippedCount = unmaterializableCount + failedCount + existsSkippedCount;

  return {
    totalBlocks,
    materializedCount,
    skippedCount,
    unmaterializableCount,
    failedCount,
    existsSkippedCount,
    dryRunCount,
    files,
  };
}

/**
 * 여러 태스크 출력을 일괄 기록한다.
 *
 * 순차 실행을 유지한다 — 동일 projectDir에 대한 병렬 쓰기는
 * 파일 수준 충돌 위험이 있으며, 충돌 감지 로직은 현재 복잡도 대비
 * 이점이 부족하다.
 *
 * @param {Array<{taskId: string, output: string}>} taskOutputs - 태스크 출력 배열
 * @param {string} projectDir - 대상 프로젝트 디렉토리
 * @param {object} options - materializeCode 옵션
 * @returns {Promise<{results: Array<{taskId: string, result: object|null, error?: string}>, totalFiles: number, totalDryRunFiles: number, errorCount: number}>}
 */
export async function materializeBatch(taskOutputs, projectDir, options = {}) {
  if (!Array.isArray(taskOutputs)) {
    return { results: [], totalFiles: 0, totalDryRunFiles: 0, errorCount: 0 };
  }

  if (!projectDir || typeof projectDir !== 'string') {
    throw inputError('projectDir must be a non-empty string');
  }

  const results = [];
  let totalFiles = 0;
  let totalDryRunFiles = 0;
  let errorCount = 0;

  for (const item of taskOutputs) {
    const taskId = item.taskId || 'unknown';
    const output = item.output || '';

    try {
      const result = await materializeCode(output, projectDir, options);
      results.push({ taskId, result });
      totalFiles += result.materializedCount;
      totalDryRunFiles += result.dryRunCount;
    } catch (error) {
      results.push({ taskId, result: null, error: error.message });
      errorCount++;
    }
  }

  return { results, totalFiles, totalDryRunFiles, errorCount };
}
