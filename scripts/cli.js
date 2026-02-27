#!/usr/bin/env node
import { createProject, getProject, listProjects, updateProjectStatus, setProjectTeam, setProjectPlan, addProjectTasks, setProjectReport, addDiscussionRound, addTaskReviews, updateTaskStatus, getExecutionProgress, addTaskMaterializationResult, saveTaskOutput, recordMetrics } from './lib/project-manager.js';
import { initExecution, getNextExecutionStep, advanceExecution, getExecutionSummary } from './lib/execution-loop.js';
import { recommendTeam, buildTeam, loadRoleCatalog, loadProjectTypes, getTeamSummary, getOptimizedTeam } from './lib/team-builder.js';
import { buildDiscussionPrompt, buildPlanDocument, parseDiscussionOutput, buildSingleAgentDiscussionPrompt } from './lib/discussion-engine.js';
import { buildTaskDistributionPrompt, buildExecutionPrompt, buildExecutionPlan, parseTaskList, buildExecutionPlanWithReviews, buildTddExecutionPrompt, isCodeTask, buildPhaseContext } from './lib/task-distributor.js';
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
import { verifyExecution, verifyAndMaterialize } from './lib/execution-verifier.js';
import { materializeCode, materializeBatch, extractMaterializableBlocks } from './lib/code-materializer.js';
import { buildComplexityAnalysisPrompt, parseComplexityAnalysis, getDefaultsForComplexity } from './lib/complexity-analyzer.js';
import { generateReport } from './lib/report-generator.js';
import {
  extractAgentPerformance, buildImprovementPrompt, parseImprovementSuggestions,
  saveAgentOverride, loadAgentOverride, listAgentOverrides, mergeAgentWithOverride,
  saveProjectOverride, loadProjectOverride, listProjectOverrides, mergeAgentWithOverrides,
} from './lib/agent-feedback.js';
import {
  listTemplates, loadTemplate, scaffold, getTemplatesForProjectType,
} from './lib/template-scaffolder.js';
import {
  createEvalSession, recordApproachResult, compareApproaches,
  generateEvalReport, saveEvalSession, loadEvalSession, listEvalSessions,
  buildSinglePromptBaseline,
} from './lib/eval-engine.js';
import {
  connectWithApiKey, connectGeminiCli, removeAuth, listConnectedProviders,
  loadProvidersConfig, setReviewStrategy, getProviderStatus,
} from './lib/auth-manager.js';
import {
  resolveReviewAssignments, executeCrossModelReviews,
  summarizeCrossModelResults,
} from './lib/cross-model-strategy.js';
import { verifyConnection } from './lib/llm-provider.js';
import { buildDiscussionDispatchPlan, buildExecutionDispatchPlan } from './lib/dispatch-plan-generator.js';
import { setupProjectInfra, appendToClaudeMd } from './lib/project-scaffolder.js';
import { getCostSummary, buildMetricsDashboard } from './lib/project-metrics.js';
import { checkGhStatus, createGithubRepo, gitInitAndPush, commitPhase } from './lib/github-manager.js';
import { requireFields, AppError } from './lib/validators.js';

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
 * 성공 응답을 표준 형식으로 출력한다.
 * @param {object} data - 응답 데이터
 */
function outputOk(data = {}) {
  output({ success: true, ...data });
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

  'recommend-team': async () => {
    const opts = parseArgs(args);
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
    const prompt = buildExecutionPrompt(data.task, data.teamMember, data.context || {});
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

  // --- Code materialization commands ---

  'materialize-code': async () => {
    const data = await readStdin();
    const result = await materializeCode(data.taskOutput, data.projectDir, data.options || {});
    output(result);
  },

  'materialize-batch': async () => {
    const data = await readStdin();
    const result = await materializeBatch(data.taskOutputs, data.projectDir, data.options || {});
    output(result);
  },

  'verify-and-materialize': async () => {
    const data = await readStdin();
    const result = await verifyAndMaterialize(data.taskOutput, data.task, data.projectDir, data.options || {});
    output(result);
  },

  'extract-materializable-blocks': async () => {
    const data = await readStdin();
    const blocks = extractMaterializableBlocks(data.taskOutput);
    output({ blocks });
  },

  // --- TDD execution commands ---

  'tdd-execution-prompt': async () => {
    const data = await readStdin();
    const prompt = buildTddExecutionPrompt(data.task, data.teamMember, data.context || {});
    output({ prompt });
  },

  'is-code-task': async () => {
    const data = await readStdin();
    const result = isCodeTask(data.task);
    output({ isCodeTask: result });
  },

  // --- Phase commit command ---

  'commit-phase': async () => {
    const data = await readStdin();
    const result = commitPhase(data.projectDir, data.phase, data.message);
    output(result);
  },

  // --- Task materialization result ---

  'add-task-materialization': async () => {
    const data = await readStdin();
    const project = await addTaskMaterializationResult(data.id, data.taskId, data.materializeResult);
    output(project);
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
    requireFields(data, ['id', 'roundData']);
    const project = await addDiscussionRound(data.id, data.roundData);
    output(project);
  },

  'add-task-reviews': async () => {
    const data = await readStdin();
    requireFields(data, ['id', 'taskId', 'reviews']);
    const project = await addTaskReviews(data.id, data.taskId, data.reviews);
    output(project);
  },

  'update-task-status': async () => {
    const data = await readStdin();
    requireFields(data, ['id', 'taskId', 'status']);
    const project = await updateTaskStatus(data.id, data.taskId, data.status);
    output(project);
  },

  'save-task-output': async () => {
    const data = await readStdin();
    requireFields(data, ['id', 'taskId']);
    const project = await saveTaskOutput(data.id, data.taskId, data.output, { maxLines: data.maxLines });
    output(project);
  },

  'build-phase-context': async () => {
    const data = await readStdin();
    const context = buildPhaseContext(data.completedTasks, { maxLinesPerTask: data.maxLinesPerTask });
    output({ phaseContext: context });
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

  'eval-baseline-prompt': async () => {
    const data = await readStdin();
    const prompt = buildSinglePromptBaseline(data.description);
    output({ prompt });
  },

  // --- Multi-model provider commands ---

  'connect': async () => {
    const data = await readStdin();
    const providerId = data.provider || args[0];
    if (!providerId) throw new Error('프로바이더 ID가 필요합니다');

    if (data.authType === 'cli') {
      if (providerId !== 'gemini') {
        throw new Error('CLI 인증은 현재 gemini만 지원합니다');
      }
      const { isGeminiCliInstalled } = await import('./lib/gemini-bridge.js');
      if (!isGeminiCliInstalled()) {
        throw new Error('Gemini CLI가 설치되지 않았습니다. `npm install -g @google/gemini-cli` 로 설치하세요.');
      }
      const auth = await connectGeminiCli();
      outputOk({ providerId, type: auth.type });
    } else {
      const auth = await connectWithApiKey(providerId, data.apiKey);
      outputOk({ providerId, type: auth.type });
    }
  },

  'disconnect': async () => {
    const data = await readStdin();
    const providerId = data.provider || args[0];
    if (!providerId) throw new Error('프로바이더 ID가 필요합니다');
    await removeAuth(providerId);
    outputOk({ providerId });
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
    outputOk({ strategy: data.strategy });
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

  // --- Agent feedback commands ---

  'extract-performance': async () => {
    const opts = parseArgs(args);
    const project = await getProject(opts.id);
    if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${opts.id}`);
    const performances = extractAgentPerformance(project);
    output(performances);
  },

  'improvement-prompt': async () => {
    const data = await readStdin();
    if (!data.roleId) throw new Error('roleId 필드가 필요합니다');
    const prompt = buildImprovementPrompt(data.roleId, data.performance || {}, data.agentMd || '');
    output({ prompt });
  },

  'parse-suggestions': async () => {
    const data = await readStdin();
    const suggestions = parseImprovementSuggestions(data.analysisText || '');
    output(suggestions);
  },

  'save-agent-override': async () => {
    const data = await readStdin();
    if (!data.roleId) throw new Error('roleId 필드가 필요합니다');
    if (!data.content) throw new Error('content 필드가 필요합니다');
    await saveAgentOverride(data.roleId, data.content);
    outputOk({ roleId: data.roleId });
  },

  'load-agent-override': async () => {
    const opts = parseArgs(args);
    if (!opts.role) throw new Error('--role 옵션이 필요합니다');
    const content = await loadAgentOverride(opts.role);
    output({ roleId: opts.role, content });
  },

  'list-agent-overrides': async () => {
    const overrides = await listAgentOverrides();
    output(overrides);
  },

  'merge-agent-override': async () => {
    const data = await readStdin();
    const merged = mergeAgentWithOverride(data.baseMd, data.overrideMd);
    output({ merged });
  },

  // --- Project setup commands (/hello) ---

  'setup-project-infra': async () => {
    const data = await readStdin();
    const result = await setupProjectInfra({
      name: data.name,
      description: data.description,
      techStack: data.techStack,
      targetDir: data.targetDir,
    });
    output(result);
  },

  'check-gh-status': async () => {
    const result = checkGhStatus();
    output(result);
  },

  'create-github-repo': async () => {
    const data = await readStdin();
    const result = createGithubRepo(data.repoName, {
      visibility: data.visibility,
      description: data.description,
    });
    output(result);
  },

  'git-init-push': async () => {
    const data = await readStdin();
    const result = gitInitAndPush(data.projectDir, data.remoteUrl);
    output(result);
  },

  'append-claude-md': async () => {
    const data = await readStdin();
    const result = await appendToClaudeMd(data.claudeMdPath, data.sectionName, data.content);
    output(result);
  },

  'execution-progress': async () => {
    const opts = parseArgs(args);
    const project = await getProject(opts.id);
    if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${opts.id}`);
    const progress = getExecutionProgress(project);
    output(progress);
  },

  // --- Execution loop commands ---

  'init-execution': async () => {
    const data = await readStdin();
    const result = await initExecution(data.id, { mode: data.mode, resume: data.resume });
    output(result);
  },

  'next-step': async () => {
    const opts = parseArgs(args);
    const project = await getProject(opts.id);
    if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${opts.id}`);
    output(getNextExecutionStep(project));
  },

  'advance-execution': async () => {
    const data = await readStdin();
    const result = await advanceExecution(data.id, data.stepResult);
    output(result);
  },

  'execution-summary': async () => {
    const opts = parseArgs(args);
    const project = await getProject(opts.id);
    if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${opts.id}`);
    output(getExecutionSummary(project));
  },

  // --- Dispatch plan commands ---

  'discussion-dispatch-plan': async () => {
    const data = await readStdin();
    const project = data.project || (data.id ? await getProject(data.id) : null);
    if (!project) throw new Error('프로젝트 정보가 필요합니다');
    const plan = buildDiscussionDispatchPlan(project, data.team || project.team, data.context || {});
    output(plan);
  },

  'execution-dispatch-plan': async () => {
    const data = await readStdin();
    const project = data.project || (data.id ? await getProject(data.id) : null);
    if (!project) throw new Error('프로젝트 정보가 필요합니다');
    const plan = buildExecutionDispatchPlan(project, data.tasks || project.tasks, data.team || project.team, data.context || {});
    output(plan);
  },

  'record-metrics': async () => {
    const data = await readStdin();
    if (!data.id) throw new Error('--id가 필요합니다');
    const updated = await recordMetrics(data.id, data);
    outputOk({ metrics: updated.metrics });
  },

  'project-metrics': async () => {
    const parsed = parseArgs(args);
    if (!parsed.id) throw new Error('--id가 필요합니다');
    const project = await getProject(parsed.id);
    if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${parsed.id}`);
    const dashboard = buildMetricsDashboard(project);
    output({ dashboard, metrics: project.metrics || null });
  },

  'cost-summary': async () => {
    const parsed = parseArgs(args);
    if (!parsed.id) throw new Error('--id가 필요합니다');
    const project = await getProject(parsed.id);
    if (!project) throw new Error(`프로젝트를 찾을 수 없습니다: ${parsed.id}`);
    const summary = getCostSummary(project.metrics);
    output(summary);
  },

  'save-project-override': async () => {
    const data = await readStdin();
    if (!data.projectDir) throw new Error('projectDir가 필요합니다');
    if (!data.roleId) throw new Error('roleId가 필요합니다');
    if (!data.content) throw new Error('content가 필요합니다');
    await saveProjectOverride(data.projectDir, data.roleId, data.content);
    outputOk();
  },

  'load-project-override': async () => {
    const data = await readStdin();
    if (!data.projectDir) throw new Error('projectDir가 필요합니다');
    if (!data.roleId) throw new Error('roleId가 필요합니다');
    const content = await loadProjectOverride(data.projectDir, data.roleId);
    output({ content });
  },

  'list-project-overrides': async () => {
    const data = await readStdin();
    if (!data.projectDir) throw new Error('projectDir가 필요합니다');
    const overrides = await listProjectOverrides(data.projectDir);
    output(overrides);
  },

  'merge-all-overrides': async () => {
    const data = await readStdin();
    if (!data.baseMd && data.baseMd !== '') throw new Error('baseMd가 필요합니다');
    const overrides = data.overrides || [];
    const result = mergeAgentWithOverrides(data.baseMd, overrides);
    output({ result });
  },
};

/**
 * 유사한 커맨드를 제안한다 (Levenshtein distance 기반).
 * @param {string} input - 사용자가 입력한 커맨드
 * @param {string[]} candidates - 후보 목록
 * @returns {string[]} 유사 커맨드 (최대 3개)
 */
function suggestSimilar(input, candidates) {
  return candidates
    .map(c => ({ name: c, dist: levenshtein(input, c) }))
    .filter(c => c.dist <= 3)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3)
    .map(c => c.name);
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array(n + 1);
    row[0] = i;
    return row;
  });
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

async function main() {
  const available = Object.keys(commands);

  if (!command || !commands[command]) {
    let msg = `사용법: cli.js <command>\n사용 가능한 명령 (${available.length}개): ${available.join(', ')}\n`;
    if (command) {
      const similar = suggestSimilar(command, available);
      if (similar.length > 0) {
        msg += `\n혹시 이 커맨드를 찾으셨나요? ${similar.join(', ')}\n`;
      }
    }
    process.stderr.write(msg);
    process.exit(1);
  }

  try {
    await commands[command]();
  } catch (err) {
    const code = err instanceof AppError ? err.code : 'SYSTEM_ERROR';
    const exitCode = code === 'INPUT_ERROR' ? 2 : code === 'NOT_FOUND' ? 3 : 1;
    process.stderr.write(`오류 [${code}]: ${err.message}\n`);
    process.exit(exitCode);
  }
}

main();
