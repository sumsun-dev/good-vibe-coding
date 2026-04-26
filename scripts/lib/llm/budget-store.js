/**
 * budget-store — opt-in 예산 임계 저장/조회.
 *
 * PRD §8.2 + #249. 사용자가 명시적으로 설정한 경우에만 위험 평가 동작.
 * 저장 위치: `${baseDir()}/budget.json` (단일 사용자 단일 파일).
 *
 * 형식:
 * ```json
 * { "maxCostUsd": 10, "maxTokens": null, "updatedAt": "2026-04-26T..." }
 * ```
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { baseDir } from '../core/app-paths.js';
import { inputError } from '../core/validators.js';

function budgetPath() {
  return resolve(baseDir(), 'budget.json');
}

const EMPTY_BUDGET = Object.freeze({ maxCostUsd: null, maxTokens: null, updatedAt: null });

/**
 * 현재 예산 임계 설정 반환. 미설정 시 null 값 객체.
 * @returns {{ maxCostUsd: number|null, maxTokens: number|null, updatedAt: string|null }}
 */
export function getBudget() {
  const path = budgetPath();
  if (!existsSync(path)) return { ...EMPTY_BUDGET };
  try {
    const data = JSON.parse(readFileSync(path, 'utf-8'));
    return {
      maxCostUsd: typeof data.maxCostUsd === 'number' ? data.maxCostUsd : null,
      maxTokens: typeof data.maxTokens === 'number' ? data.maxTokens : null,
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
    };
  } catch {
    return { ...EMPTY_BUDGET };
  }
}

/**
 * 예산 임계 설정. 음수/NaN은 거부, null은 해당 임계 해제.
 * @param {{ maxCostUsd?: number|null, maxTokens?: number|null }} input
 * @returns {{ maxCostUsd: number|null, maxTokens: number|null, updatedAt: string }}
 */
export function setBudget(input = {}) {
  const maxCostUsd = normalizeLimit(input.maxCostUsd, 'maxCostUsd');
  const maxTokens = normalizeLimit(input.maxTokens, 'maxTokens');

  if (maxCostUsd === undefined && maxTokens === undefined) {
    throw inputError('maxCostUsd 또는 maxTokens 중 하나 이상을 지정해야 합니다');
  }

  const current = getBudget();
  const next = {
    maxCostUsd: maxCostUsd === undefined ? current.maxCostUsd : maxCostUsd,
    maxTokens: maxTokens === undefined ? current.maxTokens : maxTokens,
    updatedAt: new Date().toISOString(),
  };

  const path = budgetPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(next, null, 2), 'utf-8');
  return next;
}

/**
 * 예산 설정 전체 해제. 양 필드를 명시적으로 null로 덮어쓰며 updatedAt 갱신.
 */
export function clearBudget() {
  return setBudget({ maxCostUsd: null, maxTokens: null });
}

function normalizeLimit(value, field) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw inputError(`${field}는 숫자 또는 null이어야 합니다`);
  }
  if (value < 0) {
    throw inputError(`${field}는 0 이상이어야 합니다`);
  }
  return value;
}
