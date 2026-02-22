import { readdir, stat, rm } from 'fs/promises';
import { resolve } from 'path';
import { fileExists, backupFile } from './file-writer.js';

/**
 * 설정 디렉토리의 파일을 스캔한다.
 * @param {string} targetDir - 스캔할 디렉토리 (예: ~/.claude)
 * @returns {Promise<Array<{path: string, relativePath: string, category: string, exists: boolean, size: number}>>}
 */
export async function scanConfigFiles(targetDir) {
  const files = [];

  // CLAUDE.md
  const claudeMdPath = resolve(targetDir, 'CLAUDE.md');
  if (await fileExists(claudeMdPath)) {
    const info = await stat(claudeMdPath);
    files.push({
      path: claudeMdPath,
      relativePath: 'CLAUDE.md',
      category: 'claude-md',
      exists: true,
      size: info.size,
    });
  }

  // rules/core.md
  const coreRulesPath = resolve(targetDir, 'rules', 'core.md');
  if (await fileExists(coreRulesPath)) {
    const info = await stat(coreRulesPath);
    files.push({
      path: coreRulesPath,
      relativePath: 'rules/core.md',
      category: 'rules',
      exists: true,
      size: info.size,
    });
  }

  // agents/*.md
  const agentsDir = resolve(targetDir, 'agents');
  if (await fileExists(agentsDir)) {
    try {
      const entries = await readdir(agentsDir);
      for (const entry of entries) {
        if (!entry.endsWith('.md')) continue;
        const agentPath = resolve(agentsDir, entry);
        const info = await stat(agentPath);
        files.push({
          path: agentPath,
          relativePath: `agents/${entry}`,
          category: 'agents',
          exists: true,
          size: info.size,
        });
      }
    } catch {
      // agents 디렉토리 읽기 실패 시 무시
    }
  }

  return files;
}

/**
 * 설정 파일들을 삭제한다 (백업 옵션 지원).
 * @param {Array<{path: string, exists: boolean}>} files - 삭제할 파일 목록
 * @param {object} [opts] - 옵션
 * @param {boolean} [opts.backup=true] - 백업 여부
 * @returns {Promise<Array<{path: string, backedUp: boolean, deleted: boolean}>>}
 */
export async function resetConfigFiles(files, opts = {}) {
  const { backup = true } = opts;
  const results = [];

  for (const file of files) {
    if (!file.exists) {
      results.push({ path: file.path, backedUp: false, deleted: false });
      continue;
    }

    let backedUp = false;
    if (backup) {
      const backupPath = await backupFile(file.path);
      backedUp = backupPath !== null;
    }

    await rm(file.path);
    results.push({ path: file.path, backedUp, deleted: true });
  }

  return results;
}

/**
 * 스캔 결과를 요약한다.
 * @param {Array<{category: string}>} files - 스캔된 파일 배열
 * @returns {{total: number, claudeMd: number, rules: number, agents: number}}
 */
export function summarizeConfigFiles(files) {
  return {
    total: files.length,
    claudeMd: files.filter(f => f.category === 'claude-md').length,
    rules: files.filter(f => f.category === 'rules').length,
    agents: files.filter(f => f.category === 'agents').length,
  };
}
