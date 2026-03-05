/**
 * handlers/eval — 평가 엔진 + 복잡도 분석 커맨드
 */
import { readStdin, output, parseArgs } from '../cli-utils.js';
import {
  createEvalSession,
  recordApproachResult,
  compareApproaches,
  generateEvalReport,
  saveEvalSession,
  loadEvalSession,
  listEvalSessions,
  buildSinglePromptBaseline,
} from '../lib/engine/eval-engine.js';
import {
  buildComplexityAnalysisPrompt,
  parseComplexityAnalysis,
  getDefaultsForComplexity,
} from '../lib/agent/complexity-analyzer.js';
import {
  buildClarityCheckPrompt as buildClarityPrompt,
  parseClarityResult,
  enrichDescription,
} from '../lib/agent/clarity-analyzer.js';
import { inputError, requireFields } from '../lib/core/validators.js';

const [, , , ...args] = process.argv;

export const commands = {
  'eval-create': async () => {
    const data = await readStdin();
    requireFields(data, ['projectDescription', 'approaches']);
    const session = createEvalSession(data.projectDescription, data.approaches);
    output(session);
  },

  'eval-record': async () => {
    const data = await readStdin();
    requireFields(data, ['sessionId', 'approach', 'result']);
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
    requireFields(data, ['description']);
    const prompt = buildSinglePromptBaseline(data.description);
    output({ prompt });
  },

  'complexity-analysis': async () => {
    const data = await readStdin();
    requireFields(data, ['description']);
    const prompt = buildComplexityAnalysisPrompt(data.description);
    output({ prompt });
  },

  'parse-complexity': async () => {
    const data = await readStdin();
    requireFields(data, ['rawOutput']);
    const result = parseComplexityAnalysis(data.rawOutput);
    output(result);
  },

  'complexity-defaults': async () => {
    const opts = parseArgs(args);
    const defaults = getDefaultsForComplexity(opts.level);
    output(defaults);
  },

  'clarity-check': async () => {
    const data = await readStdin();
    requireFields(data, ['description']);
    const prompt = buildClarityPrompt(data.description, data.projectType, data.codebaseInfo);
    output({ prompt });
  },

  'parse-clarity': async () => {
    const data = await readStdin();
    requireFields(data, ['rawOutput']);
    const result = parseClarityResult(data.rawOutput);
    output(result);
  },

  'enrich-description': async () => {
    const data = await readStdin();
    requireFields(data, ['original']);
    const enriched = enrichDescription(data.original, data.answers || []);
    output({ enriched });
  },
};
