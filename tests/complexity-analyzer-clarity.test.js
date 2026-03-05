import { describe, it, expect } from 'vitest';
import {
  buildClarityCheckPrompt,
  parseClarityCheckResult,
  buildClarificationQuestions,
} from '../scripts/lib/agent/complexity-analyzer.js';

// --- buildClarityCheckPrompt ---

describe('buildClarityCheckPrompt', () => {
  it('유효한 설명으로 프롬프트를 생성한다', () => {
    const prompt = buildClarityCheckPrompt('React로 만드는 할일 관리 웹앱');
    expect(prompt).toContain('명확성');
    expect(prompt).toContain('React로 만드는 할일 관리 웹앱');
    expect(prompt).toContain('feature');
    expect(prompt).toContain('target');
    expect(prompt).toContain('tech');
    expect(prompt).toContain('JSON');
  });

  it('빈 문자열은 빈 프롬프트를 반환한다', () => {
    expect(buildClarityCheckPrompt('')).toBe('');
    expect(buildClarityCheckPrompt('  ')).toBe('');
  });

  it('null/undefined는 빈 프롬프트를 반환한다', () => {
    expect(buildClarityCheckPrompt(null)).toBe('');
    expect(buildClarityCheckPrompt(undefined)).toBe('');
  });

  it('3가지 차원을 모두 포함한다', () => {
    const prompt = buildClarityCheckPrompt('앱 만들어줘');
    expect(prompt).toContain('핵심 기능');
    expect(prompt).toContain('타겟');
    expect(prompt).toContain('기술');
  });
});

// --- parseClarityCheckResult ---

describe('parseClarityCheckResult', () => {
  it('정상적인 JSON 결과를 파싱한다', () => {
    const rawOutput = JSON.stringify({
      scores: { feature: 0.8, target: 0.6, tech: 0.9 },
      clarityScore: 0.775,
      missingInfo: ['target'],
      reasoning: '타겟 사용자가 불명확',
    });
    const result = parseClarityCheckResult(rawOutput);
    expect(result.clarityScore).toBeCloseTo(0.775);
    expect(result.missingInfo).toEqual(['target']);
    expect(result.reasoning).toBe('타겟 사용자가 불명확');
  });

  it('코드블록 안의 JSON을 파싱한다', () => {
    const rawOutput = `분석 결과:
\`\`\`json
{
  "scores": { "feature": 0.5, "target": 0.3, "tech": 0.1 },
  "clarityScore": 0.35,
  "missingInfo": ["feature", "target", "tech"],
  "reasoning": "모든 차원이 불명확"
}
\`\`\``;
    const result = parseClarityCheckResult(rawOutput);
    expect(result.clarityScore).toBeCloseTo(0.35);
    expect(result.missingInfo.length).toBe(3);
  });

  it('빈 입력은 기본값을 반환한다', () => {
    const result = parseClarityCheckResult('');
    expect(result.clarityScore).toBe(0.5);
    expect(result.missingInfo).toEqual([]);
  });

  it('null은 기본값을 반환한다', () => {
    const result = parseClarityCheckResult(null);
    expect(result.clarityScore).toBe(0.5);
  });

  it('파싱 실패 시 기본값을 반환한다', () => {
    const result = parseClarityCheckResult('이건 JSON이 아닙니다');
    expect(result.clarityScore).toBe(0.5);
    expect(result.missingInfo).toEqual([]);
  });

  it('가중 평균을 올바르게 계산한다', () => {
    const rawOutput = JSON.stringify({
      scores: { feature: 1.0, target: 0.0, tech: 0.0 },
      clarityScore: 0.5,
      missingInfo: ['target', 'tech'],
      reasoning: '기능만 명확',
    });
    const result = parseClarityCheckResult(rawOutput);
    // feature×0.5 + target×0.25 + tech×0.25 = 0.5 + 0 + 0 = 0.5
    expect(result.clarityScore).toBeCloseTo(0.5);
  });
});

// --- buildClarificationQuestions ---

describe('buildClarificationQuestions', () => {
  it('missingInfo에 따라 질문을 생성한다', () => {
    const questions = buildClarificationQuestions(['feature', 'target']);
    expect(questions.length).toBe(2);
    expect(questions[0]).toContain('핵심 기능');
    expect(questions[1]).toContain('사용자');
  });

  it('tech 누락 시 기술 질문을 생성한다', () => {
    const questions = buildClarificationQuestions(['tech']);
    expect(questions.length).toBe(1);
    expect(questions[0]).toContain('기술');
  });

  it('최대 maxQuestions개까지만 생성한다', () => {
    const questions = buildClarificationQuestions(['feature', 'target', 'tech', 'extra']);
    expect(questions.length).toBeLessThanOrEqual(3);
  });

  it('빈 missingInfo는 빈 배열을 반환한다', () => {
    expect(buildClarificationQuestions([])).toEqual([]);
  });

  it('null은 빈 배열을 반환한다', () => {
    expect(buildClarificationQuestions(null)).toEqual([]);
  });

  it('알 수 없는 키는 무시한다', () => {
    const questions = buildClarificationQuestions(['unknown_key']);
    expect(questions.length).toBe(0);
  });

  it('중복 키를 처리한다', () => {
    const questions = buildClarificationQuestions(['feature', 'feature']);
    expect(questions.length).toBe(1);
  });
});
