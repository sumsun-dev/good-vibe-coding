import { describe, it, expect } from 'vitest';
import {
  buildAcceptanceCriteriaPrompt,
  parseAcceptanceCriteria,
  checkAcceptanceCriteria,
  formatCriteriaForPrompt,
} from '../scripts/lib/engine/acceptance-criteria.js';

// --- buildAcceptanceCriteriaPrompt ---

describe('buildAcceptanceCriteriaPrompt', () => {
  it('기획서 내용을 포함한다', () => {
    const prompt = buildAcceptanceCriteriaPrompt('## 기술 스택\nReact + Express', {
      name: 'Test',
      type: 'web-app',
    });

    expect(prompt).toContain('React + Express');
    expect(prompt).toContain('Test');
  });

  it('measurementMethod 종류를 안내한다', () => {
    const prompt = buildAcceptanceCriteriaPrompt('plan', { name: 'P', type: 't' });

    expect(prompt).toContain('review');
    expect(prompt).toContain('test');
    expect(prompt).toContain('build');
    expect(prompt).toContain('manual');
  });

  it('빈 기획서이면 빈 문자열을 반환한다', () => {
    expect(buildAcceptanceCriteriaPrompt('', {})).toBe('');
    expect(buildAcceptanceCriteriaPrompt(null, {})).toBe('');
  });
});

// --- parseAcceptanceCriteria ---

describe('parseAcceptanceCriteria', () => {
  it('정상 JSON 배열을 파싱한다', () => {
    const raw = JSON.stringify([
      {
        id: 'ac-1',
        description: 'JWT 인증 구현됨',
        measurementMethod: 'review',
        targetValue: '리뷰어 확인',
      },
      { id: 'ac-2', description: '빌드 성공', measurementMethod: 'build', targetValue: 'exit 0' },
    ]);

    const result = parseAcceptanceCriteria(raw);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('ac-1');
    expect(result[0].status).toBe('pending');
    expect(result[1].measurementMethod).toBe('build');
  });

  it('빈 입력이면 빈 배열을 반환한다', () => {
    expect(parseAcceptanceCriteria('')).toEqual([]);
    expect(parseAcceptanceCriteria(null)).toEqual([]);
  });

  it('필드 누락 시 기본값을 적용한다', () => {
    const raw = JSON.stringify([{ description: '테스트' }]);
    const result = parseAcceptanceCriteria(raw);

    expect(result[0].id).toMatch(/^ac-/);
    expect(result[0].measurementMethod).toBe('review');
    expect(result[0].status).toBe('pending');
  });

  it('JSON이 아닌 입력이면 빈 배열을 반환한다', () => {
    expect(parseAcceptanceCriteria('not json at all')).toEqual([]);
  });
});

// --- checkAcceptanceCriteria ---

describe('checkAcceptanceCriteria', () => {
  const criteria = [
    {
      id: 'ac-1',
      description: 'JWT',
      measurementMethod: 'review',
      targetValue: '확인',
      status: 'pending',
    },
    {
      id: 'ac-2',
      description: '빌드',
      measurementMethod: 'build',
      targetValue: 'OK',
      status: 'pending',
    },
  ];

  it('모든 기준 통과 시 allPassed=true', () => {
    const reviews = [
      { verdict: 'approve', issues: [] },
      { verdict: 'approve', issues: [] },
    ];

    const result = checkAcceptanceCriteria(reviews, criteria);

    expect(result.allPassed).toBe(true);
  });

  it('critical 이슈가 있으면 allPassed=false', () => {
    const reviews = [
      { verdict: 'request-changes', issues: [{ severity: 'critical', description: 'JWT 누락' }] },
    ];

    const result = checkAcceptanceCriteria(reviews, criteria);

    expect(result.allPassed).toBe(false);
  });

  it('빈 리뷰이면 allPassed=false', () => {
    const result = checkAcceptanceCriteria([], criteria);
    expect(result.allPassed).toBe(false);
  });

  it('빈 criteria이면 allPassed=true', () => {
    const result = checkAcceptanceCriteria([{ verdict: 'approve', issues: [] }], []);
    expect(result.allPassed).toBe(true);
  });
});

// --- formatCriteriaForPrompt ---

describe('formatCriteriaForPrompt', () => {
  it('마크다운 체크리스트 형식을 반환한다', () => {
    const criteria = [
      {
        id: 'ac-1',
        description: 'JWT 인증',
        measurementMethod: 'review',
        targetValue: '리뷰어 확인',
        status: 'pending',
      },
      {
        id: 'ac-2',
        description: '빌드 성공',
        measurementMethod: 'build',
        targetValue: 'exit 0',
        status: 'passed',
      },
    ];

    const md = formatCriteriaForPrompt(criteria);

    expect(md).toContain('ac-1');
    expect(md).toContain('JWT 인증');
    expect(md).toContain('review');
    expect(md).toContain('ac-2');
  });

  it('빈 배열이면 빈 문자열', () => {
    expect(formatCriteriaForPrompt([])).toBe('');
  });
});
