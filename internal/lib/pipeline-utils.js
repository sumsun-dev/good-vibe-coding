// pipeline-utils.js — 파이프라인 유틸리티 (재시도, 긴급 정지)
// Shell에서 호출: node pipeline-utils.js <command> [args...]

import { existsSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';

const NETWORK_ERROR_PATTERNS = [
  /ETIMEDOUT/i,
  /ECONNRESET/i,
  /ECONNREFUSED/i,
  /socket hang up/i,
  /network/i,
  /HTTP 502/i,
  /HTTP 503/i,
  /HTTP 504/i,
];

const ALLOWED_COMMAND_PREFIXES = ['gh ', 'npm ', 'git ', 'echo '];

/**
 * 명령을 exponential backoff로 재시도
 * 보안: 허용된 명령 프리픽스만 실행 가능 (Shell injection 방지)
 * @param {string} command - 실행할 shell 명령
 * @param {object} options
 * @param {number} [options.maxRetries=3]
 * @param {number} [options.baseDelay=2000] - ms
 * @param {number} [options.timeout=30000] - ms
 * @returns {string} stdout
 * @throws {Error} 최대 재시도 횟수 초과 또는 허용되지 않은 명령
 */
export function retryCommand(command, { maxRetries = 3, baseDelay = 2000, timeout = 30000 } = {}) {
  if (!ALLOWED_COMMAND_PREFIXES.some((p) => command.startsWith(p))) {
    throw new Error(`허용되지 않은 명령: ${command.split(' ')[0]}`);
  }
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return execSync(command, {
        encoding: 'utf-8',
        timeout,
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
    } catch (err) {
      lastError = err;
      const errMsg = (err.stderr || err.message || '').toString();
      const isNetworkError = NETWORK_ERROR_PATTERNS.some((p) => p.test(errMsg));

      if (!isNetworkError || attempt === maxRetries) {
        break;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      // 동기 sleep (CLI 용도)
      execSync(`sleep ${delay / 1000}`, { stdio: 'ignore' });
    }
  }

  const errMsg = lastError?.stderr || lastError?.message || 'Unknown error';
  throw new Error(`명령 실패 (${maxRetries}회 시도): ${command}\n${errMsg}`);
}

const DEFAULT_STOP_FILE = '/tmp/gv-daily-improvement.stop';

/**
 * 긴급 정지 파일이 존재하는지 확인
 * @param {string} [stopFilePath]
 * @returns {boolean}
 */
export function shouldEmergencyStop(stopFilePath = DEFAULT_STOP_FILE) {
  return existsSync(stopFilePath);
}

/**
 * 긴급 정지 파일을 삭제 (정지 실행 후)
 * @param {string} [stopFilePath]
 */
export function clearEmergencyStop(stopFilePath = DEFAULT_STOP_FILE) {
  try {
    unlinkSync(stopFilePath);
  } catch {
    // 이미 삭제되었거나 존재하지 않음
  }
}

// CLI 진입점
if (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
) {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case 'retry-gh': {
      const ghCommand = args.join(' ');
      try {
        const result = retryCommand(ghCommand);
        console.log(result);
      } catch (err) {
        console.error(err.message);
        process.exit(1);
      }
      break;
    }
    case 'check-stop': {
      const stopFile = args[0] || DEFAULT_STOP_FILE;
      if (shouldEmergencyStop(stopFile)) {
        console.log('STOP');
        clearEmergencyStop(stopFile);
        process.exit(1);
      } else {
        console.log('OK');
      }
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}
