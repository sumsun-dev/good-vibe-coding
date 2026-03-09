/**
 * settings-manager — ~/.claude/settings.json 관리
 * readSettings, writeSettings, addPermission
 */

import { readFile, writeFile as fsWriteFile, mkdir, stat } from 'fs/promises';
import { dirname, resolve } from 'path';
import { claudeDir } from './app-paths.js';
import { systemError } from './validators.js';

const MAX_SETTINGS_SIZE = 1024 * 1024; // 1MB

/**
 * 기본 settings.json 경로를 반환한다.
 * @returns {string}
 */
function defaultSettingsPath() {
  return resolve(claudeDir(), 'settings.json');
}

/**
 * settings.json을 읽는다. 파일이 없으면 빈 객체를 반환한다.
 * @param {string} [settingsPath] - 경로 (기본: ~/.claude/settings.json)
 * @returns {Promise<object>}
 */
export async function readSettings(settingsPath) {
  const filePath = settingsPath || defaultSettingsPath();
  try {
    const stats = await stat(filePath);
    if (stats.size > MAX_SETTINGS_SIZE) {
      throw systemError('settings.json 파일이 너무 큽니다 (최대 1MB)');
    }
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    if (err.code === 'SYSTEM_ERROR') throw err;
    throw systemError(`settings.json 읽기 오류: ${err.message}`);
  }
}

/**
 * settings.json을 쓴다. 디렉토리가 없으면 생성한다.
 * @param {object} settings - 쓸 설정 객체
 * @param {string} [settingsPath] - 경로 (기본: ~/.claude/settings.json)
 * @returns {Promise<void>}
 */
export async function writeSettings(settings, settingsPath) {
  const filePath = settingsPath || defaultSettingsPath();
  await mkdir(dirname(filePath), { recursive: true });
  await fsWriteFile(filePath, JSON.stringify(settings, null, 2), 'utf-8');
}

/**
 * permissions.allow에 패턴을 추가한다. 중복이면 추가하지 않는다.
 * @param {string} pattern - 추가할 패턴 (예: "Bash(node * cli.js *)")
 * @param {string} [settingsPath] - 경로 (기본: ~/.claude/settings.json)
 * @returns {Promise<{ added: boolean, alreadyExists: boolean }>}
 */
export async function addPermission(pattern, settingsPath) {
  const filePath = settingsPath || defaultSettingsPath();
  const settings = await readSettings(filePath);

  if (!settings.permissions) {
    settings.permissions = {};
  }
  if (!Array.isArray(settings.permissions.allow)) {
    settings.permissions.allow = [];
  }

  if (settings.permissions.allow.includes(pattern)) {
    return { added: false, alreadyExists: true };
  }

  settings.permissions.allow.push(pattern);
  await writeSettings(settings, filePath);
  return { added: true, alreadyExists: false };
}

/**
 * permissions.allow에 복수 패턴을 일괄 추가한다. 중복은 스킵한다.
 * @param {string[]} patterns - 추가할 패턴 배열
 * @param {string} [settingsPath] - 경로 (기본: ~/.claude/settings.json)
 * @returns {Promise<{ added: string[], skipped: string[] }>}
 */
export async function addPermissions(patterns, settingsPath) {
  const filePath = settingsPath || defaultSettingsPath();
  const settings = await readSettings(filePath);

  if (!settings.permissions) {
    settings.permissions = {};
  }
  if (!Array.isArray(settings.permissions.allow)) {
    settings.permissions.allow = [];
  }

  const added = [];
  const skipped = [];

  for (const pattern of patterns) {
    if (settings.permissions.allow.includes(pattern)) {
      skipped.push(pattern);
    } else {
      settings.permissions.allow.push(pattern);
      added.push(pattern);
    }
  }

  if (added.length > 0) {
    await writeSettings(settings, filePath);
  }

  return { added, skipped };
}
