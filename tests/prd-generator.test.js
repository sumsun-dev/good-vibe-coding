import { describe, it, expect } from 'vitest';
import {
  buildPrdPrompt,
  parsePrdResult,
  formatPrdForDisplay,
} from '../scripts/lib/project/prd-generator.js';

// --- buildPrdPrompt ---

describe('buildPrdPrompt', () => {
  it('기본 프롬프트를 생성한다', () => {
    const prompt = buildPrdPrompt('팀 채팅 앱', {
      scope: { score: 0.8, evidence: '범위 명확' },
      userStory: { score: 0.7, evidence: '시나리오 있음' },
    });
    expect(prompt).toContain('팀 채팅 앱');
    expect(prompt).toContain('scope');
    expect(prompt).toContain('0.8');
    expect(prompt).toContain('PRD 작성 지침');
    expect(prompt).toContain('JSON');
    expect(prompt).toContain('아키텍처 다이어그램');
    expect(prompt).toContain('화면 흐름');
    expect(prompt).toContain('architectureDiagram');
    expect(prompt).toContain('screenFlow');
  });

  it('codebaseInfo를 포함한다', () => {
    const prompt = buildPrdPrompt(
      '기존 프로젝트 확장',
      { scope: { score: 0.9, evidence: '명확' } },
      { techStack: ['React', 'Express'], fileStructure: 'src/' },
    );
    expect(prompt).toContain('코드베이스 정보');
    expect(prompt).toContain('React');
    expect(prompt).toContain('Express');
  });

  it('빈 설명이면 빈 문자열을 반환한다', () => {
    expect(buildPrdPrompt('', {})).toBe('');
    expect(buildPrdPrompt(null, {})).toBe('');
    expect(buildPrdPrompt(undefined, {})).toBe('');
  });

  it('clarityDimensions가 없어도 동작한다', () => {
    const prompt = buildPrdPrompt('앱 만들기', null);
    expect(prompt).toContain('앱 만들기');
    expect(prompt).toContain('PRD 작성 지침');
  });

  it('user-input 태그로 description을 감싼다', () => {
    const prompt = buildPrdPrompt('채팅 앱', { scope: { score: 0.8 } });
    expect(prompt).toContain('<user-input label="description">');
    expect(prompt).toContain('</user-input>');
    expect(prompt).toContain('user-input');
  });
});

// --- parsePrdResult ---

describe('parsePrdResult', () => {
  const validPrd = {
    overview: '실시간 채팅 앱',
    coreFeatures: ['실시간 채팅', '파일 공유'],
    userScenarios: ['팀원이 채팅방 생성'],
    technicalRequirements: {
      stack: ['React', 'Node.js'],
      integrations: ['AWS S3'],
      constraints: ['동시접속 100명'],
    },
    successCriteria: ['메시지 1초 이내 전송'],
    estimatedScope: { complexity: 'medium', reasoning: '채팅 집중' },
  };

  it('JSON 직접 파싱', () => {
    const result = parsePrdResult(JSON.stringify(validPrd));
    expect(result.overview).toBe('실시간 채팅 앱');
    expect(result.coreFeatures).toEqual(['실시간 채팅', '파일 공유']);
    expect(result.technicalRequirements.stack).toEqual(['React', 'Node.js']);
    expect(result.estimatedScope.complexity).toBe('medium');
  });

  it('fence 블록에서 파싱', () => {
    const raw = `여기 PRD입니다:\n\`\`\`json\n${JSON.stringify(validPrd)}\n\`\`\``;
    const result = parsePrdResult(raw);
    expect(result.overview).toBe('실시간 채팅 앱');
    expect(result.coreFeatures).toHaveLength(2);
  });

  it('누락 필드에 기본값 적용', () => {
    const partial = { overview: '간단한 앱' };
    const result = parsePrdResult(JSON.stringify(partial));
    expect(result.overview).toBe('간단한 앱');
    expect(result.coreFeatures).toEqual([]);
    expect(result.userScenarios).toEqual([]);
    expect(result.technicalRequirements).toEqual({
      stack: [],
      integrations: [],
      constraints: [],
    });
    expect(result.successCriteria).toEqual([]);
    expect(result.estimatedScope).toEqual({ complexity: 'unknown', reasoning: '' });
    expect(result.architectureDiagram).toBe('');
    expect(result.screenFlow).toBe('');
  });

  it('빈 입력이면 빈 PRD를 반환한다', () => {
    const result = parsePrdResult('');
    expect(result.overview).toBe('');
    expect(result.coreFeatures).toEqual([]);
  });

  it('null 입력이면 빈 PRD를 반환한다', () => {
    const result = parsePrdResult(null);
    expect(result.overview).toBe('');
  });

  it('architectureDiagram과 screenFlow를 파싱한다', () => {
    const withDiagrams = {
      ...validPrd,
      architectureDiagram: 'graph TD\n  A[SPA] --> B[API]',
      screenFlow: 'flowchart LR\n  A[로그인] --> B[대시보드]',
    };
    const result = parsePrdResult(JSON.stringify(withDiagrams));
    expect(result.architectureDiagram).toBe('graph TD\n  A[SPA] --> B[API]');
    expect(result.screenFlow).toBe('flowchart LR\n  A[로그인] --> B[대시보드]');
  });

  it('레거시 diagram 필드를 architectureDiagram으로 매핑한다', () => {
    const legacy = { ...validPrd, diagram: 'graph TD\n  A --> B' };
    const result = parsePrdResult(JSON.stringify(legacy));
    expect(result.architectureDiagram).toBe('graph TD\n  A --> B');
  });
});

// --- formatPrdForDisplay ---

describe('formatPrdForDisplay', () => {
  it('전체 필드를 마크다운으로 포맷한다', () => {
    const prd = {
      overview: '실시간 채팅 앱',
      coreFeatures: ['실시간 채팅', '파일 공유'],
      userScenarios: ['팀원이 채팅방 생성'],
      technicalRequirements: {
        stack: ['React', 'Node.js'],
        integrations: ['AWS S3'],
        constraints: ['동시접속 100명'],
      },
      successCriteria: ['메시지 1초 이내 전송'],
      estimatedScope: { complexity: 'medium', reasoning: '채팅 집중' },
    };

    const md = formatPrdForDisplay(prd);
    expect(md).toContain('## 프로젝트 개요');
    expect(md).toContain('실시간 채팅 앱');
    expect(md).toContain('## 핵심 기능');
    expect(md).toContain('실시간 채팅');
    expect(md).toContain('파일 공유');
    expect(md).toContain('## 사용자 시나리오');
    expect(md).toContain('## 기술 요구사항');
    expect(md).toContain('React');
    expect(md).toContain('AWS S3');
    expect(md).toContain('## 성공 기준');
    expect(md).toContain('## 예상 규모');
    expect(md).toContain('medium');
  });

  it('아키텍처 다이어그램을 Mermaid 블록으로 표시한다', () => {
    const prd = {
      overview: '웹앱',
      coreFeatures: [],
      userScenarios: [],
      technicalRequirements: { stack: [], integrations: [], constraints: [] },
      successCriteria: [],
      estimatedScope: { complexity: 'medium', reasoning: '' },
      architectureDiagram: 'graph TD\n  A[SPA] --> B[API]',
    };

    const md = formatPrdForDisplay(prd);
    expect(md).toContain('## 시스템 아키텍처');
    expect(md).toContain('```mermaid');
    expect(md).toContain('graph TD');
    expect(md).toContain('A[SPA] --> B[API]');
  });

  it('화면 흐름이 있으면 별도 Mermaid 블록으로 표시한다', () => {
    const prd = {
      overview: '웹앱',
      coreFeatures: [],
      userScenarios: [],
      technicalRequirements: { stack: [], integrations: [], constraints: [] },
      successCriteria: [],
      estimatedScope: { complexity: 'medium', reasoning: '' },
      architectureDiagram: 'graph TD\n  A --> B',
      screenFlow: 'flowchart LR\n  A[로그인] --> B[대시보드]',
    };

    const md = formatPrdForDisplay(prd);
    expect(md).toContain('## 시스템 아키텍처');
    expect(md).toContain('## 화면 흐름');
    expect(md).toContain('flowchart LR');
    expect(md).toContain('A[로그인] --> B[대시보드]');
  });

  it('다이어그램이 없으면 해당 섹션을 생략한다', () => {
    const prd = {
      overview: 'CLI 도구',
      coreFeatures: ['파일 처리'],
      userScenarios: [],
      technicalRequirements: { stack: [], integrations: [], constraints: [] },
      successCriteria: [],
      estimatedScope: { complexity: 'simple', reasoning: '' },
      architectureDiagram: '',
      screenFlow: '',
    };

    const md = formatPrdForDisplay(prd);
    expect(md).not.toContain('## 시스템 아키텍처');
    expect(md).not.toContain('## 화면 흐름');
    expect(md).not.toContain('```mermaid');
  });

  it('부분 필드만 있어도 동작한다', () => {
    const prd = { overview: '간단한 도구' };
    const md = formatPrdForDisplay(prd);
    expect(md).toContain('## 프로젝트 개요');
    expect(md).toContain('간단한 도구');
  });

  it('빈 PRD도 동작한다', () => {
    const md = formatPrdForDisplay({});
    expect(md).toContain('## 프로젝트 개요');
  });

  it('null 입력도 동작한다', () => {
    const md = formatPrdForDisplay(null);
    expect(md).toContain('## 프로젝트 개요');
  });
});
