import { describe, it, expect } from 'vitest';
import {
  getWeightProfile,
  buildClarityCheckPrompt,
  parseClarityResult,
  calculateClarity,
  shouldProceed,
  filterQuestions,
  enrichDescription,
} from '../scripts/lib/agent/clarity-analyzer.js';

// --- getWeightProfile ---

describe('getWeightProfile', () => {
  it('default 프로파일을 반환한다', () => {
    const w = getWeightProfile('default');
    expect(w.scope).toBe(0.3);
    expect(w.userStory).toBe(0.2);
    expect(w.techStack).toBe(0.15);
    expect(w.constraints).toBe(0.15);
    expect(w.successCriteria).toBe(0.2);
  });

  it('web-app 프로파일을 반환한다', () => {
    const w = getWeightProfile('web-app');
    expect(w.scope).toBe(0.25);
    expect(w.userStory).toBe(0.25);
    expect(w.techStack).toBe(0.2);
    expect(w.constraints).toBe(0.15);
    expect(w.successCriteria).toBe(0.15);
  });

  it('cli-tool 프로파일을 반환한다', () => {
    const w = getWeightProfile('cli-tool');
    expect(w.scope).toBe(0.35);
    expect(w.userStory).toBe(0.15);
    expect(w.techStack).toBe(0.15);
    expect(w.constraints).toBe(0.1);
    expect(w.successCriteria).toBe(0.25);
  });

  it('api-server 프로파일을 반환한다', () => {
    const w = getWeightProfile('api-server');
    expect(w.scope).toBe(0.3);
    expect(w.userStory).toBe(0.15);
    expect(w.techStack).toBe(0.2);
    expect(w.constraints).toBe(0.2);
    expect(w.successCriteria).toBe(0.15);
  });

  it('알 수 없는 타입은 default를 반환한다', () => {
    const w = getWeightProfile('unknown-type');
    expect(w.scope).toBe(0.3);
    expect(w.successCriteria).toBe(0.2);
  });

  it('모든 프로파일의 가중치 합이 1.0이다', () => {
    for (const type of ['default', 'web-app', 'cli-tool', 'api-server']) {
      const w = getWeightProfile(type);
      const sum = Object.values(w).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 4);
    }
  });

  it('brownfield(hasCodebaseInfo=true) 시 techStack이 0.05로 줄어든다', () => {
    const w = getWeightProfile('default', true);
    expect(w.techStack).toBe(0.05);
  });

  it('brownfield 보정 후에도 가중치 합이 1.0이다', () => {
    for (const type of ['default', 'web-app', 'cli-tool', 'api-server']) {
      const w = getWeightProfile(type, true);
      const sum = Object.values(w).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 4);
    }
  });

  it('brownfield 보정 시 나머지 차원에 균등 분배된다', () => {
    const base = getWeightProfile('default', false);
    const bf = getWeightProfile('default', true);
    const reduction = base.techStack - 0.05;
    const bonus = reduction / 4; // 4개 다른 차원
    expect(bf.scope).toBeCloseTo(base.scope + bonus, 4);
    expect(bf.userStory).toBeCloseTo(base.userStory + bonus, 4);
    expect(bf.constraints).toBeCloseTo(base.constraints + bonus, 4);
    expect(bf.successCriteria).toBeCloseTo(base.successCriteria + bonus, 4);
  });
});

// --- buildClarityCheckPrompt ---

describe('buildClarityCheckPrompt', () => {
  it('5개 차원을 모두 포함한다', () => {
    const prompt = buildClarityCheckPrompt('할일 관리 앱');
    expect(prompt).toContain('scope');
    expect(prompt).toContain('userStory');
    expect(prompt).toContain('techStack');
    expect(prompt).toContain('constraints');
    expect(prompt).toContain('successCriteria');
  });

  it('프로젝트 설명을 포함한다', () => {
    const prompt = buildClarityCheckPrompt('날씨를 알려주는 텔레그램 봇');
    expect(prompt).toContain('날씨를 알려주는 텔레그램 봇');
  });

  it('JSON 출력 형식을 요구한다', () => {
    const prompt = buildClarityCheckPrompt('웹앱');
    expect(prompt).toContain('dimensions');
    expect(prompt).toContain('questions');
    expect(prompt).toContain('summary');
  });

  it('빈 입력이면 빈 문자열을 반환한다', () => {
    expect(buildClarityCheckPrompt('')).toBe('');
    expect(buildClarityCheckPrompt(null)).toBe('');
    expect(buildClarityCheckPrompt('  ')).toBe('');
    expect(buildClarityCheckPrompt(undefined)).toBe('');
  });

  it('projectType이 있으면 포함한다', () => {
    const prompt = buildClarityCheckPrompt('웹앱', 'web-app');
    expect(prompt).toContain('web-app');
  });

  it('codebaseInfo가 있으면 코드베이스 정보를 포함한다', () => {
    const prompt = buildClarityCheckPrompt('웹앱', null, {
      techStack: ['react', 'express'],
      fileStructure: 'src/',
    });
    expect(prompt).toContain('react');
    expect(prompt).toContain('express');
    expect(prompt).toContain('src/');
  });

  it('긴 설명은 절단된다', () => {
    const longDesc = 'A'.repeat(4000);
    const prompt = buildClarityCheckPrompt(longDesc);
    expect(prompt.length).toBeLessThan(longDesc.length + 2000);
  });
});

// --- parseClarityResult ---

describe('parseClarityResult', () => {
  const validJson = JSON.stringify({
    dimensions: {
      scope: { score: 0.8, evidence: '기능이 명확' },
      userStory: { score: 0.6, evidence: '사용자 언급' },
      techStack: { score: 0.3, evidence: '기술 없음' },
      constraints: { score: 0.5, evidence: '일부 제약' },
      successCriteria: { score: 0.7, evidence: '기준 있음' },
    },
    questions: [
      {
        dimension: 'techStack',
        question: '어떤 기술을 사용하시겠습니까?',
        options: ['React', 'Vue', 'Angular'],
        context: '기술 스택이 명시되지 않음',
      },
    ],
    summary: '기본적인 범위는 있으나 기술 스택이 부족합니다.',
  });

  it('정상 JSON을 파싱한다', () => {
    const result = parseClarityResult(validJson);
    expect(result.dimensions.scope.score).toBe(0.8);
    expect(result.dimensions.userStory.score).toBe(0.6);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].dimension).toBe('techStack');
    expect(result.summary).toContain('기술 스택');
  });

  it('clarity 가중 평균이 계산된다', () => {
    const result = parseClarityResult(validJson);
    expect(typeof result.clarity).toBe('number');
    expect(result.clarity).toBeGreaterThan(0);
    expect(result.clarity).toBeLessThanOrEqual(1);
  });

  it('코드블록 감싸진 JSON을 파싱한다', () => {
    const wrapped = '분석:\n```json\n' + validJson + '\n```';
    const result = parseClarityResult(wrapped);
    expect(result.dimensions.scope.score).toBe(0.8);
  });

  it('빈 입력은 기본값을 반환한다', () => {
    const result = parseClarityResult('');
    expect(result.clarity).toBe(0.3);
    expect(result.dimensions).toBeDefined();
    expect(result.questions).toEqual([]);
    expect(result.parseError).toBe(true);
  });

  it('null 입력은 기본값을 반환한다', () => {
    const result = parseClarityResult(null);
    expect(result.clarity).toBe(0.3);
    expect(result.parseError).toBe(true);
  });

  it('파싱 불가능한 텍스트는 기본값을 반환한다', () => {
    const result = parseClarityResult('이것은 JSON이 아닙니다');
    expect(result.clarity).toBe(0.3);
    expect(result.parseError).toBe(true);
  });

  it('점수를 0-1 범위로 clamp한다', () => {
    const outOfRange = JSON.stringify({
      dimensions: {
        scope: { score: 1.5, evidence: '' },
        userStory: { score: -0.3, evidence: '' },
        techStack: { score: 0.5, evidence: '' },
        constraints: { score: 0.5, evidence: '' },
        successCriteria: { score: 0.5, evidence: '' },
      },
      questions: [],
      summary: '',
    });
    const result = parseClarityResult(outOfRange);
    expect(result.dimensions.scope.score).toBe(1.0);
    expect(result.dimensions.userStory.score).toBe(0.0);
  });

  it('질문에 options 배열이 있다', () => {
    const result = parseClarityResult(validJson);
    expect(Array.isArray(result.questions[0].options)).toBe(true);
    expect(result.questions[0].options.length).toBeGreaterThanOrEqual(2);
  });
});

// --- calculateClarity ---

describe('calculateClarity', () => {
  const allOneDims = {
    scope: { score: 1.0 },
    userStory: { score: 1.0 },
    techStack: { score: 1.0 },
    constraints: { score: 1.0 },
    successCriteria: { score: 1.0 },
  };
  const allZeroDims = {
    scope: { score: 0.0 },
    userStory: { score: 0.0 },
    techStack: { score: 0.0 },
    constraints: { score: 0.0 },
    successCriteria: { score: 0.0 },
  };
  const defaultWeights = {
    scope: 0.3,
    userStory: 0.2,
    techStack: 0.15,
    constraints: 0.15,
    successCriteria: 0.2,
  };

  it('전부 1.0이면 1.0을 반환한다', () => {
    expect(calculateClarity(allOneDims, defaultWeights)).toBe(1.0);
  });

  it('전부 0이면 0을 반환한다', () => {
    expect(calculateClarity(allZeroDims, defaultWeights)).toBe(0.0);
  });

  it('가중치를 정확히 적용한다', () => {
    const dims = {
      scope: { score: 0.8 },
      userStory: { score: 0.6 },
      techStack: { score: 0.4 },
      constraints: { score: 0.5 },
      successCriteria: { score: 0.7 },
    };
    // 0.8*0.3 + 0.6*0.2 + 0.4*0.15 + 0.5*0.15 + 0.7*0.2 = 0.24 + 0.12 + 0.06 + 0.075 + 0.14 = 0.635
    expect(calculateClarity(dims, defaultWeights)).toBeCloseTo(0.635, 3);
  });

  it('누락된 차원은 무시하고 나머지로 계산한다', () => {
    const partial = {
      scope: { score: 1.0 },
      userStory: { score: 1.0 },
    };
    const result = calculateClarity(partial, defaultWeights);
    expect(result).toBe(1.0); // 있는 것만으로 가중 평균
  });

  it('빈 dimensions이면 0.5를 반환한다', () => {
    expect(calculateClarity({}, defaultWeights)).toBe(0.5);
  });

  it('score가 숫자가 아닌 차원은 무시한다', () => {
    const dims = {
      scope: { score: 'invalid' },
      userStory: { score: 0.8 },
      techStack: { score: 0.8 },
      constraints: { score: 0.8 },
      successCriteria: { score: 0.8 },
    };
    const result = calculateClarity(dims, defaultWeights);
    expect(result).toBeCloseTo(0.8, 3);
  });
});

// --- shouldProceed ---

describe('shouldProceed', () => {
  it('clarity >= 0.8이면 proceed: true, reason: clear', () => {
    const result = shouldProceed(0.85, null);
    expect(result.proceed).toBe(true);
    expect(result.reason).toBe('clear');
  });

  it('clarity === 0.8이면 proceed: true', () => {
    const result = shouldProceed(0.8, 0.5);
    expect(result.proceed).toBe(true);
    expect(result.reason).toBe('clear');
  });

  it('stagnation (개선 < 0.05)이면 proceed: true, reason: stagnation', () => {
    const result = shouldProceed(0.55, 0.52);
    expect(result.proceed).toBe(true);
    expect(result.reason).toBe('stagnation');
  });

  it('개선 중이면 proceed: false', () => {
    const result = shouldProceed(0.6, 0.45);
    expect(result.proceed).toBe(false);
    expect(result.reason).toBe(null);
  });

  it('previousClarity가 null이면 stagnation 판정 안 함', () => {
    const result = shouldProceed(0.5, null);
    expect(result.proceed).toBe(false);
    expect(result.reason).toBe(null);
  });

  it('clarity 0이고 previousClarity null이면 proceed: false', () => {
    const result = shouldProceed(0, null);
    expect(result.proceed).toBe(false);
  });

  it('개선 정확히 0.05이면 stagnation 아님 (proceed: false)', () => {
    const result = shouldProceed(0.55, 0.5);
    expect(result.proceed).toBe(false);
    expect(result.reason).toBe(null);
  });
});

// --- filterQuestions ---

describe('filterQuestions', () => {
  const questions = [
    { dimension: 'scope', question: '범위?' },
    { dimension: 'techStack', question: '기술?' },
    { dimension: 'constraints', question: '제약?' },
  ];
  const dimensions = {
    scope: { score: 0.3 },
    techStack: { score: 0.7 },
    constraints: { score: 0.5 },
  };

  it('score < 0.6인 차원의 질문만 필터한다', () => {
    const filtered = filterQuestions(questions, dimensions);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((q) => q.dimension)).toEqual(['scope', 'constraints']);
  });

  it('전부 >= 0.6이면 빈 배열을 반환한다', () => {
    const highDims = {
      scope: { score: 0.8 },
      techStack: { score: 0.9 },
      constraints: { score: 0.7 },
    };
    const filtered = filterQuestions(questions, highDims);
    expect(filtered).toEqual([]);
  });

  it('빈 questions이면 빈 배열을 반환한다', () => {
    expect(filterQuestions([], dimensions)).toEqual([]);
  });

  it('null questions이면 빈 배열을 반환한다', () => {
    expect(filterQuestions(null, dimensions)).toEqual([]);
  });

  it('dimensions에 해당 차원이 없으면 질문을 포함한다', () => {
    const q = [{ dimension: 'unknownDim', question: '뭔가?' }];
    const filtered = filterQuestions(q, dimensions);
    expect(filtered).toHaveLength(1);
  });
});

// --- enrichDescription ---

describe('enrichDescription', () => {
  it('원본에 답변을 병합한다', () => {
    const enriched = enrichDescription('날씨 앱', [
      { selectedOption: '현재 날씨 + 주간 예보' },
      { selectedOption: 'React + PWA' },
    ]);
    expect(enriched).toContain('날씨 앱');
    expect(enriched).toContain('현재 날씨 + 주간 예보');
    expect(enriched).toContain('React + PWA');
  });

  it('빈 answers면 원본 그대로 반환한다', () => {
    expect(enrichDescription('테스트', [])).toBe('테스트');
  });

  it('null original이면 빈 문자열을 반환한다', () => {
    expect(enrichDescription(null, [])).toBe('');
  });

  it('undefined original이면 빈 문자열을 반환한다', () => {
    expect(enrichDescription(undefined, [])).toBe('');
  });

  it('null answers면 원본 그대로 반환한다', () => {
    expect(enrichDescription('테스트', null)).toBe('테스트');
  });

  it('빈 selectedOption은 건너뛴다', () => {
    const enriched = enrichDescription('앱', [
      { selectedOption: '기능A' },
      { selectedOption: '' },
      { selectedOption: null },
      { selectedOption: '기능B' },
    ]);
    expect(enriched).toContain('기능A');
    expect(enriched).toContain('기능B');
    const lines = enriched.split('\n').filter(Boolean);
    expect(lines).toHaveLength(3); // 원본 + 기능A + 기능B
  });

  it('원본 앞뒤 공백을 정리한다', () => {
    const enriched = enrichDescription('  앱  ', [{ selectedOption: '기능' }]);
    expect(enriched.startsWith(' ')).toBe(false);
  });
});

describe('getWeightProfile 부동소수점 보정', () => {
  it('가중치 합은 항상 1.0이다', () => {
    const profile = getWeightProfile('web-app', true);
    const sum = Object.values(profile).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it('hasCodebaseInfo=false에서도 가중치 합은 1.0이다', () => {
    for (const type of ['default', 'web-app', 'cli-tool', 'api-server']) {
      const profile = getWeightProfile(type, false);
      const sum = Object.values(profile).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 10);
    }
  });
});

describe('parseClarityResult 파싱 에러 시 낮은 기본값', () => {
  it('파싱 실패 시 clarity 0.3을 반환한다', () => {
    const result = parseClarityResult('invalid json');
    expect(result.clarity).toBe(0.3);
    expect(result.parseError).toBe(true);
  });
});

describe('shouldProceed NaN 체크', () => {
  it('NaN 입력 시 proceed false를 반환한다', () => {
    const result = shouldProceed(NaN, null);
    expect(result.proceed).toBe(false);
    expect(result.reason).toBe('invalid-clarity');
  });
});
