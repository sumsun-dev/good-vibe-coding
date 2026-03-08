/**
 * command-schemas/index — 커맨드 입출력 스키마 레지스트리
 * 에이전트가 CLI 커맨드의 입출력 형태를 프로그래밍적으로 조회할 수 있게 한다.
 *
 * 입력 방법:
 * - 'stdin'  : JSON을 stdin으로 전달
 * - 'args'   : --key value 형태의 CLI 인자
 * - 'none'   : 입력 없음
 *
 * 스키마 형식: schema-validator.js 형식 활용
 * { type: 'string'|'number'|'boolean'|'array'|'object',
 *   required?: boolean, properties?: Record<string, Schema> }
 */

import projectSchemas from './project.js';
import teamSchemas from './team.js';
import discussionSchemas from './discussion.js';
import executionSchemas from './execution.js';
import reviewSchemas from './review.js';
import buildSchemas from './build.js';
import evalSchemas from './eval.js';
import authSchemas from './auth.js';
import feedbackSchemas from './feedback.js';
import infraSchemas from './infra.js';
import metricsSchemas from './metrics.js';
import templateSchemas from './template.js';
import taskSchemas from './task.js';
import recommendationSchemas from './recommendation.js';

export const COMMAND_SCHEMAS = {
  ...projectSchemas,
  ...teamSchemas,
  ...discussionSchemas,
  ...executionSchemas,
  ...reviewSchemas,
  ...buildSchemas,
  ...evalSchemas,
  ...authSchemas,
  ...feedbackSchemas,
  ...infraSchemas,
  ...metricsSchemas,
  ...templateSchemas,
  ...taskSchemas,
  ...recommendationSchemas,
};

/**
 * 특정 커맨드의 스키마를 조회한다.
 * @param {string} commandName - 커맨드 이름
 * @returns {object|null} 스키마 또는 null
 */
export function getCommandSchema(commandName) {
  return COMMAND_SCHEMAS[commandName] || null;
}

/**
 * 모든 스키마를 핸들러별로 그룹화하여 반환한다.
 * @returns {Record<string, Array<{command: string, schema: object}>>}
 */
export function listCommandSchemas() {
  const grouped = {};
  for (const [command, schema] of Object.entries(COMMAND_SCHEMAS)) {
    const handler = schema.handler;
    if (!grouped[handler]) grouped[handler] = [];
    grouped[handler].push({ command, ...schema });
  }
  return grouped;
}
