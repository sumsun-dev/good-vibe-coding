import { describe, it, expect } from 'vitest';
import {
  buildOnboardingData,
  extractCustomRules,
  renderOnboardingFiles,
  buildGlobalClaudeMdData,
  renderGlobalClaudeMd,
  renderGlobalCoreRules,
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

    it('options.team이 mergedPreset.team보다 우선한다', () => {
      const preset = {
        displayName: '개발자',
        roleDescription: '개발',
        workflowSteps: [],
        coreRules: {},
        team: [{ roleId: 'cto', displayName: 'CTO' }],
      };
      const optionTeam = [
        { roleId: 'cto', displayName: 'CTO' },
        { roleId: 'frontend', displayName: 'Frontend' },
      ];

      const data = buildOnboardingData(preset, { team: optionTeam });
      expect(data.team).toEqual(optionTeam);
    });

    it('options.team이 없으면 mergedPreset.team을 사용한다', () => {
      const preset = {
        displayName: '개발자',
        roleDescription: '개발',
        workflowSteps: [],
        coreRules: {},
        team: [{ roleId: 'cto', displayName: 'CTO' }],
      };

      const data = buildOnboardingData(preset, {});
      expect(data.team).toEqual([{ roleId: 'cto', displayName: 'CTO' }]);
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

  describe('buildGlobalClaudeMdData', () => {
    it('auto 모드에서 전체 도구 목록을 반환한다', () => {
      const data = buildGlobalClaudeMdData({ autoApproveMode: 'auto' });

      expect(data.autoApprove).toBe(true);
      expect(data.autoApproveTools).toContain('Read');
      expect(data.autoApproveTools).toContain('Write');
      expect(data.autoApproveTools).toContain('Edit');
      expect(data.autoApproveTools).toContain('Bash(node * cli.js *)');
      expect(data.autoApproveTools).toHaveLength(9);
    });

    it('selective 모드에서 읽기/검색/CLI만 반환한다', () => {
      const data = buildGlobalClaudeMdData({ autoApproveMode: 'selective' });

      expect(data.autoApprove).toBe(true);
      expect(data.autoApproveTools).toContain('Read');
      expect(data.autoApproveTools).toContain('Glob');
      expect(data.autoApproveTools).toContain('Grep');
      expect(data.autoApproveTools).toContain('Bash(node * cli.js *)');
      expect(data.autoApproveTools).not.toContain('Write');
      expect(data.autoApproveTools).toHaveLength(4);
    });

    it('manual 모드에서 CLI만 반환한다', () => {
      const data = buildGlobalClaudeMdData({ autoApproveMode: 'manual' });

      expect(data.autoApprove).toBe(true);
      expect(data.autoApproveTools).toEqual(['Bash(node * cli.js *)']);
    });

    it('none 모드에서 autoApprove가 false이고 autoApproveTools가 빈 배열이다', () => {
      const data = buildGlobalClaudeMdData({ autoApproveMode: 'none' });

      expect(data.autoApprove).toBe(false);
      expect(data.autoApproveTools).toEqual([]);
    });

    it('기본값은 manual 모드이다', () => {
      const data = buildGlobalClaudeMdData();

      expect(data.autoApprove).toBe(true);
      expect(data.autoApproveTools).toEqual(['Bash(node * cli.js *)']);
    });

    it('알 수 없는 모드는 manual로 fallback한다', () => {
      const data = buildGlobalClaudeMdData({ autoApproveMode: 'unknown' });

      expect(data.autoApprove).toBe(true);
      expect(data.autoApproveTools).toEqual(['Bash(node * cli.js *)']);
    });
  });

  describe('renderGlobalClaudeMd', () => {
    it('글로벌 CLAUDE.md 문자열을 반환한다 (메타 설정만, 코딩 규칙 없음)', async () => {
      const data = buildGlobalClaudeMdData({ autoApproveMode: 'auto' });
      const result = await renderGlobalClaudeMd(data);

      expect(result).toContain('# Claude Code Configuration');
      expect(result).toContain('## Language');
      expect(result).toContain('## Model Selection');
      expect(result).toContain('## Working Mode');
      expect(result).toContain('## Memory');
      expect(result).toContain('## Rules');
      expect(result).toContain('rules/core.md');
    });

    it('역할/팀/스택/코딩규칙 섹션이 포함되지 않는다', async () => {
      const data = buildGlobalClaudeMdData({ autoApproveMode: 'auto' });
      const result = await renderGlobalClaudeMd(data);

      expect(result).not.toContain('## 역할');
      expect(result).not.toContain('## Your Team');
      expect(result).not.toContain('## Stack:');
      expect(result).not.toContain('## Stack Rules');
      expect(result).not.toContain('## Security (CRITICAL)');
      expect(result).not.toContain('## Code Style');
      expect(result).not.toContain('## Testing');
      expect(result).not.toContain('## Extensibility');
    });

    it('auto 모드에서 Auto-Approve 섹션에 전체 도구를 렌더링한다', async () => {
      const data = buildGlobalClaudeMdData({ autoApproveMode: 'auto' });
      const result = await renderGlobalClaudeMd(data);

      expect(result).toContain('### Auto-Approve Tools');
      expect(result).toContain('- Read');
      expect(result).toContain('- Write');
      expect(result).toContain('- Edit');
      expect(result).toContain('- Bash(node * cli.js *)');
    });

    it('none 모드에서 Auto-Approve 섹션이 생략된다', async () => {
      const data = buildGlobalClaudeMdData({ autoApproveMode: 'none' });
      const result = await renderGlobalClaudeMd(data);

      expect(result).not.toContain('### Auto-Approve Tools');
    });

    it('코딩 규칙은 rules/core.md에 포함된다 (글로벌 CLAUDE.md에는 참조만)', async () => {
      const coreRules = await renderGlobalCoreRules();

      expect(coreRules).toContain('# Core Rules');
      expect(coreRules).toContain('## Security (CRITICAL)');
      expect(coreRules).toContain('## Code Style');
      expect(coreRules).toContain('## Git');
      expect(coreRules).toContain('## Documentation');
      expect(coreRules).toContain('## Error Handling');
      expect(coreRules).toContain('## Testing');
      expect(coreRules).toContain('## Extensibility');
      expect(coreRules).toContain('README.md');
      expect(coreRules).toContain('ERROR_LOG.md');
    });
  });
});
