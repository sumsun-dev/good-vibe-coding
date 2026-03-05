/**
 * cli-utils — CLI 유틸리티 함수
 */

import { inputError } from './lib/core/validators.js';

/** stdin 최대 크기 (10MB) */
const MAX_STDIN_BYTES = 10 * 1024 * 1024;

/** Prototype pollution 위험 키 목록 */
const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];

/**
 * JSON 객체에서 prototype pollution 위험 키를 제거한다.
 * @param {*} obj - 검사할 객체
 * @returns {*} 안전한 객체
 */
function sanitizeJson(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeJson);
  for (const key of DANGEROUS_KEYS) {
    if (key in obj) delete obj[key];
  }
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      obj[key] = sanitizeJson(obj[key]);
    }
  }
  return obj;
}

/**
 * stdin에서 JSON을 읽는다.
 */
export async function readStdin() {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of process.stdin) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_STDIN_BYTES) {
      throw inputError(`stdin 입력이 최대 크기(${MAX_STDIN_BYTES / 1024 / 1024}MB)를 초과했습니다`);
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf-8').trim();
  if (!raw) return {};
  try {
    return sanitizeJson(JSON.parse(raw));
  } catch (err) {
    throw inputError(`잘못된 JSON 입력: ${err.message}`);
  }
}

/**
 * 결과를 JSON으로 출력한다.
 */
export function output(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

/**
 * 성공 응답을 표준 형식으로 출력한다.
 * @param {object} data - 응답 데이터
 */
export function outputOk(data = {}) {
  output({ success: true, ...data });
}

/**
 * 인자에서 --key value 또는 --key=value를 파싱한다.
 */
export function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        result[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
      } else if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        result[arg.slice(2)] = args[i + 1];
        i++;
      } else {
        result[arg.slice(2)] = true;
      }
    }
  }
  return result;
}

export { MAX_STDIN_BYTES };
