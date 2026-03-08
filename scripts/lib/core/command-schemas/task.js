/**
 * task 핸들러 스키마 (8개)
 */
import { obj, str, bool, arr, objField, promptOutput } from './schema-builders.js';

export default {
  'add-discussion-round': {
    handler: 'task',
    inputMethod: 'stdin',
    input: obj({ id: str(true), roundData: objField(true) }),
    output: obj({ project: objField() }),
    description: '토론 라운드 데이터를 프로젝트에 추가한다',
  },
  'add-task-reviews': {
    handler: 'task',
    inputMethod: 'stdin',
    input: obj({ id: str(true), taskId: str(true), reviews: arr(true) }),
    output: obj({ project: objField() }),
    description: '태스크에 리뷰 결과를 추가한다',
  },
  'update-task-status': {
    handler: 'task',
    inputMethod: 'stdin',
    input: obj({ id: str(true), taskId: str(true), status: str(true) }),
    output: obj({ project: objField() }),
    description: '태스크 상태를 업데이트한다',
  },
  'save-task-output': {
    handler: 'task',
    inputMethod: 'stdin',
    input: obj({ id: str(true), taskId: str(true), output: str(true) }),
    output: obj({ project: objField() }),
    description: '태스크 실행 결과를 저장한다',
  },
  'add-task-materialization': {
    handler: 'task',
    inputMethod: 'stdin',
    input: obj({ id: str(true), taskId: str(true), materializeResult: objField(true) }),
    output: obj({ project: objField() }),
    description: '태스크에 materialization 결과를 저장한다',
  },
  'build-phase-context': {
    handler: 'task',
    inputMethod: 'stdin',
    input: obj({ completedTasks: arr(true) }),
    output: obj({ phaseContext: str() }),
    description: 'Phase 컨텍스트를 생성한다',
  },
  'tdd-execution-prompt': {
    handler: 'task',
    inputMethod: 'stdin',
    input: obj({ task: objField(true), teamMember: objField(true) }),
    output: promptOutput,
    description: 'TDD 실행 프롬프트를 생성한다',
  },
  'is-code-task': {
    handler: 'task',
    inputMethod: 'stdin',
    input: obj({ task: objField(true) }),
    output: obj({ isCodeTask: bool() }),
    description: '코드 태스크 여부를 판단한다',
  },
};
