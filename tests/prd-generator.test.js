import { describe, it, expect } from 'vitest';
import {
  buildPrdPrompt,
  parsePrdResult,
  formatPrdForDisplay,
  assessPrdQuality,
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

  it('프롬프트에 와이어프레임 지시사항을 포함한다', () => {
    const prompt = buildPrdPrompt('웹 대시보드', { scope: { score: 0.9 } });
    expect(prompt).toContain('와이어프레임');
    expect(prompt).toContain('wireframes');
    expect(prompt).toContain('ASCII art');
  });

  it('prdFeedback이 있으면 CEO 피드백 섹션을 포함한다', () => {
    const prompt = buildPrdPrompt(
      '채팅 앱',
      { scope: { score: 0.8 } },
      null,
      '핵심 기능에 음성 통화를 추가해주세요',
    );
    expect(prompt).toContain('CEO 피드백');
    expect(prompt).toContain('핵심 기능에 음성 통화를 추가해주세요');
    expect(prompt).toContain('ceo-feedback');
  });

  it('prdFeedback이 null이면 CEO 피드백 섹션을 생략한다', () => {
    const prompt = buildPrdPrompt('채팅 앱', { scope: { score: 0.8 } }, null, null);
    expect(prompt).not.toContain('CEO 피드백');
  });

  it('prdFeedback이 빈 문자열이면 CEO 피드백 섹션을 생략한다', () => {
    const prompt = buildPrdPrompt('채팅 앱', { scope: { score: 0.8 } }, null, '');
    expect(prompt).not.toContain('CEO 피드백');
  });

  it('프롬프트에 품질 기대치(BAD/GOOD 예시)를 포함한다', () => {
    const prompt = buildPrdPrompt('채팅 앱', { scope: { score: 0.8 } });
    expect(prompt).toContain('BAD');
    expect(prompt).toContain('GOOD');
  });

  it('프롬프트에 자가 검증 체크리스트를 포함한다', () => {
    const prompt = buildPrdPrompt('채팅 앱', { scope: { score: 0.8 } });
    expect(prompt).toContain('품질 체크리스트');
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
    expect(result.wireframes).toBe('');
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

  it('wireframes를 파싱한다', () => {
    const withWireframes = {
      ...validPrd,
      wireframes: '┌──────────┐\n│  Header  │\n└──────────┘',
    };
    const result = parsePrdResult(JSON.stringify(withWireframes));
    expect(result.wireframes).toBe('┌──────────┐\n│  Header  │\n└──────────┘');
  });

  it('wireframes가 없으면 빈 문자열을 반환한다', () => {
    const result = parsePrdResult(JSON.stringify(validPrd));
    expect(result.wireframes).toBe('');
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

  it('와이어프레임이 있으면 화면 레이아웃 섹션을 표시한다', () => {
    const prd = {
      overview: '웹앱',
      coreFeatures: [],
      userScenarios: [],
      technicalRequirements: { stack: [], integrations: [], constraints: [] },
      successCriteria: [],
      estimatedScope: { complexity: 'medium', reasoning: '' },
      wireframes: '┌──────────┐\n│  Header  │\n└──────────┘',
    };

    const md = formatPrdForDisplay(prd);
    expect(md).toContain('## 화면 레이아웃');
    expect(md).toContain('┌──────────┐');
    expect(md).not.toContain('```mermaid\n┌');
  });

  it('와이어프레임이 없으면 화면 레이아웃 섹션을 생략한다', () => {
    const prd = {
      overview: 'API 서버',
      coreFeatures: [],
      userScenarios: [],
      technicalRequirements: { stack: [], integrations: [], constraints: [] },
      successCriteria: [],
      estimatedScope: { complexity: 'simple', reasoning: '' },
      wireframes: '',
    };

    const md = formatPrdForDisplay(prd);
    expect(md).not.toContain('## 화면 레이아웃');
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

// --- assessPrdQuality ---

describe('assessPrdQuality', () => {
  it('충분한 PRD에 adequate: true를 반환한다', () => {
    const prd = {
      overview: '원격팀용 실시간 채팅 앱으로 채널 기반 소통으로 협업을 개선합니다',
      coreFeatures: [
        '실시간 채팅 — 텍스트/이미지 전송, 읽음 확인',
        '채널 관리 — 팀별 채널 생성/삭제/초대',
        '파일 공유 — 드래그앤드롭 파일 업로드 및 미리보기',
      ],
      userScenarios: ['김과장이 팀 채널에 접속하여 스레드를 생성하고 팀원을 멘션한다'],
      technicalRequirements: {
        stack: ['React', 'Node.js', 'WebSocket'],
        integrations: [],
        constraints: [],
      },
      successCriteria: [
        '메시지 전송 시 500ms 이내 표시',
        '동시접속 100명 지원',
        '파일 업로드 10MB',
      ],
      architectureDiagram: 'graph TD\n  A[React SPA] --> B[Express API]\n  B --> C[(PostgreSQL)]',
    };
    const result = assessPrdQuality(prd);
    expect(result.adequate).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.warnings).toHaveLength(0);
  });

  it('부족한 PRD에 adequate: false + warnings를 반환한다', () => {
    const prd = {
      overview: '채팅 앱',
      coreFeatures: ['채팅'],
      userScenarios: [],
      technicalRequirements: { stack: [], integrations: [], constraints: [] },
      successCriteria: ['동작한다'],
      architectureDiagram: '',
    };
    const result = assessPrdQuality(prd);
    expect(result.adequate).toBe(false);
    expect(result.score).toBeLessThan(50);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('빈 PRD에 score 0 + adequate: false를 반환한다', () => {
    const prd = {
      overview: '',
      coreFeatures: [],
      userScenarios: [],
      technicalRequirements: { stack: [], integrations: [], constraints: [] },
      successCriteria: [],
      architectureDiagram: '',
    };
    const result = assessPrdQuality(prd);
    expect(result.score).toBe(0);
    expect(result.adequate).toBe(false);
    expect(result.warnings.length).toBe(6);
  });

  it('null/undefined 입력에도 안전하게 동작한다', () => {
    expect(assessPrdQuality(null).adequate).toBe(false);
    expect(assessPrdQuality(undefined).adequate).toBe(false);
    expect(assessPrdQuality({}).adequate).toBe(false);
  });

  it('overview가 30자 미만이면 warning을 포함한다', () => {
    const prd = {
      overview: '채팅 앱',
      coreFeatures: ['a'.repeat(20), 'b'.repeat(20), 'c'.repeat(20)],
      userScenarios: ['a'.repeat(30)],
      technicalRequirements: { stack: ['Node.js'], integrations: [], constraints: [] },
      successCriteria: ['기준1', '기준2', '기준3'],
      architectureDiagram: 'a'.repeat(20),
    };
    const result = assessPrdQuality(prd);
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining('overview')]));
  });

  it('coreFeatures가 3개 미만이면 warning을 포함한다', () => {
    const prd = {
      overview: 'a'.repeat(30),
      coreFeatures: ['기능1', '기능2'],
      userScenarios: ['a'.repeat(30)],
      technicalRequirements: { stack: ['Node.js'], integrations: [], constraints: [] },
      successCriteria: ['기준1', '기준2', '기준3'],
      architectureDiagram: 'a'.repeat(20),
    };
    const result = assessPrdQuality(prd);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('coreFeatures')]),
    );
  });

  it('coreFeatures 항목이 20자 미만이면 warning을 포함한다', () => {
    const prd = {
      overview: 'a'.repeat(30),
      coreFeatures: ['짧은기능', '짧은기능2', '짧은기능3'],
      userScenarios: ['a'.repeat(30)],
      technicalRequirements: { stack: ['Node.js'], integrations: [], constraints: [] },
      successCriteria: ['기준1', '기준2', '기준3'],
      architectureDiagram: 'a'.repeat(20),
    };
    const result = assessPrdQuality(prd);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('coreFeatures')]),
    );
  });
});
