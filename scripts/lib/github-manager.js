import { execSync, execFileSync } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * gh CLI 설치 및 인증 상태를 확인한다.
 * @returns {{installed: boolean, authenticated: boolean, username: string|null}}
 */
export function checkGhStatus() {
  let installed = false;
  let authenticated = false;
  let username = null;

  try {
    execSync('which gh', { stdio: 'pipe' });
    installed = true;
  } catch {
    return { installed: false, authenticated: false, username: null };
  }

  try {
    const output = execSync('gh auth status 2>&1', { stdio: 'pipe', encoding: 'utf-8' });
    if (output.includes('Logged in')) {
      authenticated = true;
      const match = output.match(/Logged in to [^\s]+ account (\S+)/);
      if (match) {
        username = match[1];
      } else {
        const userMatch = output.match(/account\s+(\S+)/);
        if (userMatch) {
          username = userMatch[1];
        }
      }
    }
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : '';
    const stdout = err.stdout ? err.stdout.toString() : '';
    const combined = stderr + stdout;
    if (combined.includes('Logged in')) {
      authenticated = true;
      const match = combined.match(/account\s+(\S+)/);
      if (match) {
        username = match[1];
      }
    }
  }

  return { installed, authenticated, username };
}

/**
 * GitHub 저장소를 생성한다.
 * @param {string} repoName - 저장소 이름
 * @param {object} options - 옵션
 * @param {string} [options.visibility='private'] - 'public' 또는 'private'
 * @param {string} [options.description=''] - 저장소 설명
 * @returns {{success: boolean, url: string|null, error: string|null}}
 */
export function createGithubRepo(repoName, options = {}) {
  const { visibility = 'private', description = '' } = options;

  if (!repoName || typeof repoName !== 'string') {
    return { success: false, url: null, error: 'repoName이 필요합니다' };
  }

  const vis = visibility === 'public' ? '--public' : '--private';
  const descFlag = description ? ` --description "${description.replace(/"/g, '\\"')}"` : '';

  try {
    const output = execSync(
      `gh repo create ${repoName} ${vis}${descFlag} 2>&1`,
      { stdio: 'pipe', encoding: 'utf-8' }
    );

    const urlMatch = output.match(/(https:\/\/github\.com\/\S+)/);
    const url = urlMatch ? urlMatch[1] : null;

    return { success: true, url, error: null };
  } catch (err) {
    const message = err.stderr ? err.stderr.toString() : err.message;
    return { success: false, url: null, error: message };
  }
}

/**
 * Phase 완료 후 git add + commit을 수행한다.
 * @param {string} projectDir - 프로젝트 디렉토리 경로
 * @param {number|string} phase - Phase 번호
 * @param {string} [message] - 커밋 메시지 (선택)
 * @returns {{success: boolean, error: string|null}}
 */
/** .gitignore가 없는 프로젝트에서 민감 파일 스테이징 방지를 위한 최소 패턴 */
export const MINIMAL_GITIGNORE = `.env
.env.*
*.pem
*.key
node_modules/
.DS_Store
`;

export function commitPhase(projectDir, phase, message) {
  if (!projectDir || typeof projectDir !== 'string') {
    return { success: false, error: 'projectDir이 필요합니다' };
  }
  if (phase === undefined || phase === null) {
    return { success: false, error: 'phase가 필요합니다' };
  }

  const commitMessage = message || `Phase ${phase} 완료`;

  try {
    const opts = { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' };

    // .gitignore 없으면 최소 패턴 자동 생성 (민감 파일 보호)
    const gitignorePath = join(projectDir, '.gitignore');
    if (!existsSync(gitignorePath)) {
      writeFileSync(gitignorePath, MINIMAL_GITIGNORE, 'utf-8');
    }

    execFileSync('git', ['add', '-A'], opts);
    execFileSync('git', ['commit', '-m', commitMessage, '--allow-empty'], opts);

    return { success: true, error: null };
  } catch (err) {
    const errMessage = err.stderr ? err.stderr.toString() : err.message;
    return { success: false, error: errMessage };
  }
}

/**
 * 프로젝트 디렉토리에서 git init, add, commit, remote add, push를 실행한다.
 * @param {string} projectDir - 프로젝트 디렉토리 경로
 * @param {string} remoteUrl - GitHub 원격 저장소 URL
 * @returns {{success: boolean, error: string|null}}
 */
export function gitInitAndPush(projectDir, remoteUrl) {
  if (!projectDir || typeof projectDir !== 'string') {
    return { success: false, error: 'projectDir이 필요합니다' };
  }
  if (!remoteUrl || typeof remoteUrl !== 'string') {
    return { success: false, error: 'remoteUrl이 필요합니다' };
  }

  try {
    const opts = { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' };

    execSync('git init', opts);
    execSync('git add .', opts);
    execSync('git commit -m "Initial commit"', opts);
    execSync(`git remote add origin ${remoteUrl}`, opts);
    execSync('git push -u origin main', opts);

    return { success: true, error: null };
  } catch (err) {
    const message = err.stderr ? err.stderr.toString() : err.message;
    return { success: false, error: message };
  }
}
