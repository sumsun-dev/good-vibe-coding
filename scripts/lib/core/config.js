/**
 * config — 중앙 설정 모듈
 * 매직 넘버를 하나의 불변 객체로 관리한다.
 */

export const config = Object.freeze({
  convergence: Object.freeze({ threshold: 0.8, maxRounds: 3 }),
  similarity: Object.freeze({ redundancyThreshold: 0.7, contributionThreshold: 0.5 }),
  execution: Object.freeze({ maxFixAttempts: 2, maxOutputLines: 200, maxAgentCalls: 500 }),
  build: Object.freeze({ defaultTimeout: 30_000, goTimeout: 45_000, javaTimeout: 60_000 }),
  llm: Object.freeze({ defaultTimeout: 60_000, defaultMaxTokens: 4096, pingTimeout: 15_000, pingMaxTokens: 16 }),
  review: Object.freeze({ minReviewers: 2, maxReviewers: 3, maxRevisionRounds: 2 }),
  team: Object.freeze({
    simple: Object.freeze({ min: 2, max: 3 }),
    medium: Object.freeze({ min: 3, max: 5 }),
    complex: Object.freeze({ min: 5, max: 8 }),
  }),
  recommendation: Object.freeze({
    minScore: 3,
    maxPerCategory: 5,
    maxKeywordHits: 3,
    weights: Object.freeze({ projectType: 3, complexity: 2, keyword: 1, roleAffinity: 2 }),
  }),
  github: Object.freeze({
    enabled: false,
    branchStrategy: 'timestamp',
    baseBranch: 'main',
    autoPush: true,
    autoCreatePR: true,
    prDraft: false,
  }),
  cli: Object.freeze({ suggestionThreshold: 3 }),
  codebase: Object.freeze({
    ignoredDirs: Object.freeze([
      'node_modules', '.git', '.svn', 'dist', 'build', 'coverage',
      '__pycache__', '.next', '.nuxt', 'vendor', 'target', '.gradle',
    ]),
    techStackMap: Object.freeze({
      react: 'frontend', vue: 'frontend', angular: 'frontend', svelte: 'frontend', nextjs: 'frontend',
      express: 'backend', fastapi: 'backend', django: 'backend', flask: 'backend',
      nestjs: 'backend', koa: 'backend', gin: 'backend', spring: 'backend',
      docker: 'devops', kubernetes: 'devops', terraform: 'devops',
      tensorflow: 'data', pytorch: 'data', pandas: 'data',
    }),
  }),
});
