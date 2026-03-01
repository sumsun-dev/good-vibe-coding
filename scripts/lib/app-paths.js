/**
 * app-paths — 애플리케이션 경로 중앙 관리
 * 모든 모듈이 이 모듈을 통해 경로를 참조한다.
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** 플러그인 루트 디렉토리 (이 프로젝트의 소스 루트) */
export function pluginRoot() {
  return resolve(__dirname, '../..');
}

function homeDir() {
  return process.env.HOME || process.env.USERPROFILE || '';
}

/** 앱 루트 디렉토리 (~/.claude/good-vibe) */
export function baseDir() {
  return resolve(homeDir(), '.claude', 'good-vibe');
}

/** 프로젝트 저장 디렉토리 */
export function projectsDir() {
  return resolve(baseDir(), 'projects');
}

/** 에이전트 오버라이드 디렉토리 (사용자 레벨) */
export function agentOverridesDir() {
  return resolve(baseDir(), 'agent-overrides');
}

/** 평가 세션 디렉토리 */
export function evaluationsDir() {
  return resolve(baseDir(), 'evaluations');
}

/** 커스텀 템플릿 디렉토리 */
export function customTemplatesDir() {
  return resolve(baseDir(), 'custom-templates');
}

/** 인증 설정 디렉토리 */
export function authDir() {
  return baseDir();
}

/** ~/.claude 디렉토리 */
export function claudeDir() {
  return resolve(homeDir(), '.claude');
}

/** 사용자 스킬 디렉토리 (~/.claude/skills) */
export function userSkillsDir() {
  return resolve(claudeDir(), 'skills');
}

/** 사용자 에이전트 디렉토리 (~/.claude/agents) */
export function userAgentsDir() {
  return resolve(claudeDir(), 'agents');
}
