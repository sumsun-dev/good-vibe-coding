/**
 * eval 핸들러 스키마 (9개)
 */
import { obj, str, num, arr, objField, promptOutput } from './schema-builders.js';

export default {
  'eval-create': {
    handler: 'eval',
    inputMethod: 'stdin',
    input: obj({ projectDescription: str(true), approaches: arr(true) }),
    output: obj({ sessionId: str(), approaches: arr() }),
    description: 'A/B 평가 세션을 생성한다',
  },
  'eval-record': {
    handler: 'eval',
    inputMethod: 'stdin',
    input: obj({ sessionId: str(true), approach: str(true), result: objField(true) }),
    output: obj({ sessionId: str(), approach: str() }),
    description: '평가 결과를 기록한다',
  },
  'eval-compare': {
    handler: 'eval',
    inputMethod: 'args',
    input: obj({ 'session-id': str(true) }),
    output: obj({ comparison: objField(), winner: str() }),
    description: '평가 결과를 비교한다',
  },
  'eval-report': {
    handler: 'eval',
    inputMethod: 'args',
    input: obj({ 'session-id': str(true) }),
    output: obj({ report: str() }),
    description: '평가 보고서를 생성한다',
  },
  'eval-list': {
    handler: 'eval',
    inputMethod: 'none',
    input: obj({}),
    output: arr(),
    description: '평가 세션 목록을 반환한다',
  },
  'eval-baseline-prompt': {
    handler: 'eval',
    inputMethod: 'stdin',
    input: obj({ description: str(true) }),
    output: promptOutput,
    description: '기준선 프롬프트를 생성한다',
  },
  'complexity-analysis': {
    handler: 'eval',
    inputMethod: 'stdin',
    input: obj({ description: str(true) }),
    output: promptOutput,
    description: '복잡도 분석 프롬프트를 생성한다',
  },
  'parse-complexity': {
    handler: 'eval',
    inputMethod: 'stdin',
    input: obj({ rawOutput: str(true) }),
    output: obj({ level: str(), suggestedMode: str(), reasoning: str() }),
    description: '복잡도 분석 결과를 파싱한다',
  },
  'complexity-defaults': {
    handler: 'eval',
    inputMethod: 'args',
    input: obj({ level: str(true) }),
    output: obj({
      teamSize: objField(),
      discussionRounds: num(),
      reviewRounds: num(),
      suggestedRoles: arr(),
    }),
    description: '복잡도별 기본값을 반환한다',
  },
};
