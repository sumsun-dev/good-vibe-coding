/**
 * handlers/team — 팀 추천/구성 커맨드
 */
import { readStdin, output, parseArgs } from '../cli-utils.js';
import {
  recommendTeam, buildTeam, loadRoleCatalog, loadProjectTypes,
  getTeamSummary, getOptimizedTeam,
} from '../lib/agent/team-builder.js';
import { requireFields, inputError } from '../lib/core/validators.js';

const [,, , ...args] = process.argv;

export const commands = {
  'recommend-team': async () => {
    const opts = parseArgs(args);
    if (!opts.type) throw inputError('--type 옵션이 필요합니다');
    const result = await recommendTeam(opts.type);
    output(result);
  },

  'optimized-team': async () => {
    const data = await readStdin();
    const result = await getOptimizedTeam(data.projectType, data.complexity);
    output(result);
  },

  'build-team': async () => {
    const data = await readStdin();
    requireFields(data, ['roleIds']);
    const team = await buildTeam(data.roleIds, data.personalityChoices);
    output(team);
  },

  'role-catalog': async () => {
    const catalog = await loadRoleCatalog();
    output(catalog);
  },

  'project-types': async () => {
    const types = await loadProjectTypes();
    output(types);
  },

  'team-summary': async () => {
    const data = await readStdin();
    const team = await buildTeam(data.roleIds, data.personalityChoices);
    output({ summary: getTeamSummary(team), team });
  },
};
