/**
 * gemini-bridge — Gemini CLI 서브프로세스 래퍼
 *
 * Gemini CLI (`gemini`)를 통해 LLM 호출을 수행한다.
 * CLI가 자체 인증을 처리하므로 OAuth 불필요.
 * shell injection 방지를 위해 spawnSync(args 배열) 사용.
 * Windows에서 npm global .cmd 래퍼 인식을 위해 shell: true 사용 (args 배열이므로 injection 안전).
 */

import { spawnSync } from 'child_process';
import { AppError, notFoundError } from '../core/validators.js';

const DEFAULT_CLI_PATH = process.env.GEMINI_CLI_PATH || 'gemini';
const DEFAULT_TIMEOUT_MS = 120000;
const IS_WINDOWS = process.platform === 'win32';

/** 모듈 레벨 캐시: CLI 설치 확인 결과를 path별로 저장 */
export const _installCache = new Map();

/**
 * Gemini CLI JSON 출력을 파싱하여 정규화된 응답을 반환한다.
 *
 * CLI 출력 형식:
 * {"response":"...","stats":{"models":{"gemini-2.5-flash":{"tokens":{"total":N}}}}}
 *
 * @param {string} stdout - CLI stdout 출력
 * @param {string} [model] - 사용된 모델명 (fallback용)
 * @returns {{ text: string, provider: string, model: string, tokenCount: number }}
 */
export function parseGeminiCliOutput(stdout, model) {
  const fallbackModel = model || 'gemini-2.0-flash';

  if (!stdout || stdout.trim() === '') {
    return { text: '', provider: 'gemini', model: fallbackModel, tokenCount: 0 };
  }

  let parsed;
  try {
    parsed = JSON.parse(stdout.trim());
  } catch {
    // JSON 파싱 실패 시 raw 텍스트를 text로 반환
    return { text: stdout.trim(), provider: 'gemini', model: fallbackModel, tokenCount: 0 };
  }

  const text = parsed.response || '';
  let tokenCount = 0;
  let resolvedModel = fallbackModel;

  if (parsed.stats?.models) {
    const modelKeys = Object.keys(parsed.stats.models);
    if (modelKeys.length > 0) {
      resolvedModel = modelKeys[0];
      tokenCount = parsed.stats.models[modelKeys[0]]?.tokens?.total || 0;
    }
  }

  return { text, provider: 'gemini', model: resolvedModel, tokenCount };
}

/**
 * Gemini CLI 설치 여부를 확인한다.
 * @param {string} [cliPath] - CLI 실행 경로
 * @returns {boolean}
 */
export function isGeminiCliInstalled(cliPath) {
  const bin = cliPath || DEFAULT_CLI_PATH;
  if (_installCache.has(bin)) return _installCache.get(bin);
  try {
    const result = spawnSync(bin, ['--version'], {
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf-8',
      shell: IS_WINDOWS,
    });
    const installed = result.status === 0;
    _installCache.set(bin, installed);
    return installed;
  } catch {
    _installCache.set(bin, false);
    return false;
  }
}

/**
 * Gemini CLI를 호출하여 LLM 응답을 반환한다.
 *
 * @param {string} prompt - 프롬프트 텍스트
 * @param {object} [options] - { model, timeout, cliPath }
 * @returns {{ text: string, provider: string, model: string, tokenCount: number }}
 */
export function callGeminiCli(prompt, options = {}) {
  const cliPath = options.cliPath || DEFAULT_CLI_PATH;
  const model = options.model || 'gemini-2.0-flash';
  const timeout = options.timeout || DEFAULT_TIMEOUT_MS;

  if (!isGeminiCliInstalled(cliPath)) {
    throw notFoundError(
      'Gemini CLI가 설치되지 않았습니다. `npm install -g @google/gemini-cli` 또는 brew로 설치하세요.',
    );
  }

  const args = ['-p', prompt, '-o', 'json', '-m', model];
  const result = spawnSync(cliPath, args, {
    timeout,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
    shell: IS_WINDOWS,
  });

  if (result.error) {
    if (result.error.code === 'ETIMEDOUT') {
      throw new AppError(`Gemini CLI 타임아웃 (${timeout}ms)`, 'SYSTEM_ERROR');
    }
    throw new AppError(`Gemini CLI 실행 실패: ${result.error.message}`, 'SYSTEM_ERROR');
  }

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() || '';
    throw new AppError(`Gemini CLI 비정상 종료 (exit ${result.status}): ${stderr}`, 'SYSTEM_ERROR');
  }

  return parseGeminiCliOutput(result.stdout, model);
}
