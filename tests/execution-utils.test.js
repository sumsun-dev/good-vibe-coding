import { describe, it, expect } from 'vitest';
import {
  getCategoryLabel,
  FAILURE_CATEGORY_LABELS,
  getTotalPhases,
  getTasksForPhase,
  getExecutionSummary,
  isStaleExecution,
} from '../scripts/lib/engine/execution-utils.js';

describe('getCategoryLabel', () => {
  it('7개 카테고리 모두 한국어 라벨을 반환한다', () => {
    expect(getCategoryLabel('security')).toBe('보안 문제');
    expect(getCategoryLabel('build')).toBe('빌드 오류');
    expect(getCategoryLabel('test')).toBe('테스트 실패');
    expect(getCategoryLabel('performance')).toBe('성능 문제');
    expect(getCategoryLabel('type')).toBe('타입 오류');
    expect(getCategoryLabel('architecture')).toBe('구조 문제');
    expect(getCategoryLabel('logic')).toBe('로직 오류');
  });

  it('미정의 카테고리는 원본 문자열을 반환한다', () => {
    expect(getCategoryLabel('unknown-category')).toBe('unknown-category');
    expect(getCategoryLabel('')).toBe('');
  });

  it('FAILURE_CATEGORY_LABELS와 일치한다', () => {
    for (const [key, label] of Object.entries(FAILURE_CATEGORY_LABELS)) {
      expect(getCategoryLabel(key)).toBe(label);
    }
  });
});

describe('getTotalPhases', () => {
  it('tasks에서 고유 phase 수를 계산한다', () => {
    const project = {
      tasks: [
        { id: 't1', phase: 1 },
        { id: 't2', phase: 1 },
        { id: 't3', phase: 2 },
        { id: 't4', phase: 3 },
      ],
    };
    expect(getTotalPhases(project)).toBe(3);
  });

  it('빈 tasks 배열이면 1을 반환한다', () => {
    expect(getTotalPhases({ tasks: [] })).toBe(1);
  });

  it('tasks가 없으면 1을 반환한다', () => {
    expect(getTotalPhases({})).toBe(1);
  });

  it('phase가 없는 태스크는 무시한다', () => {
    const project = {
      tasks: [
        { id: 't1', phase: 1 },
        { id: 't2' }, // phase 없음
        { id: 't3', phase: 2 },
      ],
    };
    expect(getTotalPhases(project)).toBe(2);
  });

  it('모든 태스크에 phase가 없으면 1을 반환한다', () => {
    const project = {
      tasks: [{ id: 't1' }, { id: 't2' }],
    };
    expect(getTotalPhases(project)).toBe(1);
  });
});

describe('getTasksForPhase', () => {
  const project = {
    tasks: [
      { id: 't1', phase: 1, title: 'A' },
      { id: 't2', phase: 2, title: 'B' },
      { id: 't3', phase: 1, title: 'C' },
      { id: 't4', title: 'D' }, // phase 미지정
    ],
  };

  it('지정된 phase의 태스크만 반환한다', () => {
    const result = getTasksForPhase(project, 1);
    expect(result).toHaveLength(3); // t1, t3, t4 (phase 미지정은 기본값 1)
    expect(result.map((t) => t.id)).toContain('t1');
    expect(result.map((t) => t.id)).toContain('t3');
  });

  it('phase 2 태스크를 반환한다', () => {
    const result = getTasksForPhase(project, 2);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('t2');
  });

  it('해당 phase에 태스크가 없으면 빈 배열을 반환한다', () => {
    expect(getTasksForPhase(project, 99)).toEqual([]);
  });

  it('phase 미지정 태스크는 phase 1로 기본 매핑된다', () => {
    const result = getTasksForPhase(project, 1);
    expect(result.map((t) => t.id)).toContain('t4');
  });

  it('tasks가 없으면 빈 배열을 반환한다', () => {
    expect(getTasksForPhase({}, 1)).toEqual([]);
  });
});

describe('getExecutionSummary', () => {
  it('executionState가 없으면 idle 상태를 반환한다', () => {
    const result = getExecutionSummary({ tasks: [] });
    expect(result.status).toBe('idle');
    expect(result.currentPhase).toBe(0);
    expect(result.percentage).toBe(0);
    expect(result.display).toBe('실행 대기 중');
    expect(result.nextActions).toEqual(['good-vibe:execute (실행 시작)']);
  });

  it('executing 상태를 표시한다', () => {
    const project = {
      tasks: [
        { id: 't1', phase: 1 },
        { id: 't2', phase: 2 },
      ],
      executionState: {
        status: 'executing',
        currentPhase: 1,
        phaseStep: 'execute-tasks',
        completedPhases: [],
      },
    };
    const result = getExecutionSummary(project);
    expect(result.status).toBe('executing');
    expect(result.currentPhase).toBe(1);
    expect(result.totalPhases).toBe(2);
    expect(result.percentage).toBe(0);
    expect(result.display).toContain('Phase 1/2');
    expect(result.display).toContain('팀 작업 수행');
    expect(result.nextActions).toBeUndefined();
  });

  it('completed 상태는 100%를 반환한다', () => {
    const project = {
      tasks: [{ id: 't1', phase: 1 }],
      executionState: {
        status: 'completed',
        currentPhase: 1,
        phaseStep: 'build-context',
        completedPhases: [1],
      },
    };
    const result = getExecutionSummary(project);
    expect(result.status).toBe('completed');
    expect(result.percentage).toBe(100);
    expect(result.display).toContain('전체 완료');
    expect(result.nextActions).toEqual([
      'good-vibe:report (보고서 확인)',
      'good-vibe:feedback (팀 성과 분석)',
      'good-vibe:modify (기능 추가/수정)',
    ]);
  });

  it('escalated 상태를 표시한다', () => {
    const project = {
      tasks: [
        { id: 't1', phase: 1 },
        { id: 't2', phase: 2 },
      ],
      executionState: {
        status: 'escalated',
        currentPhase: 1,
        phaseStep: 'quality-gate',
        completedPhases: [],
      },
    };
    const result = getExecutionSummary(project);
    expect(result.status).toBe('escalated');
    expect(result.display).toContain('CEO 결정 대기');
    expect(result.nextActions).toEqual(['good-vibe:execute (에스컬레이션 응답)']);
  });

  it('paused 상태를 표시한다', () => {
    const project = {
      tasks: [{ id: 't1', phase: 1 }],
      executionState: {
        status: 'paused',
        currentPhase: 1,
        phaseStep: 'execute-tasks',
        completedPhases: [],
      },
    };
    const result = getExecutionSummary(project);
    expect(result.status).toBe('paused');
    expect(result.display).toContain('일시 중지');
    expect(result.nextActions).toEqual([
      'good-vibe:execute (중단 지점부터 재개)',
      'good-vibe:discuss --reset (기획 재검토)',
      'good-vibe:status (상세 상태 확인)',
    ]);
  });

  it('phaseStep 한국어 매핑이 정확하다', () => {
    const steps = {
      'execute-tasks': '팀 작업 수행',
      materialize: '코드 파일 생성',
      review: '팀 검토',
      'quality-gate': '품질 검증',
      fix: '수정',
      commit: '저장',
      'build-context': '다음 단계 준비',
    };
    for (const [step, label] of Object.entries(steps)) {
      const project = {
        tasks: [{ id: 't1', phase: 1 }],
        executionState: {
          status: 'executing',
          currentPhase: 1,
          phaseStep: step,
          completedPhases: [],
        },
      };
      const result = getExecutionSummary(project);
      expect(result.display).toContain(label);
    }
  });
});

describe('isStaleExecution', () => {
  const ONE_HOUR = 60 * 60 * 1000;

  it('state가 null이면 stale이다', () => {
    expect(isStaleExecution(null, ONE_HOUR)).toBe(true);
  });

  it('state가 undefined이면 stale이다', () => {
    expect(isStaleExecution(undefined, ONE_HOUR)).toBe(true);
  });

  it('저널이 비어있고 startedAt이 없으면 stale이다', () => {
    expect(isStaleExecution({ journal: [] }, ONE_HOUR)).toBe(true);
  });

  it('저널이 비어있으면 startedAt 기준으로 판정한다 (최근)', () => {
    const state = {
      journal: [],
      startedAt: new Date().toISOString(),
    };
    expect(isStaleExecution(state, ONE_HOUR)).toBe(false);
  });

  it('저널이 비어있으면 startedAt 기준으로 판정한다 (오래됨)', () => {
    const state = {
      journal: [],
      startedAt: new Date(Date.now() - 2 * ONE_HOUR).toISOString(),
    };
    expect(isStaleExecution(state, ONE_HOUR)).toBe(true);
  });

  it('저널의 마지막 엔트리 기준으로 판정한다 (최근)', () => {
    const state = {
      journal: [{ timestamp: new Date().toISOString(), action: 'execute-tasks' }],
    };
    expect(isStaleExecution(state, ONE_HOUR)).toBe(false);
  });

  it('저널의 마지막 엔트리 기준으로 판정한다 (오래됨)', () => {
    const state = {
      journal: [
        { timestamp: new Date(Date.now() - 3 * ONE_HOUR).toISOString(), action: 'execute-tasks' },
      ],
    };
    expect(isStaleExecution(state, ONE_HOUR)).toBe(true);
  });

  it('NaN 타임스탬프면 stale이다', () => {
    const state = {
      journal: [{ timestamp: 'invalid-date', action: 'test' }],
    };
    expect(isStaleExecution(state, ONE_HOUR)).toBe(true);
  });

  it('startedAt이 NaN이면 stale이다', () => {
    const state = {
      journal: [],
      startedAt: 'not-a-date',
    };
    expect(isStaleExecution(state, ONE_HOUR)).toBe(true);
  });

  it('여러 저널 엔트리 중 마지막만 확인한다', () => {
    const state = {
      journal: [
        { timestamp: new Date(Date.now() - 3 * ONE_HOUR).toISOString(), action: 'old' },
        { timestamp: new Date().toISOString(), action: 'recent' },
      ],
    };
    expect(isStaleExecution(state, ONE_HOUR)).toBe(false);
  });
});
