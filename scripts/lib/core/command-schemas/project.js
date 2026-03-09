/**
 * project 핸들러 스키마 (10개)
 */
import { obj, str, arr, objField, strEnum, num, idArgsInput } from './schema-builders.js';

export default {
  'create-project': {
    handler: 'project',
    inputMethod: 'stdin',
    input: obj({
      name: str(true),
      type: str(true),
      description: str(),
      mode: strEnum(['plan-only', 'plan-execute', 'quick-build']),
      clarityAnalysis: objField(),
      complexityAnalysis: objField(),
    }),
    output: obj({ id: str(), name: str(), type: str(), status: str() }),
    description: '새 프로젝트를 생성한다',
  },
  'get-project': {
    handler: 'project',
    inputMethod: 'args',
    input: idArgsInput,
    output: obj({ id: str(), name: str(), status: str(), team: arr(), tasks: arr() }),
    description: '프로젝트를 조회한다',
  },
  'list-projects': {
    handler: 'project',
    inputMethod: 'none',
    input: obj({}),
    output: arr(),
    description: '전체 프로젝트 목록을 반환한다',
  },
  'update-status': {
    handler: 'project',
    inputMethod: 'stdin',
    input: obj({
      id: str(true),
      status: strEnum(['planning', 'approved', 'executing', 'reviewing', 'completed'], true),
    }),
    output: obj({ id: str(), status: str() }),
    description: '프로젝트 상태를 업데이트한다',
  },
  'set-team': {
    handler: 'project',
    inputMethod: 'stdin',
    input: obj({ id: str(true), team: arr(true) }),
    output: obj({ id: str(), team: arr() }),
    description: '프로젝트 팀을 설정한다',
  },
  'execution-progress': {
    handler: 'project',
    inputMethod: 'args',
    input: idArgsInput,
    output: obj({
      totalTasks: num(),
      completedTasks: num(),
      currentPhase: num(),
      totalPhases: num(),
      percentage: num(),
    }),
    description: '프로젝트 실행 진행률을 반환한다',
  },
  report: {
    handler: 'project',
    inputMethod: 'args',
    input: idArgsInput,
    output: obj({ report: str() }),
    description: '프로젝트 보고서를 생성한다',
  },
  'scan-codebase': {
    handler: 'project',
    inputMethod: 'args',
    input: obj({ path: str(true) }),
    output: obj({
      techStack: arr(),
      languages: objField(),
      dependencies: objField(),
      fileStructure: str(),
      suggestedRoles: arr(),
      scannedAt: str(),
    }),
    description: '프로젝트 폴더를 스캔하여 기술 스택과 구조를 파악한다',
  },
  'add-modify-history': {
    handler: 'project',
    inputMethod: 'stdin',
    input: obj({
      id: str(true),
      modifiedPrd: str(true),
      complexity: strEnum(['simple', 'medium', 'complex'], true),
      codebaseInsights: objField(),
      affectedAreas: arr(),
      migrationRisks: arr(),
    }),
    output: obj({ id: str(), modifyHistory: arr() }),
    description: '프로젝트에 수정 이력을 추가한다',
  },
  'describe-command': {
    handler: 'project',
    inputMethod: 'args',
    input: obj({ command: str() }),
    output: obj({ command: str(), handler: str(), inputMethod: str() }),
    description: '커맨드 스키마를 조회한다',
  },
};
