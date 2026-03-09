import { describe, it, expect } from 'vitest';
import {
  buildOnboardingData,
  extractCustomRules,
  renderOnboardingFiles,
} from '../scripts/lib/core/onboarding-generator.js';

describe('onboarding-generator', () => {
  describe('extractCustomRules', () => {
    it('공통 규칙은 제외하고 역할 고유 규칙만 반환한다', () => {
      const coreRules = {
        security: ['No hardcoded API keys'],
        codeStyle: ['Functions: max 50 lines'],
        docWriting: ['명확하고 간결한 문장 사용'],
        issueManagement: ['우선순위 명시'],
      };

      const result = extractCustomRules(coreRules);

      expect(result).toEqual([
        { title: 'docWriting', rules: ['명확하고 간결한 문장 사용'] },
        { title: 'issueManagement', rules: ['우선순위 명시'] },
      ]);
    });

    it('공통 규칙만 있으면 빈 배열을 반환한다', () => {
      const coreRules = {
        security: ['rule1'],
        codeStyle: ['rule2'],
      };
      expect(extractCustomRules(coreRules)).toEqual([]);
    });

    it('빈 coreRules이면 빈 배열을 반환한다', () => {
      expect(extractCustomRules({})).toEqual([]);
      expect(extractCustomRules(undefined)).toEqual([]);
    });
  });

  describe('buildOnboardingData', () => {
    it('단일 역할 프리셋으로 데이터를 생성한다', () => {
      const preset = {
        name: 'developer',
        displayName: '개발자',
        description: '소프트웨어 개발자',
        roleDescription: '소프트웨어 개발',
        workflowSteps: ['기획', 'TDD', '구현'],
        agents: [{ template: 'code-reviewer-kr', config: { model: 'sonnet' } }],
        skills: ['tdd-workflow'],
        commands: ['start'],
        orchestration: { enabled: true, steps: [] },
        coreRules: {
          security: ['No hardcoded API keys'],
          codeStyle: ['Functions: max 50 lines'],
          docWriting: ['명확한 문장'],
        },
        stackRules: [],
      };

      const data = buildOnboardingData(preset, {});

      expect(data.roleName).toBe('개발자');
      expect(data.roleDescription).toBe('소프트웨어 개발');
      expect(data.workflow).toEqual(['기획', 'TDD', '구현']);
      expect(data.coreRules.security).toEqual(['No hardcoded API keys']);
      expect(data.coreRules.codeStyle).toEqual(['Functions: max 50 lines']);
      expect(data.customRules).toEqual([{ title: 'docWriting', rules: ['명확한 문장'] }]);
      expect(data.skills).toEqual(['tdd-workflow']);
      expect(data.commands).toEqual(['start']);
    });

    it('stackName과 stackRules를 설정한다', () => {
      const preset = {
        name: 'developer',
        displayName: '개발자',
        roleDescription: '개발',
        workflowSteps: ['구현'],
        stackRules: ['Next.js App Router 사용'],
        coreRules: {},
      };

      const data = buildOnboardingData(preset, { stackName: 'Next.js + Supabase' });

      expect(data.stackName).toBe('Next.js + Supabase');
      expect(data.stackRules).toEqual(['Next.js App Router 사용']);
    });

    it('복수 역할 이름을 합성한다', () => {
      const preset = {
        name: 'developer',
        displayName: '개발자',
        roleDescription: '소프트웨어 개발',
        workflowSteps: ['기획'],
        coreRules: {},
      };

      const data = buildOnboardingData(preset, {
        roleNames: ['개발자', 'PM / 기획자'],
      });

      expect(data.roleName).toBe('개발자 + PM / 기획자');
    });

    it('roleNames가 1개이면 그대로 사용한다', () => {
      const preset = {
        displayName: '개발자',
        roleDescription: '개발',
        workflowSteps: [],
        coreRules: {},
      };

      const data = buildOnboardingData(preset, { roleNames: ['개발자'] });
      expect(data.roleName).toBe('개발자');
    });

    it('스택 미정이면 stackName/stackRules가 비어있다', () => {
      const preset = {
        displayName: '개발자',
        roleDescription: '개발',
        workflowSteps: [],
        coreRules: {},
        stackRules: [],
      };

      const data = buildOnboardingData(preset, {});

      expect(data.stackName).toBeUndefined();
      expect(data.stackRules).toEqual([]);
    });
  });

  describe('renderOnboardingFiles', () => {
    it('claudeMd와 coreRules 문자열을 반환한다', async () => {
      const data = {
        roleName: '개발자',
        roleDescription: '소프트웨어 개발',
        workflow: ['기획', 'TDD', '구현'],
        coreRules: {
          security: ['No hardcoded API keys'],
          codeStyle: ['Functions: max 50 lines'],
        },
        customRules: [],
        skills: ['tdd-workflow'],
        commands: ['start'],
        stackRules: [],
      };

      const result = await renderOnboardingFiles(data);

      expect(result.claudeMd).toContain('Claude Code Configuration');
      expect(result.claudeMd).toContain('개발자');
      expect(result.claudeMd).toContain('Security');
      expect(result.claudeMd).toContain('No hardcoded API keys');
      expect(result.claudeMd).toContain('Code Style');
      expect(result.claudeMd).toContain('tdd-workflow');

      expect(result.coreRules).toContain('Core Rules');
      expect(result.coreRules).toContain('No hardcoded API keys');
      expect(result.coreRules).toContain('Functions: max 50 lines');
    });

    it('역할 고유 규칙(customRules)을 렌더링한다', async () => {
      const data = {
        roleName: 'PM / 기획자',
        roleDescription: '기획',
        workflow: ['요구사항 분석'],
        coreRules: {},
        customRules: [{ title: 'docWriting', rules: ['명확하고 간결한 문장 사용'] }],
        skills: [],
        commands: [],
        stackRules: [],
      };

      const result = await renderOnboardingFiles(data);

      expect(result.claudeMd).toContain('docWriting');
      expect(result.claudeMd).toContain('명확하고 간결한 문장 사용');
      expect(result.coreRules).toContain('docWriting');
      expect(result.coreRules).toContain('명확하고 간결한 문장 사용');
    });

    it('stackRules가 있으면 Stack Rules 섹션을 렌더링한다', async () => {
      const data = {
        roleName: '개발자',
        roleDescription: '개발',
        workflow: ['구현'],
        coreRules: {},
        customRules: [],
        skills: [],
        commands: [],
        stackName: 'Next.js + Supabase',
        stackRules: ['Next.js App Router 사용'],
      };

      const result = await renderOnboardingFiles(data);

      expect(result.claudeMd).toContain('Stack: Next.js + Supabase');
      expect(result.claudeMd).toContain('Next.js App Router 사용');
    });

    it('skills/commands가 비어있으면 해당 섹션을 생략한다', async () => {
      const data = {
        roleName: '학생',
        roleDescription: '학습',
        workflow: ['학습'],
        coreRules: {},
        customRules: [],
        skills: [],
        commands: [],
        stackRules: [],
      };

      const result = await renderOnboardingFiles(data);

      expect(result.claudeMd).not.toContain('## Skills');
      expect(result.claudeMd).not.toContain('## Commands');
    });
  });
});
