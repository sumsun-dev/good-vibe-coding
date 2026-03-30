import { describe, it, expect } from 'vitest';
import {
  generateReport,
  generateRoleSummary,
  generateProjectStats,
  generateExecutiveSummary,
  extractSection,
  generateImplementationDetailsSection,
  generateEnvGuideSection,
  generateGettingStartedSection,
  buildPhaseReflection,
} from '../scripts/lib/output/report-generator.js';

const SAMPLE_PROJECT = {
  id: 'telegram-bot-2026-02',
  name: '텔레그램 봇',
  type: 'telegram-bot',
  description: '날씨를 알려주는 텔레그램 봇',
  status: 'completed',
  mode: 'plan-execute',
  team: [
    { roleId: 'cto', displayName: '민준', emoji: '', role: 'CTO' },
    { roleId: 'backend', displayName: '도윤', emoji: '', role: 'Backend Developer' },
    { roleId: 'qa', displayName: '지민', emoji: '', role: 'QA Engineer' },
  ],
  discussion: { rounds: [], planDocument: '# 기획서\n내용' },
  tasks: [
    { id: 'task-1', title: '아키텍처 설계', assignee: 'cto', status: 'completed' },
    { id: 'task-2', title: 'API 구현', assignee: 'backend', status: 'completed' },
    { id: 'task-3', title: 'DB 설계', assignee: 'backend', status: 'completed' },
    { id: 'task-4', title: '테스트 작성', assignee: 'qa', status: 'pending' },
  ],
};

describe('generateReport', () => {
  it('전체 보고서 구조를 포함한다', () => {
    const report = generateReport(SAMPLE_PROJECT);
    expect(report).toContain('텔레그램 봇');
    expect(report).toContain('보고서');
    expect(report).toContain('3명');
    expect(report).toContain('4개');
  });

  it('모든 팀원을 포함한다', () => {
    const report = generateReport(SAMPLE_PROJECT);
    expect(report).toContain('민준');
    expect(report).toContain('도윤');
    expect(report).toContain('지민');
    expect(report).toContain('CTO');
  });

  it('모드를 표시한다', () => {
    const report = generateReport(SAMPLE_PROJECT);
    expect(report).toContain('plan-execute');
  });

  it('기획서를 포함한다', () => {
    const report = generateReport(SAMPLE_PROJECT);
    expect(report).toContain('기획서');
  });
});

describe('generateRoleSummary', () => {
  it('역할별 요약을 생성한다', () => {
    const member = {
      roleId: 'backend',
      displayName: '도윤',
      emoji: '',
      role: 'Backend Developer',
    };
    const tasks = [
      { id: 'task-2', title: 'API 구현', assignee: 'backend', status: 'completed' },
      { id: 'task-3', title: 'DB 설계', assignee: 'backend', status: 'completed' },
    ];
    const summary = generateRoleSummary(member, tasks);
    expect(summary).toContain('도윤');
    expect(summary).toContain('Backend Developer');
    expect(summary).toContain('2개');
  });

  it('작업 없는 역할도 처리한다', () => {
    const member = { roleId: 'qa', displayName: '지민', emoji: '', role: 'QA Engineer' };
    const summary = generateRoleSummary(member, []);
    expect(summary).toContain('지민');
    expect(summary).toContain('0개');
  });
});

describe('generateProjectStats', () => {
  it('통계를 정확히 계산한다', () => {
    const stats = generateProjectStats(SAMPLE_PROJECT);
    expect(stats.totalTasks).toBe(4);
    expect(stats.completed).toBe(3);
    expect(stats.byRole.cto).toBe(1);
    expect(stats.byRole.backend).toBe(2);
    expect(stats.byRole.qa).toBe(1);
  });

  it('작업 없는 프로젝트를 처리한다', () => {
    const project = { ...SAMPLE_PROJECT, tasks: [] };
    const stats = generateProjectStats(project);
    expect(stats.totalTasks).toBe(0);
    expect(stats.completed).toBe(0);
  });
});

// --- 비용/성능 섹션 ---

describe('generateReport (비용/성능)', () => {
  it('메트릭스가 있으면 비용 섹션을 포함한다', () => {
    const project = {
      ...SAMPLE_PROJECT,
      metrics: {
        totalInputTokens: 5000,
        totalOutputTokens: 2000,
        totalCostUsd: 0.045,
        agentCalls: [],
        phaseMetrics: {},
        byRole: {
          cto: { callCount: 2, inputTokens: 2000, outputTokens: 1000, costUsd: 0.02 },
          backend: { callCount: 3, inputTokens: 3000, outputTokens: 1000, costUsd: 0.025 },
        },
        byProvider: {
          claude: { callCount: 5, inputTokens: 5000, outputTokens: 2000, costUsd: 0.045 },
        },
      },
    };
    const report = generateReport(project);
    expect(report).toContain('비용/성능');
    expect(report).toContain('총 비용');
    expect(report).toContain('에이전트 기여도');
  });

  it('메트릭스가 없으면 비용 섹션을 포함하지 않는다', () => {
    const project = { ...SAMPLE_PROJECT };
    delete project.metrics;
    const report = generateReport(project);
    expect(report).not.toContain('비용/성능');
  });
});

// --- Executive Summary ---

describe('generateExecutiveSummary', () => {
  it('완료율과 팀 규모를 포함한다', () => {
    const stats = generateProjectStats(SAMPLE_PROJECT);
    const summary = generateExecutiveSummary(SAMPLE_PROJECT, stats);
    expect(summary).toContain('Executive Summary');
    expect(summary).toContain('75%'); // 3/4
    expect(summary).toContain('3명');
  });

  it('실행 상태가 있으면 품질 게이트 통과율을 포함한다', () => {
    const project = {
      ...SAMPLE_PROJECT,
      executionState: {
        startedAt: '2026-03-01T00:00:00Z',
        completedAt: '2026-03-01T01:30:00Z',
        phaseResults: {
          1: { qualityGate: { passed: true } },
          2: { qualityGate: { passed: false } },
        },
      },
    };
    const stats = generateProjectStats(project);
    const summary = generateExecutiveSummary(project, stats);
    expect(summary).toContain('1/2 Phase 통과');
    expect(summary).toContain('1시간 30분');
  });

  it('completed 프로젝트에 적절한 다음 단계를 제안한다', () => {
    const stats = generateProjectStats(SAMPLE_PROJECT);
    const summary = generateExecutiveSummary(SAMPLE_PROJECT, stats);
    expect(summary).toContain('good-vibe:report');
    expect(summary).toContain('good-vibe:feedback');
  });

  it('planning 프로젝트에 적절한 다음 단계를 제안한다', () => {
    const project = { ...SAMPLE_PROJECT, status: 'planning' };
    const stats = generateProjectStats(project);
    const summary = generateExecutiveSummary(project, stats);
    expect(summary).toContain('good-vibe:discuss');
    expect(summary).toContain('good-vibe:approve');
  });

  it('generateReport에 Executive Summary가 포함된다', () => {
    const report = generateReport(SAMPLE_PROJECT);
    expect(report).toContain('Executive Summary');
    expect(report).toContain('완료율');
  });

  it('completed 프로젝트에 .env 설정 안내를 포함한다', () => {
    const stats = generateProjectStats(SAMPLE_PROJECT);
    const summary = generateExecutiveSummary(SAMPLE_PROJECT, stats);
    expect(summary).toContain('.env');
    expect(summary).toContain('의존성 설치');
  });
});

// --- extractSection ---

describe('extractSection', () => {
  it('마크다운에서 특정 섹션을 추출한다', () => {
    const text = '### 구현 요약\n텔레그램 봇을 만들었습니다.\n\n### 핵심 파일\n- src/index.js';
    const result = extractSection(text, '구현 요약');
    expect(result).toBe('텔레그램 봇을 만들었습니다.');
  });

  it('마지막 섹션도 추출한다', () => {
    const text = '### 구현 요약\n요약 내용\n### 커스터마이징 포인트\n- config.js 수정';
    const result = extractSection(text, '커스터마이징 포인트');
    expect(result).toBe('- config.js 수정');
  });

  it('없는 섹션은 null을 반환한다', () => {
    const text = '### 구현 요약\n내용';
    expect(extractSection(text, '없는 섹션')).toBeNull();
  });

  it('빈 입력은 null을 반환한다', () => {
    expect(extractSection(null, '구현 요약')).toBeNull();
    expect(extractSection('', '구현 요약')).toBeNull();
    expect(extractSection('텍스트', null)).toBeNull();
  });

  it('빈 섹션 내용은 null을 반환한다', () => {
    const text = '### 구현 요약\n\n### 다음 섹션\n내용';
    expect(extractSection(text, '구현 요약')).toBeNull();
  });
});

// --- generateImplementationDetailsSection ---

describe('generateImplementationDetailsSection', () => {
  it('phaseResults에서 구현 상세를 추출한다', () => {
    const project = {
      executionState: {
        phaseResults: {
          1: {
            taskResults: [
              {
                output: '### 구현 요약\n봇 구현 완료\n### 핵심 파일\n- src/bot.js: 메인 봇',
              },
            ],
          },
        },
      },
    };
    const section = generateImplementationDetailsSection(project);
    expect(section).toContain('## 구현 상세');
    expect(section).toContain('봇 구현 완료');
    expect(section).toContain('src/bot.js');
  });

  it('데이터가 없으면 빈 문자열을 반환한다', () => {
    expect(generateImplementationDetailsSection({})).toBe('');
    expect(generateImplementationDetailsSection({ executionState: null })).toBe('');
    expect(
      generateImplementationDetailsSection({
        executionState: { phaseResults: { 1: { taskResults: [] } } },
      }),
    ).toBe('');
  });

  it('taskOutput 필드도 지원한다', () => {
    const project = {
      executionState: {
        phaseResults: {
          1: {
            taskResults: [{ taskOutput: '### 구현 요약\nAPI 구현 완료' }],
          },
        },
      },
    };
    const section = generateImplementationDetailsSection(project);
    expect(section).toContain('API 구현 완료');
  });
});

// --- generateEnvGuideSection ---

describe('generateEnvGuideSection', () => {
  it('환경변수 가이드를 생성한다', () => {
    const project = {
      executionState: {
        phaseResults: {
          1: {
            taskResults: [
              {
                output:
                  '### 외부 서비스 및 환경변수\n- TELEGRAM_BOT_TOKEN: 텔레그램 봇 토큰 (https://t.me/botfather)\n- NEWS_API_KEY: 뉴스 API 키',
              },
            ],
          },
        },
      },
    };
    const section = generateEnvGuideSection(project);
    expect(section).toContain('## 환경변수 설정 가이드');
    expect(section).toContain('TELEGRAM_BOT_TOKEN=');
    expect(section).toContain('NEWS_API_KEY=');
    expect(section).toContain('.env');
  });

  it('"없음"이면 빈 문자열을 반환한다', () => {
    const project = {
      executionState: {
        phaseResults: {
          1: {
            taskResults: [{ output: '### 외부 서비스 및 환경변수\n없음' }],
          },
        },
      },
    };
    expect(generateEnvGuideSection(project)).toBe('');
  });

  it('데이터가 없으면 빈 문자열을 반환한다', () => {
    expect(generateEnvGuideSection({})).toBe('');
  });
});

// --- generateGettingStartedSection ---

describe('generateGettingStartedSection', () => {
  it('materializeResult에서 파일 목록을 수집한다', () => {
    const project = {
      type: 'telegram-bot',
      executionState: {
        phaseResults: {
          1: {
            taskResults: [],
            materializeResult: {
              files: [{ path: 'src/bot.js' }, { path: 'package.json' }],
            },
          },
        },
      },
    };
    const section = generateGettingStartedSection(project);
    expect(section).toContain('## 시작 가이드');
    expect(section).toContain('src/bot.js');
    expect(section).toContain('package.json');
  });

  it('에이전트 출력에서 실행 방법을 추출한다', () => {
    const project = {
      type: 'web-app',
      executionState: {
        phaseResults: {
          1: {
            taskResults: [{ output: '### 실행 방법\nnpm run dev로 실행 후 localhost:3000 확인' }],
          },
        },
      },
    };
    const section = generateGettingStartedSection(project);
    expect(section).toContain('npm run dev');
  });

  it('실행 방법이 없으면 프로젝트 타입별 기본 가이드를 제공한다', () => {
    const project = {
      type: 'telegram-bot',
      executionState: {
        phaseResults: {
          1: {
            taskResults: [],
            materializeResult: { files: ['src/bot.js'] },
          },
        },
      },
    };
    const section = generateGettingStartedSection(project);
    expect(section).toContain('TELEGRAM_BOT_TOKEN');
    expect(section).toContain('npm start');
  });

  it('데이터가 없으면 빈 문자열을 반환한다', () => {
    expect(generateGettingStartedSection({})).toBe('');
  });
});

// --- buildPhaseReflection ---

describe('buildPhaseReflection', () => {
  it('phaseResults 배열이 있으면 회고 섹션을 반환한다', () => {
    const project = {
      executionState: {
        phaseResults: [
          { phaseNumber: 1, tasks: [{ id: 't1' }, { id: 't2' }], fixAttempts: 0, qualityScore: 90 },
          { phaseNumber: 2, tasks: [{ id: 't3' }], fixAttempts: 1, qualityScore: 75 },
        ],
      },
    };
    const result = buildPhaseReflection(project);
    expect(result).toContain('## Phase별 회고');
    expect(result).toContain('Phase 1');
    expect(result).toContain('태스크 2개');
    expect(result).toContain('첫 시도 통과');
    expect(result).toContain('90점');
    expect(result).toContain('Phase 2');
    expect(result).toContain('수정 1회');
    expect(result).toContain('75점');
  });

  it('phaseResults가 없으면 빈 문자열을 반환한다', () => {
    expect(buildPhaseReflection({})).toBe('');
    expect(buildPhaseReflection({ executionState: null })).toBe('');
    expect(buildPhaseReflection({ executionState: {} })).toBe('');
  });

  it('phaseResults가 빈 배열이면 빈 문자열을 반환한다', () => {
    const project = { executionState: { phaseResults: [] } };
    expect(buildPhaseReflection(project)).toBe('');
  });

  it('qualityScore가 없으면 "-"으로 표시한다', () => {
    const project = {
      executionState: {
        phaseResults: [{ phaseNumber: 1, tasks: [], fixAttempts: 0 }],
      },
    };
    const result = buildPhaseReflection(project);
    expect(result).toContain('품질 -');
  });

  it('phaseNumber가 없으면 "?"로 표시한다', () => {
    const project = {
      executionState: {
        phaseResults: [{ tasks: [], fixAttempts: 0 }],
      },
    };
    const result = buildPhaseReflection(project);
    expect(result).toContain('Phase ?');
  });
});

// --- generateReport 보고서 확장 ---

describe('generateReport (확장 섹션)', () => {
  it('구현 상세/환경변수/시작 가이드가 데이터 있을 때만 포함된다', () => {
    const project = {
      ...SAMPLE_PROJECT,
      executionState: {
        startedAt: '2026-03-01T00:00:00Z',
        phaseResults: {
          1: {
            taskResults: [
              {
                output: '### 구현 요약\n봇 완성\n### 외부 서비스 및 환경변수\n- BOT_TOKEN: 토큰',
              },
            ],
            materializeResult: { files: [{ path: 'src/bot.js' }] },
            reviews: [],
            qualityGate: null,
            committed: false,
          },
        },
        journal: [],
        completedPhases: [],
      },
    };
    const report = generateReport(project);
    expect(report).toContain('## 구현 상세');
    expect(report).toContain('## 환경변수 설정 가이드');
    expect(report).toContain('## 시작 가이드');
  });

  it('데이터가 없으면 확장 섹션을 포함하지 않는다', () => {
    const report = generateReport(SAMPLE_PROJECT);
    expect(report).not.toContain('## 구현 상세');
    expect(report).not.toContain('## 환경변수 설정 가이드');
    expect(report).not.toContain('## 시작 가이드');
  });
});
