/**
 * update-checker — 버전 확인 + 업데이트 체크
 *
 * 소스 설치 사용자를 위해 현재 버전과 업데이트 가능 여부를 제공한다.
 */

import { readFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '../../..');

/**
 * package.json에서 현재 버전을 읽어 반환한다.
 * @returns {string}
 */
export function getCurrentVersion() {
  const pkgPath = join(REPO_ROOT, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  return pkg.version;
}

/**
 * git fetch --dry-run + HEAD vs @{u} 비교로 업데이트 가능 여부를 확인한다.
 * @returns {{ updateAvailable: boolean, local: string|null, remote: string|null }}
 */
export function checkForUpdates() {
  try {
    execFileSync('git', ['fetch', '--dry-run'], {
      cwd: REPO_ROOT,
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 10000,
    });

    const local = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: REPO_ROOT,
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();

    let remote;
    try {
      remote = execFileSync('git', ['rev-parse', '@{u}'], {
        cwd: REPO_ROOT,
        stdio: 'pipe',
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();
    } catch {
      return { updateAvailable: false, local, remote: null };
    }

    return { updateAvailable: local !== remote, local, remote };
  } catch {
    return { updateAvailable: false, local: null, remote: null };
  }
}

/**
 * 버전 + 업데이트 정보를 합쳐서 반환한다.
 * @returns {{ version: string, updateAvailable: boolean, instructions: string|null }}
 */
export function getVersionInfo() {
  const version = getCurrentVersion();
  const { updateAvailable } = checkForUpdates();
  return {
    version,
    updateAvailable,
    instructions: updateAvailable
      ? '업데이트: cd good-vibe-coding && git pull && npm install'
      : null,
  };
}
