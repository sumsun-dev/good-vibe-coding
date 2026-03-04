/**
 * defaults — SDK 기본 설정값
 */

export const DEFAULT_MODELS = Object.freeze({
  claude: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  gemini: 'gemini-2.0-flash',
});

export const DEFAULTS = Object.freeze({
  maxDiscussionRounds: 3,
  maxExecutionSteps: 200,
});
