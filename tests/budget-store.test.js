/**
 * budget-store 단위 테스트.
 * opt-in 예산 임계 저장/조회 — PRD §8.2.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'fs/promises';
import { resolve } from 'path';
import { configure, resetConfiguration } from '../scripts/lib/core/app-paths.js';
import { getBudget, setBudget, clearBudget } from '../scripts/lib/llm/budget-store.js';

const TMP_DIR = resolve('.tmp-test-budget-store');

beforeEach(async () => {
  await rm(TMP_DIR, { recursive: true, force: true });
  await mkdir(TMP_DIR, { recursive: true });
  configure({ baseDir: TMP_DIR });
});

afterEach(async () => {
  resetConfiguration();
  await rm(TMP_DIR, { recursive: true, force: true });
});

describe('budget-store', () => {
  describe('getBudget', () => {
    it('파일이 없으면 빈 임계 반환', () => {
      const b = getBudget();
      expect(b.maxCostUsd).toBeNull();
      expect(b.maxTokens).toBeNull();
      expect(b.updatedAt).toBeNull();
    });
  });

  describe('setBudget', () => {
    it('maxCostUsd 설정', () => {
      const next = setBudget({ maxCostUsd: 10 });
      expect(next.maxCostUsd).toBe(10);
      expect(next.maxTokens).toBeNull();
      expect(next.updatedAt).toBeTruthy();
    });

    it('maxTokens 설정', () => {
      const next = setBudget({ maxTokens: 100000 });
      expect(next.maxTokens).toBe(100000);
    });

    it('두 임계 동시 설정', () => {
      const next = setBudget({ maxCostUsd: 10, maxTokens: 100000 });
      expect(next.maxCostUsd).toBe(10);
      expect(next.maxTokens).toBe(100000);
    });

    it('null로 개별 임계 해제', () => {
      setBudget({ maxCostUsd: 10, maxTokens: 100000 });
      const next = setBudget({ maxCostUsd: null });
      expect(next.maxCostUsd).toBeNull();
      expect(next.maxTokens).toBe(100000);
    });

    it('재설정은 기존 값을 유지하면서 변경된 필드만 갱신', () => {
      setBudget({ maxCostUsd: 10 });
      const next = setBudget({ maxTokens: 50000 });
      expect(next.maxCostUsd).toBe(10);
      expect(next.maxTokens).toBe(50000);
    });

    it('빈 입력 → INPUT_ERROR', () => {
      expect(() => setBudget({})).toThrowError(/하나 이상/);
    });

    it('음수 → INPUT_ERROR', () => {
      expect(() => setBudget({ maxCostUsd: -1 })).toThrowError(/0 이상/);
    });

    it('NaN/Infinity → INPUT_ERROR', () => {
      expect(() => setBudget({ maxCostUsd: NaN })).toThrowError(/숫자 또는 null/);
      expect(() => setBudget({ maxTokens: Infinity })).toThrowError(/숫자 또는 null/);
    });

    it('문자열 → INPUT_ERROR', () => {
      expect(() => setBudget({ maxCostUsd: '10' })).toThrowError(/숫자 또는 null/);
    });
  });

  describe('clearBudget', () => {
    it('두 임계 모두 null로 해제', () => {
      setBudget({ maxCostUsd: 10, maxTokens: 100000 });
      const next = clearBudget();
      expect(next.maxCostUsd).toBeNull();
      expect(next.maxTokens).toBeNull();
    });
  });

  describe('영속성', () => {
    it('setBudget 후 getBudget으로 동일 값 읽힘', () => {
      setBudget({ maxCostUsd: 5, maxTokens: 50000 });
      const b = getBudget();
      expect(b.maxCostUsd).toBe(5);
      expect(b.maxTokens).toBe(50000);
    });
  });
});
