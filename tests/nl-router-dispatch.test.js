/**
 * dispatchInput — v2 단일 진입점 1차 디스패처 단위 테스트.
 * 이슈 #239 AC: status/resume/modify는 우선순위 유지, 그 외는 task로 위임.
 */

import { describe, it, expect } from 'vitest';
import { dispatchInput } from '../scripts/lib/core/nl-router.js';

describe('dispatchInput — v2 단일 진입점 1차 디스패처', () => {
  describe('우선순위 카테고리 (status/resume/modify)', () => {
    it.each([
      ['상태 보여줘', 'status'],
      ['어디까지 했어', 'status'],
      ['진행 상황', 'status'],
      ['status please', 'status'],
    ])('"%s" → status', (input, expected) => {
      expect(dispatchInput(input).category).toBe(expected);
    });

    it.each([
      ['이어서 해줘', 'resume'],
      ['계속하자', 'resume'],
      ['작업 재개', 'resume'],
      ['이전 프로젝트 이어서', 'resume'],
      ['하던 프로젝트 계속해줘', 'resume'],
      ['resume', 'resume'],
      ['continue project', 'resume'],
    ])('"%s" → resume', (input, expected) => {
      expect(dispatchInput(input).category).toBe(expected);
    });

    it.each([
      ['수정해줘', 'modify'],
      ['UI 변경해줘', 'modify'],
      ['이거 고쳐', 'modify'],
      ['개선해줘', 'modify'],
      ['modify project', 'modify'],
    ])('"%s" → modify', (input, expected) => {
      expect(dispatchInput(input).category).toBe(expected);
    });
  });

  describe('task 카테고리 위임 (그 외 모든 자연어)', () => {
    it('"이 PR 리뷰해줘" → task + taskRoute.taskType = review', () => {
      const result = dispatchInput('이 PR 리뷰해줘');
      expect(result.category).toBe('task');
      expect(result.taskRoute).toBeDefined();
      expect(result.taskRoute.taskType).toBe('review');
    });

    it('"마이크로서비스 SaaS 플랫폼 만들고 싶어" → task + plan', () => {
      const result = dispatchInput('마이크로서비스 SaaS 플랫폼 만들고 싶어');
      expect(result.category).toBe('task');
      expect(result.taskRoute.taskType).toBe('plan');
    });

    it('"BullMQ vs Temporal 비교해줘" → task + research', () => {
      const result = dispatchInput('BullMQ vs Temporal 비교해줘');
      expect(result.category).toBe('task');
      expect(result.taskRoute.taskType).toBe('research');
    });

    it('"이 코드베이스에서 인증은 어떻게 동작해?" → task + ask', () => {
      const result = dispatchInput('이 코드베이스에서 인증은 어떻게 동작해?');
      expect(result.category).toBe('task');
      expect(result.taskRoute.taskType).toBe('ask');
    });
  });

  describe('우선순위 충돌 — modify가 task code보다 우선', () => {
    // PRD §6.1: intent-gate(modify/resume/status)가 task-router보다 우선
    it('"결제 시스템 추가해줘" → modify ("추가" 키워드 매칭 — 컨텍스트로 호출자가 분기)', () => {
      // 이 입력은 새 프로젝트 코드 작업일 수도, 기존 프로젝트 수정일 수도 있음.
      // dispatchInput은 단순 패턴 매칭만 — 최종 결정은 호출자가 프로젝트 상태로 판단.
      // 패턴상 "추가해"는 modify의 트리거이므로 modify 카테고리 반환.
      const result = dispatchInput('결제 시스템 추가해줘');
      expect(result.category).toBe('modify');
    });
  });

  describe('빈/잘못된 입력', () => {
    it('빈 문자열 → task (taskRoute는 escalate)', () => {
      const result = dispatchInput('');
      expect(result.category).toBe('task');
      expect(result.taskRoute.escalateForConfirm).toBe(true);
    });

    it('null → task (taskRoute는 escalate)', () => {
      const result = dispatchInput(null);
      expect(result.category).toBe('task');
      expect(result.taskRoute.escalateForConfirm).toBe(true);
    });

    it('undefined → task (taskRoute는 escalate)', () => {
      const result = dispatchInput(undefined);
      expect(result.category).toBe('task');
      expect(result.taskRoute.escalateForConfirm).toBe(true);
    });
  });

  describe('컨텍스트 전달', () => {
    it('task 위임 시 정상 분류 결과 반환 (context는 task-router 내부에서 활용)', () => {
      const result = dispatchInput('새로운 마켓플레이스 만들고 싶어', { hasGitRepo: false });
      expect(result.category).toBe('task');
      expect(result.taskRoute).toBeDefined();
      expect(result.taskRoute.taskType).toBeDefined();
    });
  });
});

// 기존 resolveNaturalLanguage는 v1 호환을 위해 유지 — 회귀 테스트
describe('기존 resolveNaturalLanguage v1 호환 회귀', () => {
  it('기존 nl-router 테스트는 별도 파일에서 유지 — 여기선 import 가능 여부만', async () => {
    const mod = await import('../scripts/lib/core/nl-router.js');
    expect(typeof mod.resolveNaturalLanguage).toBe('function');
    expect(typeof mod.dispatchInput).toBe('function');
  });
});
