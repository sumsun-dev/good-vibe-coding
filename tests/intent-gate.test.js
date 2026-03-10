/**
 * intent-gate — 의도 분류 + 상태 라우팅 단위 테스트
 */
import { describe, it, expect } from 'vitest';
import { classifyIntent, getStateRoute } from '../scripts/lib/core/intent-gate.js';

/** 테스트용 프로젝트 팩토리 */
function makeProject(overrides = {}) {
  return {
    id: 'test-proj-2025-01-abc123',
    name: '테스트 프로젝트',
    status: 'planning',
    mode: 'plan-execute',
    team: [{ roleId: 'cto' }, { roleId: 'backend' }, { roleId: 'qa' }],
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('classifyIntent', () => {
  // A. 프로젝트 없음
  describe('프로젝트 없을 때', () => {
    it('A1: null 입력 + 빈 배열 → create, hasExistingProjects: false', () => {
      const result = classifyIntent(null, []);
      expect(result.intent).toBe('create');
      expect(result.hasExistingProjects).toBe(false);
      expect(result.suggestedProject).toBeNull();
      expect(result.projects).toEqual([]);
    });

    it('A2: 텍스트 입력 + 빈 배열 → create', () => {
      const result = classifyIntent('봇 만들어줘', []);
      expect(result.intent).toBe('create');
      expect(result.hasExistingProjects).toBe(false);
    });

    it('A3: 재개 패턴 + 빈 배열 → create fallback', () => {
      const result = classifyIntent('이어서', []);
      expect(result.intent).toBe('create');
      expect(result.hasExistingProjects).toBe(false);
    });

    it('A4: 빈 문자열 + 빈 배열 → create', () => {
      const result = classifyIntent('', []);
      expect(result.intent).toBe('create');
      expect(result.hasExistingProjects).toBe(false);
    });
  });

  // B. create 의도
  describe('create 의도', () => {
    it('B1: "새 프로젝트" + planning 프로젝트 → create, hasExistingProjects: true', () => {
      const projects = [makeProject({ status: 'planning' })];
      const result = classifyIntent('새 프로젝트', projects);
      expect(result.intent).toBe('create');
      expect(result.hasExistingProjects).toBe(true);
      expect(result.projects).toHaveLength(1);
    });

    it('B2: "팀 만들어줘" + completed 프로젝트 → create, hasExistingProjects: true', () => {
      const projects = [makeProject({ status: 'completed' })];
      const result = classifyIntent('팀 만들어줘', projects);
      expect(result.intent).toBe('create');
      expect(result.hasExistingProjects).toBe(true);
    });
  });

  // C. resume 의도
  describe('resume 의도', () => {
    it('C1: "이어서" + planning 프로젝트 → resume, suggestedProject, route', () => {
      const projects = [makeProject({ status: 'planning' })];
      const result = classifyIntent('이어서', projects);
      expect(result.intent).toBe('resume');
      expect(result.suggestedProject).not.toBeNull();
      expect(result.suggestedProject.id).toBe('test-proj-2025-01-abc123');
      expect(result.route).not.toBeNull();
      expect(result.route.commands).toContain('discuss');
    });

    it('C2: "resume" + executing 프로젝트 → resume', () => {
      const projects = [makeProject({ status: 'executing' })];
      const result = classifyIntent('resume', projects);
      expect(result.intent).toBe('resume');
      expect(result.route.commands).toContain('execute');
    });

    it('C3: "계속하자" + 여러 프로젝트 → resume, 최신 프로젝트', () => {
      const projects = [
        makeProject({
          id: 'old',
          name: '오래된',
          status: 'planning',
          createdAt: '2025-01-01T00:00:00.000Z',
        }),
        makeProject({
          id: 'new',
          name: '최신',
          status: 'executing',
          createdAt: '2025-06-01T00:00:00.000Z',
        }),
      ];
      const result = classifyIntent('계속하자', projects);
      expect(result.intent).toBe('resume');
      expect(result.suggestedProject.id).toBe('new');
    });

    it('C4: "이어서" + completed만 → create fallback', () => {
      const projects = [makeProject({ status: 'completed' })];
      const result = classifyIntent('이어서', projects);
      expect(result.intent).toBe('create');
      expect(result.hasExistingProjects).toBe(true);
    });
  });

  // D. modify 의도
  describe('modify 의도', () => {
    it('D1: "수정해줘" + completed 프로젝트 → modify', () => {
      const projects = [makeProject({ status: 'completed' })];
      const result = classifyIntent('수정해줘', projects);
      expect(result.intent).toBe('modify');
      expect(result.suggestedProject).not.toBeNull();
      expect(result.route.commands).toContain('modify');
    });

    it('D2: "추가해줘" + planning만 → create fallback', () => {
      const projects = [makeProject({ status: 'planning' })];
      const result = classifyIntent('추가해줘', projects);
      expect(result.intent).toBe('create');
      expect(result.hasExistingProjects).toBe(true);
    });

    it('D3: "고쳐줘" + completed 2개 → modify, 최신 것', () => {
      const projects = [
        makeProject({
          id: 'old-c',
          name: '이전 완료',
          status: 'completed',
          createdAt: '2025-01-01T00:00:00.000Z',
        }),
        makeProject({
          id: 'new-c',
          name: '최근 완료',
          status: 'completed',
          createdAt: '2025-06-01T00:00:00.000Z',
        }),
      ];
      const result = classifyIntent('고쳐줘', projects);
      expect(result.intent).toBe('modify');
      expect(result.suggestedProject.id).toBe('new-c');
    });
  });

  // E. status 의도
  describe('status 의도', () => {
    it('E1: "상태 알려줘" + executing 프로젝트 → status', () => {
      const projects = [makeProject({ status: 'executing' })];
      const result = classifyIntent('상태 알려줘', projects);
      expect(result.intent).toBe('status');
      expect(result.suggestedProject).not.toBeNull();
      expect(result.route).toBeNull();
    });

    it('E2: "어디까지?" + 프로젝트 없음 → create fallback', () => {
      const result = classifyIntent('어디까지?', []);
      expect(result.intent).toBe('create');
    });
  });

  // F. 패턴 매칭 없음 fallback
  describe('패턴 없음 fallback', () => {
    it('F1: "날씨 봇" + planning 프로젝트 → create (새 프로젝트 설명으로 추정)', () => {
      const projects = [makeProject({ status: 'planning' })];
      const result = classifyIntent('날씨 봇', projects);
      expect(result.intent).toBe('create');
      expect(result.hasExistingProjects).toBe(true);
    });

    it('F2: "날씨 봇" + completed만 → create', () => {
      const projects = [makeProject({ status: 'completed' })];
      const result = classifyIntent('날씨 봇', projects);
      expect(result.intent).toBe('create');
    });

    it('F3: "날씨 봇" + 프로젝트 없음 → create', () => {
      const result = classifyIntent('날씨 봇', []);
      expect(result.intent).toBe('create');
    });
  });

  // H. projects 요약 검증
  describe('projects 요약', () => {
    it('H1: 요약에 id, name, status, mode, teamSize, createdAt만 포함', () => {
      const projects = [makeProject()];
      const result = classifyIntent(null, projects);
      const p = result.projects[0];
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('status');
      expect(p).toHaveProperty('mode');
      expect(p).toHaveProperty('teamSize');
      expect(p).toHaveProperty('createdAt');
      expect(p).not.toHaveProperty('team');
      expect(p).not.toHaveProperty('prd');
    });

    it('H2: 최대 10개 제한', () => {
      const projects = Array.from({ length: 15 }, (_, i) =>
        makeProject({ id: `proj-${i}`, name: `프로젝트 ${i}` }),
      );
      const result = classifyIntent(null, projects);
      expect(result.projects.length).toBeLessThanOrEqual(10);
    });
  });

  // I. 엣지 케이스
  describe('엣지 케이스', () => {
    it('I1: undefined 입력 → create', () => {
      const result = classifyIntent(undefined, []);
      expect(result.intent).toBe('create');
    });

    it('I2: 공백만 입력 → create', () => {
      const result = classifyIntent('   ', []);
      expect(result.intent).toBe('create');
    });
  });
});

describe('getStateRoute', () => {
  it('G1: created → null (유령 상태 제거)', () => {
    const route = getStateRoute('created');
    expect(route).toBeNull();
  });

  it('G2: planning → discuss, approve', () => {
    const route = getStateRoute('planning');
    expect(route.commands).toContain('discuss');
    expect(route.commands).toContain('approve');
  });

  it('G3: approved → execute', () => {
    const route = getStateRoute('approved');
    expect(route.commands).toContain('execute');
  });

  it('G4: executing → execute', () => {
    const route = getStateRoute('executing');
    expect(route.commands).toContain('execute');
  });

  it('G5: reviewing → execute', () => {
    const route = getStateRoute('reviewing');
    expect(route.commands).toContain('execute');
  });

  it('G6: completed → modify, report', () => {
    const route = getStateRoute('completed');
    expect(route.commands).toContain('modify');
    expect(route.commands).toContain('report');
  });

  it('G7: 미정의 상태 → null', () => {
    expect(getStateRoute('unknown')).toBeNull();
  });
});
