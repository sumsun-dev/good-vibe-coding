import { describe, it, expect } from 'vitest';
import {
  buildDynamicRolePrompt,
  parseDynamicRoles,
  buildDynamicAgentMarkdown,
  validateDynamicRole,
} from '../scripts/lib/agent/dynamic-role-designer.js';

// --- buildDynamicRolePrompt ---

describe('buildDynamicRolePrompt', () => {
  it('프로젝트 설명과 기존 역할을 포함한다', () => {
    const prompt = buildDynamicRolePrompt(
      'PG사 결제 연동 서비스',
      ['cto', 'backend', 'qa'],
    );

    expect(prompt).toContain('PG사 결제 연동 서비스');
    expect(prompt).toContain('cto');
    expect(prompt).toContain('backend');
    expect(prompt).toContain('qa');
  });

  it('codebaseInfo가 있으면 기술 스택 정보를 포함한다', () => {
    const prompt = buildDynamicRolePrompt(
      '서비스 구현',
      ['cto'],
      { techStack: ['node', 'react'], fileStructure: 'src/ (10)' },
    );

    expect(prompt).toContain('node');
    expect(prompt).toContain('react');
    expect(prompt).toContain('src/ (10)');
  });

  it('빈 설명이면 빈 문자열을 반환한다', () => {
    expect(buildDynamicRolePrompt('', [])).toBe('');
    expect(buildDynamicRolePrompt(null, [])).toBe('');
  });
});

// --- parseDynamicRoles ---

describe('parseDynamicRoles', () => {
  it('JSON 배열을 파싱하고 dynamic: true를 자동 추가한다', () => {
    const raw = JSON.stringify([
      {
        roleId: 'payment-specialist',
        displayName: 'Payment Specialist',
        category: 'engineering',
        description: 'PG사 연동 전문가',
        skills: ['payment', 'stripe'],
        workDomains: ['payment', 'api'],
        reviewDomains: ['payment', 'security'],
        discussionPriority: 4,
        model: 'sonnet',
      },
    ]);

    const result = parseDynamicRoles(raw);

    expect(result).toHaveLength(1);
    expect(result[0].dynamic).toBe(true);
    expect(result[0].roleId).toMatch(/^dynamic-/);
    expect(result[0].displayName).toBe('Payment Specialist');
  });

  it('roleId에 dynamic- prefix가 없으면 자동 추가한다', () => {
    const raw = JSON.stringify([{ roleId: 'ml-engineer', displayName: 'ML' }]);
    const result = parseDynamicRoles(raw);

    expect(result[0].roleId).toBe('dynamic-ml-engineer');
  });

  it('roleId에 이미 dynamic- prefix가 있으면 중복 추가하지 않는다', () => {
    const raw = JSON.stringify([{ roleId: 'dynamic-ml-engineer', displayName: 'ML' }]);
    const result = parseDynamicRoles(raw);

    expect(result[0].roleId).toBe('dynamic-ml-engineer');
  });

  it('빈 입력이면 빈 배열을 반환한다', () => {
    expect(parseDynamicRoles('')).toEqual([]);
    expect(parseDynamicRoles(null)).toEqual([]);
  });
});

// --- buildDynamicAgentMarkdown ---

describe('buildDynamicAgentMarkdown', () => {
  it('frontmatter 형식의 마크다운을 생성한다', () => {
    const role = {
      roleId: 'dynamic-payment',
      displayName: 'Payment Specialist',
      category: 'engineering',
      description: 'PG사 연동 전문가',
      skills: ['payment', 'stripe'],
      model: 'sonnet',
    };

    const md = buildDynamicAgentMarkdown(role);

    expect(md).toContain('---');
    expect(md).toContain('displayName: Payment Specialist');
    expect(md).toContain('category: engineering');
    expect(md).toContain('model: sonnet');
    expect(md).toContain('PG사 연동 전문가');
  });
});

// --- validateDynamicRole ---

describe('validateDynamicRole', () => {
  const validRole = {
    roleId: 'dynamic-test',
    displayName: 'Test Role',
    category: 'engineering',
    workDomains: ['api'],
  };

  it('유효한 역할이면 true를 반환한다', () => {
    expect(validateDynamicRole(validRole)).toBe(true);
  });

  it('roleId 누락 시 에러를 던진다', () => {
    // eslint-disable-next-line no-unused-vars
    const { roleId: _roleId, ...rest } = validRole;
    expect(() => validateDynamicRole(rest)).toThrow();
  });

  it('displayName 누락 시 에러를 던진다', () => {
    // eslint-disable-next-line no-unused-vars
    const { displayName: _displayName, ...rest } = validRole;
    expect(() => validateDynamicRole(rest)).toThrow();
  });

  it('category 누락 시 에러를 던진다', () => {
    // eslint-disable-next-line no-unused-vars
    const { category: _category, ...rest } = validRole;
    expect(() => validateDynamicRole(rest)).toThrow();
  });

  it('workDomains 누락 시 에러를 던진다', () => {
    // eslint-disable-next-line no-unused-vars
    const { workDomains: _workDomains, ...rest } = validRole;
    expect(() => validateDynamicRole(rest)).toThrow();
  });
});
