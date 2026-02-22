import { readFile, writeFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { scanConfigFiles } from './config-scanner.js';
import { ensureDir, fileExists, backupFile } from './file-writer.js';

/**
 * 설정 파일들을 JSON 번들로 내보낸다.
 * @param {string} targetDir - 스캔할 설정 디렉토리
 * @param {string} outputPath - 번들 저장 경로
 * @returns {Promise<{exported: boolean, fileCount: number, outputPath?: string}>}
 */
export async function exportConfig(targetDir, outputPath) {
  const scanned = await scanConfigFiles(targetDir);

  if (scanned.length === 0) {
    return { exported: false, fileCount: 0 };
  }

  const files = [];
  for (const entry of scanned) {
    const content = await readFile(entry.path, 'utf-8');
    files.push({
      relativePath: entry.relativePath,
      category: entry.category,
      content,
    });
  }

  const bundle = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    sourceDir: targetDir,
    files,
  };

  await ensureDir(dirname(outputPath));
  await writeFile(outputPath, JSON.stringify(bundle, null, 2), 'utf-8');

  return { exported: true, fileCount: files.length, outputPath };
}

/**
 * JSON 번들에서 설정을 복원한다.
 * @param {string} bundlePath - 번들 파일 경로
 * @param {string} targetDir - 복원 대상 디렉토리
 * @param {object} [opts] - 옵션
 * @param {boolean} [opts.backup=true] - 기존 파일 백업 여부
 * @returns {Promise<{imported: boolean, fileCount: number, results: Array}>}
 */
export async function importConfig(bundlePath, targetDir, opts = {}) {
  const { backup = true } = opts;

  const raw = await readFile(bundlePath, 'utf-8');
  const bundle = JSON.parse(raw);
  validateBundle(bundle);

  const results = [];
  for (const file of bundle.files) {
    const filePath = resolve(targetDir, file.relativePath);

    if (backup && await fileExists(filePath)) {
      await backupFile(filePath);
    }

    await ensureDir(dirname(filePath));
    await writeFile(filePath, file.content, 'utf-8');
    results.push({ path: filePath, written: true });
  }

  return { imported: true, fileCount: bundle.files.length, results };
}

/**
 * 번들 유효성을 검증한다.
 * @param {object} bundle - 번들 객체
 * @throws {Error} 유효하지 않은 번들
 */
export function validateBundle(bundle) {
  if (!bundle.version) {
    throw new Error('번들에 version 필드가 필요합니다');
  }
  if (!bundle.files || bundle.files.length === 0) {
    throw new Error('번들의 files 배열이 비어있습니다');
  }
  for (const file of bundle.files) {
    if (!file.relativePath) {
      throw new Error('번들 파일에 relativePath 필드가 필요합니다');
    }
    if (file.content === undefined || file.content === null) {
      throw new Error('번들 파일에 content 필드가 필요합니다');
    }
  }
}
