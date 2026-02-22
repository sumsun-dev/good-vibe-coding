import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'fs/promises';
import { resolve } from 'path';
import { addFeedback, setFeedbackDir } from '../scripts/lib/feedback-manager.js';
import {
  calculateGrowthLevel,
  extractInsights,
  generateGrowthGoal,
  generateGrowthSummary,
  analyzeGrowth,
  getGrowthProfiles,
  buildGrowthContext,
  formatGrowthReport,
} from '../scripts/lib/growth-manager.js';

const TMP_DIR = resolve('.tmp-test-growth');

beforeEach(async () => {
  await mkdir(TMP_DIR, { recursive: true });
  setFeedbackDir(TMP_DIR);
});

afterEach(async () => {
  await rm(TMP_DIR, { recursive: true, force: true });
});

describe('calculateGrowthLevel', () => {
  it('Lv.1 Beginner: 프로젝트 0개', () => {
    const result = calculateGrowthLevel(0, 0);
    expect(result.level).toBe(1);
    expect(result.levelName).toBe('Beginner');
  });

  it('Lv.1 Beginner: 프로젝트 1개', () => {
    const result = calculateGrowthLevel(3.0, 1);
    expect(result.level).toBe(1);
    expect(result.levelName).toBe('Beginner');
  });

  it('Lv.1 Beginner: 프로젝트 2개이지만 평균 < 2.0', () => {
    const result = calculateGrowthLevel(1.5, 2);
    expect(result.level).toBe(1);
    expect(result.levelName).toBe('Beginner');
  });

  it('Lv.2 Growing: 프로젝트 2개, 평균 2.0-2.9', () => {
    const result = calculateGrowthLevel(2.5, 2);
    expect(result.level).toBe(2);
    expect(result.levelName).toBe('Growing');
  });

  it('Lv.3 Competent: 프로젝트 3개, 평균 3.0-3.9', () => {
    const result = calculateGrowthLevel(3.5, 3);
    expect(result.level).toBe(3);
    expect(result.levelName).toBe('Competent');
  });

  it('Lv.4 Advanced: 프로젝트 4개, 평균 4.0-4.4', () => {
    const result = calculateGrowthLevel(4.2, 4);
    expect(result.level).toBe(4);
    expect(result.levelName).toBe('Advanced');
  });

  it('Lv.5 Expert: 프로젝트 5개, 평균 4.5 이상', () => {
    const result = calculateGrowthLevel(4.8, 5);
    expect(result.level).toBe(5);
    expect(result.levelName).toBe('Expert');
  });

  it('프로젝트 수 부족 시 레벨 상한 적용 (프로젝트 2개인데 평균 4.5)', () => {
    const result = calculateGrowthLevel(4.5, 2);
    expect(result.level).toBe(2);
    expect(result.levelName).toBe('Growing');
  });

  it('프로젝트 3개, 평균 4.5 → Lv.3 (프로젝트 수 제한)', () => {
    const result = calculateGrowthLevel(4.5, 3);
    expect(result.level).toBe(3);
    expect(result.levelName).toBe('Competent');
  });
});

describe('extractInsights', () => {
  it('강점 키워드를 추출한다', () => {
    const feedbacks = [
      { comment: '아키텍처 설계가 깔끔하고 성능이 좋습니다' },
      { comment: '코드 품질이 뛰어나고 안정적입니다' },
    ];
    const result = extractInsights(feedbacks);
    expect(result.strengths.length).toBeGreaterThan(0);
  });

  it('개선점 키워드를 추출한다', () => {
    const feedbacks = [
      { comment: '테스트가 부족하고 문서화 필요합니다' },
      { comment: '속도가 느리고 에러 처리 미흡' },
    ];
    const result = extractInsights(feedbacks);
    expect(result.improvements.length).toBeGreaterThan(0);
  });

  it('빈 피드백 배열은 빈 결과 반환', () => {
    const result = extractInsights([]);
    expect(result.strengths).toEqual([]);
    expect(result.improvements).toEqual([]);
  });

  it('코멘트 없는 피드백도 처리', () => {
    const feedbacks = [{ comment: '' }, { comment: undefined }];
    const result = extractInsights(feedbacks);
    expect(result.strengths).toEqual([]);
    expect(result.improvements).toEqual([]);
  });

  it('중복 키워드를 제거한다', () => {
    const feedbacks = [
      { comment: '설계가 좋고 설계 역량이 뛰어남' },
      { comment: '설계 능력 우수' },
    ];
    const result = extractInsights(feedbacks);
    const unique = new Set(result.strengths);
    expect(result.strengths.length).toBe(unique.size);
  });
});

describe('generateGrowthGoal', () => {
  it('개선점 기반 성장 목표를 생성한다', () => {
    const goal = generateGrowthGoal(2, ['테스트', '문서화']);
    expect(goal).toBeTruthy();
    expect(typeof goal).toBe('string');
    expect(goal.length).toBeGreaterThan(0);
  });

  it('개선점이 없으면 레벨 기반 기본 목표', () => {
    const goal = generateGrowthGoal(3, []);
    expect(goal).toBeTruthy();
    expect(typeof goal).toBe('string');
  });

  it('Expert 레벨은 멘토링 목표', () => {
    const goal = generateGrowthGoal(5, []);
    expect(goal).toContain('멘토링');
  });
});

describe('generateGrowthSummary', () => {
  it('한 줄 요약을 생성한다', () => {
    const profile = {
      roleId: 'backend',
      level: 3,
      levelName: 'Competent',
      avgRating: 3.5,
      totalProjects: 3,
      strengths: ['API 설계'],
      improvements: ['테스트'],
    };
    const summary = generateGrowthSummary(profile);
    expect(typeof summary).toBe('string');
    expect(summary.length).toBeGreaterThan(0);
    expect(summary).toContain('Competent');
  });

  it('강점이 없어도 동작', () => {
    const profile = {
      roleId: 'cto',
      level: 1,
      levelName: 'Beginner',
      avgRating: 0,
      totalProjects: 0,
      strengths: [],
      improvements: [],
    };
    const summary = generateGrowthSummary(profile);
    expect(summary).toBeTruthy();
  });
});

describe('analyzeGrowth', () => {
  it('피드백 기반으로 GrowthProfile을 생성한다', async () => {
    await addFeedback('proj-1', 'backend', 4, '좋은 API 설계');
    await addFeedback('proj-2', 'backend', 3, '테스트 부족');
    await addFeedback('proj-3', 'backend', 4, '안정적인 코드');

    const profile = await analyzeGrowth('backend');
    expect(profile.roleId).toBe('backend');
    expect(profile.level).toBe(3);
    expect(profile.levelName).toBe('Competent');
    expect(profile.avgRating).toBeCloseTo(3.67, 1);
    expect(profile.totalProjects).toBe(3);
    expect(profile.growthGoal).toBeTruthy();
    expect(profile.growthSummary).toBeTruthy();
  });

  it('피드백이 없는 역할은 Lv.1 Beginner', async () => {
    const profile = await analyzeGrowth('frontend');
    expect(profile.level).toBe(1);
    expect(profile.levelName).toBe('Beginner');
    expect(profile.totalProjects).toBe(0);
    expect(profile.avgRating).toBe(0);
  });
});

describe('getGrowthProfiles', () => {
  it('여러 역할의 프로필을 Map으로 반환한다', async () => {
    await addFeedback('proj-1', 'cto', 5, '훌륭한 아키텍처');
    await addFeedback('proj-1', 'backend', 4, '좋은 API');

    const profiles = await getGrowthProfiles(['cto', 'backend', 'qa']);
    expect(profiles.size).toBe(3);
    expect(profiles.get('cto').level).toBeGreaterThanOrEqual(1);
    expect(profiles.get('backend').level).toBeGreaterThanOrEqual(1);
    expect(profiles.get('qa').level).toBe(1);
  });

  it('빈 배열은 빈 Map 반환', async () => {
    const profiles = await getGrowthProfiles([]);
    expect(profiles.size).toBe(0);
  });
});

describe('buildGrowthContext', () => {
  it('프롬프트용 마크다운 블록을 생성한다', () => {
    const profile = {
      roleId: 'backend',
      level: 3,
      levelName: 'Competent',
      avgRating: 3.5,
      totalProjects: 3,
      strengths: ['API 설계', '안정성'],
      improvements: ['테스트'],
      growthGoal: '테스트 커버리지 향상',
      growthSummary: 'Lv.3 Competent — API 설계에 강점, 테스트 개선 필요',
    };
    const context = buildGrowthContext(profile);
    expect(context).toContain('Lv.3');
    expect(context).toContain('Competent');
    expect(context).toContain('API 설계');
    expect(context).toContain('테스트');
  });

  it('Beginner 프로필도 동작한다', () => {
    const profile = {
      roleId: 'qa',
      level: 1,
      levelName: 'Beginner',
      avgRating: 0,
      totalProjects: 0,
      strengths: [],
      improvements: [],
      growthGoal: '첫 프로젝트 경험 쌓기',
      growthSummary: 'Lv.1 Beginner — 첫 프로젝트 경험 필요',
    };
    const context = buildGrowthContext(profile);
    expect(context).toContain('Beginner');
  });
});

describe('formatGrowthReport', () => {
  it('성장 현황 테이블을 생성한다', () => {
    const profiles = new Map([
      ['cto', {
        roleId: 'cto', level: 4, levelName: 'Advanced',
        avgRating: 4.2, totalProjects: 5,
        strengths: ['아키텍처'], improvements: ['문서화'],
        growthGoal: '문서화 강화', growthSummary: 'Lv.4 Advanced',
      }],
      ['backend', {
        roleId: 'backend', level: 2, levelName: 'Growing',
        avgRating: 2.5, totalProjects: 2,
        strengths: ['API'], improvements: ['테스트'],
        growthGoal: '테스트 강화', growthSummary: 'Lv.2 Growing',
      }],
    ]);
    const report = formatGrowthReport(profiles);
    expect(report).toContain('cto');
    expect(report).toContain('backend');
    expect(report).toContain('Advanced');
    expect(report).toContain('Growing');
    expect(report).toContain('|');
  });

  it('빈 프로필은 안내 메시지 반환', () => {
    const report = formatGrowthReport(new Map());
    expect(report).toContain('성장');
  });
});
