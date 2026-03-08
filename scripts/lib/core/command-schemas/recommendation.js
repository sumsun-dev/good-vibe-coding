/**
 * recommendation 핸들러 스키마 (4개)
 */
import { obj, str, arr } from './schema-builders.js';

export default {
  'recommend-setup': {
    handler: 'recommendation',
    inputMethod: 'stdin',
    input: obj({
      projectType: str(true),
      complexity: str(true),
      description: str(true),
      teamRoles: arr(),
    }),
    output: obj({ skills: arr(), agents: arr() }),
    description: '프로젝트에 맞는 스킬/에이전트를 추천한다',
  },
  'install-setup': {
    handler: 'recommendation',
    inputMethod: 'stdin',
    input: obj({ items: arr(true) }),
    output: obj({ results: arr() }),
    description: '추천된 스킬/에이전트를 설치한다',
  },
  'list-installed': {
    handler: 'recommendation',
    inputMethod: 'none',
    input: obj({}),
    output: obj({ skills: arr(), agents: arr() }),
    description: '설치된 스킬/에이전트 목록을 반환한다',
  },
  'recommendation-catalog': {
    handler: 'recommendation',
    inputMethod: 'none',
    input: obj({}),
    output: obj({ skills: arr(), agents: arr() }),
    description: '추천 가능한 스킬/에이전트 카탈로그를 반환한다',
  },
};
