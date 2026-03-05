import { writeFile, readdir } from 'fs/promises';
import { resolve } from 'path';
import { randomBytes } from 'crypto';
import { ensureDir, fileExists, readJsonFile } from '../core/file-writer.js';
import { inputError, notFoundError, AppError } from '../core/validators.js';
import {
  createMetricsSnapshot,
  recordAgentCall,
  recordPhaseCompletion,
} from './project-metrics.js';
import { projectsDir } from '../core/app-paths.js';
import { config } from '../core/config.js';

const DEFAULT_BASE_DIR = projectsDir();

let baseDir = DEFAULT_BASE_DIR;

const VALID_STATUSES = ['planning', 'approved', 'executing', 'reviewing', 'completed'];
const VALID_MODES = ['plan-only', 'plan-execute', 'quick-build'];

/**
 * 테스트용 베이스 디렉토리를 설정한다.
 * @param {string} dir - 새 베이스 디렉토리
 */
export function setBaseDir(dir) {
  baseDir = dir;
}

/**
 * 프로젝트 ID를 생성한다 (kebab-case + YYYY-MM).
 * @param {string} name - 프로젝트 이름
 * @returns {string} 프로젝트 ID
 */
export function generateProjectId(name) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const suffix = randomBytes(4).toString('hex');
  return `${slug}-${yyyy}-${mm}-${suffix}`;
}

/**
 * 프로젝트 디렉토리 경로를 반환한다.
 * @param {string} projectId - 프로젝트 ID
 * @returns {string} 디렉토리 경로
 */
export function getProjectDir(projectId) {
  return resolve(baseDir, projectId);
}

/**
 * 프로젝트 파일 경로를 반환한다.
 */
function getProjectFilePath(projectId) {
  return resolve(getProjectDir(projectId), 'project.json');
}

/**
 * In-process 쓰기 락 — 동일 프로젝트에 대한 동시 쓰기를 직렬화한다.
 * @type {Map<string, Promise<void>>}
 */
const writeLocks = new Map();

/**
 * 프로젝트 파일을 디스크에서 읽는다.
 * @param {string} projectId - 프로젝트 ID
 * @returns {Promise<object|null>} 프로젝트 또는 null (파일 없음)
 */
async function readProjectFile(projectId) {
  return readJsonFile(getProjectFilePath(projectId));
}

/**
 * 프로젝트 객체를 디스크에 기록한다.
 * @param {string} projectId - 프로젝트 ID
 * @param {object} project - 프로젝트 객체
 */
async function writeProjectFile(projectId, project) {
  const dir = getProjectDir(projectId);
  await ensureDir(dir);
  await writeFile(getProjectFilePath(projectId), JSON.stringify(project, null, 2), 'utf-8');
}

/**
 * 프로젝트 락을 획득하고 read → mutate → write 사이클을 원자적으로 수행한다.
 * @param {string} projectId - 프로젝트 ID
 * @param {function} fn - (project) => updatedProject 변환 함수
 * @returns {Promise<object>} 업데이트된 프로젝트
 */
async function withProjectLock(projectId, fn) {
  const prev = writeLocks.get(projectId) || Promise.resolve();
  let resolveLock;
  const lockPromise = new Promise((r) => {
    resolveLock = r;
  });
  writeLocks.set(projectId, lockPromise);

  await prev;
  try {
    const project = await readProjectFile(projectId);
    if (!project) throw notFoundError(`프로젝트를 찾을 수 없습니다: ${projectId}`);
    const updated = fn(project);
    await writeProjectFile(projectId, updated);
    return updated;
  } finally {
    resolveLock();
    // 현재 락이 Map에 남아있으면 삭제 (누수 방지)
    if (writeLocks.get(projectId) === lockPromise) {
      writeLocks.delete(projectId);
    }
  }
}

/**
 * 프로젝트를 디스크에 저장한다 (createProject 전용 — 신규 파일 생성).
 */
async function saveProject(project) {
  const projectId = project.id;
  await writeProjectFile(projectId, project);
  return project;
}

/**
 * 프로젝트를 생성한다.
 * @param {string} name - 프로젝트 이름
 * @param {string} type - 프로젝트 타입
 * @param {string} description - 설명
 * @param {object} options - 옵션
 * @returns {Promise<object>} 생성된 프로젝트
 */
export async function createProject(name, type, description, options = {}) {
  if (!name || typeof name !== 'string') throw inputError('name 필드가 필요합니다');
  if (!type || typeof type !== 'string') throw inputError('type 필드가 필요합니다');

  const mode = options.mode || 'plan-only';
  if (!VALID_MODES.includes(mode)) throw inputError(`유효하지 않은 모드: ${mode}`);

  const project = {
    id: generateProjectId(name),
    name,
    type,
    description: description || '',
    createdAt: new Date().toISOString(),
    status: 'planning',
    mode,
    infraPath: options.infraPath || null,
    githubUrl: options.githubUrl || null,
    team: [],
    discussion: { rounds: [], planDocument: '' },
    tasks: [],
    report: null,
    feedback: [],
    pullRequests: [],
    metrics: createMetricsSnapshot(),
  };

  return saveProject(project);
}

/**
 * 프로젝트를 조회한다.
 * @param {string} projectId - 프로젝트 ID
 * @returns {Promise<object|null>} 프로젝트 또는 null
 */
export async function getProject(projectId) {
  return readProjectFile(projectId);
}

/**
 * 모든 프로젝트를 조회한다.
 * @returns {Promise<Array<object>>} 프로젝트 목록
 */
export async function listProjects() {
  if (!(await fileExists(baseDir))) return [];
  try {
    const dirs = await readdir(baseDir, { withFileTypes: true });
    const results = await Promise.all(
      dirs
        .filter((d) => d.isDirectory())
        .map(async (d) => {
          try {
            return await getProject(d.name);
          } catch {
            process.stderr.write(`[gvc] 손상된 프로젝트 건너뜀: ${d.name}\n`);
            return null;
          }
        }),
    );
    return results.filter(Boolean);
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'EACCES' || err.code === 'EPERM') return [];
    throw new AppError(`프로젝트 목록 읽기 오류: ${err.message}`, 'SYSTEM_ERROR');
  }
}

/**
 * 프로젝트 상태를 업데이트한다.
 * @param {string} projectId - 프로젝트 ID
 * @param {string} status - 새 상태
 * @returns {Promise<object>} 업데이트된 프로젝트
 */
export async function updateProjectStatus(projectId, status) {
  if (!VALID_STATUSES.includes(status)) {
    throw inputError(`유효하지 않은 상태: ${status}. 가능한 값: ${VALID_STATUSES.join(', ')}`);
  }
  return withProjectLock(projectId, (project) => ({ ...project, status }));
}

/**
 * 프로젝트 팀을 설정한다.
 * @param {string} projectId - 프로젝트 ID
 * @param {Array} team - 팀원 배열
 * @returns {Promise<object>} 업데이트된 프로젝트
 */
export async function setProjectTeam(projectId, team) {
  return withProjectLock(projectId, (project) => ({ ...project, team }));
}

/**
 * 프로젝트 기획서를 설정한다.
 * @param {string} projectId - 프로젝트 ID
 * @param {string} planDocument - 기획서 마크다운
 * @returns {Promise<object>} 업데이트된 프로젝트
 */
export async function setProjectPlan(projectId, planDocument) {
  return withProjectLock(projectId, (project) => ({
    ...project,
    discussion: { ...project.discussion, planDocument },
  }));
}

/**
 * 프로젝트에 작업을 추가한다.
 * @param {string} projectId - 프로젝트 ID
 * @param {Array} tasks - 작업 배열
 * @returns {Promise<object>} 업데이트된 프로젝트
 */
export async function addProjectTasks(projectId, tasks) {
  return withProjectLock(projectId, (project) => ({
    ...project,
    tasks: [...project.tasks, ...tasks],
  }));
}

/**
 * 프로젝트 보고서를 설정한다.
 * @param {string} projectId - 프로젝트 ID
 * @param {string} report - 보고서 마크다운
 * @returns {Promise<object>} 업데이트된 프로젝트
 */
export async function setProjectReport(projectId, report) {
  return withProjectLock(projectId, (project) => ({ ...project, report }));
}

/**
 * 멀티에이전트 토론 라운드 데이터를 프로젝트에 추가한다.
 * @param {string} projectId - 프로젝트 ID
 * @param {object} roundData - 라운드 데이터
 * @param {number} roundData.round - 라운드 번호
 * @param {Array} roundData.agentOutputs - 에이전트 분석 결과
 * @param {string} roundData.synthesis - 종합 기획서
 * @param {Array} roundData.reviews - 리뷰 결과
 * @param {boolean} roundData.converged - 수렴 여부
 * @returns {Promise<object>} 업데이트된 프로젝트
 */
export async function addDiscussionRound(projectId, roundData) {
  return withProjectLock(projectId, (project) => {
    const rounds = [...(project.discussion.rounds || []), roundData];
    const planDocument = roundData.synthesis || project.discussion.planDocument;
    return {
      ...project,
      discussion: { ...project.discussion, rounds, planDocument },
    };
  });
}

/**
 * 태스크를 찾아 업데이트하는 공통 헬퍼 (find → throw if missing → map update).
 * @param {string} projectId - 프로젝트 ID
 * @param {string} taskId - 태스크 ID
 * @param {function} updaterFn - (task) => updatedTask 변환 함수
 * @returns {Promise<object>} 업데이트된 프로젝트
 */
async function updateTaskField(projectId, taskId, updaterFn) {
  return withProjectLock(projectId, (project) => {
    const task = project.tasks.find((t) => t.id === taskId);
    if (!task) throw notFoundError(`태스크를 찾을 수 없습니다: ${taskId}`);
    const updatedTasks = project.tasks.map((t) => (t.id === taskId ? updaterFn(t) : t));
    return { ...project, tasks: updatedTasks };
  });
}

/**
 * 태스크에 리뷰 결과를 추가한다.
 * @param {string} projectId - 프로젝트 ID
 * @param {string} taskId - 태스크 ID
 * @param {Array} reviews - 리뷰 결과 배열
 * @returns {Promise<object>} 업데이트된 프로젝트
 */
export async function addTaskReviews(projectId, taskId, reviews) {
  return updateTaskField(projectId, taskId, (t) => ({
    ...t,
    reviews: [...(t.reviews || []), ...reviews],
  }));
}

/**
 * 태스크 상태를 업데이트한다.
 * @param {string} projectId - 프로젝트 ID
 * @param {string} taskId - 태스크 ID
 * @param {string} status - 새 상태
 * @returns {Promise<object>} 업데이트된 프로젝트
 */
export async function updateTaskStatus(projectId, taskId, status) {
  return updateTaskField(projectId, taskId, (t) => ({ ...t, status }));
}

/**
 * 태스크에 materialization 결과를 저장한다.
 * @param {string} projectId - 프로젝트 ID
 * @param {string} taskId - 태스크 ID
 * @param {object} materializeResult - materializeCode 결과
 * @returns {Promise<object>} 업데이트된 프로젝트
 */
export async function addTaskMaterializationResult(projectId, taskId, materializeResult) {
  return updateTaskField(projectId, taskId, (t) => ({
    ...t,
    materialization: [
      ...(t.materialization || []),
      { ...materializeResult, timestamp: new Date().toISOString() },
    ],
  }));
}

/**
 * 태스크에 실행 출력을 저장한다.
 * @param {string} projectId - 프로젝트 ID
 * @param {string} taskId - 태스크 ID
 * @param {string} taskOutput - 태스크 출력 텍스트
 * @param {object} options - 옵션
 * @param {number} [options.maxLines=200] - 최대 줄 수
 * @returns {Promise<object>} 업데이트된 프로젝트
 */
export async function saveTaskOutput(projectId, taskId, taskOutput, options = {}) {
  return updateTaskField(projectId, taskId, (t) => {
    const output = taskOutput || '';
    const maxLines = options.maxLines || config.execution.maxOutputLines;
    const lines = output.split('\n');
    const truncatedOutput =
      lines.length > maxLines ? lines.slice(0, maxLines).join('\n') + '\n...(truncated)' : output;
    return { ...t, taskOutput: truncatedOutput };
  });
}

/**
 * 프로젝트의 executionState를 업데이트한다.
 * @param {string} projectId - 프로젝트 ID
 * @param {object} executionState - 새 실행 상태
 * @returns {Promise<object>} 업데이트된 프로젝트
 */
export async function updateExecutionState(projectId, executionState) {
  return withProjectLock(projectId, (project) => ({ ...project, executionState }));
}

/**
 * 프로젝트 실행 진행률을 계산한다.
 * @param {object} project - 프로젝트 객체
 * @returns {{totalTasks: number, completedTasks: number, currentPhase: number, totalPhases: number, percentage: number}}
 */
export function getExecutionProgress(project) {
  const tasks = project.tasks || [];
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;

  const phases = new Set(tasks.map((t) => t.phase).filter(Boolean));
  const totalPhases = phases.size || 1;

  const completedPhases = new Set(
    tasks.filter((t) => t.status === 'completed' && t.phase).map((t) => t.phase),
  );

  const inProgressPhases = tasks
    .filter((t) => t.status !== 'completed' && t.phase)
    .map((t) => t.phase);

  const currentPhase =
    inProgressPhases.length > 0
      ? Math.min(...inProgressPhases)
      : completedPhases.size > 0
        ? Math.max(...completedPhases) + 1
        : 1;

  const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return { totalTasks, completedTasks, currentPhase, totalPhases, percentage };
}

/**
 * 프로젝트에 기여도를 기록한다 (누적).
 * @param {string} projectId - 프로젝트 ID
 * @param {Array<{roleId: string, contributionScore: number, criticalsCaught?: number}>} contributions - 기여도 배열
 * @returns {Promise<object>} 업데이트된 프로젝트
 */
export async function recordContributions(projectId, contributions) {
  return withProjectLock(projectId, (project) => {
    const existing = project.contributions || {};
    const updated = { ...existing };
    for (const c of contributions) {
      const prev = updated[c.roleId] || { totalScore: 0, reviewCount: 0, criticalsCaught: 0 };
      updated[c.roleId] = {
        totalScore: prev.totalScore + (c.contributionScore || 0),
        reviewCount: prev.reviewCount + 1,
        criticalsCaught: prev.criticalsCaught + (c.criticalsCaught || 0),
      };
    }
    return { ...project, contributions: updated };
  });
}

/**
 * 프로젝트에 Pull Request 정보를 추가한다.
 * @param {string} projectId - 프로젝트 ID
 * @param {object} prInfo - PR 정보 (url, branchName, title, createdAt 등)
 * @returns {Promise<object>} 업데이트된 프로젝트
 */
export async function addPullRequest(projectId, prInfo) {
  return withProjectLock(projectId, (project) => ({
    ...project,
    pullRequests: [
      ...(project.pullRequests || []),
      { ...prInfo, recordedAt: new Date().toISOString() },
    ],
  }));
}

/**
 * 프로젝트에 메트릭스 이벤트를 기록한다.
 * @param {string} projectId - 프로젝트 ID
 * @param {object} event - 이벤트 데이터
 * @param {string} event.type - 'agent-call' | 'phase-completion'
 * @returns {Promise<object>} 업데이트된 프로젝트
 */
export async function recordMetrics(projectId, event) {
  return withProjectLock(projectId, (project) => {
    const base = project.metrics || createMetricsSnapshot();

    let metrics;
    if (event.type === 'agent-call') {
      metrics = recordAgentCall(base, event);
    } else if (event.type === 'phase-completion') {
      metrics = recordPhaseCompletion(base, event);
    } else {
      metrics = base;
    }

    return { ...project, metrics };
  });
}
