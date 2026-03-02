/**
 * handler-helpers — 핸들러 공통 유틸리티
 * getProject + notFoundError 반복 패턴을 캡슐화한다.
 */

import { getProject } from '../project/project-manager.js';
import { notFoundError } from './validators.js';

/**
 * 프로젝트를 조회하고 없으면 NOT_FOUND를 던진다.
 * @param {string} id - 프로젝트 ID
 * @param {function} fn - (project) => result 콜백
 * @returns {Promise<*>} 콜백 반환값
 */
export async function withProject(id, fn) {
  const project = await getProject(id);
  if (!project) throw notFoundError(`프로젝트를 찾을 수 없습니다: ${id}`);
  return fn(project);
}
