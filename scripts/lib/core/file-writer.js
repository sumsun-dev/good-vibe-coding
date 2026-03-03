import { writeFile as fsWriteFile, readFile, mkdir, copyFile, access, lstat } from 'fs/promises';
import { dirname } from 'path';
import { AppError } from './validators.js';

/**
 * 디렉토리가 없으면 생성한다.
 * @param {string} dirPath - 생성할 디렉토리 경로
 */
export async function ensureDir(dirPath) {
  await mkdir(dirPath, { recursive: true });
}

/**
 * 파일이 존재하는지 확인한다.
 * @param {string} filePath - 확인할 파일 경로
 * @returns {Promise<boolean>}
 */
export async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw new AppError(`파일 접근 오류 (${filePath}): ${err.message}`, 'SYSTEM_ERROR');
  }
}

/**
 * 기존 파일을 백업한다. (.backup 접미사)
 * @param {string} filePath - 백업할 파일 경로
 * @returns {Promise<string|null>} 백업 파일 경로 (없으면 null)
 */
export async function backupFile(filePath) {
  if (!(await fileExists(filePath))) {
    return null;
  }
  const backupPath = `${filePath}.backup`;
  await copyFile(filePath, backupPath);
  return backupPath;
}

/**
 * 파일을 안전하게 쓴다. 기존 파일이 있으면 백업 후 쓰기.
 * @param {string} filePath - 쓸 파일 경로
 * @param {string} content - 파일 내용
 * @param {object} options - 옵션
 * @param {boolean} options.backup - 백업 여부 (기본: true)
 * @param {boolean} options.overwrite - 덮어쓰기 허용 (기본: false)
 * @returns {Promise<{written: boolean, backupPath: string|null}>}
 */
export async function safeWriteFile(filePath, content, options = {}) {
  const { backup = true, overwrite = false } = options;

  const exists = await fileExists(filePath);
  if (exists && !overwrite) {
    return { written: false, backupPath: null };
  }

  // 심링크 감지: 심링크 대상에 쓰기를 차단하여 경로 조작 방지
  if (exists) {
    const stat = await lstat(filePath);
    if (stat.isSymbolicLink()) {
      throw new AppError(`심링크 대상에 쓰기가 차단되었습니다: ${filePath}`, 'SYSTEM_ERROR');
    }
  }

  let backupPath = null;
  if (exists && backup) {
    backupPath = await backupFile(filePath);
  }

  await ensureDir(dirname(filePath));
  await fsWriteFile(filePath, content, 'utf-8');

  return { written: true, backupPath };
}

/**
 * JSON 파일을 읽어 파싱한다. 파일이 없으면 null을 반환한다.
 * @param {string} filePath - JSON 파일 경로
 * @returns {Promise<object|null>} 파싱된 객체 또는 null (파일 없음)
 */
export async function readJsonFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw new AppError(`JSON 파일 읽기 오류 (${filePath}): ${err.message}`, 'SYSTEM_ERROR');
  }
}

/**
 * 디렉토리 내 특정 확장자 파일 목록을 반환한다.
 * 디렉토리가 없으면 빈 배열을 반환한다.
 * @param {string} dir - 디렉토리 경로
 * @param {string} ext - 확장자 (예: '.json', '.md')
 * @returns {Promise<string[]>} 파일명 목록
 */
export async function listFilesByExtension(dir, ext) {
  try {
    const { readdir } = await import('fs/promises');
    const entries = await readdir(dir);
    return entries.filter((f) => f.endsWith(ext));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw new AppError(`디렉토리 읽기 오류 (${dir}): ${err.message}`, 'SYSTEM_ERROR');
  }
}

/**
 * 여러 파일을 한번에 쓴다.
 * @param {Array<{path: string, content: string}>} files - 파일 목록
 * @param {object} options - safeWriteFile 옵션
 * @returns {Promise<Array<{path: string, written: boolean, backupPath: string|null}>>}
 */
export async function writeFiles(files, options = {}) {
  const results = [];
  for (const file of files) {
    const result = await safeWriteFile(file.path, file.content, options);
    results.push({ path: file.path, ...result });
  }
  return results;
}
