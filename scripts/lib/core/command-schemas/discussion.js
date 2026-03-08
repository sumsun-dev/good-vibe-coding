/**
 * discussion 핸들러 스키마 (12개)
 */
import {
  obj,
  str,
  num,
  bool,
  arr,
  objField,
  promptOutput,
  idArgsInput,
} from './schema-builders.js';

export default {
  'discussion-prompt': {
    handler: 'discussion',
    inputMethod: 'args',
    input: idArgsInput,
    output: promptOutput,
    description: '프로젝트별 토론 프롬프트를 생성한다',
  },
  'plan-document': {
    handler: 'discussion',
    inputMethod: 'stdin',
    input: obj({ project: objField(true), discussions: arr() }),
    output: obj({ planDocument: str() }),
    description: '기획서를 저장한다',
  },
  'single-agent-discussion-prompt': {
    handler: 'discussion',
    inputMethod: 'stdin',
    input: obj({ project: objField(true), teamMember: objField(true), context: objField() }),
    output: promptOutput,
    description: '단일 에이전트 토론 프롬프트를 생성한다',
  },
  'agent-analysis-prompt': {
    handler: 'discussion',
    inputMethod: 'stdin',
    input: obj({ project: objField(true), teamMember: objField(true), context: objField() }),
    output: promptOutput,
    description: '개별 에이전트 분석 프롬프트를 생성한다',
  },
  'synthesis-prompt': {
    handler: 'discussion',
    inputMethod: 'stdin',
    input: obj({ project: objField(true), agentOutputs: arr(true), round: num(true) }),
    output: promptOutput,
    description: '에이전트 분석을 종합하는 프롬프트를 생성한다',
  },
  'review-prompt': {
    handler: 'discussion',
    inputMethod: 'stdin',
    input: obj({ teamMember: objField(true), synthesizedPlan: str(true), round: num(true) }),
    output: promptOutput,
    description: '리뷰 프롬프트를 생성한다',
  },
  'check-convergence': {
    handler: 'discussion',
    inputMethod: 'stdin',
    input: obj({ reviews: arr(true) }),
    output: obj({ converged: bool(), approvalRate: num(), blockers: arr() }),
    description: '토론 수렴 여부를 확인한다',
  },
  'group-agents': {
    handler: 'discussion',
    inputMethod: 'stdin',
    input: obj({ team: arr(true) }),
    output: obj({ tiers: arr() }),
    description: '팀을 tier별로 그룹화한다',
  },
  'discussion-dispatch-plan': {
    handler: 'discussion',
    inputMethod: 'stdin',
    input: obj({ project: objField(true), team: arr(true), round: num() }),
    output: obj({ plan: objField() }),
    description: '토론 디스패치 계획을 생성한다',
  },
  'generate-acceptance-criteria': {
    handler: 'discussion',
    inputMethod: 'stdin',
    input: obj({ planDocument: str(true), projectContext: objField() }),
    output: promptOutput,
    description: '기획서 기반 수락 기준 생성 프롬프트를 생성한다',
  },
  'parse-acceptance-criteria': {
    handler: 'discussion',
    inputMethod: 'stdin',
    input: obj({ rawOutput: str(true) }),
    output: obj({ criteria: arr() }),
    description: '수락 기준 LLM 출력을 파싱한다',
  },
  'execution-dispatch-plan': {
    handler: 'discussion',
    inputMethod: 'stdin',
    input: obj({ project: objField(true), team: arr(true), tasks: arr(true) }),
    output: obj({ plan: objField() }),
    description: '실행 디스패치 계획을 생성한다',
  },
};
