/**
 * metrics 핸들러 스키마 (3개)
 */
import { obj, str, num, objField, idArgsInput } from './schema-builders.js';

export default {
  'record-metrics': {
    handler: 'metrics',
    inputMethod: 'stdin',
    input: obj({ id: str(true), type: str(true) }),
    output: obj({ metrics: objField() }),
    description: '메트릭스 이벤트를 기록한다',
  },
  'project-metrics': {
    handler: 'metrics',
    inputMethod: 'args',
    input: idArgsInput,
    output: obj({ dashboard: str(), metrics: objField() }),
    description: '프로젝트 메트릭스 대시보드를 반환한다',
  },
  'cost-summary': {
    handler: 'metrics',
    inputMethod: 'args',
    input: idArgsInput,
    output: obj({ totalCostUsd: num(), totalInputTokens: num(), totalOutputTokens: num() }),
    description: '비용 요약을 반환한다',
  },
};
