/**
 * defaults — SDK 기본 설정값
 */

export const DEFAULT_MODELS = {
  claude: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  gemini: 'gemini-2.0-flash',
};

export const DEFAULTS = {
  maxDiscussionRounds: 3,
  convergenceThreshold: 0.8,
  maxFixAttempts: 2,
  minReviewers: 2,
  maxExecutionSteps: 200,
};
