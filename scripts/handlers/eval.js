/**
 * handlers/eval — 평가 엔진 + 복잡도 분석 커맨드
 */
import { readStdin, output, parseArgs } from '../cli-utils.js';
import {
  createEvalSession, recordApproachResult, compareApproaches,
  generateEvalReport, saveEvalSession, loadEvalSession, listEvalSessions,
  buildSinglePromptBaseline,
} from '../lib/engine/eval-engine.js';
import {
  buildComplexityAnalysisPrompt, parseComplexityAnalysis, getDefaultsForComplexity,
} from '../lib/agent/complexity-analyzer.js';
import { inputError } from '../lib/core/validators.js';

const [,, , ...args] = process.argv;

export const commands = {
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
    if (!opts['session-id']) throw inputError('--session-id 옵션이 필요합니다');
    const session = await loadEvalSession(opts['session-id']);
    const comparison = compareApproaches(session);
    output(comparison);
  },

  'eval-report': async () => {
    const opts = parseArgs(args);
    if (!opts['session-id']) throw inputError('--session-id 옵션이 필요합니다');
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
};
