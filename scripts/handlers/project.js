/**
 * handlers/project — 프로젝트 CRUD + 상태 관리 커맨드
 */
import { readStdin, output, parseArgs } from '../cli-utils.js';
import {
  createProject,
  getProject,
  listProjects,
  updateProjectStatus,
  setProjectTeam,
  getExecutionProgress,
} from '../lib/project/project-manager.js';
import { generateReport } from '../lib/output/report-generator.js';
import { scanCodebase } from '../lib/project/codebase-scanner.js';
import {
  requireFields,
  inputError,
  notFoundError,
  assertWithinRoot,
} from '../lib/core/validators.js';
import { getCommandSchema, listCommandSchemas } from '../lib/core/command-schemas.js';

const [, , , ...args] = process.argv;

export const commands = {
  'create-project': async () => {
    const data = await readStdin();
    requireFields(data, ['name', 'type']);

    if (data.infraPath !== undefined && data.infraPath !== null) {
      if (typeof data.infraPath !== 'string') {
        throw inputError('infraPath는 문자열이어야 합니다');
      }
      const { resolve } = await import('path');
      const resolved = resolve(data.infraPath);
      if (resolved !== data.infraPath && data.infraPath.includes('..')) {
        throw inputError('infraPath에 경로 순회(..)를 사용할 수 없습니다');
      }
    }

    if (data.githubUrl !== undefined && data.githubUrl !== null) {
      if (
        typeof data.githubUrl !== 'string' ||
        !/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+/.test(data.githubUrl)
      ) {
        throw inputError('githubUrl은 https://github.com/{owner}/{repo} 형식이어야 합니다');
      }
    }

    const project = await createProject(data.name, data.type, data.description, {
      mode: data.mode,
      prd: data.prd,
      infraPath: data.infraPath,
      githubUrl: data.githubUrl,
    });
    output(project);
  },

  'get-project': async () => {
    const opts = parseArgs(args);
    const project = await getProject(opts.id);
    if (!project) throw notFoundError(`프로젝트를 찾을 수 없습니다: ${opts.id}`);
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

  report: async () => {
    const opts = parseArgs(args);
    const project = await getProject(opts.id);
    if (!project) throw notFoundError(`프로젝트를 찾을 수 없습니다: ${opts.id}`);
    const report = generateReport(project);
    output({ report });
  },

  'scan-codebase': async () => {
    const opts = parseArgs(args);
    if (!opts.path) throw inputError('--path 옵션이 필요합니다');
    const { resolve } = await import('path');
    const resolved = resolve(opts.path);
    assertWithinRoot(resolved, process.cwd(), '--path');
    const result = await scanCodebase(resolved);
    output(result);
  },

  'describe-command': async () => {
    const opts = parseArgs(args);
    if (opts.command) {
      const schema = getCommandSchema(opts.command);
      if (!schema) throw notFoundError(`커맨드 스키마를 찾을 수 없습니다: ${opts.command}`);
      output({ command: opts.command, ...schema });
    } else {
      output(listCommandSchemas());
    }
  },
};
