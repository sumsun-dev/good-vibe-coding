/**
 * auth 핸들러 스키마 (9개)
 */
import { obj, str, num, bool, arr, objField } from './schema-builders.js';

export default {
  connect: {
    handler: 'auth',
    inputMethod: 'stdin',
    input: obj({ provider: str(true), apiKey: str(), type: str() }),
    output: obj({ providerId: str(), type: str() }),
    description: 'LLM 프로바이더를 연결한다',
  },
  disconnect: {
    handler: 'auth',
    inputMethod: 'stdin',
    input: obj({ provider: str(true) }),
    output: obj({ providerId: str() }),
    description: 'LLM 프로바이더 연결을 해제한다',
  },
  providers: {
    handler: 'auth',
    inputMethod: 'none',
    input: obj({}),
    output: obj({ supported: arr() }),
    description: '지원 프로바이더 목록을 반환한다',
  },
  'connected-providers': {
    handler: 'auth',
    inputMethod: 'none',
    input: obj({}),
    output: arr(),
    description: '연결된 프로바이더 목록을 반환한다',
  },
  'set-review-strategy': {
    handler: 'auth',
    inputMethod: 'stdin',
    input: obj({ strategy: str(true) }),
    output: obj({ strategy: str() }),
    description: '리뷰 전략을 설정한다',
  },
  'verify-provider': {
    handler: 'auth',
    inputMethod: 'stdin',
    input: obj({ provider: str(true) }),
    output: obj({ connected: bool(), model: str() }),
    description: '프로바이더 연결을 검증한다',
  },
  'cross-model-review': {
    handler: 'auth',
    inputMethod: 'stdin',
    input: obj({ task: objField(true), team: arr(true) }),
    output: obj({ results: arr() }),
    description: '크로스 모델 리뷰를 실행한다',
  },
  'resolve-review-assignments': {
    handler: 'auth',
    inputMethod: 'stdin',
    input: obj({ reviewers: arr(true) }),
    output: obj({ assignments: arr() }),
    description: '리뷰어를 프로바이더별로 배정한다',
  },
  'gemini-review': {
    handler: 'auth',
    inputMethod: 'stdin',
    input: obj({
      reviewer: objField(true),
      task: objField(true),
      taskOutput: str(true),
      model: str(),
    }),
    output: obj({
      reviewer: objField(),
      provider: str(),
      model: str(),
      review: objField(),
      tokenCount: num(),
    }),
    description: 'Gemini로 리뷰를 실행한다',
  },
};
