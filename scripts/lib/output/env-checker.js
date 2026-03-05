/**
 * env-checker — 통합 개발 환경 헬스체크
 *
 * 필수(Node.js, npm, git)와 선택(gh, gemini, handlebars) 도구의
 * 설치 상태를 확인하여 통합 결과를 반환한다.
 */

import { execFileSync } from 'child_process';
import { checkGhStatus } from '../project/github-manager.js';
import { isGeminiCliInstalled } from '../llm/gemini-bridge.js';

/**
 * CLI 커맨드의 설치 여부와 버전을 확인한다.
 * @param {string} cmd - 실행할 커맨드
 * @param {string[]} [args=['--version']] - 버전 확인 인자
 * @param {number} [timeout=5000] - 타임아웃(ms)
 * @returns {{ installed: boolean, version: string|null }}
 */
export function checkCommand(cmd, args = ['--version'], timeout = 5000) {
  try {
    const output = execFileSync(cmd, args, {
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout,
    }).trim();
    const versionMatch = output.match(/(\d+\.\d+[\d.]*)/);
    return { installed: true, version: versionMatch ? versionMatch[1] : output };
  } catch {
    return { installed: false, version: null };
  }
}

/**
 * Node.js 설치 여부와 최소 버전 충족을 확인한다.
 * @param {string} [minVersion='18.0.0'] - 최소 요구 버전
 * @returns {{ installed: boolean, version: string|null, meetsMinimum: boolean }}
 */
export function checkNodeVersion(minVersion = '18.0.0') {
  const result = checkCommand('node', ['--version']);
  if (!result.installed) return { installed: false, version: null, meetsMinimum: false };

  const meetsMinimum = compareVersions(result.version, minVersion) >= 0;
  return { installed: true, version: result.version, meetsMinimum };
}

/**
 * 단순 semver 비교. a > b면 1, a < b면 -1, 같으면 0.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

/**
 * 필수/선택 도구의 설치 상태를 통합 확인한다.
 * @returns {{ node: object, npm: object, git: object, gh: object, gemini: object, handlebars: object, healthy: boolean }}
 */
export function checkEnvironment() {
  const node = checkNodeVersion();
  const npm = checkCommand('npm', ['--version']);
  const git = checkCommand('git', ['--version']);
  const gh = checkGhStatus();
  const gemini = { installed: isGeminiCliInstalled() };

  let handlebarsVersion = null;
  try {
    handlebarsVersion = execFileSync(
      'node',
      ['-e', "import('handlebars/package.json',{with:{type:'json'}}).then(m=>process.stdout.write(m.default.version))"],
      { stdio: 'pipe', encoding: 'utf-8', timeout: 5000 },
    ).trim();
  } catch {
    // not installed or import failed — fallback to require
    try {
      handlebarsVersion = execFileSync(
        'node',
        ['-e', "process.stdout.write(require('handlebars/package.json').version)"],
        { stdio: 'pipe', encoding: 'utf-8', timeout: 5000 },
      ).trim();
    } catch {
      // not installed
    }
  }
  const handlebars = { installed: !!handlebarsVersion, version: handlebarsVersion };

  const healthy = node.meetsMinimum && npm.installed && git.installed;

  return { node, npm, git, gh, gemini, handlebars, healthy };
}
