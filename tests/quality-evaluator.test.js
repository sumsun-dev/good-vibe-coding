import { describe, it, expect } from 'vitest';
import {
  calculatePhaseQuality,
  calculateOverallQuality,
  buildQualityDashboard,
} from '../scripts/lib/engine/quality-evaluator.js';

// --- calculatePhaseQuality ---

describe('calculatePhaseQuality', () => {
  it('이슈 없는 완벽한 Phase는 100점을 반환한다', () => {
    const phaseResult = {
      reviews: [{ approved: true, issues: [] }],
      qualityGate: { passed: true },
    };
    const result = calculatePhaseQuality(phaseResult);
    expect(result.score).toBe(100);
  });

  it('critical 이슈 1건은 20점 감점한다', () => {
    const phaseResult = {
      reviews: [{ approved: false, issues: [{ severity: 'critical', description: 'XSS' }] }],
      qualityGate: { passed: true },
    };
    const result = calculatePhaseQuality(phaseResult);
    expect(result.score).toBe(80);
    expect(result.metrics.criticalCount).toBe(1);
  });

  it('important 이슈 1건은 5점 감점한다', () => {
    const phaseResult = {
      reviews: [{ approved: false, issues: [{ severity: 'important', description: '에러 처리' }] }],
      qualityGate: { passed: true },
    };
    const result = calculatePhaseQuality(phaseResult);
    expect(result.score).toBe(95);
    expect(result.metrics.importantCount).toBe(1);
  });

  it('빌드 실패는 30점 감점한다', () => {
    const phaseResult = {
      reviews: [],
      qualityGate: { passed: false },
    };
    const result = calculatePhaseQuality(phaseResult);
    expect(result.score).toBe(70);
    expect(result.metrics.buildFailed).toBe(true);
  });

  it('수정 시도 횟수는 10점씩 감점한다', () => {
    const phaseResult = {
      reviews: [],
      qualityGate: { passed: true },
    };
    const result = calculatePhaseQuality(phaseResult, 2);
    expect(result.score).toBe(80);
    expect(result.metrics.fixAttempts).toBe(2);
  });

  it('복합 감점 시 최소 0점을 보장한다', () => {
    const phaseResult = {
      reviews: [
        {
          approved: false,
          issues: [
            { severity: 'critical', description: 'a' },
            { severity: 'critical', description: 'b' },
            { severity: 'critical', description: 'c' },
            { severity: 'critical', description: 'd' },
            { severity: 'critical', description: 'e' },
          ],
        },
      ],
      qualityGate: { passed: false },
    };
    const result = calculatePhaseQuality(phaseResult, 2);
    expect(result.score).toBe(0);
  });

  it('점수는 100을 초과하지 않는다', () => {
    const phaseResult = {
      reviews: [{ approved: true, issues: [] }],
      qualityGate: { passed: true },
    };
    const result = calculatePhaseQuality(phaseResult);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('null/빈 phaseResult를 처리한다', () => {
    expect(calculatePhaseQuality(null).score).toBe(100);
    expect(calculatePhaseQuality({}).score).toBe(100);
  });

  it('minor 이슈는 감점하지 않는다', () => {
    const phaseResult = {
      reviews: [{ approved: true, issues: [{ severity: 'minor', description: '스타일' }] }],
      qualityGate: { passed: true },
    };
    const result = calculatePhaseQuality(phaseResult);
    expect(result.score).toBe(100);
  });

  it('metrics에 카테고리별 이슈 수를 포함한다', () => {
    const phaseResult = {
      reviews: [
        {
          approved: false,
          issues: [
            { severity: 'critical', description: 'SQL injection 보안' },
            { severity: 'important', description: '테스트 커버리지' },
          ],
        },
      ],
      qualityGate: { passed: true },
    };
    const result = calculatePhaseQuality(phaseResult);
    expect(result.metrics.criticalCount).toBe(1);
    expect(result.metrics.importantCount).toBe(1);
  });
});

// --- calculateOverallQuality ---

describe('calculateOverallQuality', () => {
  it('단일 Phase 프로젝트의 전체 점수를 계산한다', () => {
    const project = {
      executionState: {
        phaseResults: {
          1: {
            reviews: [{ approved: true, issues: [] }],
            qualityGate: { passed: true },
          },
        },
        journal: [],
      },
    };
    const result = calculateOverallQuality(project);
    expect(result.score).toBe(100);
    expect(result.phaseScores).toEqual({ 1: 100 });
  });

  it('다중 Phase의 가중 평균을 계산한다 (첫 Phase 30%)', () => {
    const project = {
      executionState: {
        phaseResults: {
          1: {
            reviews: [
              {
                approved: false,
                issues: [{ severity: 'critical', description: 'a' }],
              },
            ],
            qualityGate: { passed: true },
          },
          2: {
            reviews: [{ approved: true, issues: [] }],
            qualityGate: { passed: true },
          },
        },
        journal: [],
      },
    };
    const result = calculateOverallQuality(project);
    // Phase 1: 80, Phase 2: 100
    // 가중: 80*0.3 + 100*0.7 = 24 + 70 = 94
    expect(result.score).toBe(94);
    expect(result.phaseScores[1]).toBe(80);
    expect(result.phaseScores[2]).toBe(100);
  });

  it('3개 Phase의 가중 평균을 계산한다', () => {
    const project = {
      executionState: {
        phaseResults: {
          1: { reviews: [], qualityGate: { passed: true } },
          2: { reviews: [], qualityGate: { passed: true } },
          3: { reviews: [], qualityGate: { passed: true } },
        },
        journal: [],
      },
    };
    const result = calculateOverallQuality(project);
    // 모두 100점 → 가중합 = 100
    expect(result.score).toBe(100);
  });

  it('트렌드를 계산한다 (improving)', () => {
    const project = {
      evolutionHistory: [{ generation: 1, score: 60 }],
      executionState: {
        phaseResults: {
          1: { reviews: [], qualityGate: { passed: true } },
        },
        journal: [],
      },
    };
    const result = calculateOverallQuality(project);
    expect(result.trend).toBe('improving');
    expect(result.improvement).toBe(40);
  });

  it('트렌드를 계산한다 (declining)', () => {
    const project = {
      evolutionHistory: [{ generation: 1, score: 100 }],
      executionState: {
        phaseResults: {
          1: {
            reviews: [
              {
                approved: false,
                issues: [{ severity: 'critical', description: 'a' }],
              },
            ],
            qualityGate: { passed: true },
          },
        },
        journal: [],
      },
    };
    const result = calculateOverallQuality(project);
    expect(result.trend).toBe('declining');
  });

  it('트렌드를 계산한다 (stable)', () => {
    const project = {
      evolutionHistory: [{ generation: 1, score: 100 }],
      executionState: {
        phaseResults: {
          1: { reviews: [], qualityGate: { passed: true } },
        },
        journal: [],
      },
    };
    const result = calculateOverallQuality(project);
    expect(result.trend).toBe('stable');
  });

  it('evolutionHistory가 없으면 트렌드는 null이다', () => {
    const project = {
      executionState: {
        phaseResults: {
          1: { reviews: [], qualityGate: { passed: true } },
        },
        journal: [],
      },
    };
    const result = calculateOverallQuality(project);
    expect(result.trend).toBeNull();
  });

  it('executionState가 없으면 기본값을 반환한다', () => {
    const result = calculateOverallQuality({});
    expect(result.score).toBe(0);
    expect(result.phaseScores).toEqual({});
  });

  it('fixAttempts를 journal에서 추출한다', () => {
    const project = {
      executionState: {
        phaseResults: {
          1: { reviews: [], qualityGate: { passed: true } },
        },
        journal: [
          { phase: 1, action: 'fix', fixAttempt: 1 },
          { phase: 1, action: 'fix', fixAttempt: 2 },
        ],
      },
    };
    const result = calculateOverallQuality(project);
    // 100 - (2 × 10) = 80
    expect(result.score).toBe(80);
  });
});

// --- buildQualityDashboard ---

describe('buildQualityDashboard', () => {
  it('마크다운 대시보드를 생성한다', () => {
    const project = {
      executionState: {
        phaseResults: {
          1: { reviews: [], qualityGate: { passed: true } },
        },
        journal: [],
      },
    };
    const dashboard = buildQualityDashboard(project);
    expect(dashboard).toContain('품질 점수');
    expect(dashboard).toContain('100');
  });

  it('세대별 추이를 표시한다', () => {
    const project = {
      evolutionHistory: [
        { generation: 1, score: 60 },
        { generation: 2, score: 75 },
      ],
      executionState: {
        phaseResults: {
          1: { reviews: [], qualityGate: { passed: true } },
        },
        journal: [],
      },
    };
    const dashboard = buildQualityDashboard(project);
    expect(dashboard).toContain('세대별');
    expect(dashboard).toContain('60');
    expect(dashboard).toContain('75');
  });

  it('Phase별 점수를 표시한다', () => {
    const project = {
      executionState: {
        phaseResults: {
          1: { reviews: [], qualityGate: { passed: true } },
          2: { reviews: [], qualityGate: { passed: true } },
        },
        journal: [],
      },
    };
    const dashboard = buildQualityDashboard(project);
    expect(dashboard).toContain('Phase 1');
    expect(dashboard).toContain('Phase 2');
  });

  it('executionState가 없으면 안내 메시지를 표시한다', () => {
    const dashboard = buildQualityDashboard({});
    expect(dashboard).toContain('품질 데이터가 없습니다');
  });

  it('트렌드 화살표를 표시한다', () => {
    const project = {
      evolutionHistory: [{ generation: 1, score: 70 }],
      executionState: {
        phaseResults: {
          1: { reviews: [], qualityGate: { passed: true } },
        },
        journal: [],
      },
    };
    const dashboard = buildQualityDashboard(project);
    // improving이면 화살표 포함
    expect(dashboard).toMatch(/[⬆↑+]/);
  });
});
