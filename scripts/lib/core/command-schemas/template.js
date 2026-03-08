/**
 * template 핸들러 스키마 (3개)
 */
import { obj, str, bool, arr, objField } from './schema-builders.js';

export default {
  'list-templates': {
    handler: 'template',
    inputMethod: 'args',
    input: obj({ type: str() }),
    output: arr(),
    description: '사용 가능한 템플릿 목록을 반환한다',
  },
  'get-template': {
    handler: 'template',
    inputMethod: 'args',
    input: obj({ name: str(true) }),
    output: obj({ name: str(), content: objField() }),
    description: '템플릿 상세를 반환한다',
  },
  scaffold: {
    handler: 'template',
    inputMethod: 'stdin',
    input: obj({
      template: str(true),
      targetDir: str(true),
      variables: objField(),
      overwrite: bool(),
      backup: bool(),
    }),
    output: obj({ filesCreated: arr() }),
    description: '템플릿으로 프로젝트를 스캐폴딩한다',
  },
};
