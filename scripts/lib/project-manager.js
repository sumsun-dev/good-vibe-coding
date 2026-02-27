import { readFile, writeFile, readdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ensureDir, fileExists } from './file-writer.js';
import { createMetricsSnapshot, recordAgentCall, recordPhaseCompletion } from './project-metrics.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_BASE_DIR = resolve(process.env.HOME || process.env.USERPROFILE, '.claude', 'good-vibe', 'projects');

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
  return `${slug}-${yyyy}-${mm}`;
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
 * 프로젝트를 디스크에 저장한다 (동시 쓰기 보호).
 */
async function saveProject(project) {
  const projectId = project.id;
  const prev = writeLocks.get(projectId) || Promise.resolve();
  let resolveLock;
  const lockPromise = new Promise(r => { resolveLock = r; });
  writeLocks.set(projectId, lockPromise);

  await prev;
  try {
    const dir = getProjectDir(projectId);
    await ensureDir(dir);
    await writeFile(getProjectFilePath(projectId), JSON.stringify(project, null, 2), 'utf-8');
    return project;
  } finally {
    resolveLock();
  }
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
  if (!name || typeof name !== 'string') throw new Error('name 필드가 필요합니다');
  if (!type || typeof type !== 'string') throw new Error('type 필드가 필요합니다');

  const mode = options.mode || 'plan-only';
  if (!VALID_MODES.includes(mode)) throw new Error(`유효하지 않은 모드: ${mode}`);

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
  const filePath = getProjectFilePath(projectId);
  if (!(await fileExists(filePath))) return null;
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * 모든 프로젝트를 조회한다.
 * @returns {Promise<Array<object>>} 프로젝트 목록
 */
export async function listProjects() {
  if (!(await fileExists(baseDir))) return [];
  try {
    const dirs = await readdir(baseDir, { withFileTypes: true });
    const projects = [];
    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;
      const project = await getProject(dir.name);
      if (project) projects.push(project);
    }
    return projects;
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
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
    throw new Error(`유효하지 않은 상태: ${status}. 가능한 값: ${VALID_STATUSES.join(', ')}`);
  }
  const project = await getProject(projectId);
  if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${projectId}`);
  project.status = status;
  return saveProject(project);
}

/**
 * 프로젝트 팀을 설정한다.
 * @param {string} projectId - 프로젝트 ID
 * @param {Array} team - 팀원 배열
 * @returns {Promise<object>} 업데이트된 프로젝트
 */
export async function setProjectTeam(projectId, team) {
  const project = await getProject(projectId);
  if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${projectId}`);
  project.team = team;
  return saveProject(project);
}

/**
 * 프로젝트 기획서를 설정한다.
 * @param {string} projectId - 프로젝트 ID
 * @param {string} planDocument - 기획서 마크다운
 * @returns {Promise<object>} 업데이트된 프로젝트
 */
export async function setProjectPlan(projectId, planDocument) {
  const project = await getProject(projectId);
  if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${projectId}`);
  project.discussion.planDocument = planDocument;
  return saveProject(project);
}

/**
 * 프로젝트에 작업을 추가한다.
 * @param {string} projectId - 프로젝트 ID
 * @param {Array} tasks - 작업 배열
 * @returns {Promise<object>} 업데이트된 프로젝트
 */
export async function addProjectTasks(projectId, tasks) {
  const project = await getProject(projectId);
  if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${projectId}`);
  project.tasks = [...project.tasks, ...tasks];
  return saveProject(project);
}

/**
 * 프로젝트 보고서를 설정한다.
 * @param {string} projectId - 프로젝트 ID
 * @param {string} report - 보고서 마크다운
 * @returns {Promise<object>} 업데이트된 프로젝트
 */
export async function setProjectReport(projectId, report) {
  const project = await getProject(projectId);
  if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${projectId}`);
  project.report = report;
  return saveProject(project);
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
  const project = await getProject(projectId);
  if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${projectId}`);
  if (!project.discussion.rounds) project.discussion.rounds = [];
  project.discussion.rounds.push(roundData);
  if (roundData.synthesis) {
    project.discussion.planDocument = roundData.synthesis;
  }
  return saveProject(project);
}

/**
 * 태스크에 리뷰 결과를 추가한다.
 * @param {string} projectId - 프로젝트 ID
 * @param {string} taskId - 태스크 ID
 * @param {Array} reviews - 리뷰 결과 배열
 * @returns {Promise<object>} 업데이트된 프로젝트
 */
export async function addTaskReviews(projectId, taskId, reviews) {
  const project = await getProject(projectId);
  if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${projectId}`);
  const task = project.tasks.find(t => t.id === taskId);
  if (!task) throw new Error(`태스크를 찾을 수 없습니다: ${taskId}`);
  if (!task.reviews) task.reviews = [];
  task.reviews.push(...reviews);
  return saveProject(project);
}

/**
 * 태스크 상태를 업데이트한다.
 * @param {string} projectId - 프로젝트 ID
 * @param {string} taskId - 태스크 ID
 * @param {string} status - 새 상태
 * @returns {Promise<object>} 업데이트된 프로젝트
 */
export async function updateTaskStatus(projectId, taskId, status) {
  const project = await getProject(projectId);
  if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${projectId}`);
  const task = project.tasks.find(t => t.id === taskId);
  if (!task) throw new Error(`태스크를 찾을 수 없습니다: ${taskId}`);
  task.status = status;
  return saveProject(project);
}

/**
 * 태스크에 materialization 결과를 저장한다.
 * @param {string} projectId - 프로젝트 ID
 * @param {string} taskId - 태스크 ID
 * @param {object} materializeResult - materializeCode 결과
 * @returns {Promise<object>} 업데이트된 프로젝트
 */
export async function addTaskMaterializationResult(projectId, taskId, materializeResult) {
  const project = await getProject(projectId);
  if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${projectId}`);
  const task = project.tasks.find(t => t.id === taskId);
  if (!task) throw new Error(`태스크를 찾을 수 없습니다: ${taskId}`);
  if (!task.materialization) task.materialization = [];
  task.materialization.push({
    ...materializeResult,
    timestamp: new Date().toISOString(),
  });
  return saveProject(project);
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
  const project = await getProject(projectId);
  if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${projectId}`);
  const task = project.tasks.find(t => t.id === taskId);
  if (!task) throw new Error(`태스크를 찾을 수 없습니다: ${taskId}`);

  const output = taskOutput || '';
  const maxLines = options.maxLines || 200;
  const lines = output.split('\n');
  task.taskOutput = lines.length > maxLines
    ? lines.slice(0, maxLines).join('\n') + '\n...(truncated)'
    : output;

  return saveProject(project);
}

/**
 * 프로젝트의 executionState를 업데이트한다.
 * @param {string} projectId - 프로젝트 ID
 * @param {object} executionState - 새 실행 상태
 * @returns {Promise<object>} 업데이트된 프로젝트
 */
export async function updateExecutionState(projectId, executionState) {
  const project = await getProject(projectId);
  if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${projectId}`);
  project.executionState = executionState;
  return saveProject(project);
}

/**
 * 프로젝트 실행 진행률을 계산한다.
 * @param {object} project - 프로젝트 객체
 * @returns {{totalTasks: number, completedTasks: number, currentPhase: number, totalPhases: number, percentage: number}}
 */
export function getExecutionProgress(project) {
  const tasks = project.tasks || [];
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'completed').length;

  const phases = new Set(tasks.map(t => t.phase).filter(Boolean));
  const totalPhases = phases.size || 1;

  const completedPhases = new Set(
    tasks
      .filter(t => t.status === 'completed' && t.phase)
      .map(t => t.phase)
  );

  const inProgressPhases = tasks
    .filter(t => t.status !== 'completed' && t.phase)
    .map(t => t.phase);

  const currentPhase = inProgressPhases.length > 0
    ? Math.min(...inProgressPhases)
    : completedPhases.size > 0
      ? Math.max(...completedPhases) + 1
      : 1;

  const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return { totalTasks, completedTasks, currentPhase, totalPhases, percentage };
}

/**
 * 프로젝트에 메트릭스 이벤트를 기록한다.
 * @param {string} projectId - 프로젝트 ID
 * @param {object} event - 이벤트 데이터
 * @param {string} event.type - 'agent-call' | 'phase-completion'
 * @returns {Promise<object>} 업데이트된 프로젝트
 */
export async function recordMetrics(projectId, event) {
  const project = await getProject(projectId);
  if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${projectId}`);

  // 하위 호환: 기존 프로젝트에 metrics가 없으면 생성
  if (!project.metrics) {
    project.metrics = createMetricsSnapshot();
  }

  if (event.type === 'agent-call') {
    recordAgentCall(project.metrics, event);
  } else if (event.type === 'phase-completion') {
    recordPhaseCompletion(project.metrics, event);
  }

  return saveProject(project);
}
