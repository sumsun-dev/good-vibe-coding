/**
 * journal-migration — 기존 project.json의 executionState.journal[]을 jsonl로 일괄 이전
 *
 * 일회성 마이그레이션 도구. 풀 마이그레이션 후 project.json의 journal 필드는 제거.
 * dry-run 모드 + 손상 graceful skip + 이미 jsonl 있는 프로젝트 skip.
 *
 * 외부 의존성 0.
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileExists } from '../core/file-writer.js';
import { appendJournalEntry, getJournalFilePath } from './journal.js';
import { getProjectDir } from './project-manager.js';

/**
 * project-manager의 setBaseDir이 변경하는 baseDir과 동기화된 경로 추론.
 * getProjectDir은 setBaseDir 영향을 받으므로 그 부모를 baseDir로 사용.
 */
function getBaseDir() {
  return dirname(getProjectDir('__probe__'));
}

function isValidEntry(entry) {
  return entry && typeof entry === 'object' && typeof entry.type === 'string';
}

async function readProjectFile(projectId, baseDir) {
  const path = resolve(baseDir, projectId, 'project.json');
  const raw = await readFile(path, 'utf-8');
  return { project: JSON.parse(raw), path };
}

async function writeProjectFile(path, project) {
  await writeFile(path, JSON.stringify(project, null, 2), 'utf-8');
}

/**
 * 단일 프로젝트의 journal[]을 jsonl로 이전한다.
 *
 * @param {string} projectId
 * @param {object} [options]
 * @param {boolean} [options.dryRun=false]
 * @param {string} [options.baseDir] - 테스트용 베이스 디렉토리 override
 * @returns {Promise<{ migrated: boolean, entriesCount: number, skippedCount: number, dryRun: boolean, reason?: string }>}
 */
export async function migrateProjectJournal(projectId, options = {}) {
  const { dryRun = false } = options;
  const baseDir = options.baseDir || getBaseDir();

  // 이미 jsonl이 있으면 skip — 데이터 손상 방지
  const jsonlPath = getJournalFilePath(projectId);
  if (await fileExists(jsonlPath)) {
    return {
      migrated: false,
      entriesCount: 0,
      skippedCount: 0,
      dryRun,
      reason: '이미 journal.jsonl이 존재합니다 (already exists)',
    };
  }

  const { project, path: projectPath } = await readProjectFile(projectId, baseDir);
  const journal = project?.executionState?.journal;

  if (!Array.isArray(journal) || journal.length === 0) {
    return {
      migrated: false,
      entriesCount: 0,
      skippedCount: 0,
      dryRun,
      reason: 'executionState.journal이 비어있거나 없습니다',
    };
  }

  // valid entry만 추출
  const validEntries = [];
  let skippedCount = 0;
  for (const entry of journal) {
    if (isValidEntry(entry)) validEntries.push(entry);
    else skippedCount++;
  }

  if (validEntries.length === 0) {
    return {
      migrated: false,
      entriesCount: 0,
      skippedCount,
      dryRun,
      reason: 'valid entry가 없습니다',
    };
  }

  if (dryRun) {
    return {
      migrated: true,
      entriesCount: validEntries.length,
      skippedCount,
      dryRun: true,
    };
  }

  // jsonl로 append
  for (const entry of validEntries) {
    await appendJournalEntry(projectId, entry);
  }

  // project.json에서 journal 필드 제거
  if (project.executionState) {
    delete project.executionState.journal;
    await writeProjectFile(projectPath, project);
  }

  return {
    migrated: true,
    entriesCount: validEntries.length,
    skippedCount,
    dryRun: false,
  };
}

/**
 * 모든 프로젝트의 journal을 일괄 마이그레이션한다.
 *
 * @param {object} [options]
 * @param {boolean} [options.dryRun=false]
 * @param {string} [options.baseDir]
 * @returns {Promise<{ totalProjects: number, migratedCount: number, skippedCount: number, failedCount: number, failures: Array<{projectId, error}>, dryRun: boolean }>}
 */
export async function migrateAllJournals(options = {}) {
  const { dryRun = false } = options;
  const baseDir = options.baseDir || getBaseDir();

  let dirs;
  try {
    dirs = await readdir(baseDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {
        totalProjects: 0,
        migratedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        failures: [],
        dryRun,
      };
    }
    throw err;
  }

  const projectIds = dirs
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => d.name);

  let migratedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const failures = [];

  for (const projectId of projectIds) {
    try {
      const result = await migrateProjectJournal(projectId, { dryRun, baseDir });
      if (result.migrated) migratedCount++;
      else skippedCount++;
    } catch (err) {
      failedCount++;
      failures.push({ projectId, error: err.message });
    }
  }

  return {
    totalProjects: projectIds.length,
    migratedCount,
    skippedCount,
    failedCount,
    failures,
    dryRun,
  };
}
