#!/usr/bin/env node
import { createProject, getProject, listProjects, updateProjectStatus, setProjectTeam, setProjectPlan, addProjectTasks, setProjectReport } from './lib/project-manager.js';
import { recommendTeam, buildTeam, loadRoleCatalog, loadProjectTypes, getTeamSummary } from './lib/team-builder.js';
import { buildDiscussionPrompt, buildPlanDocument, parseDiscussionOutput } from './lib/discussion-engine.js';
import { buildTaskDistributionPrompt, buildExecutionPrompt, buildExecutionPlan, parseTaskList } from './lib/task-distributor.js';
import { generateReport } from './lib/report-generator.js';
import { addFeedback, getTeamStats, getFeedbackHistory } from './lib/feedback-manager.js';
import { analyzeGrowth, getGrowthProfiles, formatGrowthReport } from './lib/growth-manager.js';

const [,, command, ...args] = process.argv;

/**
 * stdin에서 JSON을 읽는다.
 */
async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf-8').trim();
  return raw ? JSON.parse(raw) : {};
}

/**
 * 결과를 JSON으로 출력한다.
 */
function output(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

/**
 * 인자에서 --key value 또는 --key=value를 파싱한다.
 */
function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        result[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
      } else if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        result[arg.slice(2)] = args[i + 1];
        i++;
      } else {
        result[arg.slice(2)] = true;
      }
    }
  }
  return result;
}

const commands = {
  'create-project': async () => {
    const data = await readStdin();
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
    const project = await updateProjectStatus(data.id, data.status);
    output(project);
  },

  'set-team': async () => {
    const data = await readStdin();
    const project = await setProjectTeam(data.id, data.team);
    output(project);
  },

  'recommend-team': async () => {
    const opts = parseArgs(args);
    const result = await recommendTeam(opts.type);
    output(result);
  },

  'build-team': async () => {
    const data = await readStdin();
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

  'discussion-prompt': async () => {
    const opts = parseArgs(args);
    const project = await getProject(opts.id);
    if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${opts.id}`);
    const prompt = buildDiscussionPrompt(project, project.team, parseInt(opts.round || '1'));
    output({ prompt });
  },

  'plan-document': async () => {
    const data = await readStdin();
    const doc = buildPlanDocument(data.project, data.discussions || []);
    output({ planDocument: doc });
  },

  'task-distribution-prompt': async () => {
    const opts = parseArgs(args);
    const project = await getProject(opts.id);
    if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${opts.id}`);
    const prompt = buildTaskDistributionPrompt(project, project.discussion.planDocument);
    output({ prompt });
  },

  'execution-prompt': async () => {
    const data = await readStdin();
    const prompt = buildExecutionPrompt(data.task, data.teamMember);
    output({ prompt });
  },

  'execution-plan': async () => {
    const data = await readStdin();
    const plan = buildExecutionPlan(data.tasks, data.team);
    output(plan);
  },

  'report': async () => {
    const opts = parseArgs(args);
    const project = await getProject(opts.id);
    if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${opts.id}`);
    const report = generateReport(project);
    output({ report });
  },

  'add-feedback': async () => {
    const data = await readStdin();
    const feedback = await addFeedback(data.projectId, data.roleId, data.rating, data.comment);
    output(feedback);
  },

  'team-stats': async () => {
    const stats = await getTeamStats();
    output(stats);
  },

  'growth': async () => {
    const opts = parseArgs(args);
    if (opts.role) {
      const profile = await analyzeGrowth(opts.role);
      output(profile);
    } else {
      const data = await readStdin().catch(() => ({}));
      const roleIds = data.roleIds || [];
      if (roleIds.length === 0) {
        const stats = await getTeamStats();
        const ids = stats.map(s => s.roleId);
        const profiles = await getGrowthProfiles(ids);
        output({ report: formatGrowthReport(profiles), profiles: Object.fromEntries(profiles) });
      } else {
        const profiles = await getGrowthProfiles(roleIds);
        output({ report: formatGrowthReport(profiles), profiles: Object.fromEntries(profiles) });
      }
    }
  },
};

async function main() {
  if (!command || !commands[command]) {
    const available = Object.keys(commands).join(', ');
    process.stderr.write(`사용법: cli.js <command>\n사용 가능한 명령: ${available}\n`);
    process.exit(1);
  }

  try {
    await commands[command]();
  } catch (err) {
    process.stderr.write(`오류: ${err.message}\n`);
    process.exit(1);
  }
}

main();
