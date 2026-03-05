import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm } from 'fs/promises';
import { resolve } from 'path';
import {
  extractAgentPerformance,
  buildImprovementPrompt,
  parseImprovementSuggestions,
  saveAgentOverride,
  loadAgentOverride,
  listAgentOverrides,
  mergeAgentWithOverride,
  setOverridesDir,
  saveProjectOverride,
  loadProjectOverride,
  listProjectOverrides,
  mergeAgentWithOverrides,
  aggregateCrossProjectFeedback,
  formatCrossProjectPatterns,
} from '../scripts/lib/agent/agent-feedback.js';

const TMP_DIR = resolve('.tmp-test-agent-feedback');

beforeEach(async () => {
  await mkdir(TMP_DIR, { recursive: true });
  setOverridesDir(TMP_DIR);
});

afterEach(async () => {
  await rm(TMP_DIR, { recursive: true, force: true });
});

const SAMPLE_PROJECT = {
  id: 'proj-1',
  name: '테스트 프로젝트',
  type: 'web-app',
  status: 'completed',
  team: [
    { roleId: 'cto', displayName: '민준', emoji: '', role: 'CTO' },
    { roleId: 'backend', displayName: '도윤', emoji: '', role: 'Backend Developer' },
    { roleId: 'qa', displayName: '지민', emoji: '', role: 'QA Engineer' },
  ],
  tasks: [
    {
      id: 'task-1',
      title: '아키텍처 설계',
      assignee: 'cto',
      status: 'completed',
      reviews: [{ approved: true, feedback: '좋습니다', issues: [] }],
    },
    {
      id: 'task-2',
      title: 'API 구현',
      assignee: 'backend',
      status: 'completed',
      reviews: [
        {
          approved: false,
          feedback: '에러 처리 부족',
          issues: [
            { severity: 'critical', description: 'SQL injection 취약점' },
            { severity: 'important', description: '에러 응답 형식 불일치' },
          ],
        },
      ],
    },
    {
      id: 'task-3',
      title: '테스트 작성',
      assignee: 'qa',
      status: 'completed',
      reviews: [{ approved: true, feedback: '커버리지 충분', issues: [] }],
    },
  ],
  discussion: {},
};

describe('extractAgentPerformance', () => {
  it('프로젝트에서 역할별 성과를 추출한다', () => {
    const performances = extractAgentPerformance(SAMPLE_PROJECT);
    expect(performances.length).toBe(3);

    const cto = performances.find((p) => p.roleId === 'cto');
    expect(cto.tasks.length).toBe(1);
    expect(cto.issues.length).toBe(0);

    const backend = performances.find((p) => p.roleId === 'backend');
    expect(backend.tasks.length).toBe(1);
    expect(backend.issues.length).toBe(2);
    expect(backend.issues[0].severity).toBe('critical');
  });

  it('빈 프로젝트를 처리한다', () => {
    const performances = extractAgentPerformance({ team: [], tasks: [] });
    expect(performances).toEqual([]);
  });

  it('리뷰가 없는 작업도 처리한다', () => {
    const project = {
      team: [{ roleId: 'backend' }],
      tasks: [{ id: 't-1', title: 'A', assignee: 'backend', status: 'completed' }],
    };
    const performances = extractAgentPerformance(project);
    expect(performances[0].reviews).toEqual([]);
    expect(performances[0].issues).toEqual([]);
  });

  it('undefined 프로젝트 필드를 안전하게 처리한다', () => {
    expect(() => extractAgentPerformance({})).not.toThrow();
    expect(extractAgentPerformance({})).toEqual([]);
  });

  it('minor 이슈는 필터링한다', () => {
    const project = {
      team: [{ roleId: 'backend' }],
      tasks: [
        {
          id: 't-1',
          title: 'A',
          assignee: 'backend',
          status: 'completed',
          reviews: [
            {
              approved: true,
              feedback: 'OK',
              issues: [{ severity: 'minor', description: '변수명 개선' }],
            },
          ],
        },
      ],
    };
    const performances = extractAgentPerformance(project);
    expect(performances[0].issues.length).toBe(0);
  });
});

describe('buildImprovementPrompt', () => {
  it('프롬프트를 생성한다', () => {
    const performance = {
      roleId: 'backend',
      tasks: [{ title: 'API 구현', status: 'completed' }],
      reviews: [{ approved: false, feedback: '에러 처리 부족' }],
      issues: [{ severity: 'critical', description: 'SQL injection' }],
    };
    const agentMd = '# Backend Developer\n역할: API 설계 및 구현';
    const prompt = buildImprovementPrompt('backend', performance, agentMd);

    expect(prompt).toContain('backend');
    expect(prompt).toContain('API 구현');
    expect(prompt).toContain('SQL injection');
    expect(prompt).toContain('에러 처리 부족');
    expect(prompt).toContain('Backend Developer');
  });

  it('작업/이슈가 없는 경우도 처리한다', () => {
    const performance = { roleId: 'qa', tasks: [], reviews: [], issues: [] };
    const prompt = buildImprovementPrompt('qa', performance, '# QA');
    expect(prompt).toContain('담당 작업 없음');
    expect(prompt).toContain('이슈 없음');
  });
});

describe('parseImprovementSuggestions', () => {
  it('JSON 배열을 파싱한다', () => {
    const text = JSON.stringify([
      { section: '역할', current: '기존', suggested: '개선', reason: '이유' },
    ]);
    const suggestions = parseImprovementSuggestions(text);
    expect(suggestions.length).toBe(1);
    expect(suggestions[0].section).toBe('역할');
    expect(suggestions[0].suggested).toBe('개선');
  });

  it('코드블록 안의 JSON을 추출한다', () => {
    const text = '분석 결과:\n```json\n[{"section":"A","suggested":"B","reason":"C"}]\n```';
    const suggestions = parseImprovementSuggestions(text);
    expect(suggestions.length).toBe(1);
    expect(suggestions[0].section).toBe('A');
  });

  it('텍스트 안의 배열 패턴을 추출한다', () => {
    const text = '제안입니다: [{"section":"X","suggested":"Y","reason":"Z"}] 끝';
    const suggestions = parseImprovementSuggestions(text);
    expect(suggestions.length).toBe(1);
  });

  it('빈 입력은 빈 배열을 반환한다', () => {
    expect(parseImprovementSuggestions('')).toEqual([]);
    expect(parseImprovementSuggestions(null)).toEqual([]);
  });

  it('파싱 불가능한 텍스트는 빈 배열을 반환한다', () => {
    expect(parseImprovementSuggestions('이건 JSON이 아닙니다')).toEqual([]);
  });

  it('suggested 필드가 없는 항목은 필터링한다', () => {
    const text = JSON.stringify([
      { section: 'A', suggested: '개선', reason: '이유' },
      { section: 'B', reason: '이유만' },
    ]);
    const suggestions = parseImprovementSuggestions(text);
    expect(suggestions.length).toBe(1);
  });

  it('빈 배열도 정상 처리한다', () => {
    const suggestions = parseImprovementSuggestions('[]');
    expect(suggestions).toEqual([]);
  });

  it('non-array JSON은 빈 배열을 반환한다', () => {
    expect(parseImprovementSuggestions('{"key": "value"}')).toEqual([]);
  });
});

describe('saveAgentOverride / loadAgentOverride', () => {
  it('오버라이드를 저장하고 로드한다', async () => {
    await saveAgentOverride('backend', '# 개선사항\n- 에러 처리 강화');
    const content = await loadAgentOverride('backend');
    expect(content).toContain('에러 처리 강화');
  });

  it('존재하지 않는 오버라이드는 null을 반환한다', async () => {
    const content = await loadAgentOverride('nonexistent');
    expect(content).toBeNull();
  });

  it('오버라이드를 덮어쓴다', async () => {
    await saveAgentOverride('cto', '버전 1');
    await saveAgentOverride('cto', '버전 2');
    const content = await loadAgentOverride('cto');
    expect(content).toBe('버전 2');
  });

  it('경로 순회 roleId를 거부한다', async () => {
    await expect(saveAgentOverride('../etc/passwd', 'x')).rejects.toThrow('유효하지 않은 roleId');
    await expect(saveAgentOverride('foo/bar', 'x')).rejects.toThrow('유효하지 않은 roleId');
    await expect(loadAgentOverride('../../.ssh/id_rsa')).rejects.toThrow('유효하지 않은 roleId');
  });

  it('빈 roleId를 거부한다', async () => {
    await expect(saveAgentOverride('', 'x')).rejects.toThrow('비어있지 않은 문자열');
    await expect(saveAgentOverride(null, 'x')).rejects.toThrow('비어있지 않은 문자열');
  });
});

describe('listAgentOverrides', () => {
  it('오버라이드 목록을 반환한다', async () => {
    await saveAgentOverride('cto', '# CTO 개선');
    await saveAgentOverride('backend', '# Backend 개선');
    const list = await listAgentOverrides();
    expect(list.length).toBe(2);
    expect(list.map((l) => l.roleId).sort()).toEqual(['backend', 'cto']);
    expect(list[0].updatedAt).toBeTruthy();
  });

  it('빈 디렉토리는 빈 배열을 반환한다', async () => {
    const list = await listAgentOverrides();
    expect(list).toEqual([]);
  });

  it('디렉토리가 없으면 빈 배열을 반환한다', async () => {
    setOverridesDir(resolve(TMP_DIR, 'nonexistent'));
    const list = await listAgentOverrides();
    expect(list).toEqual([]);
  });
});

describe('mergeAgentWithOverride', () => {
  it('기본 .md와 오버라이드를 병합한다', () => {
    const base = '# Backend Developer\n역할: API 설계';
    const override = '- 에러 처리를 반드시 포함할 것\n- SQL 파라미터화 필수';
    const merged = mergeAgentWithOverride(base, override);
    expect(merged).toContain('Backend Developer');
    expect(merged).toContain('오버라이드 (프로젝트 피드백 기반)');
    expect(merged).toContain('에러 처리를 반드시 포함할 것');
  });

  it('오버라이드가 없으면 기본 .md만 반환한다', () => {
    const base = '# CTO\n역할: 아키텍처';
    expect(mergeAgentWithOverride(base, null)).toBe(base);
    expect(mergeAgentWithOverride(base, '')).toBe(base);
  });

  it('기본 .md가 없으면 오버라이드만 반환한다', () => {
    const override = '- 개선사항';
    expect(mergeAgentWithOverride(null, override)).toBe(override);
    expect(mergeAgentWithOverride('', override)).toBe(override);
  });
});

// --- 프로젝트 레벨 오버라이드 ---

describe('saveProjectOverride / loadProjectOverride', () => {
  it('프로젝트 레벨 오버라이드를 저장하고 로드한다', async () => {
    await saveProjectOverride(TMP_DIR, 'backend', '# 프로젝트 레벨 개선\n- 에러 처리 강화');
    const content = await loadProjectOverride(TMP_DIR, 'backend');
    expect(content).toContain('프로젝트 레벨 개선');
    expect(content).toContain('에러 처리 강화');
  });

  it('존재하지 않는 오버라이드는 null을 반환한다', async () => {
    const content = await loadProjectOverride(TMP_DIR, 'nonexistent');
    expect(content).toBeNull();
  });

  it('경로 순회 roleId를 거부한다', async () => {
    await expect(saveProjectOverride(TMP_DIR, '../etc/passwd', 'x')).rejects.toThrow(
      '유효하지 않은 roleId',
    );
    await expect(loadProjectOverride(TMP_DIR, '../../etc/passwd')).rejects.toThrow(
      '유효하지 않은 roleId',
    );
  });
});

describe('listProjectOverrides', () => {
  it('프로젝트 레벨 오버라이드 목록을 반환한다', async () => {
    await saveProjectOverride(TMP_DIR, 'cto', '# CTO');
    await saveProjectOverride(TMP_DIR, 'backend', '# Backend');
    const list = await listProjectOverrides(TMP_DIR);
    expect(list.length).toBe(2);
    expect(list.map((l) => l.roleId).sort()).toEqual(['backend', 'cto']);
  });

  it('디렉토리가 없으면 빈 배열을 반환한다', async () => {
    const list = await listProjectOverrides(resolve(TMP_DIR, 'nonexistent'));
    expect(list).toEqual([]);
  });
});

describe('mergeAgentWithOverrides', () => {
  it('다중 소스 오버라이드를 병합한다 (user → project 순서)', () => {
    const base = '# Backend Developer';
    const overrides = [
      { source: 'user', content: '사용자 피드백' },
      { source: 'project', content: '프로젝트 피드백' },
    ];
    const merged = mergeAgentWithOverrides(base, overrides);
    expect(merged).toContain('Backend Developer');
    expect(merged).toContain('사용자 피드백');
    expect(merged).toContain('프로젝트 피드백');
    // project가 user보다 뒤에 (높은 우선순위)
    const userIdx = merged.indexOf('사용자 피드백');
    const projectIdx = merged.indexOf('프로젝트 피드백');
    expect(projectIdx).toBeGreaterThan(userIdx);
  });

  it('오버라이드가 없으면 기본 .md만 반환한다', () => {
    expect(mergeAgentWithOverrides('# Base', [])).toBe('# Base');
    expect(mergeAgentWithOverrides('# Base', null)).toBe('# Base');
  });

  it('기본 .md가 없어도 동작한다', () => {
    const overrides = [{ source: 'project', content: '프로젝트 피드백' }];
    const merged = mergeAgentWithOverrides(null, overrides);
    expect(merged).toContain('프로젝트 피드백');
  });

  it('빈 content는 건너뛴다', () => {
    const overrides = [
      { source: 'user', content: '' },
      { source: 'project', content: '유효한 피드백' },
    ];
    const merged = mergeAgentWithOverrides('# Base', overrides);
    expect(merged).not.toContain('사용자');
    expect(merged).toContain('유효한 피드백');
  });
});

// --- 크로스프로젝트 학습 ---

describe('aggregateCrossProjectFeedback', () => {
  const makeProject = (roleId, issues) => ({
    team: [{ roleId }],
    tasks: [
      {
        id: 't1',
        assignee: roleId,
        reviews: [{ issues }],
      },
    ],
  });

  it('3회 이상 반복된 카테고리를 패턴으로 추출한다', () => {
    const projects = [
      makeProject('backend', [
        { severity: 'critical', category: 'security', description: 'SQL injection' },
      ]),
      makeProject('backend', [
        { severity: 'critical', category: 'security', description: 'XSS 취약점' },
      ]),
      makeProject('backend', [
        { severity: 'important', category: 'security', description: '인증 누락' },
      ]),
    ];
    const result = aggregateCrossProjectFeedback('backend', projects);
    expect(result.patterns.length).toBe(1);
    expect(result.patterns[0].category).toBe('security');
    expect(result.patterns[0].count).toBe(3);
    expect(result.totalProjects).toBe(3);
  });

  it('3회 미만은 패턴에서 제외한다', () => {
    const projects = [
      makeProject('backend', [
        { severity: 'critical', category: 'security', description: '이슈1' },
      ]),
      makeProject('backend', [
        { severity: 'critical', category: 'security', description: '이슈2' },
      ]),
    ];
    const result = aggregateCrossProjectFeedback('backend', projects);
    expect(result.patterns.length).toBe(0);
  });

  it('빈 입력을 처리한다', () => {
    expect(aggregateCrossProjectFeedback('', []).patterns).toEqual([]);
    expect(aggregateCrossProjectFeedback(null, []).patterns).toEqual([]);
    expect(aggregateCrossProjectFeedback('backend', null).patterns).toEqual([]);
  });

  it('해당 역할이 없는 프로젝트는 건너뛴다', () => {
    const projects = [
      makeProject('frontend', [
        { severity: 'critical', category: 'security', description: '이슈' },
      ]),
    ];
    const result = aggregateCrossProjectFeedback('backend', projects);
    expect(result.patterns).toEqual([]);
  });

  it('examples는 최대 3개까지 수집한다', () => {
    const projects = Array.from({ length: 5 }, () =>
      makeProject('backend', [
        { severity: 'critical', category: 'build', description: '빌드 실패' },
      ]),
    );
    const result = aggregateCrossProjectFeedback('backend', projects);
    expect(result.patterns[0].examples.length).toBe(3);
  });
});

describe('formatCrossProjectPatterns', () => {
  it('패턴을 마크다운으로 포맷팅한다', () => {
    const patterns = [
      { category: 'security', count: 5, examples: ['SQL injection', 'XSS'] },
      { category: 'build', count: 3, examples: ['타입 오류'] },
    ];
    const result = formatCrossProjectPatterns(patterns);
    expect(result).toContain('반복 패턴 주의');
    expect(result).toContain('security');
    expect(result).toContain('5회');
    expect(result).toContain('SQL injection');
  });

  it('빈 패턴은 빈 문자열을 반환한다', () => {
    expect(formatCrossProjectPatterns([])).toBe('');
    expect(formatCrossProjectPatterns(null)).toBe('');
  });
});
