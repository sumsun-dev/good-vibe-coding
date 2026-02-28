#!/usr/bin/env node
import { AppError } from './lib/validators.js';

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
};

async function resolveCommand(name) {
  for (const loader of Object.values(HANDLERS)) {
    const mod = await loader();
    if (mod.commands[name]) return mod.commands[name];
  }
  return null;
}

async function listAllCommands() {
  const all = [];
  for (const loader of Object.values(HANDLERS)) {
    const mod = await loader();
    all.push(...Object.keys(mod.commands));
  }
  return all;
}

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
  const [,, command] = process.argv;

  const handler = command ? await resolveCommand(command) : null;

  if (!handler) {
    const available = await listAllCommands();
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
    process.stderr.write(`오류 [${code}]: ${err.message}\n`);
    process.exit(exitCode);
  }
}

main();
