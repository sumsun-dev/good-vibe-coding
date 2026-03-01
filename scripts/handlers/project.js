/**
 * handlers/project — 프로젝트 CRUD + 상태 관리 커맨드
 */
import { readStdin, output, parseArgs } from '../cli-utils.js';
import {
  createProject, getProject, listProjects, updateProjectStatus,
  setProjectTeam, getExecutionProgress,
} from '../lib/project-manager.js';
import { generateReport } from '../lib/report-generator.js';
import { requireFields, notFoundError } from '../lib/validators.js';

const [,, , ...args] = process.argv;

export const commands = {
  'create-project': async () => {
    const data = await readStdin();
    requireFields(data, ['name', 'type']);
    const project = await createProject(data.name, data.type, data.description, { mode: data.mode });
    output(project);
  },

  'get-project': async () => {
    const opts = parseArgs(args);
    const project = await getProject(opts.id);
    output(project);
  },

  'list-projects': async () => {
    const projects = await listProjects();
    output(projects);
  },

  'update-status': async () => {
    const data = await readStdin();
    requireFields(data, ['id', 'status']);
    const project = await updateProjectStatus(data.id, data.status);
    output(project);
  },

  'set-team': async () => {
    const data = await readStdin();
    requireFields(data, ['id', 'team']);
    const project = await setProjectTeam(data.id, data.team);
    output(project);
  },

  'execution-progress': async () => {
    const opts = parseArgs(args);
    const project = await getProject(opts.id);
    if (!project) throw notFoundError(`프로젝트를 찾을 수 없습니다: ${opts.id}`);
    const progress = getExecutionProgress(project);
    output(progress);
  },

  'report': async () => {
    const opts = parseArgs(args);
    const project = await getProject(opts.id);
    if (!project) throw notFoundError(`프로젝트를 찾을 수 없습니다: ${opts.id}`);
    const report = generateReport(project);
    output({ report });
  },
};
