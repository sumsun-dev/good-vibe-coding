/**
 * handlers/infra — 프로젝트 인프라 셋업 + GitHub + 온보딩 + 설정 커맨드
 */
import { readStdin, output } from '../cli-utils.js';
import { requireFields } from '../lib/core/validators.js';
import { setupProjectInfra, appendToClaudeMd } from '../lib/project/project-scaffolder.js';
import { checkGhStatus, createGithubRepo, gitInitAndPush } from '../lib/project/github-manager.js';
import {
  createFeatureBranch,
  pushBranch,
  getCurrentBranch,
} from '../lib/project/branch-manager.js';
import {
  createPullRequest,
  buildPRBody,
  buildPRTitle,
  buildPRLabels,
  buildMergeReport,
  finalizeWithPR,
} from '../lib/project/pr-manager.js';
import {
  resolveCIStrategy,
  inferCommands,
  generateCIWorkflow,
} from '../lib/project/ci-generator.js';
import { isGeminiCliInstalled } from '../lib/llm/gemini-bridge.js';
import { checkEnvironment } from '../lib/output/env-checker.js';
import { getVersionInfo } from '../lib/output/update-checker.js';
import { readSettings, addPermission } from '../lib/core/settings-manager.js';
import { buildOnboardingData, renderOnboardingFiles } from '../lib/core/onboarding-generator.js';
import { loadPreset, mergePresets } from '../lib/core/preset-loader.js';
import { safeWriteFile, ensureDir } from '../lib/core/file-writer.js';
import { claudeDir } from '../lib/core/app-paths.js';
import { resolve } from 'path';

export const commands = {
  'setup-project-infra': async () => {
    const data = await readStdin();
    requireFields(data, ['name', 'targetDir']);
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
    requireFields(data, ['repoName']);
    const result = createGithubRepo(data.repoName, {
      visibility: data.visibility,
      description: data.description,
    });
    output(result);
  },

  'git-init-push': async () => {
    const data = await readStdin();
    requireFields(data, ['projectDir', 'remoteUrl']);
    const result = gitInitAndPush(data.projectDir, data.remoteUrl);
    output(result);
  },

  'check-gemini-status': async () => {
    const installed = isGeminiCliInstalled();
    output({ installed, authType: 'cli', model: 'gemini-2.0-flash' });
  },

  'append-claude-md': async () => {
    const data = await readStdin();
    requireFields(data, ['claudeMdPath', 'sectionName', 'content']);
    const result = await appendToClaudeMd(data.claudeMdPath, data.sectionName, data.content);
    output(result);
  },

  'check-environment': async () => {
    const result = checkEnvironment();
    output(result);
  },

  'check-version': async () => {
    const result = getVersionInfo();
    output(result);
  },

  'create-branch': async () => {
    const data = await readStdin();
    requireFields(data, ['projectDir', 'projectSlug']);
    const result = createFeatureBranch(data.projectDir, {
      projectSlug: data.projectSlug,
      baseBranch: data.baseBranch,
      strategy: data.strategy,
      context: data.context,
    });
    output(result);
  },

  'push-branch': async () => {
    const data = await readStdin();
    requireFields(data, ['projectDir', 'branchName']);
    const result = pushBranch(data.projectDir, data.branchName);
    output(result);
  },

  'current-branch': async () => {
    const data = await readStdin();
    requireFields(data, ['projectDir']);
    const branch = getCurrentBranch(data.projectDir);
    output({ branch });
  },

  'create-pr': async () => {
    const data = await readStdin();
    requireFields(data, ['projectDir', 'branchName', 'baseBranch', 'title', 'body']);
    const result = createPullRequest(data.projectDir, {
      branchName: data.branchName,
      baseBranch: data.baseBranch,
      title: data.title,
      body: data.body,
      labels: data.labels,
      draft: data.draft,
    });
    output(result);
  },

  'build-pr-body': async () => {
    const data = await readStdin();
    requireFields(data, ['project']);
    const title = buildPRTitle(data.project, data.options);
    const body = buildPRBody(data.project, data.executionState);
    const labels = buildPRLabels(data.project);
    output({ title, body, labels });
  },

  'finalize-pr': async () => {
    const data = await readStdin();
    requireFields(data, ['projectDir']);
    const result = await finalizeWithPR(data.projectDir, {
      project: data.project,
      executionState: data.executionState,
      githubConfig: data.githubConfig,
    });
    output(result);
  },

  'build-merge-report': async () => {
    const data = await readStdin();
    requireFields(data, ['project', 'executionState']);
    const report = buildMergeReport(data.project, data.executionState);
    output({ report });
  },

  'generate-ci': async () => {
    const data = await readStdin();
    requireFields(data, ['projectDir', 'techStack']);
    const strategy = resolveCIStrategy({
      techStack: data.techStack,
      codebaseInfo: data.codebaseInfo,
    });
    const commands = inferCommands(strategy.type, data.packageJson);
    const result = await generateCIWorkflow(data.projectDir, strategy, commands);
    output({ ...result, strategy, commands });
  },

  'read-settings': async () => {
    const settings = await readSettings();
    output(settings);
  },

  'add-permission': async () => {
    const data = await readStdin();
    requireFields(data, ['pattern']);
    const result = await addPermission(data.pattern);
    output(result);
  },

  'generate-onboarding': async () => {
    const data = await readStdin();
    requireFields(data, ['roles']);
    const rolePresets = await Promise.all(data.roles.map((r) => loadPreset('roles', r)));
    const presets = [...rolePresets];
    let stackPreset = null;
    if (data.stack) {
      stackPreset = await loadPreset('stacks', data.stack);
      presets.push(stackPreset);
    }
    const merged = mergePresets(...presets);
    const roleNames = rolePresets.map((p) => p.displayName);
    const onboardingData = buildOnboardingData(merged, {
      roleNames,
      stackName: stackPreset?.displayName,
      personalities: data.personalities,
    });
    const result = await renderOnboardingFiles(onboardingData);
    output(result);
  },

  'write-onboarding': async () => {
    const data = await readStdin();
    requireFields(data, ['claudeMd', 'coreRules']);
    const claudeBase = claudeDir();
    const claudeMdPath = resolve(claudeBase, 'CLAUDE.md');
    const rulesDir = resolve(claudeBase, 'rules');
    const coreRulesPath = resolve(rulesDir, 'core.md');
    await ensureDir(rulesDir);
    await Promise.all([
      safeWriteFile(claudeMdPath, data.claudeMd, { overwrite: true }),
      safeWriteFile(coreRulesPath, data.coreRules, { overwrite: true }),
    ]);
    output({ written: [claudeMdPath, coreRulesPath] });
  },
};
