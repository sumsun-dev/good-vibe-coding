import { describe, it, expect } from 'vitest';
import {
  buildComplexityAnalysisPrompt,
  parseComplexityAnalysis,
  getDefaultsForComplexity,
} from '../scripts/lib/complexity-analyzer.js';

// --- buildComplexityAnalysisPrompt ---

describe('buildComplexityAnalysisPrompt', () => {
  it('프로젝트 설명을 포함한다', () => {
    const prompt = buildComplexityAnalysisPrompt('날씨를 알려주는 텔레그램 봇');
    expect(prompt).toContain('날씨를 알려주는 텔레그램 봇');
  });

  it('복잡도 판단 기준을 포함한다', () => {
    const prompt = buildComplexityAnalysisPrompt('웹 앱');
    expect(prompt).toContain('simple');
    expect(prompt).toContain('medium');
    expect(prompt).toContain('complex');
  });

  it('JSON 출력 형식 가이드를 포함한다', () => {
    const prompt = buildComplexityAnalysisPrompt('웹 앱');
    expect(prompt).toContain('level');
    expect(prompt).toContain('suggestedMode');
    expect(prompt).toContain('reasoning');
  });

  it('빈 설명이면 빈 문자열을 반환한다', () => {
    expect(buildComplexityAnalysisPrompt('')).toBe('');
    expect(buildComplexityAnalysisPrompt(null)).toBe('');
    expect(buildComplexityAnalysisPrompt('  ')).toBe('');
  });
});

// --- parseComplexityAnalysis ---

describe('parseComplexityAnalysis', () => {
  it('JSON 결과를 파싱한다', () => {
    const raw = JSON.stringify({
      level: 'simple',
      suggestedMode: 'quick-build',
      reasoning: '단순 봇이므로',
    });
    const result = parseComplexityAnalysis(raw);
    expect(result.level).toBe('simple');
    expect(result.suggestedMode).toBe('quick-build');
    expect(result.reasoning).toBe('단순 봇이므로');
  });

  it('JSON 코드블록에서 파싱한다', () => {
    const raw = '분석:\n```json\n{"level":"complex","suggestedMode":"plan-only","reasoning":"복잡"}\n```';
    const result = parseComplexityAnalysis(raw);
    expect(result.level).toBe('complex');
    expect(result.suggestedMode).toBe('plan-only');
  });

  it('빈 입력은 medium 기본값을 반환한다', () => {
    const result = parseComplexityAnalysis('');
    expect(result.level).toBe('medium');
    expect(result.suggestedMode).toBe('plan-execute');
  });

  it('유효하지 않은 level은 medium으로 처리한다', () => {
    const raw = JSON.stringify({ level: 'invalid', suggestedMode: 'quick-build', reasoning: '' });
    const result = parseComplexityAnalysis(raw);
    expect(result.level).toBe('medium');
  });

  it('유효하지 않은 mode는 plan-execute로 처리한다', () => {
    const raw = JSON.stringify({ level: 'simple', suggestedMode: 'invalid', reasoning: '' });
    const result = parseComplexityAnalysis(raw);
    expect(result.suggestedMode).toBe('plan-execute');
  });

  it('파싱 불가능한 텍스트는 기본값을 반환한다', () => {
    const result = parseComplexityAnalysis('이건 JSON이 아닙니다');
    expect(result.level).toBe('medium');
    expect(result.suggestedMode).toBe('plan-execute');
  });
});

// --- getDefaultsForComplexity ---

describe('getDefaultsForComplexity', () => {
  it('simple 복잡도 기본값을 반환한다', () => {
    const defaults = getDefaultsForComplexity('simple');
    expect(defaults.teamSize.min).toBe(2);
    expect(defaults.teamSize.max).toBe(3);
    expect(defaults.discussionRounds).toBe(0);
    expect(defaults.reviewRounds).toBe(1);
    expect(defaults.suggestedRoles).toContain('cto');
  });

  it('medium 복잡도 기본값을 반환한다', () => {
    const defaults = getDefaultsForComplexity('medium');
    expect(defaults.teamSize.min).toBe(3);
    expect(defaults.teamSize.max).toBe(5);
    expect(defaults.discussionRounds).toBe(1);
    expect(defaults.suggestedRoles).toEqual(['cto', 'frontend', 'backend', 'qa']);
    expect(defaults.suggestedRoles).not.toContain('fullstack');
  });

  it('complex 복잡도 기본값을 반환한다', () => {
    const defaults = getDefaultsForComplexity('complex');
    expect(defaults.teamSize.min).toBe(5);
    expect(defaults.teamSize.max).toBe(8);
    expect(defaults.discussionRounds).toBe(3);
    expect(defaults.reviewRounds).toBe(2);
    expect(defaults.suggestedRoles).toEqual(['cto', 'po', 'frontend', 'backend', 'qa', 'security']);
    expect(defaults.suggestedRoles).not.toContain('fullstack');
    expect(defaults.suggestedRoles).not.toContain('uiux');
    expect(defaults.suggestedRoles).not.toContain('devops');
  });

  it('알 수 없는 복잡도는 medium으로 처리한다', () => {
    const defaults = getDefaultsForComplexity('unknown');
    expect(defaults.teamSize.min).toBe(3);
    expect(defaults.discussionRounds).toBe(1);
  });

  it('모든 복잡도에 modelTiers가 포함된다', () => {
    for (const level of ['simple', 'medium', 'complex']) {
      const defaults = getDefaultsForComplexity(level);
      expect(defaults.modelTiers).toBeDefined();
      expect(defaults.modelTiers.leadership).toBeTruthy();
      expect(defaults.modelTiers.engineering).toBeTruthy();
      expect(defaults.modelTiers.design).toBeTruthy();
      expect(defaults.modelTiers.research).toBeTruthy();
      expect(defaults.modelTiers.support).toBeTruthy();
    }
  });

  it('simple은 leadership=sonnet, design=haiku', () => {
    const defaults = getDefaultsForComplexity('simple');
    expect(defaults.modelTiers.leadership).toBe('sonnet');
    expect(defaults.modelTiers.design).toBe('haiku');
    expect(defaults.modelTiers.support).toBe('haiku');
  });

  it('medium은 engineering=sonnet, support=haiku', () => {
    const defaults = getDefaultsForComplexity('medium');
    expect(defaults.modelTiers.engineering).toBe('sonnet');
    expect(defaults.modelTiers.design).toBe('sonnet');
    expect(defaults.modelTiers.support).toBe('haiku');
  });

  it('complex는 leadership=opus, engineering=sonnet', () => {
    const defaults = getDefaultsForComplexity('complex');
    expect(defaults.modelTiers.leadership).toBe('opus');
    expect(defaults.modelTiers.engineering).toBe('sonnet');
    expect(defaults.modelTiers.support).toBe('haiku');
  });
});
