import { execFileSync } from 'child_process';
import { existsSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { buildCommitMessage } from './commit-message-builder.js';
import { config } from '../core/config.js';

/**
 * gh CLI 설치 및 인증 상태를 확인한다.
 * @returns {{installed: boolean, authenticated: boolean, username: string|null}}
 */
export function checkGhStatus() {
  let installed = false;
  let authenticated = false;
  let username = null;

  try {
    execFileSync('gh', ['--version'], { stdio: 'pipe' });
    installed = true;
  } catch {
    return { installed: false, authenticated: false, username: null };
  }

  try {
    // gh auth status: exit 0=인증됨, exit 1=미인증
    execFileSync('gh', ['auth', 'status'], { stdio: 'pipe', encoding: 'utf-8' });
    authenticated = true;
    // username은 별도 API로 안전하게 조회
    try {
      username =
        execFileSync('gh', ['api', 'user', '--jq', '.login'], {
          stdio: 'pipe',
          encoding: 'utf-8',
        }).trim() || null;
    } catch {
      // username 조회 실패는 무시
    }
  } catch {
    // exit 1 = 미인증
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

  const args = ['repo', 'create', repoName];
  args.push(visibility === 'public' ? '--public' : '--private');
  if (description) {
    args.push('--description', description);
  }

  try {
    const output = execFileSync('gh', args, { stdio: 'pipe', encoding: 'utf-8' });

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

    // 특수문자 안전: -m 대신 임시 파일로 메시지 전달
    const tmpMsgFile = join(tmpdir(), `gvc-commit-${Date.now()}.txt`);
    try {
      writeFileSync(tmpMsgFile, commitMessage, 'utf-8');
      execFileSync('git', ['commit', '-F', tmpMsgFile, '--allow-empty'], opts);
    } finally {
      try {
        unlinkSync(tmpMsgFile);
      } catch {
        /* ignore */
      }
    }

    return { success: true, error: null };
  } catch (err) {
    const errMessage = err.stderr ? err.stderr.toString() : err.message;
    return { success: false, error: errMessage };
  }
}

/**
 * conventional commit 메시지로 Phase를 커밋한다.
 * 기존 commitPhase()에 buildCommitMessage()를 결합.
 * @param {string} projectDir - 프로젝트 디렉토리 경로
 * @param {object} options - 옵션
 * @param {number} options.phase - Phase 번호
 * @param {Array} [options.tasks] - 태스크 배열
 * @param {object} [options.project] - 프로젝트 객체
 * @param {Array} [options.team] - 팀 배열
 * @param {number} [options.totalPhases] - 전체 Phase 수
 * @param {object} [options.qualityGate] - 품질 게이트 결과
 * @returns {{success: boolean, message: string|null, error: string|null}}
 */
export function commitPhaseEnhanced(projectDir, options = {}) {
  const { phase, tasks = [], project = {}, team = [], totalPhases = 1, qualityGate } = options;

  if (!projectDir || typeof projectDir !== 'string') {
    return { success: false, message: null, error: 'projectDir이 필요합니다' };
  }
  if (phase === undefined || phase === null || typeof phase !== 'number') {
    return { success: false, message: null, error: 'phase가 필요합니다 (숫자)' };
  }

  const message = buildCommitMessage({ phase, tasks, project, team, totalPhases, qualityGate });
  const result = commitPhase(projectDir, phase, message);
  return { ...result, message: result.success ? message : null };
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
  if (!/^https?:\/\/.+|^git@.+:.+/.test(remoteUrl)) {
    return { success: false, error: '유효하지 않은 remoteUrl 형식입니다' };
  }

  try {
    const opts = { cwd: projectDir, stdio: 'pipe', encoding: 'utf-8' };

    // .gitignore 없으면 최소 패턴 자동 생성 (민감 파일 보호)
    const gitignorePath = join(projectDir, '.gitignore');
    if (!existsSync(gitignorePath)) {
      writeFileSync(gitignorePath, MINIMAL_GITIGNORE, 'utf-8');
    }

    execFileSync('git', ['init'], opts);
    execFileSync('git', ['add', '.'], opts);
    execFileSync('git', ['commit', '-m', 'Initial commit'], opts);
    execFileSync('git', ['remote', 'add', 'origin', remoteUrl], opts);
    execFileSync('git', ['push', '-u', 'origin', config.github.baseBranch], opts);

    return { success: true, error: null };
  } catch (err) {
    const message = err.stderr ? err.stderr.toString() : err.message;
    return { success: false, error: message };
  }
}
