/**
 * risk-evaluator 단위 테스트.
 * 이슈 #238 AC:
 * - 비용 임계 미설정 시 비용으로 escalate 안 함 (opt-in)
 * - 80% 도달 시 경고만, 100% 초과 시 escalate
 * - 보안/회귀 신호 감지 시 항상 escalate (임계와 무관)
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateRisk,
  RISK_SEVERITY,
  SECURITY_EVENT_TYPES,
  REGRESSION_EVENT_TYPES,
} from '../scripts/lib/engine/risk-evaluator.js';

const noEvents = { totalCostUsd: 0, totalTokens: 0, recentEvents: [] };
const baseTask = { taskType: 'code', intent: 'feature', projectId: 'p1' };

describe('risk-evaluator', () => {
  describe('비용 임계 — opt-in (기본값 없음)', () => {
    it('budgetConfig 없음 + 비용 0 → escalate 안 함', () => {
      const r = evaluateRisk({ taskContext: baseTask, metrics: noEvents, budgetConfig: null });
      expect(r.shouldEscalate).toBe(false);
      expect(r.severity).toBe(RISK_SEVERITY.INFO);
    });

    it('budgetConfig 없음 + 비용 폭증 → escalate 안 함 (opt-in이므로)', () => {
      const r = evaluateRisk({
        taskContext: baseTask,
        metrics: { totalCostUsd: 999, totalTokens: 9999999, recentEvents: [] },
        budgetConfig: null,
      });
      expect(r.shouldEscalate).toBe(false);
    });

    it('maxCostUsd 설정됨 + 50% 사용 → INFO, escalate 안 함', () => {
      const r = evaluateRisk({
        taskContext: baseTask,
        metrics: { totalCostUsd: 5, totalTokens: 0, recentEvents: [] },
        budgetConfig: { maxCostUsd: 10 },
      });
      expect(r.severity).toBe(RISK_SEVERITY.INFO);
      expect(r.shouldEscalate).toBe(false);
    });

    it('maxCostUsd 설정됨 + 80% 도달 → WARNING, escalate 안 함', () => {
      const r = evaluateRisk({
        taskContext: baseTask,
        metrics: { totalCostUsd: 8, totalTokens: 0, recentEvents: [] },
        budgetConfig: { maxCostUsd: 10 },
      });
      expect(r.severity).toBe(RISK_SEVERITY.WARNING);
      expect(r.shouldEscalate).toBe(false);
    });

    it('maxCostUsd 설정됨 + 100% 도달 → CRITICAL, escalate', () => {
      const r = evaluateRisk({
        taskContext: baseTask,
        metrics: { totalCostUsd: 10, totalTokens: 0, recentEvents: [] },
        budgetConfig: { maxCostUsd: 10 },
      });
      expect(r.severity).toBe(RISK_SEVERITY.CRITICAL);
      expect(r.shouldEscalate).toBe(true);
      expect(r.reason).toMatch(/예산/);
    });

    it('maxTokens 설정됨 + 100% 초과 → CRITICAL, escalate', () => {
      const r = evaluateRisk({
        taskContext: baseTask,
        metrics: { totalCostUsd: 0, totalTokens: 1500, recentEvents: [] },
        budgetConfig: { maxTokens: 1000 },
      });
      expect(r.severity).toBe(RISK_SEVERITY.CRITICAL);
      expect(r.shouldEscalate).toBe(true);
      expect(r.reason).toMatch(/토큰/);
    });

    it('두 임계 동시 적용 — 더 심각한 쪽이 우선', () => {
      const r = evaluateRisk({
        taskContext: baseTask,
        metrics: { totalCostUsd: 5, totalTokens: 1500, recentEvents: [] },
        budgetConfig: { maxCostUsd: 100, maxTokens: 1000 },
      });
      // 비용은 5%, 토큰은 150% — 토큰이 critical
      expect(r.severity).toBe(RISK_SEVERITY.CRITICAL);
      expect(r.shouldEscalate).toBe(true);
    });
  });

  describe('보안/회귀 신호 — 항상 동작 (임계와 무관)', () => {
    it.each(SECURITY_EVENT_TYPES)('보안 이벤트 %s 감지 시 escalate', (type) => {
      const r = evaluateRisk({
        taskContext: baseTask,
        metrics: {
          totalCostUsd: 0,
          totalTokens: 0,
          recentEvents: [{ type, timestamp: Date.now() }],
        },
        budgetConfig: null,
      });
      expect(r.shouldEscalate).toBe(true);
      expect(r.severity).toBe(RISK_SEVERITY.CRITICAL);
      expect(r.reason).toMatch(/보안/);
    });

    it.each(REGRESSION_EVENT_TYPES)('회귀 이벤트 %s 감지 시 escalate', (type) => {
      const r = evaluateRisk({
        taskContext: baseTask,
        metrics: {
          totalCostUsd: 0,
          totalTokens: 0,
          recentEvents: [{ type, timestamp: Date.now() }],
        },
        budgetConfig: null,
      });
      expect(r.shouldEscalate).toBe(true);
      expect(r.severity).toBe(RISK_SEVERITY.CRITICAL);
      expect(r.reason).toMatch(/회귀/);
      expect(r.suggestedAction).toMatch(/롤백|회복/);
    });

    it('정상 이벤트만 있음 → escalate 안 함', () => {
      const r = evaluateRisk({
        taskContext: baseTask,
        metrics: {
          totalCostUsd: 0,
          totalTokens: 0,
          recentEvents: [
            { type: 'phase-completed', timestamp: Date.now() },
            { type: 'review-passed', timestamp: Date.now() },
          ],
        },
        budgetConfig: null,
      });
      expect(r.shouldEscalate).toBe(false);
    });
  });

  describe('우선순위: 보안/회귀 > 비용', () => {
    it('비용 100% + 보안 신호 → CRITICAL + reason에 보안 우선 표시', () => {
      const r = evaluateRisk({
        taskContext: baseTask,
        metrics: {
          totalCostUsd: 10,
          totalTokens: 0,
          recentEvents: [{ type: 'security-violation', timestamp: Date.now() }],
        },
        budgetConfig: { maxCostUsd: 10 },
      });
      expect(r.shouldEscalate).toBe(true);
      expect(r.reason).toMatch(/보안/);
    });
  });

  describe('suggestedAction', () => {
    it('비용 critical → "예산을 확장하거나 작업을 중단" 권고', () => {
      const r = evaluateRisk({
        taskContext: baseTask,
        metrics: { totalCostUsd: 10, totalTokens: 0, recentEvents: [] },
        budgetConfig: { maxCostUsd: 10 },
      });
      expect(r.suggestedAction).toMatch(/(예산|중단|확장)/);
    });

    it('보안 critical → "즉시 중단" 권고', () => {
      const r = evaluateRisk({
        taskContext: baseTask,
        metrics: {
          totalCostUsd: 0,
          totalTokens: 0,
          recentEvents: [{ type: 'secret-leak', timestamp: Date.now() }],
        },
        budgetConfig: null,
      });
      expect(r.suggestedAction).toMatch(/즉시|중단/);
    });

    it('정상 → 빈 권고', () => {
      const r = evaluateRisk({ taskContext: baseTask, metrics: noEvents, budgetConfig: null });
      expect(r.suggestedAction).toBe('');
    });
  });

  describe('출력 스키마', () => {
    it('모든 호출에서 일관된 필드 반환', () => {
      const r = evaluateRisk({ taskContext: baseTask, metrics: noEvents, budgetConfig: null });
      expect(r).toMatchObject({
        shouldEscalate: expect.any(Boolean),
        severity: expect.any(String),
        reason: expect.any(String),
        suggestedAction: expect.any(String),
      });
    });

    it('RISK_SEVERITY 상수 노출', () => {
      expect(RISK_SEVERITY.INFO).toBeDefined();
      expect(RISK_SEVERITY.WARNING).toBeDefined();
      expect(RISK_SEVERITY.CRITICAL).toBeDefined();
    });

    it('SECURITY_EVENT_TYPES + REGRESSION_EVENT_TYPES 상수 노출', () => {
      expect(SECURITY_EVENT_TYPES).toBeInstanceOf(Array);
      expect(REGRESSION_EVENT_TYPES).toBeInstanceOf(Array);
      expect(SECURITY_EVENT_TYPES.length).toBeGreaterThan(0);
      expect(REGRESSION_EVENT_TYPES.length).toBeGreaterThan(0);
    });
  });

  describe('빈/잘못된 입력 안전 처리', () => {
    it('metrics 누락 → 안전 처리 (escalate 안 함)', () => {
      const r = evaluateRisk({ taskContext: baseTask, budgetConfig: null });
      expect(r.shouldEscalate).toBe(false);
    });

    it('전체 입력 누락', () => {
      expect(() => evaluateRisk({})).not.toThrow();
    });
  });
});
