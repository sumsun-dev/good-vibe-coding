/**
 * build 핸들러 스키마 (6개)
 */
import { obj, str, num, bool, arr, objField } from './schema-builders.js';

export default {
  'materialize-code': {
    handler: 'build',
    inputMethod: 'stdin',
    input: obj({ taskOutput: str(true), projectDir: str(true) }),
    output: obj({ files: arr(), summary: str() }),
    description: '마크다운에서 파일을 추출하고 기록한다',
  },
  'materialize-batch': {
    handler: 'build',
    inputMethod: 'stdin',
    input: obj({ taskOutputs: arr(true), projectDir: str(true), options: objField() }),
    output: obj({ results: arr(), totalFiles: num() }),
    description: '여러 태스크의 코드를 일괄 구체화한다',
  },
  'verify-and-materialize': {
    handler: 'build',
    inputMethod: 'stdin',
    input: obj({ taskOutput: str(true), task: objField(true), projectDir: str(true) }),
    output: obj({ verified: bool(), files: arr() }),
    description: '빌드 검증 후 프로젝트에 기록한다',
  },
  'extract-materializable-blocks': {
    handler: 'build',
    inputMethod: 'stdin',
    input: obj({ taskOutput: str(true) }),
    output: obj({ blocks: arr() }),
    description: '마크다운에서 구체화 가능한 코드 블록을 추출한다',
  },
  'commit-phase': {
    handler: 'build',
    inputMethod: 'stdin',
    input: obj({ projectDir: str(true), phase: num(true), message: str() }),
    output: obj({ committed: bool(), message: str() }),
    description: 'Phase 결과를 커밋한다',
  },
  'commit-phase-enhanced': {
    handler: 'build',
    inputMethod: 'stdin',
    input: obj({
      projectDir: str(true),
      phase: num(true),
      tasks: arr(),
      project: objField(),
      team: arr(),
      totalPhases: num(),
      qualityGate: objField(),
    }),
    output: obj({ success: bool(), message: str(), error: str() }),
    description: 'conventional commit 메시지로 Phase를 커밋한다',
  },
};
