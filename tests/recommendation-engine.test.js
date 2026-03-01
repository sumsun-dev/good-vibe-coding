import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractKeywords,
  scoreItem,
  buildReasonText,
  recommendSetup,
  formatRecommendations,
  clearCache,
} from '../scripts/lib/recommendation-engine.js';
import { config } from '../scripts/lib/config.js';

describe('recommendation-engine', () => {
  beforeEach(() => {
    clearCache();
  });

  // --- extractKeywords ---
  describe('extractKeywords', () => {
    it('공백 기준으로 토큰화한다', () => {
      const kw = extractKeywords('웹앱 만들기 서비스');
      expect(kw.has('웹앱')).toBe(true);
      expect(kw.has('만들기')).toBe(true);
      expect(kw.has('서비스')).toBe(true);
    });

    it('한국어 조사를 제거한다', () => {
      const kw = extractKeywords('프로젝트를 관리하는 도구');
      expect(kw.has('프로젝트')).toBe(true);
      expect(kw.has('관리하')).toBe(true);
      expect(kw.has('도구')).toBe(true);
    });

    it('영어를 소문자로 정규화한다', () => {
      const kw = extractKeywords('GitHub API Server');
      expect(kw.has('github')).toBe(true);
      expect(kw.has('api')).toBe(true);
      expect(kw.has('server')).toBe(true);
    });

    it('빈 입력은 빈 Set을 반환한다', () => {
      expect(extractKeywords('')).toEqual(new Set());
      expect(extractKeywords(null)).toEqual(new Set());
      expect(extractKeywords(undefined)).toEqual(new Set());
    });

    it('영어 1자는 제외하고 한글 1자는 포함한다', () => {
      const kw = extractKeywords('a 나 ok 좋아');
      expect(kw.has('a')).toBe(false);
      expect(kw.has('나')).toBe(true);
      expect(kw.has('ok')).toBe(true);
      expect(kw.has('좋아')).toBe(true);
    });

    it('한글 1자 의미 단어를 추출한다', () => {
      const kw = extractKeywords('웹 앱 봇 서비스');
      expect(kw.has('웹')).toBe(true);
      expect(kw.has('앱')).toBe(true);
      expect(kw.has('봇')).toBe(true);
      expect(kw.has('서비스')).toBe(true);
    });

    it('구두점을 제거한다', () => {
      const kw = extractKeywords('todo(앱), 리뷰!');
      expect(kw.has('todo')).toBe(true);
      expect(kw.has('앱')).toBe(true);
      expect(kw.has('리뷰')).toBe(true);
    });
  });

  // --- scoreItem ---
  describe('scoreItem', () => {
    const baseContext = {
      projectType: 'web-app',
      complexity: 'medium',
      description: '웹 애플리케이션',
      teamRoles: ['fullstack', 'qa'],
    };

    it('프로젝트 타입 매칭 시 3점을 부여한다', () => {
      const item = {
        applicableProjectTypes: ['web-app'],
        complexityRange: [],
        keywords: [],
        targetRoles: [],
      };
      const score = scoreItem(item, baseContext);
      expect(score).toBe(config.recommendation.weights.projectType);
    });

    it('빈 applicableProjectTypes는 1점을 부여한다', () => {
      const item = {
        applicableProjectTypes: [],
        complexityRange: [],
        keywords: [],
        targetRoles: [],
      };
      const score = scoreItem(item, baseContext);
      expect(score).toBe(1);
    });

    it('프로젝트 타입 불일치 시 0점', () => {
      const item = {
        applicableProjectTypes: ['cli-tool'],
        complexityRange: [],
        keywords: [],
        targetRoles: [],
      };
      const score = scoreItem(item, baseContext);
      expect(score).toBe(0);
    });

    it('복잡도 매칭 시 2점을 부여한다', () => {
      const item = {
        applicableProjectTypes: [],
        complexityRange: ['medium'],
        keywords: [],
        targetRoles: [],
      };
      const score = scoreItem(item, baseContext);
      expect(score).toBe(1 + config.recommendation.weights.complexity);
    });

    it('키워드 교집합에 최대 3점을 부여한다', () => {
      const item = {
        applicableProjectTypes: [],
        complexityRange: [],
        keywords: ['리뷰', '성능', '보안', '테스트'],
        targetRoles: [],
      };
      const ctx = { ...baseContext, description: '리뷰 성능 보안 테스트 확인' };
      const score = scoreItem(item, ctx);
      // 범용 1점 + 키워드 최대 3점 캡 (4개 매칭이지만 cap=3) = 4점
      expect(score).toBe(1 + 3 * config.recommendation.weights.keyword);
    });

    it('역할 친화성 점수를 부여한다', () => {
      const item = {
        applicableProjectTypes: [],
        complexityRange: [],
        keywords: [],
        targetRoles: ['fullstack', 'qa', 'backend'],
      };
      const score = scoreItem(item, baseContext);
      // 범용 1점 + fullstack(2) + qa(2) = 5점
      expect(score).toBe(1 + 2 * config.recommendation.weights.roleAffinity);
    });

    it('모든 시그널 합산이 정확하다', () => {
      const item = {
        applicableProjectTypes: ['web-app'],
        complexityRange: ['medium'],
        keywords: ['웹'],
        targetRoles: ['fullstack'],
      };
      const ctx = { ...baseContext, description: '웹 기반 서비스' };
      const score = scoreItem(item, ctx);
      // 타입 3 + 복잡도 2 + 키워드 1 (웹 매칭) + 역할 2 = 8
      expect(score).toBe(8);
    });
  });

  // --- buildReasonText ---
  describe('buildReasonText', () => {
    const baseContext = {
      projectType: 'web-app',
      complexity: 'medium',
      teamRoles: ['fullstack', 'qa'],
    };

    it('프로젝트 타입 매칭 이유를 포함한다', () => {
      const item = { applicableProjectTypes: ['web-app'], complexityRange: [], targetRoles: [], description: 'test' };
      expect(buildReasonText(item, baseContext)).toContain('web-app');
    });

    it('범용 항목은 "모든 프로젝트에 유용"을 반환한다', () => {
      const item = { applicableProjectTypes: [], complexityRange: [], targetRoles: [], description: 'test' };
      expect(buildReasonText(item, baseContext)).toContain('모든 프로젝트에 유용');
    });

    it('복잡도 이유를 포함한다', () => {
      const item = { applicableProjectTypes: [], complexityRange: ['medium'], targetRoles: [], description: 'test' };
      expect(buildReasonText(item, baseContext)).toContain('medium');
    });

    it('역할 이유를 포함한다', () => {
      const item = { applicableProjectTypes: [], complexityRange: [], targetRoles: ['fullstack', 'backend'], description: 'test' };
      expect(buildReasonText(item, baseContext)).toContain('fullstack');
    });

    it('매칭 없으면 description을 반환한다', () => {
      const item = { applicableProjectTypes: ['cli-tool'], complexityRange: ['complex'], targetRoles: ['devops'], description: '기본 설명' };
      expect(buildReasonText(item, baseContext)).toBe('기본 설명');
    });
  });

  // --- recommendSetup ---
  describe('recommendSetup', () => {
    it('web-app+medium 컨텍스트에서 추천 결과를 반환한다', async () => {
      const result = await recommendSetup({
        projectType: 'web-app',
        complexity: 'medium',
        description: '웹 애플리케이션 프로젝트',
        teamRoles: ['fullstack', 'qa', 'frontend'],
      });
      expect(result.skills).toBeDefined();
      expect(result.agents).toBeDefined();
      expect(Array.isArray(result.skills)).toBe(true);
      expect(Array.isArray(result.agents)).toBe(true);
    });

    it('설치 완료 항목을 제외한다', async () => {
      const result = await recommendSetup({
        projectType: 'web-app',
        complexity: 'medium',
        description: '웹 앱',
        teamRoles: ['fullstack'],
        installedItems: new Set(['code-reviewer-kr', 'project-setup']),
      });
      const ids = [...result.skills, ...result.agents].map(i => i.id);
      expect(ids).not.toContain('code-reviewer-kr');
      expect(ids).not.toContain('project-setup');
    });

    it('최소 점수 미달 항목을 필터링한다', async () => {
      const result = await recommendSetup({
        projectType: 'web-app',
        complexity: 'medium',
        description: '웹 앱',
        teamRoles: [],
      });
      for (const item of [...result.skills, ...result.agents]) {
        expect(item.score).toBeGreaterThanOrEqual(config.recommendation.minScore);
      }
    });

    it('카테고리당 maxPerCategory 이하로 반환한다', async () => {
      const result = await recommendSetup({
        projectType: 'web-app',
        complexity: 'medium',
        description: '웹 앱',
        teamRoles: ['fullstack', 'frontend', 'backend', 'qa', 'security'],
      });
      expect(result.skills.length).toBeLessThanOrEqual(config.recommendation.maxPerCategory);
      expect(result.agents.length).toBeLessThanOrEqual(config.recommendation.maxPerCategory);
    });

    it('점수 내림차순으로 정렬한다', async () => {
      const result = await recommendSetup({
        projectType: 'web-app',
        complexity: 'medium',
        description: '코드 리뷰 TDD 테스트',
        teamRoles: ['fullstack', 'qa'],
      });
      for (const arr of [result.skills, result.agents]) {
        for (let i = 1; i < arr.length; i++) {
          expect(arr[i - 1].score).toBeGreaterThanOrEqual(arr[i].score);
        }
      }
    });

    it('각 항목에 reason 필드가 포함된다', async () => {
      const result = await recommendSetup({
        projectType: 'web-app',
        complexity: 'medium',
        description: '웹 앱',
        teamRoles: ['fullstack'],
      });
      for (const item of [...result.skills, ...result.agents]) {
        expect(typeof item.reason).toBe('string');
        expect(item.reason.length).toBeGreaterThan(0);
      }
    });

    it('cli-tool+simple 컨텍스트에서도 동작한다', async () => {
      const result = await recommendSetup({
        projectType: 'cli-tool',
        complexity: 'simple',
        description: 'CLI 유틸리티',
        teamRoles: ['backend'],
      });
      expect(result).toBeDefined();
      expect(result.skills).toBeDefined();
      expect(result.agents).toBeDefined();
    });
  });

  // --- catalog validation ---
  describe('catalog validation', () => {
    it('카탈로그가 스키마 검증을 통과한다', async () => {
      const result = await recommendSetup({
        projectType: 'web-app',
        complexity: 'medium',
        description: '테스트',
        teamRoles: [],
      });
      expect(result).toBeDefined();
    });
  });

  // --- formatRecommendations ---
  describe('formatRecommendations', () => {
    it('마크다운 테이블을 반환한다', () => {
      const recs = {
        skills: [{ displayName: 'A', description: 'desc-a', reason: 'reason-a' }],
        agents: [{ displayName: 'B', model: 'sonnet', description: 'desc-b', reason: 'reason-b' }],
      };
      const md = formatRecommendations(recs);
      expect(md).toContain('### 추천 스킬');
      expect(md).toContain('### 추천 에이전트');
      expect(md).toContain('| A |');
      expect(md).toContain('| B |');
    });

    it('빈 결과는 빈 문자열을 반환한다', () => {
      expect(formatRecommendations({ skills: [], agents: [] })).toBe('');
    });

    it('스킬만 있을 때 에이전트 섹션이 없다', () => {
      const recs = {
        skills: [{ displayName: 'A', description: 'desc-a', reason: 'reason-a' }],
        agents: [],
      };
      const md = formatRecommendations(recs);
      expect(md).toContain('### 추천 스킬');
      expect(md).not.toContain('### 추천 에이전트');
    });

    it('에이전트만 있을 때 스킬 섹션이 없다', () => {
      const recs = {
        skills: [],
        agents: [{ displayName: 'B', model: 'haiku', description: 'desc-b', reason: 'reason-b' }],
      };
      const md = formatRecommendations(recs);
      expect(md).not.toContain('### 추천 스킬');
      expect(md).toContain('### 추천 에이전트');
    });
  });
});
