/**
 * claude-panel-renderer 단위 테스트.
 * 이슈 #245 AC: 5개 작업 유형 렌더링, 진행 상태 표, 비용 opt-in, 위험 신호, 최근 이벤트, 안전 처리.
 */

import { describe, it, expect } from 'vitest';
import {
  renderPanel,
  STATE_MARKERS,
  EVENT_LIMIT_DEFAULT,
} from '../scripts/lib/output/claude-panel-renderer.js';

const baseInput = {
  taskType: 'code',
  currentState: 'executing',
  graphStates: [
    'pending',
    'analyzing-side-impact',
    'executing',
    'materializing',
    'reviewing',
    'done',
    'failed',
  ],
  costUsd: 0,
  tokens: 0,
  recentEvents: [],
  riskSignal: null,
};

describe('claude-panel-renderer', () => {
  describe('헤더', () => {
    it.each([
      ['code', 'pending'],
      ['plan', 'discussing'],
      ['research', 'researching'],
      ['review', 'fetching-diff'],
      ['ask', 'answering'],
    ])('%s/%s 작업 유형 헤더 출력', (taskType, currentState) => {
      const md = renderPanel({ ...baseInput, taskType, currentState });
      expect(md).toMatch(new RegExp(`##.*${taskType}`));
      expect(md).toContain(currentState);
    });
  });

  describe('진행 상태 표', () => {
    it('현재 상태에는 ⏳ 마커', () => {
      const md = renderPanel({ ...baseInput, currentState: 'executing' });
      expect(md).toMatch(new RegExp(`executing[^\\n]*${STATE_MARKERS.CURRENT}`));
    });

    it('현재 이전 상태에는 ✓ 마커', () => {
      const md = renderPanel({ ...baseInput, currentState: 'executing' });
      expect(md).toMatch(new RegExp(`pending[^\\n]*${STATE_MARKERS.DONE}`));
    });

    it('현재 이후 상태에는 ⏸ 마커', () => {
      const md = renderPanel({ ...baseInput, currentState: 'executing' });
      expect(md).toMatch(new RegExp(`reviewing[^\\n]*${STATE_MARKERS.PENDING}`));
    });

    it('terminal 상태(done/failed)는 표 끝에 — 마커', () => {
      const md = renderPanel({ ...baseInput, currentState: 'executing' });
      // done/failed는 terminal이므로 별도 처리
      expect(md).toMatch(
        new RegExp(`done[^\\n]*(${STATE_MARKERS.PENDING}|${STATE_MARKERS.TERMINAL})`),
      );
    });
  });

  describe('메트릭', () => {
    it('비용/토큰 항상 표시', () => {
      const md = renderPanel({ ...baseInput, costUsd: 0.42, tokens: 1234 });
      expect(md).toMatch(/0\.42/);
      expect(md).toMatch(/1[,]?234/);
    });

    it('budgetConfig 미설정 → 사용률 미표시 (opt-in)', () => {
      const md = renderPanel({ ...baseInput, costUsd: 5, tokens: 100, budgetConfig: null });
      expect(md).not.toMatch(/예산\s*\d+%/);
    });

    it('budgetConfig 설정 → 사용률 표시', () => {
      const md = renderPanel({
        ...baseInput,
        costUsd: 5,
        tokens: 0,
        budgetConfig: { maxCostUsd: 10 },
      });
      expect(md).toMatch(/예산\s*50%/);
    });
  });

  describe('위험 신호', () => {
    it('riskSignal null → 위험 섹션 없음', () => {
      const md = renderPanel({ ...baseInput, riskSignal: null });
      expect(md).not.toMatch(/위험|⚠️/);
    });

    it('riskSignal 있음 → severity, reason, suggestedAction 출력', () => {
      const md = renderPanel({
        ...baseInput,
        riskSignal: {
          severity: 'critical',
          reason: '보안 위반 감지: secret-leak',
          suggestedAction: '즉시 중단하고 보안 검토를 수행하세요',
        },
      });
      expect(md).toMatch(/CRITICAL/);
      expect(md).toMatch(/보안 위반/);
      expect(md).toMatch(/즉시 중단/);
    });

    it('warning 위험 신호도 표시 (escalate 안 해도)', () => {
      const md = renderPanel({
        ...baseInput,
        riskSignal: { severity: 'warning', reason: '예산 80% 도달', suggestedAction: '진행 가능' },
      });
      expect(md).toMatch(/WARNING/);
      expect(md).toMatch(/80%/);
    });
  });

  describe('최근 이벤트', () => {
    it('빈 배열 → 이벤트 섹션은 있지만 시간 형식 항목은 없음', () => {
      const md = renderPanel({ ...baseInput, recentEvents: [] });
      // 시간 형식(HH:MM:SS) 항목 라인 카운트
      const eventLines = md.split('\n').filter((l) => /^- \d{2}:\d{2}/.test(l));
      expect(eventLines.length).toBe(0);
      // "없습니다" 안내 또는 빈 섹션
      expect(md).toMatch(/없습니다|최근 이벤트/);
    });

    it('이벤트 5개 → 최근 N개로 제한 (기본 5)', () => {
      const events = Array.from({ length: 10 }, (_, i) => ({
        type: `event-${i}`,
        timestamp: new Date(2026, 0, 1, 14, i).toISOString(),
      }));
      const md = renderPanel({ ...baseInput, recentEvents: events });
      // 최근 5개만 등장
      expect(md).toContain('event-9');
      expect(md).toContain('event-5');
      expect(md).not.toContain('event-4');
    });

    it('limit 옵션으로 표시 개수 조정', () => {
      const events = Array.from({ length: 10 }, (_, i) => ({
        type: `event-${i}`,
        timestamp: new Date(2026, 0, 1, 14, i).toISOString(),
      }));
      const md = renderPanel({ ...baseInput, recentEvents: events, eventLimit: 3 });
      expect(md).toContain('event-9');
      expect(md).toContain('event-7');
      expect(md).not.toContain('event-6');
    });

    it('EVENT_LIMIT_DEFAULT 상수 노출', () => {
      expect(EVENT_LIMIT_DEFAULT).toBe(5);
    });
  });

  describe('안전 처리', () => {
    it('빈 입력 → 빈 문자열이 아닌 안전한 기본 panel 반환', () => {
      const md = renderPanel({});
      expect(typeof md).toBe('string');
      expect(md.length).toBeGreaterThan(0);
    });

    it('null 입력 → 안전 처리', () => {
      expect(() => renderPanel(null)).not.toThrow();
    });

    it('graphStates에 currentState가 없음 → 안전 처리 (terminal로 표시)', () => {
      const md = renderPanel({ ...baseInput, currentState: 'unknown-state' });
      expect(typeof md).toBe('string');
      expect(md.length).toBeGreaterThan(0);
    });

    it('costUsd가 음수/NaN → 0으로 표시', () => {
      const md = renderPanel({ ...baseInput, costUsd: -1 });
      expect(md).not.toMatch(/-1/);
      expect(md).toMatch(/0\.00|0 USD/);
    });
  });

  describe('STATE_MARKERS 상수', () => {
    it('마커 상수 노출', () => {
      expect(STATE_MARKERS.DONE).toBeDefined();
      expect(STATE_MARKERS.CURRENT).toBeDefined();
      expect(STATE_MARKERS.PENDING).toBeDefined();
      expect(STATE_MARKERS.TERMINAL).toBeDefined();
      expect(STATE_MARKERS.FAILED).toBeDefined();
    });
  });

  describe('terminal 상태 직접 진입', () => {
    it('currentState가 done → done 줄에 ✓ 마커', () => {
      const md = renderPanel({ ...baseInput, currentState: 'done' });
      expect(md).toMatch(new RegExp(`done[^\\n]*${STATE_MARKERS.DONE}`));
    });

    it('currentState가 failed → failed 줄에 ✗ 마커', () => {
      const md = renderPanel({ ...baseInput, currentState: 'failed' });
      expect(md).toMatch(new RegExp(`failed[^\\n]*${STATE_MARKERS.FAILED}`));
    });
  });

  describe('headingDepth 옵션', () => {
    it('기본 depth는 2 (## 헤더)', () => {
      const md = renderPanel(baseInput);
      expect(md).toMatch(/^## /m);
      expect(md).toMatch(/^### 진행/m);
    });

    it('headingDepth 3 → 헤더가 ### / ####', () => {
      const md = renderPanel({ ...baseInput, headingDepth: 3 });
      expect(md).toMatch(/^### /m);
      expect(md).toMatch(/^#### 진행/m);
    });

    it('범위 밖 값(0, 7) → 1과 6으로 클램프', () => {
      const md0 = renderPanel({ ...baseInput, headingDepth: 0 });
      expect(md0).toMatch(/^# /m);
      const md7 = renderPanel({ ...baseInput, headingDepth: 7 });
      expect(md7).toMatch(/^###### /m);
    });
  });

  describe('eventLimit 상한', () => {
    it('과도하게 큰 limit는 50으로 클램프', () => {
      const events = Array.from({ length: 200 }, (_, i) => ({
        type: `event-${i}`,
        timestamp: new Date(2026, 0, 1, 14, 0, i % 60).toISOString(),
      }));
      const md = renderPanel({ ...baseInput, recentEvents: events, eventLimit: 1000 });
      const eventLines = md.split('\n').filter((l) => /^- \d{2}:\d{2}/.test(l));
      expect(eventLines.length).toBeLessThanOrEqual(50);
    });
  });
});
