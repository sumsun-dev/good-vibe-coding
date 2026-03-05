import { describe, it, expect } from 'vitest';
import {
  shouldEvolve,
  buildEvolutionFeedback,
  recordGeneration,
} from '../scripts/lib/engine/evolution-engine.js';

// --- shouldEvolve ---

describe('shouldEvolve', () => {
  it('점수 미달 + 세대 한도 내 + 개선폭 충분 → evolve: true', () => {
    const project = {
      generation: 1,
      evolutionHistory: [],
      qualityMetrics: { score: 60 },
    };
    const result = shouldEvolve(project);
    expect(result.evolve).toBe(true);
    expect(result.reason).toBeTruthy();
  });

  it('점수가 목표치 이상이면 evolve: false', () => {
    const project = {
      generation: 1,
      evolutionHistory: [],
      qualityMetrics: { score: 85 },
    };
    const result = shouldEvolve(project);
    expect(result.evolve).toBe(false);
    expect(result.reason).toContain('목표');
  });

  it('세대 한도 초과 시 evolve: false', () => {
    const project = {
      generation: 3,
      evolutionHistory: [
        { generation: 1, score: 50 },
        { generation: 2, score: 60 },
        { generation: 3, score: 70 },
      ],
      qualityMetrics: { score: 70 },
    };
    const result = shouldEvolve(project);
    expect(result.evolve).toBe(false);
    expect(result.reason).toContain('세대');
  });

  it('개선폭이 minImprovement 미만이면 evolve: false', () => {
    const project = {
      generation: 2,
      evolutionHistory: [
        { generation: 1, score: 50 },
        { generation: 2, score: 52 },
      ],
      qualityMetrics: { score: 52 },
    };
    const result = shouldEvolve(project);
    expect(result.evolve).toBe(false);
    expect(result.reason).toContain('개선');
  });

  it('첫 세대에서는 개선폭 조건을 무시한다', () => {
    const project = {
      generation: 1,
      evolutionHistory: [],
      qualityMetrics: { score: 60 },
    };
    const result = shouldEvolve(project);
    expect(result.evolve).toBe(true);
  });

  it('qualityMetrics가 없으면 evolve: false', () => {
    const project = { generation: 1, evolutionHistory: [] };
    const result = shouldEvolve(project);
    expect(result.evolve).toBe(false);
  });

  it('null project를 처리한다', () => {
    const result = shouldEvolve(null);
    expect(result.evolve).toBe(false);
  });
});

// --- buildEvolutionFeedback ---

describe('buildEvolutionFeedback', () => {
  it('Phase별 이슈를 역할별로 집계한다', () => {
    const project = {
      team: [
        { roleId: 'backend', displayName: 'Backend' },
        { roleId: 'frontend', displayName: 'Frontend' },
      ],
      tasks: [
        {
          assignee: 'backend',
          phase: 1,
          reviews: [
            {
              approved: false,
              issues: [{ severity: 'critical', description: 'SQL injection' }],
            },
          ],
        },
      ],
      executionState: {
        phaseResults: {
          1: {
            reviews: [
              {
                approved: false,
                issues: [{ severity: 'critical', description: 'SQL injection' }],
              },
            ],
          },
        },
      },
    };
    const qualityScore = { score: 60, phaseScores: { 1: 60 } };
    const feedback = buildEvolutionFeedback(project, qualityScore);

    expect(Array.isArray(feedback)).toBe(true);
    expect(feedback.length).toBeGreaterThan(0);
    expect(feedback[0].roleId).toBeTruthy();
    expect(feedback[0].feedback).toBeTruthy();
  });

  it('이슈가 없는 역할은 피드백을 생성하지 않는다', () => {
    const project = {
      team: [{ roleId: 'frontend', displayName: 'Frontend' }],
      tasks: [{ assignee: 'frontend', phase: 1, reviews: [{ approved: true, issues: [] }] }],
      executionState: {
        phaseResults: {
          1: { reviews: [{ approved: true, issues: [] }] },
        },
      },
    };
    const qualityScore = { score: 100, phaseScores: { 1: 100 } };
    const feedback = buildEvolutionFeedback(project, qualityScore);
    expect(feedback.length).toBe(0);
  });

  it('null project를 처리한다', () => {
    const feedback = buildEvolutionFeedback(null, { score: 0 });
    expect(feedback).toEqual([]);
  });
});

// --- recordGeneration ---

describe('recordGeneration', () => {
  it('evolutionHistory에 새 세대를 추가한다', () => {
    const project = {
      generation: 1,
      evolutionHistory: [],
    };
    const qualityScore = { score: 75, phaseScores: { 1: 75 } };
    const updated = recordGeneration(project, qualityScore);

    expect(updated.generation).toBe(2);
    expect(updated.evolutionHistory.length).toBe(1);
    expect(updated.evolutionHistory[0].generation).toBe(1);
    expect(updated.evolutionHistory[0].score).toBe(75);
  });

  it('기존 이력을 유지하면서 추가한다', () => {
    const project = {
      generation: 2,
      evolutionHistory: [{ generation: 1, score: 60 }],
    };
    const qualityScore = { score: 80, phaseScores: { 1: 80 } };
    const updated = recordGeneration(project, qualityScore);

    expect(updated.generation).toBe(3);
    expect(updated.evolutionHistory.length).toBe(2);
    expect(updated.evolutionHistory[1].generation).toBe(2);
    expect(updated.evolutionHistory[1].score).toBe(80);
  });

  it('원본 project를 변경하지 않는다 (불변)', () => {
    const project = {
      generation: 1,
      evolutionHistory: [],
      name: 'test',
    };
    const updated = recordGeneration(project, { score: 90 });
    expect(project.generation).toBe(1);
    expect(project.evolutionHistory.length).toBe(0);
    expect(updated.name).toBe('test');
  });
});
