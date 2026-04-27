/**
 * agent-provenance — agent-overrides의 origin/추적성 메타데이터
 *
 * 자가발전 시스템에서 각 override 항목이 "어느 프로젝트, 어느 시점, 어떤 신호에 의해 추가됐는지"를
 * 추적해야 잘못된 학습을 디버깅·revert할 수 있다. 외부 의존성 0 원칙을 지키기 위해 마크다운에
 * YAML/JSON frontmatter를 끼우지 않고 **별도 JSON 파일**로 분리한다.
 *
 * 파일 레이아웃:
 *   ~/.claude/good-vibe/agent-overrides/{roleId}.md              ← 사람 읽는 가이드 (변경 없음)
 *   ~/.claude/good-vibe/agent-overrides/{roleId}.provenance.json ← 메타데이터 (이 모듈)
 *
 * provenance.json 없거나 손상되면 graceful 처리 (override 자체는 정상 동작).
 */

import { readFile, writeFile, unlink } from 'fs/promises';
import { resolve } from 'path';
import { randomBytes } from 'crypto';
import { ensureDir, fileExists } from '../core/file-writer.js';
import { agentOverridesDir } from '../core/app-paths.js';
import { inputError } from '../core/validators.js';

const VALID_ROLE_PATTERN = /^[a-z][a-z0-9-]{0,49}$/;
const VALID_SOURCES = Object.freeze(['project-feedback', 'cross-project-pattern', 'manual']);

let overridesDir = agentOverridesDir();

/**
 * 테스트용 — overrides 디렉토리 변경.
 * @param {string} dir
 */
export function setProvenanceDir(dir) {
  overridesDir = dir;
}

function validateRoleId(roleId) {
  if (typeof roleId !== 'string' || !VALID_ROLE_PATTERN.test(roleId)) {
    throw inputError(`유효하지 않은 roleId: ${roleId}`);
  }
}

function provenancePath(roleId) {
  return resolve(overridesDir, `${roleId}.provenance.json`);
}

function generateEntryId() {
  return `ent-${randomBytes(6).toString('hex')}`;
}

/**
 * @typedef {Object} ProvenanceSignals
 * @property {number} [quality]
 * @property {number} [time]
 * @property {number} [cost]
 * @property {number} [retry]
 * @property {number} [escalation]
 * @property {number} [contribution]
 */

/**
 * @typedef {Object} ProvenanceEntry
 * @property {string} id - "ent-{12hex}"
 * @property {string} source - 'project-feedback' | 'cross-project-pattern' | 'manual'
 * @property {string} timestamp - ISO 8601
 * @property {string} [summary] - 사람이 읽을 한 줄 요약
 * @property {string} [projectId] - source=project-feedback일 때
 * @property {string[]} [projectIds] - source=cross-project-pattern일 때
 * @property {string} [pattern] - source=cross-project-pattern일 때
 * @property {number} [repeatCount] - source=cross-project-pattern일 때
 * @property {ProvenanceSignals} [signals] - agent-performance.extractAllSignals 결과
 */

/**
 * @typedef {Object} ProvenanceFile
 * @property {string} roleId
 * @property {string} revision - 마지막 갱신 시점의 플러그인 버전
 * @property {string} lastUpdated - ISO 8601
 * @property {ProvenanceEntry[]} entries
 */

/**
 * provenance entry를 검증한다. 기본 필드와 source별 필수 필드를 확인.
 * @param {Partial<ProvenanceEntry>} entry
 * @returns {ProvenanceEntry} 검증/정규화된 entry (id, timestamp 자동 보강)
 */
export function validateProvenanceEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    throw inputError('provenance entry는 object여야 합니다');
  }
  if (!VALID_SOURCES.includes(entry.source)) {
    throw inputError(`유효하지 않은 source: ${entry.source} (허용: ${VALID_SOURCES.join(', ')})`);
  }
  if (entry.source === 'project-feedback' && typeof entry.projectId !== 'string') {
    throw inputError("source='project-feedback'은 projectId(string)가 필요합니다");
  }
  if (entry.source === 'cross-project-pattern') {
    if (!Array.isArray(entry.projectIds) || entry.projectIds.length < 1) {
      throw inputError("source='cross-project-pattern'은 projectIds(배열)이 필요합니다");
    }
    if (typeof entry.pattern !== 'string' || !entry.pattern) {
      throw inputError("source='cross-project-pattern'은 pattern(string)이 필요합니다");
    }
  }
  return {
    ...entry,
    id: entry.id || generateEntryId(),
    timestamp: entry.timestamp || new Date().toISOString(),
  };
}

/**
 * provenance 파일을 읽는다. 파일이 없거나 손상되면 빈 구조 반환.
 * @param {string} roleId
 * @returns {Promise<ProvenanceFile>}
 */
export async function loadProvenance(roleId) {
  validateRoleId(roleId);
  const path = provenancePath(roleId);
  if (!(await fileExists(path))) {
    return { roleId, revision: '', lastUpdated: '', entries: [] };
  }
  try {
    const raw = await readFile(path, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { roleId, revision: '', lastUpdated: '', entries: [] };
    }
    return {
      roleId: parsed.roleId || roleId,
      revision: parsed.revision || '',
      lastUpdated: parsed.lastUpdated || '',
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    };
  } catch {
    // 손상된 JSON은 빈 구조로 graceful — override 자체 동작은 보존
    return { roleId, revision: '', lastUpdated: '', entries: [] };
  }
}

/**
 * provenance 파일 전체를 덮어쓴다.
 * @param {ProvenanceFile} file
 */
export async function saveProvenance(file) {
  if (!file || typeof file !== 'object') {
    throw inputError('saveProvenance: file 객체가 필요합니다');
  }
  validateRoleId(file.roleId);
  await ensureDir(overridesDir);
  const path = provenancePath(file.roleId);
  const payload = {
    roleId: file.roleId,
    revision: file.revision || '',
    lastUpdated: file.lastUpdated || new Date().toISOString(),
    entries: Array.isArray(file.entries) ? file.entries : [],
  };
  await writeFile(path, JSON.stringify(payload, null, 2), 'utf-8');
}

/**
 * provenance entry를 추가한다 (기존 파일에 append).
 * id, timestamp 자동 보강. lastUpdated 갱신.
 * @param {string} roleId
 * @param {Partial<ProvenanceEntry>} entry
 * @param {{ revision?: string }} [options]
 * @returns {Promise<ProvenanceEntry>} 저장된 entry (정규화 포함)
 */
export async function appendProvenanceEntry(roleId, entry, options = {}) {
  const validated = validateProvenanceEntry(entry);
  const file = await loadProvenance(roleId);
  file.entries.push(validated);
  file.lastUpdated = new Date().toISOString();
  if (options.revision) file.revision = options.revision;
  await saveProvenance(file);
  return validated;
}

/**
 * 특정 entry를 id로 제거한다 (CEO revert 시나리오).
 * @param {string} roleId
 * @param {string} entryId
 * @returns {Promise<{ removed: boolean, remaining: number }>}
 */
export async function removeProvenanceEntry(roleId, entryId) {
  if (typeof entryId !== 'string' || !entryId) {
    throw inputError('entryId가 필요합니다');
  }
  const file = await loadProvenance(roleId);
  const before = file.entries.length;
  file.entries = file.entries.filter((e) => e.id !== entryId);
  const removed = file.entries.length < before;
  if (removed) {
    file.lastUpdated = new Date().toISOString();
    await saveProvenance(file);
  }
  return { removed, remaining: file.entries.length };
}

/**
 * provenance 파일을 삭제한다 (override 자체는 보존).
 * @param {string} roleId
 * @returns {Promise<{ deleted: boolean }>}
 */
export async function clearProvenance(roleId) {
  validateRoleId(roleId);
  const path = provenancePath(roleId);
  if (!(await fileExists(path))) return { deleted: false };
  await unlink(path);
  return { deleted: true };
}
