/**
 * execution 핸들러 스키마 (10개)
 */
import {
  obj,
  str,
  num,
  bool,
  arr,
  objField,
  strEnum,
  promptOutput,
  projectAndNextStep,
  idArgsInput,
} from './schema-builders.js';

export default {
  'init-execution': {
    handler: 'execution',
    inputMethod: 'stdin',
    input: obj({
      id: str(true),
      mode: strEnum(['interactive', 'auto']),
      resume: bool(),
    }),
    output: obj({ project: objField(), nextStep: objField(), resumed: bool() }),
    description: '실행을 초기화하거나 재개한다',
  },
  'next-step': {
    handler: 'execution',
    inputMethod: 'args',
    input: idArgsInput,
    output: obj({ action: str(), phase: num(), description: str() }),
    description: '다음 실행 단계를 조회한다',
  },
  'advance-execution': {
    handler: 'execution',
    inputMethod: 'stdin',
    input: obj({
      id: str(true),
      stepResult: { type: 'object', required: true, properties: { completedAction: str(true) } },
    }),
    output: projectAndNextStep,
    description: '실행 상태를 다음 단계로 전이시킨다',
  },
  'execution-summary': {
    handler: 'execution',
    inputMethod: 'args',
    input: idArgsInput,
    output: obj({
      status: str(),
      currentPhase: num(),
      totalPhases: num(),
      percentage: num(),
      display: str(),
    }),
    description: '실행 진행 요약을 반환한다',
  },
  'task-distribution-prompt': {
    handler: 'execution',
    inputMethod: 'args',
    input: idArgsInput,
    output: promptOutput,
    description: '태스크 분배 프롬프트를 생성한다',
  },
  'execution-prompt': {
    handler: 'execution',
    inputMethod: 'stdin',
    input: obj({ task: objField(true), teamMember: objField(true), context: objField() }),
    output: promptOutput,
    description: '실행 프롬프트를 생성한다',
  },
  'execution-plan': {
    handler: 'execution',
    inputMethod: 'stdin',
    input: obj({ tasks: arr(true), team: arr(true) }),
    output: obj({ phases: arr() }),
    description: '실행 계획을 생성한다',
  },
  'execution-plan-with-reviews': {
    handler: 'execution',
    inputMethod: 'stdin',
    input: obj({ tasks: arr(true), team: arr(true) }),
    output: obj({ phases: arr() }),
    description: '리뷰를 포함한 실행 계획을 생성한다',
  },
  'get-failure-context': {
    handler: 'execution',
    inputMethod: 'args',
    input: idArgsInput,
    output: obj({
      status: str(),
      phase: num(),
      fixAttempt: num(),
      failureContext: objField(),
      failureHistory: arr(),
      pendingEscalation: objField(),
    }),
    description: '실패 컨텍스트를 조회한다',
  },
  'handle-escalation': {
    handler: 'execution',
    inputMethod: 'stdin',
    input: obj({
      id: str(true),
      decision: strEnum(['continue', 'skip', 'abort'], true),
      reason: str(),
    }),
    output: projectAndNextStep,
    description: 'CEO 에스컬레이션에 대한 결정을 처리한다',
  },
};
