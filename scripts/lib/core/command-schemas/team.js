/**
 * team 핸들러 스키마 (9개)
 */
import { obj, str, arr, objField, promptOutput } from './schema-builders.js';

export default {
  'recommend-team': {
    handler: 'team',
    inputMethod: 'args',
    input: obj({ type: str(true) }),
    output: obj({ recommended: arr(), optional: arr() }),
    description: '프로젝트 타입에 따른 팀을 추천한다',
  },
  'optimized-team': {
    handler: 'team',
    inputMethod: 'stdin',
    input: obj({ projectType: str(true), complexity: str(true) }),
    output: obj({ roles: arr(), optional: arr() }),
    description: '타입 + 복잡도를 결합해 최적 팀을 구성한다',
  },
  'build-team': {
    handler: 'team',
    inputMethod: 'stdin',
    input: obj({ roleIds: arr(true), personalityChoices: objField(), complexity: str() }),
    output: arr(),
    description: '역할 ID와 페르소나로 팀을 빌드한다',
  },
  'role-catalog': {
    handler: 'team',
    inputMethod: 'none',
    input: obj({}),
    output: obj({ roles: objField() }),
    description: '역할 카탈로그를 반환한다',
  },
  'project-types': {
    handler: 'team',
    inputMethod: 'none',
    input: obj({}),
    output: obj({ types: objField() }),
    description: '프로젝트 타입 목록을 반환한다',
  },
  'design-dynamic-roles': {
    handler: 'team',
    inputMethod: 'stdin',
    input: obj({ description: str(true), existingRoles: arr(), codebaseInfo: objField() }),
    output: promptOutput,
    description: '프로젝트별 맞춤 역할 설계 프롬프트를 생성한다',
  },
  'parse-dynamic-roles': {
    handler: 'team',
    inputMethod: 'stdin',
    input: obj({ rawOutput: str(true) }),
    output: obj({ roles: arr() }),
    description: '동적 역할 LLM 출력을 파싱한다',
  },
  'build-team-with-dynamic': {
    handler: 'team',
    inputMethod: 'stdin',
    input: obj({ roleIds: arr(true), dynamicRoles: arr(), complexity: str() }),
    output: arr(),
    description: 'catalog 역할과 동적 역할을 병합하여 팀을 빌드한다',
  },
  'team-summary': {
    handler: 'team',
    inputMethod: 'stdin',
    input: obj({ roleIds: arr(true), personalityChoices: objField() }),
    output: obj({ summary: str(), team: arr() }),
    description: '팀 요약 문자열을 생성한다',
  },
};
