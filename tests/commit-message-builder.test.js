import { describe, it, expect } from 'vitest';
import {
  resolveCommitType,
  buildCoAuthoredBy,
  buildCommitBody,
  buildCommitMessage,
} from '../scripts/lib/project/commit-message-builder.js';

describe('commit-message-builder', () => {
  describe('resolveCommitType', () => {
    it('Phase 1이면 feat를 반환한다', () => {
      const tasks = [{ assignedTo: 'backend', title: 'API 구현' }];
      expect(resolveCommitType(tasks, 1, 3)).toBe('feat');
    });

    it('fix 키워드가 포함된 태스크가 있으면 fix를 반환한다', () => {
      const tasks = [
        { assignedTo: 'backend', title: '버그 수정' },
        { assignedTo: 'frontend', title: 'UI fix' },
      ];
      expect(resolveCommitType(tasks, 2, 3)).toBe('fix');
    });

    it('QA/test 태스크만 있으면 test를 반환한다', () => {
      const tasks = [{ assignedTo: 'qa', title: '통합 테스트 작성' }];
      expect(resolveCommitType(tasks, 2, 3)).toBe('test');
    });

    it('마지막 Phase이면 chore를 반환한다', () => {
      const tasks = [{ assignedTo: 'devops', title: '배포 설정' }];
      expect(resolveCommitType(tasks, 3, 3)).toBe('chore');
    });

    it('리팩토링 태스크가 있으면 refactor를 반환한다', () => {
      const tasks = [{ assignedTo: 'fullstack', title: '코드 리팩토링' }];
      expect(resolveCommitType(tasks, 2, 3)).toBe('refactor');
    });

    it('빈 태스크 배열이면 feat를 반환한다', () => {
      expect(resolveCommitType([], 1, 1)).toBe('feat');
    });
  });

  describe('buildCoAuthoredBy', () => {
    it('팀원 기반으로 Co-authored-by 라인을 생성한다', () => {
      const tasks = [{ assignedTo: 'backend' }, { assignedTo: 'cto' }];
      const team = [
        { roleId: 'backend', name: 'Backend Developer' },
        { roleId: 'cto', name: 'CTO' },
      ];
      const lines = buildCoAuthoredBy(tasks, team);
      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe('Co-authored-by: backend (AI) <noreply@good-vibe.dev>');
      expect(lines[1]).toBe('Co-authored-by: cto (AI) <noreply@good-vibe.dev>');
    });

    it('중복 역할을 제거한다', () => {
      const tasks = [
        { assignedTo: 'backend' },
        { assignedTo: 'backend' },
        { assignedTo: 'frontend' },
      ];
      const team = [{ roleId: 'backend' }, { roleId: 'frontend' }];
      const lines = buildCoAuthoredBy(tasks, team);
      expect(lines).toHaveLength(2);
    });

    it('빈 태스크면 빈 배열을 반환한다', () => {
      expect(buildCoAuthoredBy([], [])).toEqual([]);
    });

    it('팀이 없어도 태스크의 assignedTo로 생성한다', () => {
      const tasks = [{ assignedTo: 'backend' }];
      const lines = buildCoAuthoredBy(tasks, []);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('backend');
    });
  });

  describe('buildCommitBody', () => {
    it('태스크 요약을 포함한다', () => {
      const tasks = [
        { id: 'task-1', assignedTo: 'backend', title: 'Express 라우터 구현' },
        { id: 'task-2', assignedTo: 'cto', title: '아키텍처 설계' },
      ];
      const body = buildCommitBody(tasks);
      expect(body).toContain('task-1');
      expect(body).toContain('Express 라우터 구현');
      expect(body).toContain('task-2');
    });

    it('품질 게이트 정보를 포함한다', () => {
      const tasks = [{ id: 'task-1', assignedTo: 'backend', title: 'API' }];
      const qualityGate = {
        passed: true,
        criticalCount: 0,
        importantCount: 2,
        reviews: [{}, {}, {}],
      };
      const body = buildCommitBody(tasks, qualityGate);
      expect(body).toContain('3 reviews');
      expect(body).toContain('0 critical');
    });

    it('품질 게이트가 없어도 동작한다', () => {
      const tasks = [{ id: 'task-1', assignedTo: 'be', title: 'X' }];
      const body = buildCommitBody(tasks);
      expect(body).toContain('task-1');
      expect(body).not.toContain('Quality');
    });

    it('빈 태스크면 빈 문자열을 반환한다', () => {
      expect(buildCommitBody([])).toBe('');
    });
  });

  describe('buildCommitMessage', () => {
    it('conventional commit 형식의 전체 메시지를 생성한다', () => {
      const options = {
        phase: 1,
        tasks: [
          { id: 'task-1', assignedTo: 'backend', title: 'API 라우터 구현' },
          { id: 'task-2', assignedTo: 'cto', title: '아키텍처 설계' },
        ],
        project: { name: '팀 관리 웹앱' },
        team: [{ roleId: 'backend' }, { roleId: 'cto' }],
        totalPhases: 3,
      };

      const message = buildCommitMessage(options);
      expect(message).toMatch(/^feat\(phase-1\):/);
      expect(message).toContain('Co-authored-by:');
    });

    it('scope에 phase 번호를 포함한다', () => {
      const message = buildCommitMessage({
        phase: 2,
        tasks: [{ id: 't1', assignedTo: 'qa', title: '테스트' }],
        project: { name: 'test' },
        team: [],
        totalPhases: 3,
      });
      expect(message).toMatch(/^test\(phase-2\):/);
    });

    it('품질 게이트 정보를 포함할 수 있다', () => {
      const message = buildCommitMessage({
        phase: 1,
        tasks: [{ id: 't1', assignedTo: 'backend', title: 'API' }],
        project: { name: 'test' },
        team: [{ roleId: 'backend' }],
        totalPhases: 1,
        qualityGate: { passed: true, criticalCount: 0, importantCount: 1, reviews: [{}] },
      });
      expect(message).toContain('Quality');
    });

    it('빈 태스크/팀으로도 동작한다', () => {
      const message = buildCommitMessage({
        phase: 1,
        tasks: [],
        project: { name: 'empty' },
        team: [],
        totalPhases: 1,
      });
      expect(message).toMatch(/^feat\(phase-1\):/);
    });

    it('태스크 제목으로 요약 라인을 생성한다', () => {
      const message = buildCommitMessage({
        phase: 1,
        tasks: [
          { id: 't1', assignedTo: 'backend', title: 'API 라우터 구현' },
          { id: 't2', assignedTo: 'frontend', title: 'UI 컴포넌트' },
        ],
        project: { name: 'test' },
        team: [],
        totalPhases: 2,
      });
      // 첫 줄에 요약이 있어야 함
      const firstLine = message.split('\n')[0];
      expect(firstLine.length).toBeLessThanOrEqual(72);
    });
  });
});
