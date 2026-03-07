import { describe, it, expect } from 'vitest';
import {
  buildComplexityAnalysisPrompt,
  parseComplexityAnalysis,
  getDefaultsForComplexity,
  calculateComplexityScore,
  deriveComplexityLevel,
} from '../scripts/lib/agent/complexity-analyzer.js';

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
    const raw =
      '분석:\n```json\n{"level":"complex","suggestedMode":"plan-only","reasoning":"복잡"}\n```';
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

// --- calculateComplexityScore ---

describe('calculateComplexityScore', () => {
  it('모든 차원 0.5 → 0.5', () => {
    const dimensions = {
      featureScope: { score: 0.5, evidence: '' },
      dataComplexity: { score: 0.5, evidence: '' },
      integrations: { score: 0.5, evidence: '' },
      authSecurity: { score: 0.5, evidence: '' },
      scalability: { score: 0.5, evidence: '' },
    };
    expect(calculateComplexityScore(dimensions)).toBeCloseTo(0.5, 5);
  });

  it('모든 차원 0 → 0', () => {
    const dimensions = {
      featureScope: { score: 0, evidence: '' },
      dataComplexity: { score: 0, evidence: '' },
      integrations: { score: 0, evidence: '' },
      authSecurity: { score: 0, evidence: '' },
      scalability: { score: 0, evidence: '' },
    };
    expect(calculateComplexityScore(dimensions)).toBe(0);
  });

  it('모든 차원 1.0 → 1.0', () => {
    const dimensions = {
      featureScope: { score: 1.0, evidence: '' },
      dataComplexity: { score: 1.0, evidence: '' },
      integrations: { score: 1.0, evidence: '' },
      authSecurity: { score: 1.0, evidence: '' },
      scalability: { score: 1.0, evidence: '' },
    };
    expect(calculateComplexityScore(dimensions)).toBeCloseTo(1.0, 5);
  });

  it('가중치 반영 정확성 (featureScope만 1.0 → 0.25)', () => {
    const dimensions = {
      featureScope: { score: 1.0, evidence: '' },
      dataComplexity: { score: 0, evidence: '' },
      integrations: { score: 0, evidence: '' },
      authSecurity: { score: 0, evidence: '' },
      scalability: { score: 0, evidence: '' },
    };
    expect(calculateComplexityScore(dimensions)).toBeCloseTo(0.25, 5);
  });

  it('누락 차원 graceful 처리', () => {
    const dimensions = {
      featureScope: { score: 0.8, evidence: '' },
      dataComplexity: { score: 0.6, evidence: '' },
    };
    const score = calculateComplexityScore(dimensions);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('점수 clamp (범위 밖 값)', () => {
    const dimensions = {
      featureScope: { score: 1.5, evidence: '' },
      dataComplexity: { score: -0.3, evidence: '' },
      integrations: { score: 0.5, evidence: '' },
      authSecurity: { score: 0.5, evidence: '' },
      scalability: { score: 0.5, evidence: '' },
    };
    const score = calculateComplexityScore(dimensions);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

// --- deriveComplexityLevel ---

describe('deriveComplexityLevel', () => {
  it('score 0.2 → simple', () => {
    expect(deriveComplexityLevel(0.2)).toBe('simple');
  });

  it('score 0.5 → medium', () => {
    expect(deriveComplexityLevel(0.5)).toBe('medium');
  });

  it('score 0.8 → complex', () => {
    expect(deriveComplexityLevel(0.8)).toBe('complex');
  });

  it('경계값 0.35 → medium, 0.65 → complex', () => {
    expect(deriveComplexityLevel(0.35)).toBe('medium');
    expect(deriveComplexityLevel(0.65)).toBe('complex');
  });
});

// --- parseComplexityAnalysis v2 (dimensions 지원) ---

describe('parseComplexityAnalysis v2', () => {
  it('dimensions 포함 JSON → complexityScore 계산', () => {
    const raw = JSON.stringify({
      level: 'medium',
      suggestedMode: 'plan-execute',
      reasoning: '보통 수준',
      dimensions: {
        featureScope: { score: 0.5, evidence: '여러 기능' },
        dataComplexity: { score: 0.4, evidence: 'DB 1개' },
        integrations: { score: 0.3, evidence: 'API 2개' },
        authSecurity: { score: 0.2, evidence: '기본 인증' },
        scalability: { score: 0.3, evidence: '단일 서버' },
      },
    });
    const result = parseComplexityAnalysis(raw);
    expect(result.dimensions).toBeDefined();
    expect(result.complexityScore).toBeGreaterThan(0);
    expect(result.complexityScore).toBeLessThan(1);
  });

  it('dimensions 없는 JSON → 기존 동작 (backward compatible)', () => {
    const raw = JSON.stringify({
      level: 'simple',
      suggestedMode: 'quick-build',
      reasoning: '단순 봇',
    });
    const result = parseComplexityAnalysis(raw);
    expect(result.level).toBe('simple');
    expect(result.suggestedMode).toBe('quick-build');
    expect(result.dimensions).toBeUndefined();
    expect(result.complexityScore).toBeUndefined();
  });

  it('부분 dimensions → 있는 것만 계산', () => {
    const raw = JSON.stringify({
      level: 'medium',
      suggestedMode: 'plan-execute',
      reasoning: '부분 평가',
      dimensions: {
        featureScope: { score: 0.8, evidence: '다기능' },
        dataComplexity: { score: 0.5, evidence: 'DB 사용' },
      },
    });
    const result = parseComplexityAnalysis(raw);
    expect(result.dimensions).toBeDefined();
    expect(result.complexityScore).toBeGreaterThan(0);
  });

  it('점수 범위 밖 clamp', () => {
    const raw = JSON.stringify({
      level: 'complex',
      suggestedMode: 'plan-only',
      reasoning: '복잡',
      dimensions: {
        featureScope: { score: 1.5, evidence: '초과' },
        dataComplexity: { score: -0.2, evidence: '음수' },
        integrations: { score: 0.5, evidence: '보통' },
        authSecurity: { score: 0.5, evidence: '보통' },
        scalability: { score: 0.5, evidence: '보통' },
      },
    });
    const result = parseComplexityAnalysis(raw);
    expect(result.complexityScore).toBeGreaterThanOrEqual(0);
    expect(result.complexityScore).toBeLessThanOrEqual(1);
  });
});

// --- buildComplexityAnalysisPrompt v2 ---

describe('buildComplexityAnalysisPrompt v2', () => {
  it('5차원 평가 기준을 포함한다', () => {
    const prompt = buildComplexityAnalysisPrompt('웹앱 프로젝트');
    expect(prompt).toContain('featureScope');
    expect(prompt).toContain('dataComplexity');
    expect(prompt).toContain('integrations');
    expect(prompt).toContain('authSecurity');
    expect(prompt).toContain('scalability');
  });

  it('dimensions 필드 출력 형식을 포함한다', () => {
    const prompt = buildComplexityAnalysisPrompt('웹앱 프로젝트');
    expect(prompt).toContain('dimensions');
    expect(prompt).toContain('evidence');
  });
});

describe('parseComplexityAnalysis dimensions 검증 강화', () => {
  it('잘못된 dimensions 구조를 정상 처리한다', () => {
    const raw = JSON.stringify({
      level: 'medium',
      suggestedMode: 'plan-execute',
      reasoning: '테스트',
      dimensions: {
        featureScope: { score: 1.5, evidence: '초과' },
        dataComplexity: 'invalid',
        // integrations, authSecurity, scalability 누락
      },
    });
    const result = parseComplexityAnalysis(raw);
    expect(result.level).toBe('medium');
    // score는 0~1 범위로 clamp되어야 함
    if (result.dimensions) {
      const fs = result.dimensions.featureScope;
      if (fs && typeof fs.score === 'number') {
        expect(fs.score).toBeLessThanOrEqual(1);
        expect(fs.score).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('buildComplexityAnalysisPrompt fileStructure 크기 제한', () => {
  it('1000자 초과 fileStructure를 절단한다', () => {
    const longStructure = 'dir/'.repeat(500);
    const prompt = buildComplexityAnalysisPrompt('웹앱', {
      techStack: ['node'],
      fileStructure: longStructure,
      languages: { js: 10 },
    });
    expect(prompt).not.toContain(longStructure);
    expect(prompt).toContain('...(truncated)');
  });

  it('1000자 이하 fileStructure는 절단하지 않는다', () => {
    const shortStructure = 'src/index.js\nsrc/app.js';
    const prompt = buildComplexityAnalysisPrompt('웹앱', {
      techStack: ['node'],
      fileStructure: shortStructure,
      languages: { js: 2 },
    });
    expect(prompt).toContain(shortStructure);
    expect(prompt).not.toContain('...(truncated)');
  });
});

describe('buildComplexityAnalysisPrompt 프롬프트 인젝션 방어', () => {
  it('user-input 태그로 description을 감싼다', () => {
    const prompt = buildComplexityAnalysisPrompt('채팅 앱 만들어줘');
    expect(prompt).toContain('<user-input label="description">');
    expect(prompt).toContain('</user-input>');
  });
});
