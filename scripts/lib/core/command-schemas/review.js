/**
 * review 핸들러 스키마 (7개)
 */
import { obj, str, num, bool, arr, objField, promptOutput } from './schema-builders.js';

export default {
  'select-reviewers': {
    handler: 'review',
    inputMethod: 'stdin',
    input: obj({ task: objField(true), team: arr(true) }),
    output: obj({ reviewers: arr() }),
    description: '태스크에 적합한 리뷰어를 선정한다',
  },
  'task-review-prompt': {
    handler: 'review',
    inputMethod: 'stdin',
    input: obj({ reviewer: objField(true), task: objField(true), taskOutput: str(true) }),
    output: promptOutput,
    description: '태스크 리뷰 프롬프트를 생성한다',
  },
  'check-quality-gate': {
    handler: 'review',
    inputMethod: 'stdin',
    input: obj({ reviews: arr(true) }),
    output: obj({ passed: bool(), criticalCount: num(), importantCount: num(), summary: str() }),
    description: '품질 게이트를 확인한다',
  },
  'enhanced-quality-gate': {
    handler: 'review',
    inputMethod: 'stdin',
    input: obj({ reviews: arr(true), executionResult: objField() }),
    output: obj({
      passed: bool(),
      criticalCount: num(),
      importantCount: num(),
      executionVerified: bool(),
      summary: str(),
    }),
    description: '강화된 품질 게이트를 확인한다 (텍스트 + 실행 검증)',
  },
  'revision-prompt': {
    handler: 'review',
    inputMethod: 'stdin',
    input: obj({
      task: objField(true),
      implementer: objField(true),
      reviews: arr(true),
      failureContext: objField(),
    }),
    output: promptOutput,
    description: '수정 프롬프트를 생성한다',
  },
  'verify-execution': {
    handler: 'review',
    inputMethod: 'stdin',
    input: obj({ taskOutput: str(true), task: objField(true) }),
    output: obj({ verified: bool(), buildResult: objField() }),
    description: '빌드 실행을 검증한다',
  },
  'analyze-efficiency': {
    handler: 'review',
    inputMethod: 'stdin',
    input: obj({ agentOutputs: arr(), roleContributions: arr(), teamSize: num(), id: str() }),
    output: obj({ redundancies: arr(), recommendations: arr() }),
    description: '에이전트 효율성을 분석한다',
  },
};
