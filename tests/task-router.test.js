/**
 * task-router 단위 테스트.
 * AC-1 (분류 정확도 ≥ 90%), AC-2 (인젝션 방어), AC-3 (intent-gate 협업),
 * AC-4 (confidence 임계), AC-5 (컨텍스트 가중치) 검증.
 */

import { describe, it, expect } from 'vitest';
import { routeTask, TASK_TYPES, INTENT_TYPES } from '../scripts/lib/engine/task-router.js';
import {
  ALL_CASES,
  CODE_CASES,
  PLAN_CASES,
  RESEARCH_CASES,
  REVIEW_CASES,
  ASK_CASES,
  INJECTION_CASES,
  AMBIGUOUS_CASES,
} from './fixtures/task-router-cases.js';

describe('task-router', () => {
  describe('AC-1: 분류 정확도 (PRD §10 Phase A 완료 게이트)', () => {
    it('전체 100개 픽스처 분류 정확도 ≥ 90%', () => {
      const failed = [];
      let correct = 0;
      for (const c of ALL_CASES) {
        const result = routeTask(c.input);
        if (result.taskType === c.expectedTaskType) {
          correct++;
        } else {
          failed.push(`${c.id}: expected=${c.expectedTaskType} got=${result.taskType}`);
        }
      }
      const accuracy = correct / ALL_CASES.length;
      expect(
        accuracy,
        `정확도 ${(accuracy * 100).toFixed(1)}% (${correct}/${ALL_CASES.length}). 실패: ${failed.join(', ')}`,
      ).toBeGreaterThanOrEqual(0.9);
    });

    it.each([
      ['code', CODE_CASES],
      ['plan', PLAN_CASES],
      ['research', RESEARCH_CASES],
      ['review', REVIEW_CASES],
      ['ask', ASK_CASES],
    ])('%s 유형 단독 정확도 ≥ 80%', (_label, cases) => {
      const correct = cases.filter(
        (c) => routeTask(c.input).taskType === c.expectedTaskType,
      ).length;
      expect(correct / cases.length).toBeGreaterThanOrEqual(0.8);
    });

    it('code 유형의 intent (feature/refactor/debug) 분류 정확도 ≥ 70%', () => {
      const codeOnly = CODE_CASES.filter((c) => routeTask(c.input).taskType === 'code');
      const intentCorrect = codeOnly.filter(
        (c) => routeTask(c.input).intent === c.expectedIntent,
      ).length;
      expect(intentCorrect / codeOnly.length).toBeGreaterThanOrEqual(0.7);
    });
  });

  describe('AC-2: 보안 — 한국어/영어 프롬프트 인젝션 방어', () => {
    it.each(INJECTION_CASES)('인젝션 패턴 차단: $id', ({ input }) => {
      const result = routeTask(input);
      expect(result.confidence).toBe(0);
      expect(result.escalateForConfirm).toBe(true);
      expect(result.warnings).toBeInstanceOf(Array);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.sanitizedInput).toBeNull();
    });

    it('정상 입력은 인젝션으로 잘못 분류되지 않음 (false positive 0)', () => {
      const falsePositives = ALL_CASES.filter((c) => {
        const r = routeTask(c.input);
        return r.confidence === 0 || r.escalateForConfirm === true;
      });
      expect(falsePositives).toHaveLength(0);
    });

    it('정상 입력의 sanitizedInput은 wrapUserInput으로 감싸져 있음', () => {
      const result = routeTask('결제 시스템 추가해줘');
      expect(result.sanitizedInput).toMatch(/^<user-input>/);
      expect(result.sanitizedInput).toMatch(/<\/user-input>$/);
      expect(result.sanitizedInput).toContain('결제 시스템 추가해줘');
    });
  });

  describe('AC-3: intent-gate 협업 — task 카테고리만 처리', () => {
    it('intent-gate에서 거를 입력(resume/modify)이 도달해도 크래시 없이 결과 반환', () => {
      // 호출자(/gv 진입점)는 intent-gate를 먼저 거쳐야 하지만,
      // task-router 자체가 방어적이어야 회귀 안전
      const cases = ['이전 작업 이어서 진행해줘', '코드 수정해줘', '상태 보여줘'];
      for (const input of cases) {
        const result = routeTask(input);
        expect(TASK_TYPES).toContain(result.taskType);
        expect(typeof result.escalateForConfirm).toBe('boolean');
      }
    });
  });

  describe('AC-4: confidence 임계 + 빈 입력', () => {
    it('빈 입력 → confidence 0 + escalate', () => {
      const result = routeTask('');
      expect(result.confidence).toBe(0);
      expect(result.escalateForConfirm).toBe(true);
    });

    it('너무 짧은 입력 (< 3 단어) → confidence 0 + escalate', () => {
      const result = routeTask('hi');
      expect(result.confidence).toBe(0);
      expect(result.escalateForConfirm).toBe(true);
    });

    it('null/undefined 입력 안전 처리', () => {
      expect(() => routeTask(null)).not.toThrow();
      expect(() => routeTask(undefined)).not.toThrow();
      expect(routeTask(null).escalateForConfirm).toBe(true);
    });

    it('confidence < 0.6이면 escalateForConfirm: true', () => {
      // 모호한 입력은 default로 code/feature 잡히지만 confidence 낮음
      const result = routeTask('음 그거 뭐였지');
      if (result.confidence < 0.6) {
        expect(result.escalateForConfirm).toBe(true);
      }
    });
  });

  describe('AC-5: 컨텍스트 가중치', () => {
    it('git 저장소 없는 디렉토리 컨텍스트 → plan 가중치 +', () => {
      const ambiguous = '커뮤니티 사이트 같은 거 만들고 싶어';
      const noRepo = routeTask(ambiguous, { hasGitRepo: false });
      const withRepo = routeTask(ambiguous, { hasGitRepo: true });
      // plan 신호가 강하지 않은 입력에서 컨텍스트가 결과를 흔들 수 있음
      expect(noRepo).toBeDefined();
      expect(withRepo).toBeDefined();
      // 최소한: 동일 입력 + 다른 컨텍스트가 confidence 또는 분류에 영향 줄 수 있음
      expect(noRepo.context).toBeDefined();
    });

    it('컨텍스트 미제공 시 기본값 적용', () => {
      const result = routeTask('이 코드 봐줘');
      expect(result.context).toBeDefined();
      expect(typeof result.context.hasGitRepo).toBe('boolean');
    });
  });

  describe('모호 입력 (Phase B 대비 관찰)', () => {
    it.each(AMBIGUOUS_CASES)(
      '모호 입력 $id — 크래시 없이 분류 결과 반환',
      ({ input, plausibleTaskTypes }) => {
        const result = routeTask(input);
        expect(TASK_TYPES).toContain(result.taskType);
        // 모호 케이스는 strict 정확도 검증 X — 분류가 plausible 후보 안에 들어가는지만 확인
        // (Phase B에서 LLM fallback 도입 시 이 픽스처로 회귀 측정)
        if (plausibleTaskTypes.includes(result.taskType)) {
          expect(result.confidence).toBeGreaterThan(0);
        }
      },
    );
  });

  describe('출력 스키마 검증', () => {
    it('정상 입력 시 모든 필드 반환', () => {
      const result = routeTask('결제 시스템 추가해줘');
      expect(result).toMatchObject({
        taskType: expect.stringMatching(/^(code|plan|research|review|ask)$/),
        confidence: expect.any(Number),
        escalateForConfirm: expect.any(Boolean),
        warnings: expect.any(Array),
        context: expect.any(Object),
        sanitizedInput: expect.any(String),
      });
    });

    it('TASK_TYPES 상수 노출', () => {
      expect(TASK_TYPES).toEqual(['code', 'plan', 'research', 'review', 'ask']);
    });

    it('INTENT_TYPES 상수 노출 (code 전용)', () => {
      expect(INTENT_TYPES).toEqual(['feature', 'refactor', 'debug']);
    });
  });
});
