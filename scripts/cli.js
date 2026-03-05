#!/usr/bin/env node
import { AppError } from './lib/core/validators.js';
import { config } from './lib/core/config.js';
import { resolveNaturalLanguage } from './lib/core/nl-router.js';

const HANDLERS = {
  project: () => import('./handlers/project.js'),
  team: () => import('./handlers/team.js'),
  discussion: () => import('./handlers/discussion.js'),
  execution: () => import('./handlers/execution.js'),
  review: () => import('./handlers/review.js'),
  build: () => import('./handlers/build.js'),
  eval: () => import('./handlers/eval.js'),
  auth: () => import('./handlers/auth.js'),
  feedback: () => import('./handlers/feedback.js'),
  infra: () => import('./handlers/infra.js'),
  metrics: () => import('./handlers/metrics.js'),
  template: () => import('./handlers/template.js'),
  task: () => import('./handlers/task.js'),
  recommendation: () => import('./handlers/recommendation.js'),
};

/** 커맨드 → 핸들러 모듈 O(1) 매핑 테이블 */
const COMMAND_MAP = {
  // project
  'create-project': 'project',
  'get-project': 'project',
  'list-projects': 'project',
  'update-status': 'project',
  'set-team': 'project',
  'execution-progress': 'project',
  report: 'project',
  'describe-command': 'project',
  'scan-codebase': 'project',
  // team
  'recommend-team': 'team',
  'optimized-team': 'team',
  'build-team': 'team',
  'role-catalog': 'team',
  'project-types': 'team',
  'team-summary': 'team',
  'design-dynamic-roles': 'team',
  'parse-dynamic-roles': 'team',
  'build-team-with-dynamic': 'team',
  // discussion
  'discussion-prompt': 'discussion',
  'plan-document': 'discussion',
  'single-agent-discussion-prompt': 'discussion',
  'agent-analysis-prompt': 'discussion',
  'synthesis-prompt': 'discussion',
  'review-prompt': 'discussion',
  'check-convergence': 'discussion',
  'group-agents': 'discussion',
  'discussion-dispatch-plan': 'discussion',
  'execution-dispatch-plan': 'discussion',
  'generate-acceptance-criteria': 'discussion',
  'parse-acceptance-criteria': 'discussion',
  // execution
  'init-execution': 'execution',
  'next-step': 'execution',
  'advance-execution': 'execution',
  'execution-summary': 'execution',
  'task-distribution-prompt': 'execution',
  'execution-prompt': 'execution',
  'execution-plan': 'execution',
  'execution-plan-with-reviews': 'execution',
  'get-failure-context': 'execution',
  'handle-escalation': 'execution',
  // review
  'select-reviewers': 'review',
  'task-review-prompt': 'review',
  'check-quality-gate': 'review',
  'enhanced-quality-gate': 'review',
  'revision-prompt': 'review',
  'verify-execution': 'review',
  'analyze-efficiency': 'review',
  // build
  'materialize-code': 'build',
  'materialize-batch': 'build',
  'verify-and-materialize': 'build',
  'extract-materializable-blocks': 'build',
  'commit-phase': 'build',
  'commit-phase-enhanced': 'build',
  // eval
  'eval-create': 'eval',
  'eval-record': 'eval',
  'eval-compare': 'eval',
  'eval-report': 'eval',
  'eval-list': 'eval',
  'eval-baseline-prompt': 'eval',
  'complexity-analysis': 'eval',
  'parse-complexity': 'eval',
  'complexity-defaults': 'eval',
  'clarity-check': 'eval',
  'parse-clarity': 'eval',
  'enrich-description': 'eval',
  // auth
  connect: 'auth',
  disconnect: 'auth',
  providers: 'auth',
  'connected-providers': 'auth',
  'set-review-strategy': 'auth',
  'verify-provider': 'auth',
  'cross-model-review': 'auth',
  'resolve-review-assignments': 'auth',
  'gemini-review': 'auth',
  // feedback
  'extract-performance': 'feedback',
  'improvement-prompt': 'feedback',
  'parse-suggestions': 'feedback',
  'save-agent-override': 'feedback',
  'load-agent-override': 'feedback',
  'list-agent-overrides': 'feedback',
  'merge-agent-override': 'feedback',
  'save-project-override': 'feedback',
  'load-project-override': 'feedback',
  'list-project-overrides': 'feedback',
  'merge-all-overrides': 'feedback',
  // infra
  'setup-project-infra': 'infra',
  'check-gh-status': 'infra',
  'check-gemini-status': 'infra',
  'create-github-repo': 'infra',
  'git-init-push': 'infra',
  'append-claude-md': 'infra',
  'check-environment': 'infra',
  'check-version': 'infra',
  'create-branch': 'infra',
  'push-branch': 'infra',
  'current-branch': 'infra',
  'create-pr': 'infra',
  'build-pr-body': 'infra',
  'finalize-pr': 'infra',
  'build-merge-report': 'infra',
  'generate-ci': 'infra',
  // metrics
  'record-metrics': 'metrics',
  'project-metrics': 'metrics',
  'cost-summary': 'metrics',
  // template
  'list-templates': 'template',
  'get-template': 'template',
  scaffold: 'template',
  // task
  'add-discussion-round': 'task',
  'add-task-reviews': 'task',
  'update-task-status': 'task',
  'save-task-output': 'task',
  'add-task-materialization': 'task',
  'build-phase-context': 'task',
  'tdd-execution-prompt': 'task',
  'is-code-task': 'task',
  // recommendation
  'recommend-setup': 'recommendation',
  'install-setup': 'recommendation',
  'list-installed': 'recommendation',
  'recommendation-catalog': 'recommendation',
};

async function resolveCommand(name) {
  const handlerKey = COMMAND_MAP[name];
  if (!handlerKey) return null;
  const mod = await HANDLERS[handlerKey]();
  return mod.commands[name] || null;
}

function listAllCommands() {
  return Object.keys(COMMAND_MAP);
}

function suggestSimilar(input, candidates) {
  const threshold = config.cli?.suggestionThreshold ?? 3;
  return candidates
    .map((c) => ({ name: c, dist: levenshtein(input, c) }))
    .filter((c) => c.dist <= threshold)
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 3)
    .map((c) => c.name);
}

function levenshtein(a, b) {
  const m = a.length,
    n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array(n + 1);
    row[0] = i;
    return row;
  });
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

const ERROR_HINTS = {
  INPUT_ERROR: '입력 형식을 확인한 후 다시 시도하세요.',
  NOT_FOUND: '/projects 또는 /status로 목록을 확인하세요.',
  SYSTEM_ERROR: '설정을 확인하거나 Claude Code를 다시 시작하세요.',
};

async function main() {
  const [, , command] = process.argv;

  let handler = command ? await resolveCommand(command) : null;

  // NL fallback: 커맨드 매칭 실패 시 자연어 라우팅 시도
  if (!handler && command) {
    const nlCommand = resolveNaturalLanguage(command);
    if (nlCommand) {
      process.stderr.write(`"${command}" → /${nlCommand} 으로 매핑합니다.\n`);
      handler = await resolveCommand(nlCommand);
    }
  }

  if (!handler) {
    const available = listAllCommands();
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
    await handler();
  } catch (err) {
    const code = err instanceof AppError ? err.code : 'SYSTEM_ERROR';
    const exitCode = code === 'INPUT_ERROR' ? 2 : code === 'NOT_FOUND' ? 3 : 1;
    const hint = ERROR_HINTS[code] || '';
    process.stderr.write(`오류 [${code}]: ${err.message}\n${hint}\n`);
    process.exit(exitCode);
  }
}

main();
