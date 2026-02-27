/**
 * code-materializer — 코드 구체화 모듈
 * 마크다운 태스크 출력에서 코드 블록을 추출하여 프로젝트 디렉토리에
 * 실제 파일로 기록한다.
 */

import { resolve } from 'path';
import { extractCodeBlocks, classifyCodeBlocks } from './execution-verifier.js';
import { safeWriteFile, ensureDir } from './file-writer.js';

/**
 * 경로가 기준 디렉토리 내에 있는지 검증한다 (path traversal 방지).
 * @param {string} fullPath - 검증할 전체 경로
 * @param {string} baseDir - 기준 디렉토리
 * @returns {boolean}
 */
function isPathSafe(fullPath, baseDir) {
  const resolvedPath = resolve(fullPath);
  const resolvedBase = resolve(baseDir);
  return resolvedPath.startsWith(resolvedBase + '/') || resolvedPath === resolvedBase;
}

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
      files: [],
    };
  }

  if (!projectDir || typeof projectDir !== 'string') {
    throw new Error('projectDir must be a non-empty string');
  }

  const { overwrite = true, backup = true, dryRun = false } = options;

  const allBlocks = extractCodeBlocks(taskOutput);
  const totalBlocks = allBlocks.length;
  const classified = classifyCodeBlocks(allBlocks);
  const materializableBlocks = classified.filter(block => block.filename);

  if (materializableBlocks.length === 0) {
    return {
      totalBlocks,
      materializedCount: 0,
      skippedCount: totalBlocks,
      files: [],
    };
  }

  if (!dryRun) {
    await ensureDir(projectDir);
  }

  const files = [];
  let materializedCount = 0;

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
    if (!isPathSafe(fullPath, projectDir)) {
      fileRecord.error = 'path traversal detected';
      files.push(fileRecord);
      continue;
    }

    if (dryRun) {
      // dryRun: materializedCount는 "기록될 예정" 수를 의미
      files.push(fileRecord);
      materializedCount++;
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
      }
    } catch (error) {
      fileRecord.written = false;
      fileRecord.error = error.message;
    }

    files.push(fileRecord);
  }

  const skippedCount = totalBlocks - materializedCount;

  return {
    totalBlocks,
    materializedCount,
    skippedCount,
    files,
  };
}

/**
 * 여러 태스크 출력을 일괄 기록한다.
 * @param {Array<{taskId: string, output: string}>} taskOutputs - 태스크 출력 배열
 * @param {string} projectDir - 대상 프로젝트 디렉토리
 * @param {object} options - materializeCode 옵션
 * @returns {Promise<{results: Array<{taskId: string, result: object}>, totalFiles: number}>}
 */
export async function materializeBatch(taskOutputs, projectDir, options = {}) {
  if (!Array.isArray(taskOutputs)) {
    return { results: [], totalFiles: 0 };
  }

  if (!projectDir || typeof projectDir !== 'string') {
    throw new Error('projectDir must be a non-empty string');
  }

  const results = [];
  let totalFiles = 0;

  for (const item of taskOutputs) {
    const taskId = item.taskId || 'unknown';
    const output = item.output || '';

    const result = await materializeCode(output, projectDir, options);

    results.push({ taskId, result });
    totalFiles += result.materializedCount;
  }

  return { results, totalFiles };
}
