import { execSync } from 'child_process';

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
