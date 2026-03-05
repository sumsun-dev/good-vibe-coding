import { describe, it, expect } from 'vitest';
import {
  formatPhaseStart,
  formatPhaseComplete,
  formatTaskProgress,
  formatReviewProgress,
  formatQualityGateResult,
  formatProgressBar,
  estimateRemainingTime,
  formatExecutionDashboard,
} from '../scripts/lib/output/progress-formatter.js';

// --- formatPhaseStart ---

describe('formatPhaseStart', () => {
  it('Phase 번호와 총 Phase 수를 표시한다', () => {
    const result = formatPhaseStart(1, 3, [{ title: 'API 구현', assignee: 'backend' }]);
    expect(result).toContain('Phase 1/3');
  });

  it('태스크 수를 표시한다', () => {
    const tasks = [
      { title: 'API 구현', assignee: 'backend' },
      { title: 'UI 개발', assignee: 'frontend' },
      { title: '테스트', assignee: 'qa' },
    ];
    const result = formatPhaseStart(1, 3, tasks);
    expect(result).toContain('3');
  });

  it('담당자 역할을 표시한다', () => {
    const tasks = [
      { title: 'API 구현', assignee: 'backend' },
      { title: 'UI 개발', assignee: 'frontend' },
    ];
    const result = formatPhaseStart(1, 2, tasks);
    expect(result).toContain('backend');
    expect(result).toContain('frontend');
  });
});

// --- formatPhaseComplete ---

describe('formatPhaseComplete', () => {
  it('완료된 Phase 번호를 표시한다', () => {
    const result = formatPhaseComplete(1, 3, {
      taskCount: 3,
      reviewCount: 6,
      criticalCount: 0,
      passed: true,
    });
    expect(result).toContain('Phase 1/3');
  });

  it('태스크 수와 리뷰 수를 표시한다', () => {
    const result = formatPhaseComplete(1, 3, {
      taskCount: 3,
      reviewCount: 6,
      criticalCount: 0,
      passed: true,
    });
    expect(result).toContain('3');
    expect(result).toContain('6');
  });

  it('critical 이슈 수를 표시한다', () => {
    const result = formatPhaseComplete(2, 3, {
      taskCount: 2,
      reviewCount: 4,
      criticalCount: 2,
      passed: false,
    });
    expect(result).toContain('2');
  });

  it('PASS/FAIL 상태를 표시한다', () => {
    const passed = formatPhaseComplete(1, 3, {
      taskCount: 3,
      reviewCount: 6,
      criticalCount: 0,
      passed: true,
    });
    expect(passed).toContain('PASS');

    const failed = formatPhaseComplete(1, 3, {
      taskCount: 3,
      reviewCount: 6,
      criticalCount: 1,
      passed: false,
    });
    expect(failed).toContain('FAIL');
  });
});

// --- formatTaskProgress ---

describe('formatTaskProgress', () => {
  it('완료/미완료 태스크를 구분한다', () => {
    const tasks = [
      { id: 't1', title: 'API 구현', assignee: 'backend' },
      { id: 't2', title: 'UI 개발', assignee: 'frontend' },
      { id: 't3', title: '테스트', assignee: 'qa' },
    ];
    const result = formatTaskProgress(tasks, ['t1']);
    expect(result).toContain('API 구현');
    expect(result).toContain('UI 개발');
  });

  it('완료 카운트를 표시한다', () => {
    const tasks = [
      { id: 't1', title: 'API 구현', assignee: 'backend' },
      { id: 't2', title: 'UI 개발', assignee: 'frontend' },
    ];
    const result = formatTaskProgress(tasks, ['t1']);
    expect(result).toContain('1/2');
  });

  it('빈 태스크 배열을 처리한다', () => {
    const result = formatTaskProgress([], []);
    expect(result).toContain('0/0');
  });
});

// --- formatReviewProgress ---

describe('formatReviewProgress', () => {
  it('완료/진행 중 리뷰어를 구분한다', () => {
    const result = formatReviewProgress(['qa', 'security', 'cto'], ['qa']);
    expect(result).toContain('qa');
    expect(result).toContain('security');
  });

  it('완료 카운트를 표시한다', () => {
    const result = formatReviewProgress(['qa', 'security'], ['qa']);
    expect(result).toContain('1/2');
  });

  it('빈 배열을 처리한다', () => {
    const result = formatReviewProgress([], []);
    expect(result).toContain('0/0');
  });
});

// --- formatQualityGateResult ---

describe('formatQualityGateResult', () => {
  it('통과 시 통과 메시지를 표시한다', () => {
    const result = formatQualityGateResult({ passed: true, criticalCount: 0 });
    expect(result).toMatch(/통과|PASS/);
  });

  it('실패 시 실패 메시지와 critical 수를 표시한다', () => {
    const result = formatQualityGateResult({ passed: false, criticalCount: 2, fixProgress: '1/2' });
    expect(result).toMatch(/실패|FAIL/);
    expect(result).toContain('2');
  });

  it('수정 진행률을 표시한다', () => {
    const result = formatQualityGateResult({ passed: false, criticalCount: 2, fixProgress: '1/2' });
    expect(result).toContain('1/2');
  });
});

// --- formatProgressBar ---

describe('formatProgressBar', () => {
  it('퍼센트를 표시한다', () => {
    const result = formatProgressBar(2, 4, 'review');
    expect(result).toMatch(/\d+%/);
  });

  it('진행률 바를 포함한다', () => {
    const result = formatProgressBar(1, 3, 'execute-tasks');
    expect(result).toMatch(/[█░]/);
  });

  it('Phase 라벨을 표시한다', () => {
    const result = formatProgressBar(2, 4, 'review');
    expect(result).toContain('Phase 2/4');
  });

  it('경계값 (첫 Phase, 마지막 Phase)을 처리한다', () => {
    const first = formatProgressBar(1, 5, 'execute-tasks');
    expect(first).toContain('Phase 1/5');

    const last = formatProgressBar(5, 5, 'quality-gate');
    expect(last).toContain('Phase 5/5');
  });
});

// --- estimateRemainingTime ---

describe('estimateRemainingTime', () => {
  it('빈 journal → null 반환', () => {
    const result = estimateRemainingTime([], 1, 3);
    expect(result).toBeNull();
  });

  it('completedPhases 0 → null 반환', () => {
    const journal = [{ action: 'execute-tasks', timestamp: Date.now() }];
    const result = estimateRemainingTime(journal, 1, 3);
    expect(result).toBeNull();
  });

  it('completedPhases 1 → confidence low', () => {
    const now = Date.now();
    const journal = [
      { action: 'execute-tasks', timestamp: now - 600000, phase: 1 },
      { action: 'build-context', timestamp: now, phase: 1 },
    ];
    const result = estimateRemainingTime(journal, 2, 3);
    expect(result).not.toBeNull();
    expect(result.confidence).toBe('low');
    expect(result.estimatedMinutes).toBeGreaterThan(0);
  });

  it('completedPhases 2+ → confidence medium', () => {
    const now = Date.now();
    const journal = [
      { action: 'execute-tasks', timestamp: now - 1200000, phase: 1 },
      { action: 'build-context', timestamp: now - 600000, phase: 1 },
      { action: 'execute-tasks', timestamp: now - 600000, phase: 2 },
      { action: 'build-context', timestamp: now, phase: 2 },
    ];
    const result = estimateRemainingTime(journal, 3, 4);
    expect(result).not.toBeNull();
    expect(result.confidence).toBe('medium');
  });

  it('평균 계산이 올바르다', () => {
    const now = Date.now();
    // Phase 1: 10분, Phase 2: 10분
    const journal = [
      { action: 'execute-tasks', timestamp: now - 1200000, phase: 1 },
      { action: 'build-context', timestamp: now - 600000, phase: 1 },
      { action: 'execute-tasks', timestamp: now - 600000, phase: 2 },
      { action: 'build-context', timestamp: now, phase: 2 },
    ];
    const result = estimateRemainingTime(journal, 3, 4);
    // remaining 2 phases × 10 min = 20 min
    expect(result.estimatedMinutes).toBeCloseTo(20, 0);
  });

  it('마지막 Phase → remaining 1', () => {
    const now = Date.now();
    const journal = [
      { action: 'execute-tasks', timestamp: now - 600000, phase: 1 },
      { action: 'build-context', timestamp: now, phase: 1 },
    ];
    const result = estimateRemainingTime(journal, 2, 2);
    expect(result.estimatedMinutes).toBeGreaterThan(0);
  });

  it('basedOnPhases를 반환한다', () => {
    const now = Date.now();
    const journal = [
      { action: 'execute-tasks', timestamp: now - 600000, phase: 1 },
      { action: 'build-context', timestamp: now, phase: 1 },
    ];
    const result = estimateRemainingTime(journal, 2, 3);
    expect(result.basedOnPhases).toBe(1);
  });

  it('journal에 build-context가 없으면 null 반환', () => {
    const journal = [
      { action: 'execute-tasks', timestamp: Date.now(), phase: 1 },
      { action: 'review', timestamp: Date.now(), phase: 1 },
    ];
    const result = estimateRemainingTime(journal, 2, 3);
    expect(result).toBeNull();
  });
});

// --- formatExecutionDashboard ---

describe('formatExecutionDashboard', () => {
  it('대기 중 상태를 표시한다', () => {
    const project = {
      executionState: null,
      tasks: [{ id: 't1', title: 'API', phase: 1 }],
    };
    const result = formatExecutionDashboard(project);
    expect(result).toMatch(/대기|시작 전/);
  });

  it('진행 중 상태를 표시한다', () => {
    const project = {
      executionState: {
        currentPhase: 2,
        totalPhases: 3,
        currentAction: 'execute-tasks',
        journal: [],
      },
      tasks: [
        { id: 't1', title: 'API', phase: 1 },
        { id: 't2', title: 'UI', phase: 2 },
      ],
    };
    const result = formatExecutionDashboard(project);
    expect(result).toContain('Phase 2/3');
  });

  it('phaseResults가 있으면 포함한다', () => {
    const project = {
      executionState: {
        currentPhase: 2,
        totalPhases: 3,
        currentAction: 'execute-tasks',
        journal: [],
        phaseResults: [{ phase: 1, taskCount: 3, passed: true }],
      },
      tasks: [{ id: 't1', title: 'API', phase: 1 }],
    };
    const result = formatExecutionDashboard(project);
    expect(result).toContain('Phase');
  });
});
