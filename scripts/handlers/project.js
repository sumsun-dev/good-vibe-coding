/**
 * handlers/project — 프로젝트 CRUD + 상태 관리 커맨드
 */
import { readStdin, output, parseArgs } from '../cli-utils.js';
import {
  createProject,
  listProjects,
  updateProjectStatus,
  setProjectTeam,
  getExecutionProgress,
  addModifyEntry,
} from '../lib/project/project-manager.js';
import { generateReport } from '../lib/output/report-generator.js';
import { scanCodebase } from '../lib/project/codebase-scanner.js';
import {
  requireFields,
  inputError,
  notFoundError,
  assertWithinRoot,
} from '../lib/core/validators.js';
import { withProject } from '../lib/project/handler-helpers.js';
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

    if (data.clarityAnalysis !== undefined && data.clarityAnalysis !== null) {
      if (typeof data.clarityAnalysis !== 'object' || Array.isArray(data.clarityAnalysis)) {
        throw inputError('clarityAnalysis는 객체여야 합니다');
      }
    }
    if (data.complexityAnalysis !== undefined && data.complexityAnalysis !== null) {
      if (typeof data.complexityAnalysis !== 'object' || Array.isArray(data.complexityAnalysis)) {
        throw inputError('complexityAnalysis는 객체여야 합니다');
      }
    }

    const project = await createProject(data.name, data.type, data.description, {
      mode: data.mode,
      prd: data.prd,
      infraPath: data.infraPath,
      githubUrl: data.githubUrl,
      clarityAnalysis: data.clarityAnalysis,
      complexityAnalysis: data.complexityAnalysis,
    });
    output(project);
  },

  'get-project': async () => {
    const opts = parseArgs(args);
    await withProject(opts.id, (project) => output(project));
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
    await withProject(opts.id, (project) => output(getExecutionProgress(project)));
  },

  report: async () => {
    const opts = parseArgs(args);
    await withProject(opts.id, (project) => output({ report: generateReport(project) }));
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

  'add-modify-history': async () => {
    const data = await readStdin();
    requireFields(data, ['id', 'modifiedPrd', 'complexity']);

    if (typeof data.modifiedPrd !== 'string') {
      throw inputError('modifiedPrd는 문자열이어야 합니다');
    }
    const validComplexity = ['simple', 'medium', 'complex'];
    if (!validComplexity.includes(data.complexity)) {
      throw inputError(`complexity는 ${validComplexity.join('/')} 중 하나여야 합니다`);
    }
    if (data.affectedAreas !== undefined && !Array.isArray(data.affectedAreas)) {
      throw inputError('affectedAreas는 배열이어야 합니다');
    }
    if (data.migrationRisks !== undefined && !Array.isArray(data.migrationRisks)) {
      throw inputError('migrationRisks는 배열이어야 합니다');
    }

    const project = await addModifyEntry(data.id, {
      modifiedPrd: data.modifiedPrd,
      codebaseInsights: data.codebaseInsights || null,
      affectedAreas: data.affectedAreas || [],
      migrationRisks: data.migrationRisks || [],
      complexity: data.complexity,
    });
    output(project);
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
