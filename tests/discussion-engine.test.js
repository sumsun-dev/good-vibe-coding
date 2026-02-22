import { describe, it, expect } from 'vitest';
import {
  buildDiscussionPrompt,
  parseDiscussionOutput,
  buildPlanDocument,
} from '../scripts/lib/discussion-engine.js';

const SAMPLE_PROJECT = {
  id: 'telegram-bot-2026-02',
  name: '텔레그램 봇',
  type: 'telegram-bot',
  description: '날씨를 알려주는 텔레그램 봇',
};

const SAMPLE_TEAM = [
  {
    roleId: 'cto',
    displayName: '민준',
    emoji: '🏗️',
    role: 'CTO',
    trait: '전략적이고 큰 그림을 보는',
    speakingStyle: '확신 있고 명확한 기술 리더 스타일',
    skills: ['architecture', 'tech-decision', 'code-review'],
  },
  {
    roleId: 'backend',
    displayName: '도윤',
    emoji: '🔧',
    role: 'Backend Developer',
    trait: '체계적이고 설계 중심의',
    speakingStyle: '논리적이고 구조화된 설명 스타일',
    skills: ['api', 'database', 'auth'],
  },
  {
    roleId: 'qa',
    displayName: '지민',
    emoji: '🧪',
    role: 'QA Engineer',
    trait: '빈틈없이 꼼꼼한',
    speakingStyle: '조심스럽고 혹시... 로 시작하는 스타일',
    skills: ['testing', 'e2e', 'tdd'],
  },
];

describe('buildDiscussionPrompt', () => {
  it('프로젝트 정보를 포함한다', () => {
    const prompt = buildDiscussionPrompt(SAMPLE_PROJECT, SAMPLE_TEAM, 1);
    expect(prompt).toContain('텔레그램 봇');
    expect(prompt).toContain('telegram-bot');
    expect(prompt).toContain('날씨를 알려주는');
  });

  it('모든 팀원 정보를 포함한다', () => {
    const prompt = buildDiscussionPrompt(SAMPLE_PROJECT, SAMPLE_TEAM, 1);
    expect(prompt).toContain('민준');
    expect(prompt).toContain('도윤');
    expect(prompt).toContain('지민');
    expect(prompt).toContain('CTO');
    expect(prompt).toContain('Backend Developer');
    expect(prompt).toContain('QA Engineer');
  });

  it('말투와 성격을 포함한다', () => {
    const prompt = buildDiscussionPrompt(SAMPLE_PROJECT, SAMPLE_TEAM, 1);
    expect(prompt).toContain('전략적이고 큰 그림을 보는');
    expect(prompt).toContain('확신 있고 명확한 기술 리더 스타일');
  });

  it('기획서 형식 가이드를 포함한다', () => {
    const prompt = buildDiscussionPrompt(SAMPLE_PROJECT, SAMPLE_TEAM, 1);
    expect(prompt).toContain('프로젝트 개요');
    expect(prompt).toContain('기술 스택');
    expect(prompt).toContain('아키텍처');
    expect(prompt).toContain('역할별 작업 분배');
  });

  it('라운드 번호를 포함한다', () => {
    const prompt = buildDiscussionPrompt(SAMPLE_PROJECT, SAMPLE_TEAM, 2);
    expect(prompt).toContain('2');
  });
});

describe('parseDiscussionOutput', () => {
  it('기획서 섹션을 파싱한다', () => {
    const raw = `## 토론 내용\n팀원들 토론\n\n## 기획서\n# 프로젝트 개요\n텔레그램 봇`;
    const result = parseDiscussionOutput(raw);
    expect(result.planDocument).toContain('프로젝트 개요');
  });

  it('빈 출력을 처리한다', () => {
    const result = parseDiscussionOutput('');
    expect(result.planDocument).toBe('');
    expect(result.contributions).toEqual([]);
  });

  it('기획서가 없는 출력을 처리한다', () => {
    const result = parseDiscussionOutput('그냥 토론만 했습니다');
    expect(result.planDocument).toBe('');
  });
});

describe('buildPlanDocument', () => {
  it('마크다운 기획서를 생성한다', () => {
    const discussions = [
      { role: 'CTO', content: '아키텍처 의견' },
      { role: 'Backend', content: '백엔드 의견' },
    ];
    const doc = buildPlanDocument(SAMPLE_PROJECT, discussions);
    expect(doc).toContain('텔레그램 봇');
    expect(doc).toContain('프로젝트 개요');
    expect(doc).toContain('기술 스택');
    expect(doc).toContain('아키텍처');
    expect(doc).toContain('역할별 작업 분배');
    expect(doc).toContain('리스크');
  });

  it('필수 섹션이 모두 포함된다', () => {
    const doc = buildPlanDocument(SAMPLE_PROJECT, []);
    const sections = ['프로젝트 개요', '기술 스택', '아키텍처', '역할별 작업 분배', '일정', '리스크'];
    for (const section of sections) {
      expect(doc).toContain(section);
    }
  });
});
