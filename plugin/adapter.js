/**
 * plugin/adapter — Claude Code 환경에서 SDK를 초기화하는 어댑터
 * 기존 CLI 환경에서 SDK를 사용할 수 있는 브릿지.
 */

import { GoodVibe } from '../src/index.js';
import { baseDir } from '../scripts/lib/core/app-paths.js';

/**
 * Claude Code 환경 기본 설정으로 GoodVibe 인스턴스를 생성한다.
 * @param {object} [options] - 추가 옵션 (GoodVibe 생성자에 전달)
 * @returns {GoodVibe}
 */
export function createFromClaude(options = {}) {
  return new GoodVibe({
    provider: 'claude',
    storage: baseDir(),
    ...options,
  });
}
