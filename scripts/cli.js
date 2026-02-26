#!/usr/bin/env node
import { createProject, getProject, listProjects, updateProjectStatus, setProjectTeam, setProjectPlan, addProjectTasks, setProjectReport, addDiscussionRound, addTaskReviews, updateTaskStatus } from './lib/project-manager.js';
import { recommendTeam, buildTeam, loadRoleCatalog, loadProjectTypes, getTeamSummary } from './lib/team-builder.js';
import { buildDiscussionPrompt, buildPlanDocument, parseDiscussionOutput, buildSingleAgentDiscussionPrompt } from './lib/discussion-engine.js';
import { buildTaskDistributionPrompt, buildExecutionPrompt, buildExecutionPlan, parseTaskList, buildExecutionPlanWithReviews } from './lib/task-distributor.js';
import {
  buildAgentAnalysisPrompt, buildSynthesisPrompt, buildReviewPrompt,
  parseReviewOutput, checkConvergence, groupAgentsForParallelDispatch,
  analyzeAgentEfficiency,
} from './lib/orchestrator.js';
import {
  measureOutputSimilarity, detectRedundantAgents, trackRoleContribution,
  recommendOptimalTeam, buildOptimizationReport,
} from './lib/agent-optimizer.js';
import {
  selectReviewers, buildTaskReviewPrompt, parseTaskReview,
  checkQualityGate, buildRevisionPrompt, checkEnhancedQualityGate,
} from './lib/review-engine.js';
import { verifyExecution } from './lib/execution-verifier.js';
import { buildComplexityAnalysisPrompt, parseComplexityAnalysis, getDefaultsForComplexity } from './lib/complexity-analyzer.js';
import { generateReport } from './lib/report-generator.js';
import { addFeedback, getTeamStats, getFeedbackHistory } from './lib/feedback-manager.js';
import { analyzeGrowth, getGrowthProfiles, formatGrowthReport } from './lib/growth-manager.js';
import {
  createCustomRole, getCustomRole, listCustomRoles, updateCustomRole, deleteCustomRole,
  addCustomVariant, getCustomVariants, updateCustomVariant, deleteCustomVariant,
  setOverride, getOverrides, removeOverride, getAvailableVariants,
} from './lib/persona-manager.js';
import {
  listTemplates, loadTemplate, scaffold, getTemplatesForProjectType,
} from './lib/template-scaffolder.js';
import {
  createEvalSession, recordApproachResult, compareApproaches,
  generateEvalReport, saveEvalSession, loadEvalSession, listEvalSessions,
} from './lib/eval-engine.js';
import {
  connectWithApiKey, connectGeminiCli, removeAuth, listConnectedProviders,
  loadProvidersConfig, setReviewStrategy, getProviderStatus,
  buildOAuthUrl, exchangeOAuthCode,
} from './lib/auth-manager.js';
import {
  resolveReviewAssignments, executeCrossModelReviews,
  summarizeCrossModelResults,
} from './lib/cross-model-strategy.js';
import { verifyConnection } from './lib/llm-provider.js';

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

  'create-custom-role': async () => {
    const data = await readStdin();
    const role = await createCustomRole(data);
    output(role);
  },

  'get-custom-role': async () => {
    const opts = parseArgs(args);
    const role = await getCustomRole(opts.id);
    output(role);
  },

  'list-custom-roles': async () => {
    const roles = await listCustomRoles();
    output(roles);
  },

  'update-custom-role': async () => {
    const data = await readStdin();
    const role = await updateCustomRole(data.id, data.patch);
    output(role);
  },

  'delete-custom-role': async () => {
    const data = await readStdin();
    await deleteCustomRole(data.id);
    output({ success: true, id: data.id });
  },

  'add-custom-variant': async () => {
    const data = await readStdin();
    const variant = await addCustomVariant(data.roleId, data.variant);
    output(variant);
  },

  'get-custom-variants': async () => {
    const opts = parseArgs(args);
    const variants = await getCustomVariants(opts.role);
    output(variants);
  },

  'update-custom-variant': async () => {
    const data = await readStdin();
    const variant = await updateCustomVariant(data.roleId, data.variantId, data.patch);
    output(variant);
  },

  'delete-custom-variant': async () => {
    const data = await readStdin();
    await deleteCustomVariant(data.roleId, data.variantId);
    output({ success: true, roleId: data.roleId, variantId: data.variantId });
  },

  'set-override': async () => {
    const data = await readStdin();
    await setOverride(data.roleId, data.variantId, data.patch);
    output({ success: true });
  },

  'get-overrides': async () => {
    const overrides = await getOverrides();
    output(overrides);
  },

  'remove-override': async () => {
    const data = await readStdin();
    await removeOverride(data.roleId, data.variantId);
    output({ success: true });
  },

  'available-variants': async () => {
    const opts = parseArgs(args);
    const variants = await getAvailableVariants(opts.role);
    output(variants);
  },

  'list-templates': async () => {
    const opts = parseArgs(args);
    if (opts.type) {
      const templates = await getTemplatesForProjectType(opts.type);
      output(templates.map(t => ({ name: t.name, displayName: t.displayName, description: t.description, projectType: t.projectType })));
    } else {
      const templates = await listTemplates();
      output(templates.map(t => ({ name: t.name, displayName: t.displayName, description: t.description, projectType: t.projectType })));
    }
  },

  'get-template': async () => {
    const opts = parseArgs(args);
    const template = await loadTemplate(opts.name);
    output(template);
  },

  'scaffold': async () => {
    const data = await readStdin();
    const result = await scaffold(data.template, data.targetDir, data.variables || {}, {
      overwrite: data.overwrite || false,
      backup: data.backup !== false,
    });
    output(result);
  },

  // --- Orchestrator commands (v4.0) ---

  'agent-analysis-prompt': async () => {
    const data = await readStdin();
    const prompt = buildAgentAnalysisPrompt(data.project, data.teamMember, data.context || {});
    output({ prompt });
  },

  'synthesis-prompt': async () => {
    const data = await readStdin();
    const prompt = buildSynthesisPrompt(data.project, data.agentOutputs, data.round || 1);
    output({ prompt });
  },

  'review-prompt': async () => {
    const data = await readStdin();
    const prompt = buildReviewPrompt(data.teamMember, data.synthesizedPlan, data.round || 1);
    output({ prompt });
  },

  'check-convergence': async () => {
    const data = await readStdin();
    const result = checkConvergence(data.reviews);
    output(result);
  },

  'group-agents': async () => {
    const data = await readStdin();
    const tiers = groupAgentsForParallelDispatch(data.team);
    output({ tiers });
  },

  'single-agent-discussion-prompt': async () => {
    const data = await readStdin();
    const prompt = buildSingleAgentDiscussionPrompt(data.project, data.teamMember, data.context || {});
    output({ prompt });
  },

  // --- Review engine commands (v4.0) ---

  'select-reviewers': async () => {
    const data = await readStdin();
    const reviewers = selectReviewers(data.task, data.team);
    output({ reviewers });
  },

  'task-review-prompt': async () => {
    const data = await readStdin();
    const prompt = buildTaskReviewPrompt(data.reviewer, data.task, data.taskOutput);
    output({ prompt });
  },

  'check-quality-gate': async () => {
    const data = await readStdin();
    const result = checkQualityGate(data.reviews);
    output(result);
  },

  'revision-prompt': async () => {
    const data = await readStdin();
    const prompt = buildRevisionPrompt(data.task, data.implementer, data.reviews);
    output({ prompt });
  },

  'execution-plan-with-reviews': async () => {
    const data = await readStdin();
    const plan = buildExecutionPlanWithReviews(data.tasks, data.team);
    output(plan);
  },

  // --- Execution verification commands (v4.0) ---

  'verify-execution': async () => {
    const data = await readStdin();
    const result = await verifyExecution(data.taskOutput, data.task);
    output(result);
  },

  'enhanced-quality-gate': async () => {
    const data = await readStdin();
    const result = checkEnhancedQualityGate(data.reviews, data.executionResult);
    output(result);
  },

  // --- Complexity analyzer commands (v4.0) ---

  'complexity-analysis': async () => {
    const data = await readStdin();
    const prompt = buildComplexityAnalysisPrompt(data.description);
    output({ prompt });
  },

  'parse-complexity': async () => {
    const data = await readStdin();
    const result = parseComplexityAnalysis(data.rawOutput);
    output(result);
  },

  'complexity-defaults': async () => {
    const opts = parseArgs(args);
    const defaults = getDefaultsForComplexity(opts.level);
    output(defaults);
  },

  // --- Project data extension commands (v4.0) ---

  'add-discussion-round': async () => {
    const data = await readStdin();
    const project = await addDiscussionRound(data.id, data.roundData);
    output(project);
  },

  'add-task-reviews': async () => {
    const data = await readStdin();
    const project = await addTaskReviews(data.id, data.taskId, data.reviews);
    output(project);
  },

  'update-task-status': async () => {
    const data = await readStdin();
    const project = await updateTaskStatus(data.id, data.taskId, data.status);
    output(project);
  },

  'analyze-efficiency': async () => {
    const data = await readStdin();
    const agentOutputs = data.agentOutputs || [];
    const roleContributions = data.roleContributions || [];
    const teamSize = data.teamSize;
    const redundancies = detectRedundantAgents(agentOutputs);
    const recommendations = recommendOptimalTeam(agentOutputs, roleContributions, teamSize);
    const report = buildOptimizationReport(recommendations);
    output({ redundancies, recommendations, report });
  },

  // --- Eval engine commands ---

  'eval-create': async () => {
    const data = await readStdin();
    const session = createEvalSession(data.projectDescription, data.approaches);
    output(session);
  },

  'eval-record': async () => {
    const data = await readStdin();
    const session = await loadEvalSession(data.sessionId);
    const updated = recordApproachResult(session, data.approach, data.result);
    await saveEvalSession(updated);
    output(updated);
  },

  'eval-compare': async () => {
    const opts = parseArgs(args);
    const session = await loadEvalSession(opts['session-id']);
    const comparison = compareApproaches(session);
    output(comparison);
  },

  'eval-report': async () => {
    const opts = parseArgs(args);
    const session = await loadEvalSession(opts['session-id']);
    const comparison = compareApproaches(session);
    const report = generateEvalReport(session, comparison);
    output({ report });
  },

  'eval-list': async () => {
    const sessions = await listEvalSessions();
    output(sessions);
  },

  // --- Multi-model provider commands ---

  'connect': async () => {
    const data = await readStdin();
    const providerId = data.provider || args[0];
    if (!providerId) throw new Error('프로바이더 ID가 필요합니다');

    if (data.authType === 'oauth') {
      const { url, state } = buildOAuthUrl(providerId, { clientId: data.clientId });
      output({ url, state, message: '브라우저에서 인증을 완료하세요' });
    } else if (data.authType === 'cli') {
      if (providerId !== 'gemini') {
        throw new Error('CLI 인증은 현재 gemini만 지원합니다');
      }
      const { isGeminiCliInstalled } = await import('./lib/gemini-bridge.js');
      if (!isGeminiCliInstalled()) {
        throw new Error('Gemini CLI가 설치되지 않았습니다. `npm install -g @google/gemini-cli` 로 설치하세요.');
      }
      const auth = await connectGeminiCli();
      output({ success: true, providerId, type: auth.type });
    } else {
      const auth = await connectWithApiKey(providerId, data.apiKey);
      output({ success: true, providerId, type: auth.type });
    }
  },

  'exchange-oauth': async () => {
    const data = await readStdin();
    const auth = await exchangeOAuthCode(data.provider, data.code, {
      clientId: data.clientId,
      clientSecret: data.clientSecret,
    });
    output({ success: true, provider: data.provider, type: auth.type });
  },

  'disconnect': async () => {
    const data = await readStdin();
    const providerId = data.provider || args[0];
    if (!providerId) throw new Error('프로바이더 ID가 필요합니다');
    await removeAuth(providerId);
    output({ success: true, providerId });
  },

  'providers': async () => {
    const status = await getProviderStatus();
    output(status);
  },

  'connected-providers': async () => {
    const connected = await listConnectedProviders();
    output(connected);
  },

  'set-review-strategy': async () => {
    const data = await readStdin();
    await setReviewStrategy(data.strategy);
    output({ success: true, strategy: data.strategy });
  },

  'verify-provider': async () => {
    const data = await readStdin();
    const providerId = data.provider || args[0];
    const result = await verifyConnection(providerId);
    output(result);
  },

  'cross-model-review': async () => {
    const data = await readStdin();
    const config = data.providerConfig || await loadProvidersConfig();
    const assignments = await resolveReviewAssignments(data.reviewers, config);
    const results = await executeCrossModelReviews(assignments, data.task, data.taskOutput);
    const summary = summarizeCrossModelResults(results);
    output({ results, summary });
  },

  'resolve-review-assignments': async () => {
    const data = await readStdin();
    const config = data.providerConfig || await loadProvidersConfig();
    const assignments = await resolveReviewAssignments(data.reviewers, config);
    output({ assignments });
  },

  'gemini-review': async () => {
    const data = await readStdin();
    const { buildTaskReviewPrompt, parseTaskReview } = await import('./lib/review-engine.js');
    const { callGeminiCli } = await import('./lib/gemini-bridge.js');
    const prompt = buildTaskReviewPrompt(data.reviewer, data.task, data.taskOutput);
    const response = callGeminiCli(prompt, { model: data.model });
    const review = parseTaskReview(response.text);
    output({ reviewer: data.reviewer, provider: 'gemini', model: response.model, review, tokenCount: response.tokenCount });
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
