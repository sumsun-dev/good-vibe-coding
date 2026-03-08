/**
 * feedback 핸들러 스키마 (11개)
 */
import { obj, str, arr, objField, promptOutput, idArgsInput } from './schema-builders.js';

export default {
  'extract-performance': {
    handler: 'feedback',
    inputMethod: 'args',
    input: idArgsInput,
    output: arr(),
    description: '에이전트별 성과를 추출한다',
  },
  'improvement-prompt': {
    handler: 'feedback',
    inputMethod: 'stdin',
    input: obj({ roleId: str(true), performance: objField(), agentMd: str() }),
    output: promptOutput,
    description: '개선 제안 프롬프트를 생성한다',
  },
  'parse-suggestions': {
    handler: 'feedback',
    inputMethod: 'stdin',
    input: obj({ analysisText: str(true) }),
    output: obj({ suggestions: arr() }),
    description: '개선 제안을 파싱한다',
  },
  'save-agent-override': {
    handler: 'feedback',
    inputMethod: 'stdin',
    input: obj({ roleId: str(true), content: str(true) }),
    output: obj({ roleId: str() }),
    description: '에이전트 오버라이드를 저장한다 (사용자 레벨)',
  },
  'load-agent-override': {
    handler: 'feedback',
    inputMethod: 'args',
    input: obj({ role: str(true) }),
    output: obj({ roleId: str(), content: str() }),
    description: '에이전트 오버라이드를 로딩한다',
  },
  'list-agent-overrides': {
    handler: 'feedback',
    inputMethod: 'none',
    input: obj({}),
    output: arr(),
    description: '에이전트 오버라이드 목록을 반환한다',
  },
  'merge-agent-override': {
    handler: 'feedback',
    inputMethod: 'stdin',
    input: obj({ baseMd: str(true), overrideMd: str(true) }),
    output: obj({ merged: str() }),
    description: '에이전트 오버라이드를 머지한다',
  },
  'save-project-override': {
    handler: 'feedback',
    inputMethod: 'stdin',
    input: obj({ roleId: str(true), content: str(true), projectDir: str(true) }),
    output: obj({ roleId: str() }),
    description: '프로젝트 레벨 에이전트 오버라이드를 저장한다',
  },
  'load-project-override': {
    handler: 'feedback',
    inputMethod: 'stdin',
    input: obj({ roleId: str(true), projectDir: str(true) }),
    output: obj({ content: str() }),
    description: '프로젝트 레벨 에이전트 오버라이드를 로딩한다',
  },
  'list-project-overrides': {
    handler: 'feedback',
    inputMethod: 'stdin',
    input: obj({ projectDir: str(true) }),
    output: arr(),
    description: '프로젝트 레벨 오버라이드 목록을 반환한다',
  },
  'merge-all-overrides': {
    handler: 'feedback',
    inputMethod: 'stdin',
    input: obj({ baseMd: str(true), overrides: arr() }),
    output: obj({ result: str() }),
    description: '모든 레벨의 오버라이드를 머지한다',
  },
};
