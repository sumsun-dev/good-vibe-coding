/**
 * agent-shadow-mode — 자가발전 학습안의 회귀 안전망
 *
 * 새 override 제안을 즉시 active로 적용하면 잘못된 학습이 다음 프로젝트들을 더 나쁘게 만들어도
 * CEO가 발견할 때까지 계속 누적된다. 이 모듈은 학습안을 candidate로 격리하고 N개 프로젝트
 * 동안 신호를 누적한 뒤, 통합 점수 비교로 promote/discard를 결정한다.
 *
 * 파일 레이아웃 (사용자 레벨, agent-overrides 디렉토리):
 *   {roleId}.md                       ← active (실제 사용)
 *   {roleId}.candidate.md             ← shadow 후보 (이 모듈)
 *   {roleId}.provenance.json          ← active provenance (agent-provenance 모듈)
 *   {roleId}.candidate.provenance.json ← candidate provenance + 누적 시그널 (이 모듈)
 *
 * 의사결정 — evaluateCandidate(roleId, { minProjects, weights }):
 *   1. candidate가 없거나 projectCount < minProjects → 'pending'
 *   2. candidate 누적 시그널의 통합 점수 vs active 누적 시그널 비교
 *   3. candidate 점수 > active 점수 → 'promote'
 *   4. candidate 점수 ≤ active 점수 → 'discard'
 *
 * 실제 dry-run 실행(execution loop 통합)은 후속 PR. 이 모듈은 데이터 구조 + 의사결정 로직만.
 */

import { readFile, writeFile, unlink, readdir } from 'fs/promises';
import { resolve } from 'path';
import { ensureDir, fileExists } from '../core/file-writer.js';
import { agentOverridesDir } from '../core/app-paths.js';
import { inputError } from '../core/validators.js';
import {
  loadProvenance,
  saveProvenance,
  appendProvenanceEntry,
  validateProvenanceEntry,
} from './agent-provenance.js';
import { computeAggregateScore, DEFAULT_SIGNAL_WEIGHTS } from './agent-performance.js';

const VALID_ROLE_PATTERN = /^[a-z][a-z0-9-]{0,49}$/;
export const DEFAULT_MIN_SHADOW_PROJECTS = 3;

let overridesDir = agentOverridesDir();

/**
 * 테스트용 — overrides 디렉토리 변경.
 * @param {string} dir
 */
export function setShadowDir(dir) {
  overridesDir = dir;
}

function validateRoleId(roleId) {
  if (typeof roleId !== 'string' || !VALID_ROLE_PATTERN.test(roleId)) {
    throw inputError(`유효하지 않은 roleId: ${roleId}`);
  }
}

function activePath(roleId) {
  return resolve(overridesDir, `${roleId}.md`);
}

function candidatePath(roleId) {
  return resolve(overridesDir, `${roleId}.candidate.md`);
}

/**
 * candidate provenance 파일 경로. agent-provenance 모듈은 active만 다루므로
 * 여기서는 candidate 전용 경로를 분리해 직접 읽고 쓴다.
 */
function candidateProvenancePath(roleId) {
  return resolve(overridesDir, `${roleId}.candidate.provenance.json`);
}

/**
 * candidate override를 저장한다 (active는 건드리지 않음).
 * 동시에 candidate provenance에 origin entry를 추가한다.
 * @param {string} roleId
 * @param {string} content - 마크다운 내용
 * @param {Partial<import('./agent-provenance.js').ProvenanceEntry>} originEntry
 * @returns {Promise<{ candidatePath: string, entryId: string }>}
 */
export async function saveCandidateOverride(roleId, content, originEntry) {
  validateRoleId(roleId);
  if (typeof content !== 'string') {
    throw inputError('candidate content는 string이어야 합니다');
  }
  const validatedEntry = validateProvenanceEntry(originEntry);
  await ensureDir(overridesDir);
  await writeFile(candidatePath(roleId), content, 'utf-8');

  const file = await loadCandidateProvenance(roleId);
  file.entries.push(validatedEntry);
  file.lastUpdated = new Date().toISOString();
  await saveCandidateProvenance(file);

  return { candidatePath: candidatePath(roleId), entryId: validatedEntry.id };
}

/**
 * candidate override 마크다운을 로드한다.
 * @param {string} roleId
 * @returns {Promise<string|null>}
 */
export async function loadCandidateOverride(roleId) {
  validateRoleId(roleId);
  const path = candidatePath(roleId);
  if (!(await fileExists(path))) return null;
  return readFile(path, 'utf-8');
}

/**
 * candidate provenance 파일을 읽는다 (없거나 손상되면 빈 구조).
 * projectResults 필드는 N개 프로젝트의 평가 신호 누적용 (이 모듈 전용).
 * @param {string} roleId
 * @returns {Promise<{ roleId: string, lastUpdated: string, entries: Array, projectResults: Array<{ projectId: string, signals: object, timestamp: string }> }>}
 */
export async function loadCandidateProvenance(roleId) {
  validateRoleId(roleId);
  const path = candidateProvenancePath(roleId);
  if (!(await fileExists(path))) {
    return { roleId, lastUpdated: '', entries: [], projectResults: [] };
  }
  try {
    const raw = await readFile(path, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { roleId, lastUpdated: '', entries: [], projectResults: [] };
    }
    return {
      roleId: parsed.roleId || roleId,
      lastUpdated: parsed.lastUpdated || '',
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      projectResults: Array.isArray(parsed.projectResults) ? parsed.projectResults : [],
    };
  } catch {
    return { roleId, lastUpdated: '', entries: [], projectResults: [] };
  }
}

/**
 * candidate provenance 전체 덮어쓰기.
 */
async function saveCandidateProvenance(file) {
  validateRoleId(file.roleId);
  await ensureDir(overridesDir);
  const payload = {
    roleId: file.roleId,
    lastUpdated: file.lastUpdated || new Date().toISOString(),
    entries: file.entries || [],
    projectResults: file.projectResults || [],
  };
  await writeFile(candidateProvenancePath(file.roleId), JSON.stringify(payload, null, 2), 'utf-8');
}

/**
 * candidate (또는 active)의 한 프로젝트 평가 신호를 누적한다.
 * which='candidate' (기본): candidate.provenance.json의 projectResults에 추가.
 * which='active': active provenance에 'project-feedback' entry로 추가 (signals 보존).
 *
 * @param {string} roleId
 * @param {string} projectId
 * @param {import('./agent-performance.js').AgentSignals} signals
 * @param {{ which?: 'candidate' | 'active' }} [options]
 */
export async function recordProjectResult(roleId, projectId, signals, options = {}) {
  if (typeof projectId !== 'string' || !projectId) {
    throw inputError('projectId가 필요합니다');
  }
  if (!signals || typeof signals !== 'object') {
    throw inputError('signals가 필요합니다');
  }
  const which = options.which || 'candidate';
  const timestamp = new Date().toISOString();

  if (which === 'candidate') {
    const file = await loadCandidateProvenance(roleId);
    file.projectResults.push({ projectId, signals, timestamp });
    file.lastUpdated = timestamp;
    await saveCandidateProvenance(file);
  } else if (which === 'active') {
    await appendProvenanceEntry(roleId, {
      source: 'project-feedback',
      projectId,
      signals,
      summary: `active 누적 (${projectId})`,
    });
  } else {
    throw inputError(`유효하지 않은 which: ${which}`);
  }
}

/**
 * candidate에 누적된 N개 프로젝트의 평균 신호를 계산한다.
 * @param {Array<{ signals: object }>} results
 * @returns {import('./agent-performance.js').AgentSignals|null} 평균. 결과 없으면 null.
 */
export function averageSignals(results) {
  if (!Array.isArray(results) || results.length === 0) return null;
  const sum = { quality: 0, time: 0, cost: 0, retry: 0, escalation: 0, contribution: 0 };
  for (const r of results) {
    const s = r?.signals || {};
    sum.quality += Number(s.quality) || 0;
    sum.time += Number(s.time) || 0;
    sum.cost += Number(s.cost) || 0;
    sum.retry += Number(s.retry) || 0;
    sum.escalation += Number(s.escalation) || 0;
    sum.contribution += Number(s.contribution) || 0;
  }
  const n = results.length;
  return {
    quality: sum.quality / n,
    time: sum.time / n,
    cost: sum.cost / n,
    retry: sum.retry / n,
    escalation: sum.escalation / n,
    contribution: sum.contribution / n,
  };
}

/**
 * active provenance의 'project-feedback' entry에서 signals를 추출해 평균을 낸다.
 * baseline 비교용.
 * @param {string} roleId
 * @returns {Promise<import('./agent-performance.js').AgentSignals|null>}
 */
async function loadActiveAverageSignals(roleId) {
  const file = await loadProvenance(roleId);
  const projectResults = (file.entries || [])
    .filter((e) => e?.source === 'project-feedback' && e?.signals)
    .map((e) => ({ signals: e.signals }));
  return averageSignals(projectResults);
}

/**
 * candidate를 평가한다.
 *
 * @param {string} roleId
 * @param {{ minProjects?: number, weights?: object }} [options]
 * @returns {Promise<{
 *   decision: 'promote' | 'discard' | 'pending',
 *   reason: string,
 *   projectCount: number,
 *   activeScore: number | null,
 *   candidateScore: number | null,
 *   activeSignals: object | null,
 *   candidateSignals: object | null,
 * }>}
 */
export async function evaluateCandidate(roleId, options = {}) {
  validateRoleId(roleId);
  const minProjects = options.minProjects ?? DEFAULT_MIN_SHADOW_PROJECTS;
  const weights = options.weights || DEFAULT_SIGNAL_WEIGHTS;

  const candidate = await loadCandidateProvenance(roleId);
  const projectCount = candidate.projectResults.length;

  if (projectCount < minProjects) {
    return {
      decision: 'pending',
      reason: `candidate 누적 ${projectCount} / 최소 ${minProjects} 프로젝트 필요`,
      projectCount,
      activeScore: null,
      candidateScore: null,
      activeSignals: null,
      candidateSignals: null,
    };
  }

  const candidateSignals = averageSignals(candidate.projectResults);
  const activeSignals = await loadActiveAverageSignals(roleId);

  const candidateScore = candidateSignals ? computeAggregateScore(candidateSignals, weights) : null;
  const activeScore = activeSignals ? computeAggregateScore(activeSignals, weights) : null;

  // active baseline이 없으면 (첫 학습) candidate를 그대로 promote
  if (activeScore === null) {
    return {
      decision: 'promote',
      reason: 'active baseline 없음 — candidate를 첫 학습으로 promote',
      projectCount,
      activeScore: null,
      candidateScore,
      activeSignals: null,
      candidateSignals,
    };
  }

  if (candidateScore > activeScore) {
    return {
      decision: 'promote',
      reason: `candidate 점수 ${candidateScore.toFixed(3)} > active ${activeScore.toFixed(3)}`,
      projectCount,
      activeScore,
      candidateScore,
      activeSignals,
      candidateSignals,
    };
  }
  return {
    decision: 'discard',
    reason: `candidate 점수 ${candidateScore.toFixed(3)} ≤ active ${activeScore.toFixed(3)}`,
    projectCount,
    activeScore,
    candidateScore,
    activeSignals,
    candidateSignals,
  };
}

/**
 * candidate를 active로 승격한다 (candidate.md → active.md).
 * candidate provenance entries는 active provenance에 머지하고, candidate 파일들은 삭제.
 * @param {string} roleId
 * @returns {Promise<{ promoted: boolean, mergedEntries: number }>}
 */
export async function promoteCandidate(roleId) {
  validateRoleId(roleId);
  const candContent = await loadCandidateOverride(roleId);
  if (candContent === null) return { promoted: false, mergedEntries: 0 };

  // candidate.md → active.md
  await ensureDir(overridesDir);
  await writeFile(activePath(roleId), candContent, 'utf-8');

  // candidate provenance entries (origin) → active provenance에 머지
  const candidateProv = await loadCandidateProvenance(roleId);
  const activeProv = await loadProvenance(roleId);
  for (const entry of candidateProv.entries) {
    activeProv.entries.push(entry);
  }
  // candidate.projectResults → active provenance에 project-feedback entries로 이전
  // 이렇게 해야 다음 candidate 평가 시 active baseline 평균에 포함된다.
  for (const result of candidateProv.projectResults) {
    activeProv.entries.push(
      validateProvenanceEntry({
        source: 'project-feedback',
        projectId: result.projectId,
        timestamp: result.timestamp,
        signals: result.signals,
        summary: 'inherited from candidate (promoted)',
      }),
    );
  }
  activeProv.lastUpdated = new Date().toISOString();
  await saveProvenance(activeProv);

  // candidate 파일들 삭제
  await unlinkIfExists(candidatePath(roleId));
  await unlinkIfExists(candidateProvenancePath(roleId));

  return { promoted: true, mergedEntries: candidateProv.entries.length };
}

/**
 * candidate를 폐기한다 (active 영향 없음).
 * @param {string} roleId
 * @returns {Promise<{ discarded: boolean }>}
 */
export async function discardCandidate(roleId) {
  validateRoleId(roleId);
  const existed = await fileExists(candidatePath(roleId));
  await unlinkIfExists(candidatePath(roleId));
  await unlinkIfExists(candidateProvenancePath(roleId));
  return { discarded: existed };
}

/**
 * candidate 상태를 조회한다 (디버깅/UI용).
 * @param {string} roleId
 * @returns {Promise<{ exists: boolean, projectCount: number, projectIds: string[], entryCount: number }>}
 */
export async function getCandidateState(roleId) {
  validateRoleId(roleId);
  const exists = await fileExists(candidatePath(roleId));
  if (!exists) {
    return { exists: false, projectCount: 0, projectIds: [], entryCount: 0 };
  }
  const prov = await loadCandidateProvenance(roleId);
  return {
    exists: true,
    projectCount: prov.projectResults.length,
    projectIds: prov.projectResults.map((r) => r.projectId),
    entryCount: prov.entries.length,
  };
}

async function unlinkIfExists(path) {
  if (await fileExists(path)) {
    await unlink(path);
  }
}

/**
 * 활성 candidate가 있는 모든 역할의 상태를 열거한다 (CEO 노출용).
 * overridesDir에서 `*.candidate.md` 파일을 스캔하여 각각의 getCandidateState를 반환.
 *
 * 디렉토리가 없으면 빈 배열 반환 (graceful).
 *
 * @returns {Promise<Array<{ roleId: string, projectCount: number, projectIds: string[], entryCount: number }>>}
 */
export async function listActiveCandidates() {
  let entries;
  try {
    entries = await readdir(overridesDir);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }

  const roleIds = entries
    .filter((name) => name.endsWith('.candidate.md'))
    .map((name) => name.slice(0, -'.candidate.md'.length))
    .filter((roleId) => VALID_ROLE_PATTERN.test(roleId));

  const results = [];
  for (const roleId of roleIds) {
    const state = await getCandidateState(roleId);
    if (state.exists) {
      results.push({ roleId, ...state });
    }
  }
  return results;
}
