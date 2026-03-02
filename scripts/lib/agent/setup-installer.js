/**
 * setup-installer — 스킬/에이전트 설치 모듈
 * 카탈로그 항목을 ~/.claude/ 디렉토리에 설치한다.
 */

import { readFile, writeFile, readdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { ensureDir, fileExists } from '../core/file-writer.js';
import { claudeDir, userSkillsDir, userAgentsDir, pluginRoot } from '../core/app-paths.js';
import { assertWithinRoot, AppError } from '../core/validators.js';

const PLUGIN_ROOT = pluginRoot();

/**
 * 설치된 스킬/에이전트 목록을 조회한다.
 * @returns {Promise<{skills: string[], agents: string[]}>}
 */
export async function listInstalled() {
  const skills = await scanSkills();
  const agents = await scanAgents();
  return { skills, agents };
}

async function scanSkills() {
  const dir = userSkillsDir();
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory())
      .map(e => e.name);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw new AppError(`스킬 디렉토리 읽기 오류: ${err.message}`, 'SYSTEM_ERROR');
  }
}

async function scanAgents() {
  const dir = userAgentsDir();
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter(e => e.isFile() && e.name.endsWith('.md'))
      .map(e => e.name.replace(/\.md$/, ''));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw new AppError(`에이전트 디렉토리 읽기 오류: ${err.message}`, 'SYSTEM_ERROR');
  }
}

/**
 * 단일 항목을 설치한다.
 * @param {object} item - 카탈로그 항목 (sourcePath, installPath, id 필수)
 * @returns {Promise<{id: string, installed: boolean, skipped: boolean, path: string}>}
 */
export async function installItem(item) {
  const sourcePath = resolve(PLUGIN_ROOT, item.sourcePath);
  const targetPath = resolve(claudeDir(), item.installPath);

  assertWithinRoot(sourcePath, PLUGIN_ROOT, 'sourcePath');
  assertWithinRoot(targetPath, claudeDir(), 'installPath');

  if (await fileExists(targetPath)) {
    return { id: item.id, installed: false, skipped: true, path: targetPath };
  }

  const content = await readFile(sourcePath, 'utf-8');
  await ensureDir(dirname(targetPath));
  await writeFile(targetPath, content, 'utf-8');

  return { id: item.id, installed: true, skipped: false, path: targetPath };
}

/**
 * 여러 항목을 순차 설치한다.
 * @param {Array<object>} items - 카탈로그 항목 배열
 * @returns {Promise<Array<{id: string, installed: boolean, skipped: boolean, path: string}>>}
 */
export async function installItems(items) {
  const results = [];
  for (const item of items) {
    try {
      results.push(await installItem(item));
    } catch (err) {
      results.push({ id: item.id, installed: false, skipped: false, error: err.message, path: '' });
    }
  }
  return results;
}

/**
 * 설치 결과를 포맷한다.
 * @param {Array<{id: string, installed: boolean, skipped: boolean, path: string}>} results
 * @returns {string} 마크다운 포맷 문자열
 */
export function formatInstallResults(results) {
  if (results.length === 0) return '설치할 항목이 없습니다.';

  const lines = results.map(r => {
    if (r.error) {
      return `- [실패] **${r.id}** ${r.error}`;
    }
    if (r.installed) {
      return `- [설치] **${r.id}** → \`${r.path}\``;
    }
    return `- [스킵] **${r.id}** 이미 설치됨`;
  });

  const installed = results.filter(r => r.installed).length;
  const skipped = results.filter(r => r.skipped).length;
  lines.push('');
  lines.push(`설치: ${installed}개 / 건너뜀: ${skipped}개`);

  return lines.join('\n');
}
