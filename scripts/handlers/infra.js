/**
 * handlers/infra — 프로젝트 인프라 셋업 + GitHub 커맨드
 */
import { readStdin, output } from '../cli-utils.js';
import { setupProjectInfra, appendToClaudeMd } from '../lib/project/project-scaffolder.js';
import { checkGhStatus, createGithubRepo, gitInitAndPush } from '../lib/project/github-manager.js';
import { isGeminiCliInstalled } from '../lib/llm/gemini-bridge.js';
import { checkEnvironment } from '../lib/output/env-checker.js';
import { getVersionInfo } from '../lib/output/update-checker.js';

export const commands = {
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

  'check-gemini-status': async () => {
    const installed = isGeminiCliInstalled();
    output({ installed, authType: 'cli', model: 'gemini-2.0-flash' });
  },

  'append-claude-md': async () => {
    const data = await readStdin();
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
};
